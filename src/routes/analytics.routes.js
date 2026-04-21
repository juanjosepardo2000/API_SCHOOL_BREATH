const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');

/**
 * Analytics Routes – /analytics
 *
 * POST /analytics/play
 *   Fire-and-forget play event recording from the client audio player.
 *   Auth is optional: if a JWT is present the user email is resolved automatically;
 *   otherwise the body's `userEmail` field is used (or 'anonymous').
 *
 * GET /analytics/popular-content?type=mantra&limit=20&days=7
 *   Popularity leaderboard for the admin dashboard.
 *   Open endpoint — play counts are not sensitive data.
 *
 * GET /analytics/content-stats/:contentId?type=mantra
 *   Per-item play stats for a single track.
 *
 * GET /analytics/bulk-stats?type=mantra&ids=id1,id2,id3
 *   Bulk stats for admin dashboard tables (avoids N+1 requests).
 */

// Client → server: record one qualified play
router.post('/play', analyticsController.recordPlay);

// Dashboard: popularity leaderboard
router.get('/popular-content', analyticsController.getPopularContent);

// Per-track stats
router.get('/content-stats/:contentId', analyticsController.getContentStats);

// Bulk stats for table views
router.get('/bulk-stats', analyticsController.getBulkStats);

module.exports = router;
