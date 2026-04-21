const { Schema, model } = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

/**
 * MantraPlaylist Schema – curated/admin-managed playlists
 * These are managed via the admin dashboard and served to all users.
 */
const MantraPlaylistSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    coverImage: {
      type: String,
      default: '',
    },
    accentColor: {
      type: String,
      default: '#5f8b78',
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /** Ordered list of mantra _id references */
    trackIds: {
      type: [String],
      default: [],
    },
    /** Total duration in minutes (computed on write) */
    totalDuration: {
      type: Number,
      default: 0,
    },
    playCount: {
      type: Number,
      default: 0,
    },
    /** Tags like 'sleep', 'morning', 'yoga' for filtering */
    tags: {
      type: [String],
      default: [],
    },
    /** Sort order for the playlists listing */
    position: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'mantraplaylists',
  }
);

MantraPlaylistSchema.index({ isPublic: 1, isActive: 1 });
MantraPlaylistSchema.index({ position: 1, createdAt: -1 });

MantraPlaylistSchema.plugin(mongoosePaginate);

module.exports = model('MantraPlaylist', MantraPlaylistSchema);
