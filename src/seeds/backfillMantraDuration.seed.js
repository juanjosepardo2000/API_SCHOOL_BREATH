const { execFile } = require('child_process');
const { promisify } = require('util');
const mongoose = require('mongoose');
const Mantra = require('../models/mantra.model');
require('dotenv').config();

const execFileAsync = promisify(execFile);
const FFPROBE_TIMEOUT_MS = 25000;

const parseArgValue = (argv, name, fallback) => {
  const arg = argv.find((item) => item.startsWith(`${name}=`));
  if (!arg) return fallback;
  const [, value] = arg.split('=');
  return value ?? fallback;
};

const parseArgs = (argv) => {
  const apply = argv.includes('--apply');
  const includeInactive = argv.includes('--include-inactive');
  const limitRaw = parseArgValue(argv, '--limit', '0');
  const minDiffRaw = parseArgValue(argv, '--min-diff', '3');

  const limit = Number.parseInt(limitRaw, 10);
  const minDiffSeconds = Number.parseInt(minDiffRaw, 10);

  return {
    apply,
    includeInactive,
    limit: Number.isNaN(limit) || limit < 0 ? 0 : limit,
    minDiffSeconds:
      Number.isNaN(minDiffSeconds) || minDiffSeconds < 0 ? 3 : minDiffSeconds,
  };
};

const getMongoUri = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.MONGO_URI;
  }
  return process.env.MONGO_URI_DEV || process.env.MONGO_URI;
};

const getDurationFromAudioUrl = async (audioUrl) => {
  const args = [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    audioUrl,
  ];

  const { stdout } = await execFileAsync('ffprobe', args, {
    timeout: FFPROBE_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });

  const parsed = Number.parseFloat(String(stdout).trim());
  const rounded = Math.round(parsed);

  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new Error(`Invalid duration output: ${stdout}`);
  }

  return rounded;
};

async function backfillMantraDuration() {
  const { apply, includeInactive, limit, minDiffSeconds } = parseArgs(
    process.argv.slice(2)
  );
  const mongoUri = getMongoUri();

  if (!mongoUri) {
    console.error('❌ Missing MongoDB URI. Set MONGO_URI (and/or MONGO_URI_DEV).');
    process.exit(1);
  }

  const modeLabel = apply ? 'APPLY' : 'DRY-RUN';
  console.log(`🚀 Mantra duration backfill (${modeLabel})`);
  console.log(
    `⚙️  Options: includeInactive=${includeInactive}, limit=${limit || 'all'}, minDiffSeconds=${minDiffSeconds}`
  );

  let scanned = 0;
  let prepared = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const query = {
      audioUrl: { $exists: true, $ne: '' },
    };
    if (!includeInactive) {
      query.isActive = true;
    }

    let cursorQuery = Mantra.find(query)
      .select('_id title duration audioUrl isActive')
      .sort({ createdAt: 1 });

    if (limit > 0) {
      cursorQuery = cursorQuery.limit(limit);
    }

    const mantras = await cursorQuery;

    if (!mantras.length) {
      console.log('ℹ️ No mantra records found for this query.');
      return;
    }

    console.log(`📝 Found ${mantras.length} mantra(s) to scan.`);

    for (const mantra of mantras) {
      scanned += 1;
      const id = String(mantra._id);
      const title = mantra.title || '(untitled)';
      const stored = Number.isFinite(mantra.duration)
        ? Math.round(mantra.duration)
        : 0;

      try {
        const actual = await getDurationFromAudioUrl(mantra.audioUrl);
        const diff = Math.abs(actual - stored);

        if (stored > 0 && diff < minDiffSeconds) {
          console.log(`⏭️  ${id} ${title} -> unchanged (${stored}s)`);
          skipped += 1;
          continue;
        }

        prepared += 1;

        if (!apply) {
          console.log(
            `🔍 ${id} ${title} -> ${stored || 0}s => ${actual}s (diff: ${actual - stored}s)`
          );
          continue;
        }

        await Mantra.updateOne(
          { _id: mantra._id },
          { $set: { duration: actual } }
        );
        console.log(
          `✅ ${id} ${title} -> saved ${actual}s (prev: ${stored || 0}s)`
        );
        updated += 1;
      } catch (error) {
        failed += 1;
        console.log(
          `❌ ${id} ${title} -> ${
            error instanceof Error ? error.message : 'duration read failed'
          }`
        );
      }
    }

    console.log('\n📊 Summary');
    console.log(`   Scanned: ${scanned}`);
    console.log(`   Prepared updates: ${prepared}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped (within diff): ${skipped}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Mode: ${modeLabel}`);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  backfillMantraDuration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { backfillMantraDuration };
