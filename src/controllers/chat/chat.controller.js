const chatService = require('../../services/chatService');
const Topic = require('../../models/topic.model');
const FAQ = require('../../models/faq.model');
const ListenQuestion = require('../../models/listenQuestion.model');

exports.topics = async (req, res, next) => {
    try {
        const TOPICS = await Topic.find().sort({ id: 1 });
        res.status(200).json(TOPICS);
    } catch (error) {
        return next(error);
    }
};

// Get FAQ data by topic from MongoDB
exports.getFaqByTopic = async (req, res, next) => {
    try {
        const category = req.params.category;
      
        // Validate the category exists in our Topic collection
      
        const topicExists = await Topic.findOne({ category: category });
        if (!topicExists) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Get FAQs from MongoDB
        const faqData = await FAQ.find({ category: category }).sort({ createdAt: -1 });
        
        res.status(200).json(faqData);
    } catch (error) {
        return next(error);
    }
};

// Chat endpoint - STORAGE ONLY in hybrid mode
// 🆕 HYBRID MODE: Backend focuses on DATABASE STORAGE
// Frontend (openAiService.ts) handles OpenAI calls
// Backend receives aiResponse and stores in MongoDB
exports.chat = async (req, res, next) => {
    try {
        const { message, userId, userEmail, sessionId, selectedGuide, aiResponse } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Determine user identifier - prefer userId if available, otherwise use userEmail
        const userIdentifier = userId || userEmail;

        // Use selected guide or default to 'abhi'
        const guideId = selectedGuide || 'abhi';

        const metadata = {
            ...req.metadata,
            platform: req.get('platform') || 'unknown',
            deviceType: req.get('device-type') || 'unknown'
        };

        // 🆕 SIMPLIFIED HYBRID MODE:
        // - Frontend calls OpenAI (openAiService.ts)
        // - Frontend sends aiResponse here
        // - Backend stores in MongoDB (NO OpenAI call)
        // - Legacy: If no aiResponse, backend calls OpenAI (backward compatible)
        const result = await chatService.processMessage(
            message, 
            userIdentifier, 
            sessionId,
            metadata,
            guideId,
            aiResponse || null  // AI response from frontend
        );

        // Return full response (for backward compatibility)
        // In hybrid mode, frontend already has aiResponse, but we return it anyway
        res.status(200).json({
            ...result.response,
            sessionId: result.sessionId,
            selectedGuide: result.selectedGuide,
            shortcuts: result.response.shortcuts || []
        });

    } catch (error) {
        return next(error);
    }
};

// Get conversation history
exports.getConversationHistory = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { userId, userEmail, limit } = req.query;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        // Determine user identifier - prefer userId if available, otherwise use userEmail
        const userIdentifier = userId || userEmail;

        const history = await chatService.getConversationHistory(
            sessionId,
            userIdentifier || null,
            limit ? parseInt(limit) : 50
        );

        res.status(200).json(history);
    } catch (error) {
        return next(error);
    }
};

// Get conversation history with cursor-based pagination
// Query parameters:
// - limit: Number of messages to return (1-100, default: 10)
// - cursor: Cursor for pagination (optional, if not provided returns first page)
// - userId/userEmail: User identifier (optional)
// Returns: { messages, hasMore, nextCursor, count }
exports.getConversationHistoryPaginated = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { userId, userEmail, limit, cursor } = req.query;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        // Determine user identifier - prefer userId if available, otherwise use userEmail
        const userIdentifier = userId || userEmail;

        // Validate limit parameter
        const messageLimit = limit ? parseInt(limit) : 10;
        if (messageLimit < 1 || messageLimit > 100) {
            return res.status(400).json({ error: 'Limit must be between 1 and 100' });
        }

        const result = await chatService.getConversationHistoryPaginated(
            sessionId,
            userIdentifier || null,
            messageLimit,
            cursor || null
        );

        res.status(200).json({
            messages: result.messages,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
            count: result.messages.length
        });
    } catch (error) {
        return next(error);
    }
};

