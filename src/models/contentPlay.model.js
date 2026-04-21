const { Schema, model } = require('mongoose');

/**
 * ContentPlay – per-user per-track play statistics.
 *
 * One document per (userEmail, contentId, contentType) triple.
 * playCount is incremented atomically each time the client reports a qualified play.
 *
 * A "qualified play" = track reached ≥50% duration or track ended (decided client-side).
 * Analytics failures must never surface to the user – callers should handle errors silently.
 */
const ContentPlaySchema = new Schema(
  {
    /**
     * Lowercased user email.
     * 'anonymous' is used when no user identity is available.
     */
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    /** The _id (as string) of the mantra / music document being played. */
    contentId: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * Content category – matches the three main types in the app:
     *   mantra   → Mantra model
     *   guided   → Music model (guided meditation category)
     *   sleep    → Music model (sleep music category)
     *   chakra   → Music model (chakra/shakra category)
     *   music    → Music model (generic / other)
     */
    contentType: {
      type: String,
      required: true,
      enum: ['mantra', 'guided', 'sleep', 'chakra', 'music'],
    },

    /** Denormalized title for display in analytics dashboards without extra lookups. */
    contentTitle: {
      type: String,
      default: '',
      trim: true,
    },

    /** How many qualified plays this user has logged for this track. */
    playCount: {
      type: Number,
      default: 1,
      min: 0,
    },

    /** Cumulative seconds this user has listened to this track (across all plays). */
    totalListenedSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Timestamp of the most recent qualified play. */
    lastPlayedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'contentplays',
  }
);

// Unique compound index — one document per (user × track × type).
// Used for atomic $inc upserts in recordPlay.
ContentPlaySchema.index(
  { userEmail: 1, contentId: 1, contentType: 1 },
  { unique: true }
);

// Supports popularity aggregation queries filtered by type and time window.
ContentPlaySchema.index({ contentType: 1, lastPlayedAt: -1 });

// Supports per-item stats lookup.
ContentPlaySchema.index({ contentId: 1, contentType: 1 });

module.exports = model('ContentPlay', ContentPlaySchema);
