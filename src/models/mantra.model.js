const { Schema, model } = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

/**
 * Mantra Schema
 * Based on web version AudioTrack interface with mantra-specific fields
 * @private
 */
const MantraSchema = new Schema(
  {
    // Basic information
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: Number, // Duration in seconds
      required: true,
    },

    // Media URLs
    audioUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
      default: "",
    },
    visualUrl: {
      type: String, // Optional custom visual (GIF/Video) for the player
      default: "",
    },

    // Categorization
    category: {
      type: String,
      enum: ['MANTRA', 'SHIVA', 'KRISHNA', 'HANUMAN', 'DEVI', 'GANESHA', 'GURU', 'UNIVERSAL'],
      default: 'MANTRA',
    },
    tags: {
      type: [String],
      default: [],
    },

    // Mantra-specific exploration fields
    deity: {
      type: String,
      enum: ['SHIVA', 'HANUMAN', 'KRISHNA', 'DEVI', 'GANESHA', 'GURU', 'UNIVERSAL'],
      required: true,
    },
    benefit: {
      type: String,
      enum: ['ENERGY', 'CALM', 'SLEEP', 'PROTECTION', 'HEALING', 'DEVOTION', 'CONFIDENCE', 'FORGIVENESS'],
      required: true,
    },
    difficulty: {
      type: String,
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
      default: 'BEGINNER',
    },

    // Visual styling
    color: {
      type: String,
      default: 'bg-cyan-500', // Tailwind CSS class or hex color
    },

    // Engagement metrics
    popularityScore: {
      type: Number,
      default: 0,
    },
    pointsReward: {
      type: Number,
      default: 50,
    },
    views: {
      type: Number,
      default: 0,
    },

    // Access control
    isPremium: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Ordering
    position: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toObject: { virtuals: true, getters: true },
    toJSON: { virtuals: true },
  }
);

// Add pagination plugin
MantraSchema.plugin(mongoosePaginate);

// Index for common queries
MantraSchema.index({ deity: 1, benefit: 1 });
MantraSchema.index({ difficulty: 1 });
MantraSchema.index({ popularityScore: -1 });
MantraSchema.index({ position: 1 });
MantraSchema.index({ isActive: 1 });

// Middleware to increment views on find operations
MantraSchema.post("findOne", async function (result) {
  if (result) {
    result.views += 1;
    await result.save();
  }
});

const Mantra = model("Mantra", MantraSchema);
module.exports = Mantra;
