const mongoose = require('mongoose');

/**
 * BreathingTechniqueLevels — one document per user.
 *
 * Stores the current level state for every breathing technique (CALM, REST,
 * FOCUS, ENERGY, etc.) so the frontend can restore the exact level and freeze
 * state after a logout/login without losing progress.
 *
 * Uses the "breathingsessions" collection as requested.
 */
const breathingTechniqueLevelsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    email: {
      type: String,
      index: true,
    },

    /**
     * Map of patternId → level state.
     * Example:
     * {
     *   "CALM":   { level: 3, cyclesInLevel: 2, isFrozen: false },
     *   "REST":   { level: 2, cyclesInLevel: 0, isFrozen: true  },
     *   "ENERGY": { level: 1, cyclesInLevel: 0, isFrozen: false }
     * }
     */
    techniqueStates: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'breathingsessions',
  }
);

module.exports = mongoose.model('BreathingTechniqueLevels', breathingTechniqueLevelsSchema);
