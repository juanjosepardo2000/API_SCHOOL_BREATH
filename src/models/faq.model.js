// models/faq.model.js
const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['general', 'membership', 'course', 'app', 'technical']
  },
  question: {
    type: String,
    required: true,
    index: true // Add text index for better search
  },
  answer: {
    type: String,
    required: true
  },
  views: { type: Number, default: 0 }, // Track usage
  lastAccessed: Date, // Track last access
  backgroundColor: {
    type: String,
    default: '#FFFFFF'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add text index for better search
faqSchema.index({ question: 'text', answer: 'text' });

// Update the updatedAt field before saving
faqSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const FAQ = mongoose.model('FAQ', faqSchema);

module.exports = FAQ;