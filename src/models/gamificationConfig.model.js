const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const levelEntrySchema = new mongoose.Schema({
  level: { type: Number, required: true },
  name:  { type: String, required: true },
  minXP: { type: Number, required: true },
}, { _id: false });

const leagueEntrySchema = new mongoose.Schema({
  name:     { type: String, required: true },
  minLevel: { type: Number, required: true },
  maxLevel: { type: Number, required: true },
}, { _id: false });

// ─── Main schema ──────────────────────────────────────────────────────────────

/**
 * GamificationConfig — single document that drives all XP/level/league rules.
 *
 * Design goal: changing levels, XP values, or bonus amounts requires only
 * a DB document edit — zero code changes or deploys.
 *
 * xpRules uses Mixed type so new session types or bonus categories can be
 * added without a schema migration.
 */
const gamificationConfigSchema = new mongoose.Schema({
  version:  { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },

  /** Ordered level definitions. Level is determined by highest minXP ≤ totalXP. */
  levels: { type: [levelEntrySchema], default: [] },

  /** League bands by level range. */
  leagues: { type: [leagueEntrySchema], default: [] },

  /** XP required per mastery star after reaching max level. */
  masteryXPPerStar: { type: Number, default: 500 },

  /**
   * XP calculation rules. Mixed type allows extending rules (new session types,
   * new bonuses) without schema migrations.
   *
   * Shape:
   * {
   *   dailyCap: Number,
   *   maxSessionsPerDay: Number,
   *   minDurationSeconds: Number,
   *   sessionTypes: {
   *     [type]: { base: Number, minCompletionRatio?: Number, requiresTechniqueCompleted?: Boolean }
   *   },
   *   bonuses: {
   *     firstSessionOfDay: Number,
   *     streakContinue: Number,
   *     optimalTimeAM: { xp: Number, startHour: Number, endHour: Number },
   *     optimalTimePM: { xp: Number, startHour: Number, endHour: Number },
   *     streakMilestone7: Number,
   *     streakMilestone30: Number,
   *     techniqueLevelUp: Number,
   *   }
   * }
   */
  xpRules: { type: mongoose.Schema.Types.Mixed, default: {} },

  /** Maximum level achievable for any breathing technique (applies to all). */
  techniqueMaxLevel: { type: Number, default: 6 },

  /** Streak freezes granted per week (resets each Monday). */
  streakFreezesPerWeek: { type: Number, default: 1 },

  /** How many days of dailyStats to retain per user profile. */
  dailyStatsRetentionDays: { type: Number, default: 45 },

  /**
   * URL of the reward sound played on the native app when the user earns XP.
   * Must be a short audio file (≤ 3 seconds). Stored here so it can be
   * updated without shipping a new APK build.
   * Defaults to the chimes asset on GCS.
   */
  rewardAudioUrl: {
    type: String,
    default: 'https://storage.googleapis.com/schoolbreathvideos/breathinstructionsabhi/VideoCues/chimes.mp3',
  },

}, {
  timestamps: true,
  collection: 'gamification_config',
});

module.exports = mongoose.model('GamificationConfig', gamificationConfigSchema);
