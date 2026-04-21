const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/**
 * Progress for a single breathing technique.
 * Stored as values in a Mongoose Map keyed by techniqueId (CALM, REST, …).
 */
const techniqueProgressSchema = new mongoose.Schema({
  currentLevel:      { type: Number, default: 1, min: 1 },
  cyclesCompleted:   { type: Number, default: 0, min: 0 },
  sessionsCompleted: { type: Number, default: 0, min: 0 },
  lastPracticeDate:  { type: String, default: null }, // YYYY-MM-DD
}, { _id: false });

/**
 * One day in the activity history array.
 * Capped at config.dailyStatsRetentionDays entries (enforced in service layer).
 */
const dailyStatSchema = new mongoose.Schema({
  date:            { type: String, required: true }, // YYYY-MM-DD
  xpEarned:        { type: Number, default: 0, min: 0 },
  sessionsCounted: { type: Number, default: 0, min: 0 },
  types:           [{ type: String }], // ["morning_ritual", "breath_training", …]
}, { _id: false });

// ─── Main schema ──────────────────────────────────────────────────────────────

const gamificationSchema = new mongoose.Schema({

  // ── Identity ──────────────────────────────────────────────────────────────
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  email:       { type: String, required: true, index: true },
  displayName: { type: String, default: '' },

  // ── XP ────────────────────────────────────────────────────────────────────
  /** Canonical all-time XP. Used for level calculation. */
  totalXP: { type: Number, default: 0, min: 0 },
  /**
   * Legacy alias — kept for backward-compat with the existing /sync endpoint.
   * New code writes both fields in sync; reads prefer totalXP.
   */
  totalCalmPoints: { type: Number, default: 0, min: 0 },

  weeklyXP:          { type: Number, default: 0, min: 0 },
  /** YYYY-MM-DD (Monday) when weeklyXP was last reset. */
  weeklyXPResetDate: { type: String, default: null },

  // ── Level & League (cached derived values) ────────────────────────────────
  // Stored so leaderboard queries don't recalculate from XP at query time.
  level:     { type: Number, default: 1, min: 1 },
  levelName: { type: String, default: 'Seed' },
  league: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'crown', 'prana'],
    default: 'bronze',
  },

  // ── Streak ────────────────────────────────────────────────────────────────
  currentStreak: { type: Number, default: 0, min: 0 },
  longestStreak: { type: Number, default: 0, min: 0 },
  /**
   * User's LOCAL calendar date of their last session (YYYY-MM-DD).
   * Stored as a string (not a timestamp) for timezone-safe streak logic.
   */
  lastSessionDate: { type: String, default: null },

  // ── Streak freeze ─────────────────────────────────────────────────────────
  freezesRemainingThisWeek: { type: Number, default: 1, min: 0 },
  /** Monday YYYY-MM-DD when the current freeze allowance was granted. */
  lastFreezeGrantedWeek: { type: String, default: null },

  // ── Session counters ──────────────────────────────────────────────────────
  totalSessionsCompleted:  { type: Number, default: 0, min: 0 },
  morningRitualCompleted:  { type: Number, default: 0, min: 0 },
  breathTrainingCompleted: { type: Number, default: 0, min: 0 },
  /** Legacy name for morningRitualCompleted — kept for backward compat. */
  dailyBreathingCompleted: { type: Number, default: 0, min: 0 },

  // ── Daily cap tracking ────────────────────────────────────────────────────
  // Counters reset to 0 whenever dailyXPDate differs from today's local date.
  dailyXPDate:          { type: String, default: null }, // YYYY-MM-DD
  dailyXPEarned:        { type: Number, default: 0, min: 0 },
  dailySessionsCounted: { type: Number, default: 0, min: 0 },

  // ── Morning ritual consistency ────────────────────────────────────────────
  morningRitualLastDate:     { type: String, default: null },
  morningRitualWeeklyCount:  { type: Number, default: 0, min: 0 },
  morningRitualMonthlyCount: { type: Number, default: 0, min: 0 },

  // ── Per-technique progress ────────────────────────────────────────────────
  // Map<techniqueId, TechniqueProgress>
  // e.g. { "CALM": { currentLevel: 3, cyclesCompleted: 42, … } }
  techniqueProgress: {
    type: Map,
    of:   techniqueProgressSchema,
    default: {},
  },

  // ── Activity history ──────────────────────────────────────────────────────
  // Newest-first array, capped at config.dailyStatsRetentionDays by the service.
  dailyStats: { type: [dailyStatSchema], default: [] },

  // ── Badges ────────────────────────────────────────────────────────────────
  badges: [{ type: String }],

}, {
  timestamps: true,
  collection: 'gamification',
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

gamificationSchema.index({ league: 1, weeklyXP: -1 }); // leaderboard por liga
gamificationSchema.index({ totalXP: -1 });              // ranking all-time
gamificationSchema.index({ totalCalmPoints: -1 });      // backward compat
gamificationSchema.index({ currentStreak: -1 });        // ranking de racha
gamificationSchema.index({ weeklyXP: -1 });             // ranking semanal global

module.exports = mongoose.model('Gamification', gamificationSchema);
