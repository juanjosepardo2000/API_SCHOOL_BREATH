const CustomBreathingProgress = require('../models/customBreathingProgress.model');

// Helper function to find or create custom breathing progress - ATOMIC & SAFE
const findOrCreateCustomProgress = async (userId) => {
  try {
    // Use atomic upsert to prevent duplicate key errors
    // This will find existing document or create new one atomically
    const customProgress = await CustomBreathingProgress.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          recentSessions: [],
          statistics: {
            totalSessionsCompleted: 0,
            totalCyclesCompleted: 0,
            totalPracticeTime: 0,
            lastSessionDate: null,
            currentStreak: 0,
            longestStreak: 0,
            longestSession: 0,
            averageSessionLength: 0
          },
          adaptiveChallenge: {
            isEnabled: false,
            currentLevel: 1,
            currentCycleInLevel: 0,
            totalCyclesCompleted: 0,
            lastAdaptiveTiming: null,
            badgesEarned: []
          },
          customBreathing: {
            isActive: true,
            currentLevel: 1,
            totalCyclesCompleted: 0,
            lastCustomTiming: null
          }
        }
      },
      { 
        upsert: true,    // Create if doesn't exist
        new: true,       // Return the updated/created document
        runValidators: true // Run model validations
      }
    );
    
    console.log(`🔍 Found/Created custom progress for user ${userId}:`, {
      exists: !!customProgress,
      recentSessionsCount: customProgress.recentSessions?.length || 0,
      totalCycles: customProgress.statistics?.totalCyclesCompleted || 0
    });
    
    return customProgress;
  } catch (error) {
    console.error(`❌ Error in findOrCreateCustomProgress for user ${userId}:`, error);
    
    // Fallback: try to find existing document
    try {
      const existingProgress = await CustomBreathingProgress.findOne({ userId });
      if (existingProgress) {
        console.log(`✅ Fallback: Found existing progress for user ${userId}`);
        return existingProgress;
      }
    } catch (fallbackError) {
      console.error(`❌ Fallback also failed for user ${userId}:`, fallbackError);
    }
    
    // If all else fails, throw the original error
    throw error;
  }
};

