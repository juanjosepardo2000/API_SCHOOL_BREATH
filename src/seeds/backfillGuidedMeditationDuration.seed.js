const { execFile } = require('child_process');
const { promisify } = require('util');
const mongoose = require('mongoose');
const Music = require('../models/music.model');
const Category = require('../models/categories.model');
require('dotenv').config();

const execFileAsync = promisify(execFile);
const FFPROBE_TIMEOUT_MS = 20000;

const parseArgValue = (argv, name, fallback) => {
  const arg = argv.find((item) => item.startsWith(`${name}=`));
  if (!arg) return fallback;
  const [, value] = arg.split('=');
  return value ?? fallback;
};

const parseArgs = (argv) => {
  const apply = argv.includes('--apply');
  const force = argv.includes('--force');
  const limitRaw = parseArgValue(argv, '--limit', '0');
  const categoryName = parseArgValue(argv, '--category', 'guided meditation');
  const categoryId = parseArgValue(argv, '--category-id', '');

  const limit = Number.parseInt(limitRaw, 10);
  return {
    apply,
    force,
    categoryId,
    categoryName,
    limit: Number.isNaN(limit) || limit < 0 ? 0 : limit,
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

const buildQuery = (categoryId, force) => {
  const query = { categories: categoryId };

  if (!force) {
    query.$or = [
      { duration: { $exists: false } },
      { duration: null },
      { duration: { $lte: 0 } },
    ];
  }

  return query;
};

async function backfillGuidedMeditationDuration() {
  const { apply, force, limit, categoryName, categoryId } = parseArgs(process.argv.slice(2));
  const mongoUri = getMongoUri();

  if (!mongoUri) {
    console.error('❌ Missing MongoDB URI. Set MONGO_URI (and/or MONGO_URI_DEV).');
    process.exit(1);
  }

  const modeLabel = apply ? 'APPLY' : 'DRY-RUN';
  console.log(`🚀 Guided meditation duration backfill (${modeLabel})`);
  console.log(
    `⚙️  Options: force=${force}, limit=${limit || 'all'}, category="${categoryName}", categoryId="${categoryId || 'auto'}"`
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    let category = null;
    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        console.error(`❌ Invalid category id: ${categoryId}`);
        process.exit(1);
      }
      category = await Category.findById(categoryId).select('_id name slug');
    } else {
      category = await Category.findOne({
        $or: [
          { name: new RegExp(`^${categoryName}$`, 'i') },
          { slug: new RegExp(`^${categoryName.replace(/\s+/g, '-')}$`, 'i') },
        ],
      }).select('_id name slug');
    }

    if (!category) {
      console.error(
        `❌ Category not found: ${categoryId || categoryName}`
      );
      process.exit(1);
    }

    console.log(
      `📂 Category resolved: ${category.name} (${category.slug}) [${category._id}]`
    );

    const query = buildQuery(category._id, force);
    const matchingCount = await Music.countDocuments(query);
    console.log(`🔎 Matching records before limit: ${matchingCount}`);

    let cursorQuery = Music.find(query)
      .select('_id name audioFilename duration')
      .sort({ createdAt: 1 });

    if (limit > 0) {
      cursorQuery = cursorQuery.limit(limit);
    }

    const tracks = await cursorQuery;

    if (!tracks.length) {
      console.log('ℹ️ Nothing to backfill.');
      return;
    }

    console.log(`📝 Found ${tracks.length} track(s) to process.`);

    for (const track of tracks) {
      const id = String(track._id);
      const name = track.name || '(untitled)';

      if (!track.audioFilename) {
        console.log(`⏭️  ${id} ${name} -> missing audioFilename`);
        skipped += 1;
        continue;
      }

      try {
        const duration = await getDurationFromAudioUrl(track.audioFilename);

        if (!apply) {
          console.log(`🔍 ${id} ${name} -> duration ${duration}s`);
          updated += 1;
          continue;
        }

        await Music.updateOne(
          { _id: track._id },
          { $set: { duration } }
        );

        console.log(`✅ ${id} ${name} -> saved duration ${duration}s`);
        updated += 1;
      } catch (error) {
        console.log(
          `❌ ${id} ${name} -> ${error instanceof Error ? error.message : 'duration read failed'}`
        );
        failed += 1;
      }
    }

    console.log('\n📊 Summary');
    console.log(`   Updated/Prepared: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
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
  backfillGuidedMeditationDuration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { backfillGuidedMeditationDuration };
