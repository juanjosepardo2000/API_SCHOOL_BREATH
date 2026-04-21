const mongoose = require('mongoose');

/**
 * sessionEvent.model.js
 *
 * Audit log for every session submitted to POST /gamification/session.
 * Dual purpose:
 *   1. Idempotency — clientSessionId (UUID) prevents double-credit
 *      if the client retries a failed request.
 *   2. Audit trail — every XP award is traceable to a concrete session.
 *
 * TTL: documents auto-delete after 90 days (configurable via SESSION_EVENTS_TTL_DAYS).
 */
const sessionEventSchema = new mongoose.Schema({

  // ── Idempotency key (set by client, must be UUID v4) ──────────────────────
  clientSessionId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
  },

  // ── Identity ──────────────────────────────────────────────────────────────
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },

  // ── Session inputs (what the client reported) ─────────────────────────────
  sessionType: {
    type:     String,
    enum:     ['morning_ritual', 'breath_training', 'breathing_session'],
    required: true,
  },
  techniqueId:      { type: String,  default: null  }, // e.g. "4-7-8", "CALM"
  durationSeconds:  { type: Number,  required: true, min: 0 },
  completionRatio:  { type: Number,  default: 1,     min: 0, max: 1 },
  timezone:         { type: String,  default: 'UTC' },
  localDate:        { type: String,  required: true }, // YYYY-MM-DD

  // ── Server-computed outcome ───────────────────────────────────────────────
  xpAwarded: { type: Number, default: 0, min: 0 },

  /**
   * Itemised breakdown of XP awarded.
   * e.g. { base: 60, firstSessionOfDay: 15, streakContinue: 20, optimalTime: 10 }
   */
  bonusBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Streak snapshot (before → after this session)
  streakBefore: { type: Number, default: 0 },
  streakAfter:  { type: Number, default: 0 },

  // Level snapshot
  levelBefore: { type: Number, default: 1 },
  levelAfter:  { type: Number, default: 1 },

  /**
   * Full response payload cached here.
   * On duplicate clientSessionId we return this directly — no DB re-computation.
   */
  responseSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },

}, {
  timestamps: true,
  collection: 'session_events',
});

// TTL index — Mongoose runs a background job to expire old documents.
// Default: 90 days. Override with SESSION_EVENTS_TTL_DAYS env var.
const TTL_SECONDS = (parseInt(process.env.SESSION_EVENTS_TTL_DAYS, 10) || 90) * 86_400;
sessionEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

// Additional query indexes
sessionEventSchema.index({ userId: 1, createdAt: -1 }); // per-user history
sessionEventSchema.index({ localDate: 1, userId: 1 });  // daily aggregation

module.exports = mongoose.model('SessionEvent', sessionEventSchema);
