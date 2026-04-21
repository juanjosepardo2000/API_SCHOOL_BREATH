/**
 * migrateLevelsToChakra.js
 *
 * Syncs cached gamification fields (`levelName` and `league`) with the
 * currently active GamificationConfig so users immediately see the new names.
 *
 * Run:
 *   node src/seeds/migrateLevelsToChakra.js
 */

require('dotenv').config();

const { connectDB } = require('../configs/database');
const Gamification = require('../models/gamification.model');
const GamificationConfig = require('../models/gamificationConfig.model');
const { DEFAULT_CONFIG } = require('./gamificationConfig.seed');
const { computeLevel, computeLeague } = require('../services/gamification.service');

async function migrateLevelsToChakra() {
  await connectDB();

  const configDoc = await GamificationConfig.findOne({ isActive: true });
  const config = configDoc ? configDoc.toObject() : null;

  if (!config) {
    throw new Error(
      'No active gamification config found. Run: node src/seeds/gamificationConfig.seed.js'
    );
  }

  // Sync active config to canonical stage rules from seed.
  const canonicalLevels = (DEFAULT_CONFIG.levels || []).map((item) => ({
    level: item.level,
    name: item.name,
    minXP: item.minXP,
  }));
  const canonicalLeagues = (DEFAULT_CONFIG.leagues || []).map((item) => ({
    name: item.name,
    minLevel: item.minLevel,
    maxLevel: item.maxLevel,
  }));

  const levelsChanged = JSON.stringify(configDoc.levels) !== JSON.stringify(canonicalLevels);
  const leaguesChanged = JSON.stringify(configDoc.leagues) !== JSON.stringify(canonicalLeagues);
  const rawConfig = await GamificationConfig.collection.findOne(
    { _id: configDoc._id },
    { projection: { masteryXPPerStar: 1 } }
  );
  const hasPersistedMasteryField = Object.prototype.hasOwnProperty.call(rawConfig || {}, 'masteryXPPerStar');
  const masteryChanged = !hasPersistedMasteryField
    || (configDoc.masteryXPPerStar ?? null) !== (DEFAULT_CONFIG.masteryXPPerStar ?? null);

  if (levelsChanged) configDoc.levels = canonicalLevels;
  if (leaguesChanged) configDoc.leagues = canonicalLeagues;
  if (masteryChanged) {
    configDoc.masteryXPPerStar = DEFAULT_CONFIG.masteryXPPerStar;
    configDoc.markModified('masteryXPPerStar');
  }

  if (levelsChanged || leaguesChanged || masteryChanged) {
    await configDoc.save();
    console.log(`[Migration] Active config updated (levelsChanged=${levelsChanged}, leaguesChanged=${leaguesChanged}, masteryChanged=${masteryChanged})`);
  }

  const activeConfig = configDoc.toObject();

  const profiles = await Gamification.find({})
    .select('_id totalXP totalCalmPoints level levelName league')
    .lean();

  if (profiles.length === 0) {
    console.log('[Migration] No gamification profiles found. Nothing to migrate.');
    return;
  }

  const ops = [];
  let changed = 0;

  for (const profile of profiles) {
    const totalXP = (profile.totalXP ?? 0) > 0
      ? profile.totalXP
      : (profile.totalCalmPoints ?? 0);

    const levelData = computeLevel(totalXP, activeConfig.levels, activeConfig.masteryXPPerStar);
    const league = computeLeague(levelData.level, activeConfig.leagues);

    const needsUpdate =
      profile.level !== levelData.level ||
      profile.levelName !== levelData.levelName ||
      profile.league !== league ||
      profile.totalCalmPoints !== totalXP;

    if (!needsUpdate) continue;

    changed += 1;
    ops.push({
      updateOne: {
        filter: { _id: profile._id },
        update: {
          $set: {
            totalXP,
            totalCalmPoints: totalXP,
            level: levelData.level,
            levelName: levelData.levelName,
            league,
          },
        },
      },
    });
  }

  if (ops.length > 0) {
    await Gamification.bulkWrite(ops, { ordered: false });
  }

  console.log(`[Migration] Config levels synced: ${levelsChanged ? 'yes' : 'no'}`);
  console.log(`[Migration] Config leagues synced: ${leaguesChanged ? 'yes' : 'no'}`);
  console.log(`[Migration] Config masteryXPPerStar synced: ${masteryChanged ? 'yes' : 'no'}`);
  console.log(`[Migration] Profiles scanned: ${profiles.length}`);
  console.log(`[Migration] Profiles updated: ${changed}`);
}

if (require.main === module) {
  migrateLevelsToChakra()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migration] Failed:', err);
      process.exit(1);
    });
}

module.exports = { migrateLevelsToChakra };
