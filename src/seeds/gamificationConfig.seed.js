/**
 * gamificationConfig.seed.js
 *
 * Inserts the canonical gamification config document if it doesn't exist.
 * This document drives ALL XP rules, level thresholds, and league bands — no
 * hardcoded business logic in application code.
 *
 * Run standalone:
 *   node src/seeds/gamificationConfig.seed.js
 *
 * Or call seedGamificationConfig() from any bootstrap script.
 */

require('dotenv').config();

const { connectDB } = require('../configs/database');
const GamificationConfig = require('../models/gamificationConfig.model');

// ─── Canonical config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  version:  '2.1',
  isActive: true,

  // Stage = long-term identity based on Lifetime XP (never resets).
  // Stage 7 (Crown) is the ceiling — mastery stars take over beyond it.
  levels: [
    { level: 1, name: 'Root',       minXP: 0    },
    { level: 2, name: 'Sacral',     minXP: 350  },
    { level: 3, name: 'Solar',      minXP: 900  },
    { level: 4, name: 'Heart',      minXP: 1700 },
    { level: 5, name: 'Throat',     minXP: 2800 },
    { level: 6, name: 'Third Eye',  minXP: 4300 },
    { level: 7, name: 'Crown',      minXP: 6400 },
  ],

  // XP gap per mastery star after reaching Crown.
  masteryXPPerStar: 500,

  leagues: [
    { name: 'bronze', minLevel: 1, maxLevel: 2 },
    { name: 'silver', minLevel: 3, maxLevel: 4 },
    { name: 'gold',   minLevel: 5, maxLevel: 6 },
    { name: 'crown',  minLevel: 7, maxLevel: 7 },
  ],

  xpRules: {
    // Unlimited daily rewards: no cap by day and no session count limit.
    dailyCap:           null,
    maxSessionsPerDay:  null,
    minDurationSeconds: 60, // general minimum; morning_ritual uses duration tiers

    sessionTypes: {
      // base: 0 → controller uses morningRitualTiers for actual XP
      morning_ritual:    { base: 0,  minCompletionRatio: 0.8 },
      // base: 0 → controller uses technique level × 5 (capped at 30)
      breath_training:   { base: 0 },
      breathing_session: { base: 15, minCompletionRatio: 0.5 },
      // Journaling session types
      intention:         { base: 5  },
      gratitude:         { base: 10 },
    },

    // Duration-based XP tiers for morning_ritual.
    // The highest tier whose minSeconds ≤ durationSeconds is used.
    // Sessions below the first tier (< 540 s / 9 min) earn 0 XP.
    morningRitualTiers: [
      { label: 'Quick Practice', minSeconds: 540,  xp: 30 }, // 9 – 12 min
      { label: 'Self Care',      minSeconds: 720,  xp: 30 }, // 12 – 18 min
      { label: 'Expansion',      minSeconds: 1080, xp: 40 }, // 18 – 24 min
      { label: 'Ascension',      minSeconds: 1440, xp: 50 }, // 24 – 30 min
    ],

    bonuses: {
      // Streak milestones — one-time award on the day the milestone is reached
      streakMilestone7:   40,
      streakMilestone30:  120,
      // Awarded when a broken streak (≥ 1 prior day) is resumed after a gap
      returnAfterLapse:   15,
      // Awarded when practicing at a frozen technique level
      freezeLevelBonus:   3,
    },
  },

  techniqueMaxLevel:       6,
  streakFreezesPerWeek:    1,
  dailyStatsRetentionDays: 45,
};

// ─── Seed function ────────────────────────────────────────────────────────────

async function seedGamificationConfig() {
  const existing = await GamificationConfig.findOne({ version: DEFAULT_CONFIG.version });

  if (existing) {
    console.log(`[GamificationConfig] Config ${DEFAULT_CONFIG.version} already exists — skipping seed.`);
    return existing;
  }

  // Deactivate any previous active config so only one is active at a time
  await GamificationConfig.updateMany({ isActive: true }, { $set: { isActive: false } });

  const config = await GamificationConfig.create(DEFAULT_CONFIG);
  console.log(`[GamificationConfig] Config ${DEFAULT_CONFIG.version} seeded successfully.`);
  return config;
}

// ─── Standalone execution ─────────────────────────────────────────────────────

if (require.main === module) {
  connectDB()
    .then(() => seedGamificationConfig())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[GamificationConfig] Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seedGamificationConfig, DEFAULT_CONFIG };
