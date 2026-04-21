const express = require('express');
const router  = express.Router();
const gamificationController = require('../controllers/gamification.controller');
const passport = require('passport');

const requireAuth = passport.authenticate('jwt', { session: false });

// GET  /gamification/profile
// Full gamification profile for the authenticated user + active config rules.
// Query: ?timezone=America/Guayaquil  (IANA, default UTC)
router.get('/profile', requireAuth, gamificationController.getProfile);

// POST /gamification/session  ← Phase 2: server-authoritative XP
// Client sends raw session data; server computes XP, streak, level, etc.
// Body: { clientSessionId, sessionType, durationSeconds, completionRatio?, techniqueId?, timezone? }
router.post('/session', requireAuth, gamificationController.postSession);

// POST /gamification/sync
// Legacy endpoint: persists frontend-calculated state (Phase 1 compat).
// Kept for backward compatibility; /session is now the source of truth.
router.post('/sync', requireAuth, gamificationController.sync);

// GET  /gamification/leaderboard
// Top-20 ranking + user's position.
// Query: ?type=weekly (default) | alltime | streak
router.get('/leaderboard', requireAuth, gamificationController.getLeaderboard);

// POST /gamification/freeze
// Spends one weekly streak freeze to bridge a single missed day.
// Body: { timezone? }
router.post('/freeze', requireAuth, gamificationController.postFreeze);

module.exports = router;