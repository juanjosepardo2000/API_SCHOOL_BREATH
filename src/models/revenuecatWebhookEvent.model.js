const mongoose = require('mongoose');

const RevenuecatWebhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    eventType: {
      type: String,
      default: 'unknown',
      index: true,
      trim: true,
    },
    appUserId: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    payloadHash: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['received', 'processed', 'ignored', 'failed'],
      default: 'received',
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    processingResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const RevenuecatWebhookEventModel =
  mongoose.models.RevenuecatWebhookEvent ||
  mongoose.model('RevenuecatWebhookEvent', RevenuecatWebhookEventSchema);

module.exports = { RevenuecatWebhookEventModel };
