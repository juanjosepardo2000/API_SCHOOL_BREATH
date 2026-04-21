const { Schema, model } = require('mongoose');

/**
 * UserMantraPlaylist Schema – one per user (identified by email).
 * This is the user's personal "My Playlist" / sadhana.
 * Not exposed in the admin dashboard.
 */
const UserMantraPlaylistSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: 'My Practice',
      trim: true,
    },
    /** Ordered list of mantra _id strings */
    trackIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'usermantraplaylists',
  }
);

module.exports = model('UserMantraPlaylist', UserMantraPlaylistSchema);
