// models/chatHistory.js
const mongoose = require('mongoose');

// Schema for individual messages within a conversation
const messageSchema = new mongoose.Schema({
  text: { 
    type: String, 
    required: true 
  },
  isUser: { 
    type: Boolean, 
    required: true 
  },
  hasAudio: { 
    type: Boolean, 
    default: false 
  },
  backgroundColor: { 
    type: String, 
    default: "#E8D1D1" 
  },
  source: { 
    type: String, 
    enum: ['local', 'openai', 'user'], 
    required: true 
  },
  shortcuts: {
    type: [String],
    default: []
  },
  cursor: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  }
});

// Main chat history schema with conversation tracking
const chatHistorySchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: false, 
    index: true // Indexed for faster queries by user
  },
  sessionId: { 
    type: String, 
    required: true, 
    index: true // Indexed for faster retrieval of specific sessions
  },
  messages: [messageSchema],
  metadata: {
    userAgent: String,
    ipAddress: String,
    platform: String,
    deviceType: String,
    selectedGuide: {
      type: String,
      enum: ['abhi', 'ganesha'],
      default: 'abhi'
    },
    guidePersonality: {
      type: String,
      default: 'modern'
    },
    lastActive: { 
      type: Date, 
      default: Date.now 
    }
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    index: true // Indexed for time-based queries
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Add TTL index to automatically expire old chat histories after 180 days (configurable)
chatHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

// Update the updatedAt field on save
chatHistorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add methods for common operations
chatHistorySchema.methods = {
  // Add a message to the conversation
  addMessage: function(message) {
    // Generate a unique cursor for the message if it doesn't have one
    if (!message.cursor) {
      const { v4: uuidv4 } = require('uuid');
      message.cursor = uuidv4();
    }
    this.messages.push(message);
    this.updatedAt = Date.now();
    return this.save();
  },

  // Get all messages in the conversation
  getMessages: function() {
    return this.messages;
  },

  // Get the last N messages
  getRecentMessages: function(limit = 10) {
    return this.messages.slice(-limit);
  },

  // Get messages with cursor-based pagination
  getMessagesWithPagination: function(limit = 10, cursor = null) {
    let messages = [...this.messages];
    
    // Ensure all messages have cursors (migrate if needed)
    messages.forEach(msg => {
      if (!msg.cursor) {
        const { v4: uuidv4 } = require('uuid');
        msg.cursor = uuidv4();
      }
    });
    
    // Sort messages by createdAt (oldest first for pagination)
    messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // If cursor is provided, find the message with that cursor and get messages after it
    if (cursor) {
      const cursorIndex = messages.findIndex(msg => msg.cursor === cursor);
      if (cursorIndex !== -1) {
        messages = messages.slice(cursorIndex + 1);
      }
    }
    
    // Get the requested number of messages
    const paginatedMessages = messages.slice(0, limit);
    
    // Determine if there are more messages
    const hasMore = messages.length > limit;
    
    // Get the next cursor (cursor of the last message in this page)
    const nextCursor = hasMore && paginatedMessages.length > 0 
      ? paginatedMessages[paginatedMessages.length - 1].cursor 
      : null;
    
    return {
      messages: paginatedMessages,
      hasMore,
      nextCursor
    };
  },

  // Update guide selection
  updateGuide: function(guideId) {
    this.metadata.selectedGuide = guideId;
    this.updatedAt = Date.now();
    return this.save();
  }
};

// Static methods for common queries
chatHistorySchema.statics = {
  // Find active sessions for a user
  findActiveSessionsForUser: function(userId) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 1); // Sessions active in the last 24 hours
    
    return this.find({
      userId: userId,
      updatedAt: { $gte: cutoffDate }
    }).sort({ updatedAt: -1 });
  },

  // Find or create a session
  findOrCreateSession: async function(userId, sessionId, selectedGuide = 'abhi') {
    let session = await this.findOne({ userId, sessionId });
    
    if (!session) {
      session = new this({
        userId,
        sessionId,
        messages: [],
        metadata: {
          selectedGuide: selectedGuide
        }
      });
      await session.save();
    }
    
    return session;
  },

  // Aggregate common questions (for analytics)
  getTopQuestions: async function(limit = 10) {
    return this.aggregate([
      { $unwind: "$messages" },
      { $match: { "messages.isUser": true } },
      { $group: { 
        _id: "$messages.text", 
        count: { $sum: 1 } 
      }},
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
  },

  // Get guide analytics
  getGuideAnalytics: async function() {
    return this.aggregate([
      { $group: { 
        _id: "$metadata.selectedGuide", 
        count: { $sum: 1 },
        totalMessages: { $sum: { $size: "$messages" } }
      }},
      { $sort: { count: -1 } }
    ]);
  },

  // Migrate existing messages to have cursors
  migrateMessagesWithCursors: async function() {
    const { v4: uuidv4 } = require('uuid');
    
    // Find all chat histories that have messages without cursors
    const chatHistories = await this.find({
      'messages.cursor': { $exists: false }
    });
    
    let migratedCount = 0;
    
    for (const chatHistory of chatHistories) {
      let needsUpdate = false;
      
      // Add cursors to messages that don't have them
      chatHistory.messages.forEach(message => {
        if (!message.cursor) {
          message.cursor = uuidv4();
          needsUpdate = true;
        }
      });
      
      // Save if any messages were updated
      if (needsUpdate) {
        await chatHistory.save();
        migratedCount++;
      }
    }
    
    return { migratedSessions: migratedCount };
  }
};

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

module.exports = ChatHistory;
