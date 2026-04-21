/**
 * updateGamificationConfig.js
 *
 * Migrates the active gamification config to v1.1.
 * Deactivates any prior version and creates (or updates) v1.1.
 *
 * Run once:
 *   node src/seeds/updateGamificationConfig.js
 */

require('dotenv').config();

const { connectDB } = require('../configs/database');
const { seedGamificationConfig, DEFAULT_CONFIG } = require('./gamificationConfig.seed');
const GamificationConfig = require('../models/gamificationConfig.model');

async function run() {
  await connectDB();

  // Deactivate all existing configs
  const deactivated = await GamificationConfig.updateMany({}, { $set: { isActive: false } });
  console.log(`[Migration] Deactivated ${deactivated.modifiedCount} config(s).`);

  // Remove old v1.1 if it exists (so seed re-creates with fresh values)
  await GamificationConfig.deleteOne({ version: DEFAULT_CONFIG.version });

  // Re-seed with the current DEFAULT_CONFIG
  await seedGamificationConfig();

  console.log('[Migration] Done. Active config is now v' + DEFAULT_CONFIG.version);
  process.exit(0);
}

run().catch((err) => {
  console.error('[Migration] Failed:', err);
  process.exit(1);
});