// Get custom breathing progress
const getCustomBreathingProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Use the safe atomic upsert function
    const customProgress = await findOrCreateCustomProgress(userId);
    
    // Safety check: ensure customProgress exists
    if (!customProgress) {
      console.error(`❌ Failed to get/create custom progress for user ${userId}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize user progress',
        error: 'User progress initialization failed'
      });
    }
    
    // Ensure all required properties exist with defaults
    if (!customProgress.recentSessions) {
      customProgress.recentSessions = [];
    }
    if (!customProgress.statistics) {
      customProgress.statistics = {
        totalSessionsCompleted: 0,
        totalCyclesCompleted: 0,
        totalPracticeTime: 0,
        lastSessionDate: null,
        currentStreak: 0,
        longestStreak: 0,
        longestSession: 0,
        averageSessionLength: 0
      };
    }
    if (!customProgress.adaptiveChallenge) {
      customProgress.adaptiveChallenge = {
        isEnabled: false,
        currentLevel: 1,
        currentCycleInLevel: 0,
        totalCyclesCompleted: 0,
        lastAdaptiveTiming: null,
        badgesEarned: []
      };
    }
    if (!customProgress.customBreathing) {
      customProgress.customBreathing = {
        isActive: true,
        currentLevel: 1,
        totalCyclesCompleted: 0,
        lastCustomTiming: null
      };
    }
    
    // Save if we had to add defaults
    if (!customProgress.recentSessions || !customProgress.statistics || 
        !customProgress.adaptiveChallenge || !customProgress.customBreathing) {
      await customProgress.save();
      console.log(`✅ Updated custom progress structure for user ${userId}`);
    }
    
    res.status(200).json({
      success: true,
      data: customProgress,
      message: 'Custom breathing progress retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting custom breathing progress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Record a custom breathing session (single endpoint like adaptive mode)
const recordCustomSession = async (req, res) => {
  try {
    const { userId } = req.params;
    const sessionData = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Use the safe atomic upsert function
    const customProgress = await findOrCreateCustomProgress(userId);
    
    // Safety check: ensure customProgress exists and has required properties
    if (!customProgress) {
      console.error(`❌ Failed to get/create custom progress for user ${userId}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize user progress',
        error: 'User progress initialization failed'
      });
    }
    
    // Ensure all required properties exist
    if (!customProgress.recentSessions) {
      customProgress.recentSessions = [];
    }
    if (!customProgress.statistics) {
      customProgress.statistics = {
        totalSessionsCompleted: 0,
        totalCyclesCompleted: 0,
        totalPracticeTime: 0,
        lastSessionDate: null,
        currentStreak: 0,
        longestStreak: 0,
        longestSession: 0,
        averageSessionLength: 0
      };
    }
    
    // Validate session data
    const {
      sessionId,
      startTime,
      endTime,
      cyclesCompleted,
      practiceTime,
      timing,
      notes,
      phoneLocalDate // Add this field to receive phone's local date
    } = sessionData;
    
    if (!sessionId || !startTime || !endTime || cyclesCompleted === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required session data'
      });
    }
    
    // Use phone's local date if provided, otherwise fallback to server time
    const sessionDate = phoneLocalDate ? new Date(phoneLocalDate + 'T00:00:00') : new Date();
    
    // Create session record with phone's local date
    const sessionRecord = {
      sessionId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      targetCycles: cyclesCompleted, // For custom mode, target = completed
      completedCycles: cyclesCompleted,
      practiceTime: practiceTime || 0,
      timing,
      notes: notes || `Completed ${cyclesCompleted} cycles in custom mode`,
      phoneLocalDate: phoneLocalDate, // Store the phone's local date string
      sessionDate: sessionDate // Store the actual session date (phone's local time)
    };
    
    console.log(`📝 Custom session record created:`, {
      sessionId,
      cyclesCompleted,
      practiceTime: sessionRecord.practiceTime,
      phoneLocalDate: phoneLocalDate,
      sessionDate: sessionDate,
      phoneLocalDateParsed: new Date(phoneLocalDate + 'T00:00:00'),
      serverTime: new Date()
    });
    
    // Add to recent sessions (keep only last 20)
    customProgress.recentSessions.unshift(sessionRecord);
    if (customProgress.recentSessions.length > 20) {
      customProgress.recentSessions = customProgress.recentSessions.slice(0, 20);
    }
    
    // Update statistics using phone's local date
    customProgress.statistics.totalSessionsCompleted += 1;
    customProgress.statistics.totalCyclesCompleted += cyclesCompleted;
    customProgress.statistics.totalPracticeTime += practiceTime || 0;
    customProgress.statistics.lastSessionDate = sessionDate; // Use phone's local date
    
    // Update longest session if this one is longer
    if (cyclesCompleted > customProgress.statistics.longestSession) {
      customProgress.statistics.longestSession = cyclesCompleted;
    }
    
    // Calculate average session length
    const totalSessions = customProgress.statistics.totalSessionsCompleted;
    const totalCycles = customProgress.statistics.totalCyclesCompleted;
    customProgress.statistics.averageSessionLength = totalSessions > 0 ? Math.round(totalCycles / totalSessions) : 0;
    
    // Update streak logic using phone's local date
    const today = sessionDate; // Use session date instead of server time
    const lastSessionDate = customProgress.statistics.lastSessionDate;
    const daysDiff = Math.floor((today - lastSessionDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      // Consecutive day
      customProgress.statistics.currentStreak += 1;
      if (customProgress.statistics.currentStreak > customProgress.statistics.longestStreak) {
        customProgress.statistics.longestStreak = customProgress.statistics.currentStreak;
      }
    } else if (daysDiff > 1) {
      // Streak broken
      customProgress.statistics.currentStreak = 1;
    }
    
    await customProgress.save();
    
    console.log(`✅ Custom session saved successfully with phone local date: ${phoneLocalDate}`);
    console.log(`📊 Custom statistics updated:`, {
      totalSessions: customProgress.statistics.totalSessionsCompleted,
      totalCycles: customProgress.statistics.totalCyclesCompleted,
      longestSession: customProgress.statistics.longestSession,
      lastSessionDate: customProgress.statistics.lastSessionDate
    });
    
    res.status(201).json({
      success: true,
      data: {
        sessionRecord,
        statistics: customProgress.statistics,
        totalSessions: customProgress.statistics.totalSessionsCompleted,
        totalCycles: customProgress.statistics.totalCyclesCompleted
      },
      message: 'Custom breathing session recorded successfully'
    });
  } catch (error) {
    console.error('Error recording custom session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get today's cycles based on phone's local date
const getTodayCycles = async (req, res) => {
  try {
    const { userId } = req.params;
    const { phoneLocalDate } = req.query; // Get phone's local date from query params
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    if (!phoneLocalDate) {
      return res.status(400).json({
        success: false,
        message: 'Phone local date is required'
      });
    }
    
    // Use the safe atomic upsert function
    const customProgress = await findOrCreateCustomProgress(userId);
    
    // Safety check: ensure customProgress exists and has required properties
    if (!customProgress) {
      console.error(`❌ Failed to get/create custom progress for user ${userId}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize user progress',
        data: {
          todayCycles: 0,
          totalCycles: 0,
          todaySessions: 0,
          phoneLocalDate: phoneLocalDate,
          sessions: []
        }
      });
    }
    
    // Ensure recentSessions array exists
    if (!customProgress.recentSessions) {
      customProgress.recentSessions = [];
      await customProgress.save();
    }
    
    // Parse the phone's local date (should be in YYYY-MM-DD format)
    const phoneDate = new Date(phoneLocalDate + 'T00:00:00');
    const phoneDateStart = new Date(phoneDate.getFullYear(), phoneDate.getMonth(), phoneDate.getDate());
    const phoneDateEnd = new Date(phoneDateStart.getTime() + 24 * 60 * 60 * 1000 - 1); // End of day
    
    console.log(`📅 Getting today's cycles for phone date: ${phoneLocalDate}`);
    console.log(`📅 Phone date parsed: ${phoneDate.toISOString()}`);
    console.log(`📅 Date range: ${phoneDateStart.toISOString()} to ${phoneDateEnd.toISOString()}`);
    
    // Filter sessions for today based on phone's local date
    const todaySessions = customProgress.recentSessions.filter(session => {
      // Use phoneLocalDate if available, otherwise fallback to sessionDate
      let sessionDate;
      if (session.phoneLocalDate) {
        // Parse the stored phoneLocalDate string
        sessionDate = new Date(session.phoneLocalDate + 'T00:00:00');
      } else {
        // Fallback to sessionDate or startTime
        sessionDate = session.sessionDate ? new Date(session.sessionDate) : new Date(session.startTime);
      }
      
      const isToday = sessionDate >= phoneDateStart && sessionDate <= phoneDateEnd;
      console.log(`🔍 Session ${session.sessionId}: date=${sessionDate.toISOString()}, phoneLocalDate=${session.phoneLocalDate}, isToday=${isToday}`);
      
      return isToday;
    });
    
    // Calculate today's total cycles
    const todayCycles = todaySessions.reduce((total, session) => total + session.completedCycles, 0);
    
    console.log(`📊 Found ${todaySessions.length} sessions for today with ${todayCycles} total cycles`);
    
    res.status(200).json({
      success: true,
      data: {
        todayCycles,
        totalCycles: customProgress.statistics?.totalCyclesCompleted || 0,
        todaySessions: todaySessions.length,
        phoneLocalDate: phoneLocalDate,
        sessions: todaySessions.map(s => ({
          sessionId: s.sessionId,
          cycles: s.completedCycles,
          date: s.phoneLocalDate || s.startTime
        }))
      },
      message: 'Today\'s cycles retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting today\'s cycles:', error);
    
    // Provide fallback response even on error
    res.status(500).json({
      success: false,
      message: 'Error retrieving today\'s cycles',
      data: {
        todayCycles: 0,
        totalCycles: 0,
        todaySessions: 0,
        phoneLocalDate: req.query.phoneLocalDate || 'unknown',
        sessions: []
      },
      error: error.message
    });
  }
};

// Get custom breathing statistics
const getCustomStatistics = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const customProgress = await findOrCreateCustomProgress(userId);
    
    const statistics = {
      currentSession: {
        isActive: customProgress.currentSession.isActive,
        targetCycles: customProgress.currentSession.targetCycles,
        completedCycles: customProgress.currentSession.completedCycles,
        currentCycle: customProgress.currentSession.currentCycle,
        progress: customProgress.currentSessionProgress,
        timing: customProgress.currentSession.timing
      },
      overall: {
        totalSessions: customProgress.statistics.totalSessionsCompleted,
        totalCycles: customProgress.statistics.totalCyclesCompleted,
        totalPracticeTime: customProgress.statistics.totalPracticeTime,
        longestSession: customProgress.statistics.longestSession,
        averageSessionLength: customProgress.statistics.averageSessionLength,
        currentStreak: customProgress.statistics.currentStreak,
        longestStreak: customProgress.statistics.longestStreak,
        lastSessionDate: customProgress.statistics.lastSessionDate
      },
      recentSessions: customProgress.recentSessions.slice(0, 10), // Last 10 sessions
      currentSessionCycles: customProgress.currentSessionCycles // Current session cycle details
    };
    
    res.status(200).json({
      success: true,
      data: statistics,
      message: 'Custom breathing statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting custom statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update custom breathing timing
const updateCustomTiming = async (req, res) => {
  try {
    const { userId } = req.params;
    const { timing } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    if (!timing || !timing.inhale || !timing.hold || !timing.exhale) {
      return res.status(400).json({
        success: false,
        message: 'Valid timing object with inhale, hold, and exhale is required'
      });
    }
    
    // Validate timing values
    if (timing.inhale < 1 || timing.inhale > 20 ||
        timing.hold < 1 || timing.hold > 20 ||
        timing.exhale < 1 || timing.exhale > 20) {
      return res.status(400).json({
        success: false,
        message: 'Timing values must be between 1 and 20 seconds'
      });
    }

    const customProgress = await findOrCreateCustomProgress(userId);
    
    // Update timing for current session if active
    if (customProgress.currentSession.isActive) {
      customProgress.currentSession.timing = timing;
    }
    
    await customProgress.save();
    
    console.log(`⚙️ Custom timing updated for user ${userId}:`, timing);
    
    res.status(200).json({
      success: true,
      data: {
        timing: customProgress.currentSession.timing
      },
      message: 'Custom breathing timing updated successfully'
    });
  } catch (error) {
    console.error('Error updating custom timing:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Reset custom breathing progress
const resetCustomProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const customProgress = await findOrCreateCustomProgress(userId);
    
    // Reset all progress
    customProgress.resetProgress();
    await customProgress.save();
    
    console.log(`🔄 Custom progress reset for user ${userId}`);
    
    res.status(200).json({
      success: true,
      data: customProgress,
      message: 'Custom breathing progress reset successfully'
    });
  } catch (error) {
    console.error('Error resetting custom progress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getCustomBreathingProgress,
  recordCustomSession,
  getCustomStatistics,
  updateCustomTiming,
  resetCustomProgress,
  getTodayCycles
}; 