// Get user sessions
exports.getUserSessions = async (req, res, next) => {
    try {
        const { userId, userEmail, activeOnly } = req.query;

        // Determine user identifier - prefer userId if available, otherwise use userEmail
        const userIdentifier = userId || userEmail;

        if (!userIdentifier) {
            return res.status(400).json({ error: 'User ID or Email is required' });
        }

        const sessions = await chatService.getUserSessions(
            userIdentifier,
            activeOnly === 'true'
        );

        res.status(200).json(sessions);
    } catch (error) {
        return next(error);
    }
};

// Get session guide information
exports.getSessionGuideInfo = async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        const guideInfo = await chatService.getSessionGuideInfo(sessionId);
        res.status(200).json(guideInfo);
    } catch (error) {
        if (error.message === 'Session not found') {
            return res.status(404).json({ error: 'Session not found' });
        }
        return next(error);
    }
};

// Get analytics
exports.getAnalytics = async (req, res, next) => {
    const { userId } = req.query;

    try {
        // Get both chat analytics and FAQ analytics
        const chatAnalytics = await chatService.getAnalytics(userId || null);
        
        // Add FAQ-specific analytics
        const faqAnalytics = {
            totalFAQs: await FAQ.countDocuments(),
            byCategory: await FAQ.aggregate([
                { $group: { _id: "$category", count: { $sum: 1 } } }
            ]),
            mostViewed: await FAQ.find().sort({ views: -1 }).limit(5)
        };

        res.status(200).json({
            ...chatAnalytics,
            faqAnalytics
        });
    } catch (error) {
        console.error('Error retrieving analytics:', error);
        res.status(500).json({ error: 'Failed to retrieve analytics' });
    }
};


exports.listenQuestion = async (req, res, next) => {
    try {

        const { faqId } = req.body;
        const { userEmail } = req.query;
        
        if (!userEmail) {
            return res.status(400).json({ error: 'User ID and FAQ ID are required' });
        }
        
        // Create or update the listen question record
        const listenQuestion = await ListenQuestion.findOneAndUpdate(
            { userId: userEmail , faqId },
            { $inc: { count: 1 } },
            { upsert: true, new: true }
        );
        
        res.status(200).json({
            success: true,
            message: 'Listen question recorded successfully',
            data: listenQuestion
        });
    } catch (error) {
        return next(error);
    }
};




// Seed FAQs from the static data (one-time operation)
exports.seedFAQs = async (req, res, next) => {
    try {
        const { 
            getGeneralFAQs, 
            getMembershipFAQs, 
            getCourseFAQs, 
            getAppFAQs, 
            getTechnicalFAQs 
        } = require('../../data/faqData');

        // Delete existing FAQs
        await FAQ.deleteMany({});

        // Prepare FAQ data with categories
        const faqsToInsert = [
            ...getGeneralFAQs().map(faq => ({ ...faq, category: 'general' })),
            ...getMembershipFAQs().map(faq => ({ ...faq, category: 'membership' })),
            ...getCourseFAQs().map(faq => ({ ...faq, category: 'course' })),
            ...getAppFAQs().map(faq => ({ ...faq, category: 'app' })),
            ...getTechnicalFAQs().map(faq => ({ ...faq, category: 'technical' }))
        ];

        // Insert all FAQs
        const result = await FAQ.insertMany(faqsToInsert);

        res.status(200).json({
            message: 'FAQs seeded successfully',
            count: result.length
        });
    } catch (error) {
        return next(error);
    }
};

// Migrate existing messages to have cursors (one-time operation)
exports.migrateMessageCursors = async (req, res, next) => {
    try {
        const ChatHistory = require('../../models/chat.model');
        const result = await ChatHistory.migrateMessagesWithCursors();
        
        res.status(200).json({
            message: 'Message cursors migrated successfully',
            migratedSessions: result.migratedSessions
        });
    } catch (error) {
        return next(error);
    }
};
