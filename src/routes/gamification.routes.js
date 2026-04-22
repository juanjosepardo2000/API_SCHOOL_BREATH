const express = require('express');
const router  = express.Router();
const gamificationController = require('../controllers/gamification.controller');
const passport = require('passport');

const requireAuth = passport.authenticate('jwt', { session: false });

// GET  /gamification/profile
// Full gamification profile for the authenticated user + active config rules.
// Query: ?timezone=America/Guayaquil  (IANA, default UTC)
router.get('/profile', requireAuth, gamificationController.getProfile);

// POST /gamification/session
// Server-authoritative XP calculation and persistence (idempotent by clientSessionId).
router.post('/session', requireAuth, gamificationController.postSession);

// GET  /gamification/leaderboard
// Query: ?type=weekly|alltime|streak
router.get('/leaderboard', requireAuth, gamificationController.getLeaderboard);

// POST /gamification/freeze
// Apply one streak freeze (if eligible) to preserve streak after one missed day.
router.post('/freeze', requireAuth, gamificationController.postFreeze);

// POST /gamification/sync
// Legacy compatibility endpoint (frontend-calculated state).
router.post('/sync', requireAuth, gamificationController.sync);

module.exports = router;