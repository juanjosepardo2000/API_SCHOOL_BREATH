const express = require('express');
const router = express.Router();
const controller = require('../controllers/mantraPlaylist.controller');

// ─────────────────────────────────────────────────────────────────────────────
// User Personal Playlist – "My Practice" / Sadhana
// All endpoints require ?email= query param or email in body.
// ─────────────────────────────────────────────────────────────────────────────

// GET  /mantras/user-playlist?email=...        – fetch user's playlist + resolved tracks
router.get('/', controller.getUserPlaylist);

// PUT  /mantras/user-playlist                  – upsert full playlist (name + trackIds)
router.put('/', controller.upsertUserPlaylist);

// PUT  /mantras/user-playlist/name             – rename playlist
router.put('/name', controller.renameUserPlaylist);

// POST /mantras/user-playlist/tracks           – add single track
router.post('/tracks', controller.addTrackToUserPlaylist);

// DELETE /mantras/user-playlist/tracks/:trackId?email=...  – remove single track
router.delete('/tracks/:trackId', controller.removeTrackFromUserPlaylist);

module.exports = router;
