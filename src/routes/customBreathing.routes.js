const express = require('express');
const router = express.Router();
const {
  getCustomBreathingProgress,
  recordCustomSession,
  getCustomStatistics,
  updateCustomTiming,
  resetCustomProgress,
  getTodayCycles
} = require('../controllers/customBreathingProgress.controller');

// Get custom breathing progress
router.get('/user/:userId/progress', getCustomBreathingProgress);

// Get today's cycles based on phone's local date
router.get('/user/:userId/today-cycles', getTodayCycles);

// Get custom breathing statistics
router.get('/user/:userId/statistics', getCustomStatistics);

// Record a custom breathing session (single endpoint like adaptive mode)
router.post('/user/:userId/session/record', recordCustomSession);

// Update custom breathing timing
router.put('/user/:userId/timing', updateCustomTiming);

// Reset custom breathing progress
router.delete('/user/:userId/progress', resetCustomProgress);

module.exports = router; 