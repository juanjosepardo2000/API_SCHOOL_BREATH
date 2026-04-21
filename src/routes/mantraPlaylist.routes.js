const express = require('express');
const router = express.Router();
const controller = require('../controllers/mantraPlaylist.controller');

// ─────────────────────────────────────────────────────────────────────────────
// Curated Playlists (Admin-managed, public consumption)
// ─────────────────────────────────────────────────────────────────────────────

// GET  /mantras/playlists          – list all public playlists (webapp)
// GET  /mantras/playlists          – list all including inactive (admin: ?includeInactive=true)
router.get('/', controller.getCuratedPlaylists);

// GET  /mantras/playlists/:id            – single playlist + resolved tracks
router.get('/:id', controller.getCuratedPlaylistById);

// GET  /mantras/playlists/:id/tracks     – only the resolved tracks (for playback)
router.get('/:id/tracks', controller.getCuratedPlaylistTracks);

// POST /mantras/playlists                – create new curated playlist (admin)
router.post('/', controller.createCuratedPlaylist);

// PUT  /mantras/playlists/:id            – update playlist (admin)
router.put('/:id', controller.updateCuratedPlaylist);

// DELETE /mantras/playlists/:id          – delete playlist (admin)
router.delete('/:id', controller.deleteCuratedPlaylist);

// POST /mantras/playlists/:id/increment-play  – increment play count (webapp, fire-and-forget)
router.post('/:id/increment-play', controller.incrementPlayCount);

// POST /mantras/playlists/:id/ai-tracks  – AI auto-generate track list (admin)
router.post('/:id/ai-tracks', controller.aiGenerateTracks);

module.exports = router;
