const mongoose = require('mongoose');

const AuditSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    provider: { type: String, enum: ['google', 'apple'], required: true },
    action: { type: String, enum: ['linked', 'unlinked'], required: true },
    ip: { type: String },
    requestId: { type: String },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

const AuditModel = mongoose.model('Audit', AuditSchema);

module.exports = { AuditModel };


