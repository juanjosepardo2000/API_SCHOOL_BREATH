const { Schema, model } = require("mongoose");

/**
 * Mantra Category Schema
 * Stores metadata for deities and benefits to make frontend completely dynamic
 * @private
 */
const MantraCategorySchema = new Schema(
  {
    // Category identification
    type: {
      type: String,
      enum: ['DEITY', 'BENEFIT', 'DIFFICULTY'],
      required: true,
    },
    identifier: {
      type: String,
      required: true,
      uppercase: true,
    },

    // Display information
    label: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },

    // Visual assets
    image: {
      type: String,
      default: "",
    },
    icon: {
      type: String, // Lucide icon name for frontend
      default: "",
    },
    color: {
      type: String, // Tailwind gradient or hex color
      default: "bg-gradient-to-br from-purple-400 to-indigo-600",
    },

    // Additional metadata
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // SEO and content
    keywords: {
      type: [String],
      default: [],
    },
    longDescription: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    toObject: { virtuals: true, getters: true },
    toJSON: { virtuals: true },
  }
);

// Compound index for unique category types
MantraCategorySchema.index({ type: 1, identifier: 1 }, { unique: true });
MantraCategorySchema.index({ type: 1, order: 1 });
MantraCategorySchema.index({ isActive: 1 });

// Virtual to get count of mantras in this category
MantraCategorySchema.virtual('mantraCount', {
  ref: 'Mantra',
  localField: '_id',
  foreignField: 'categoryRef',
  count: true
});

const MantraCategory = model("MantraCategory", MantraCategorySchema);
module.exports = MantraCategory;
