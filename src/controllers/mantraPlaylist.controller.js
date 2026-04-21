const MantraPlaylist = require('../models/mantraPlaylist.model');
const UserMantraPlaylist = require('../models/userMantraPlaylist.model');
const Mantra = require('../models/mantra.model');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY } = require('../configs/vars');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const computeTotalDuration = (trackDocs) => {
  const seconds = trackDocs.reduce((acc, t) => acc + (t.duration || 0), 0);
  return seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0;
};

const resolvePlaylistDuration = async (trackIds) => {
  if (!trackIds || trackIds.length === 0) return 0;
  const tracks = await Mantra.find({ _id: { $in: trackIds } }).select('duration').lean();
  return computeTotalDuration(tracks);
};

// ─────────────────────────────────────────────────────────────────────────────
// Curated Playlists – Public/Admin endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /mantras/playlists
 * Returns all active public playlists (for the webapp).
 * Pass ?includeInactive=true to get all playlists (admin use).
 */
exports.getCuratedPlaylists = async (req, res) => {
  try {
    const { includeInactive, page = 1, limit = 50 } = req.query;

    const query = includeInactive === 'true' ? {} : { isActive: true, isPublic: true };

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { position: 1, createdAt: -1 },
    };

    const result = await MantraPlaylist.paginate(query, options);

    return res.status(200).json({
      success: true,
      playlists: result.docs,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.totalDocs,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    });
  } catch (error) {
    console.error('[MantraPlaylist] getCuratedPlaylists error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /mantras/playlists/:id
 * Returns a single playlist with resolved track objects.
 */
exports.getCuratedPlaylistById = async (req, res) => {
  try {
    const playlist = await MantraPlaylist.findById(req.params.id).lean();
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    const tracks = await Mantra.find({ _id: { $in: playlist.trackIds }, isActive: true }).lean();
    // Preserve the order defined in trackIds
    const trackMap = new Map(tracks.map((t) => [String(t._id), t]));
    const orderedTracks = playlist.trackIds.map((id) => trackMap.get(id)).filter(Boolean);

    return res.status(200).json({
      success: true,
      playlist,
      tracks: orderedTracks,
    });
  } catch (error) {
    console.error('[MantraPlaylist] getCuratedPlaylistById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /mantras/playlists/:id/tracks
 * Returns resolved mantra track objects for a playlist (lightweight endpoint for playback).
 */
exports.getCuratedPlaylistTracks = async (req, res) => {
  try {
    const playlist = await MantraPlaylist.findById(req.params.id).select('trackIds name').lean();
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    const tracks = await Mantra.find({ _id: { $in: playlist.trackIds }, isActive: true }).lean();
    const trackMap = new Map(tracks.map((t) => [String(t._id), t]));
    const orderedTracks = playlist.trackIds.map((id) => trackMap.get(id)).filter(Boolean);

    return res.status(200).json({
      success: true,
      playlistName: playlist.name,
      tracks: orderedTracks,
    });
  } catch (error) {
    console.error('[MantraPlaylist] getCuratedPlaylistTracks error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /mantras/playlists
 * Admin: Create a new curated playlist.
 * Body: { name, description?, coverImage?, accentColor?, trackIds?, tags?, isPublic? }
 */
exports.createCuratedPlaylist = async (req, res) => {
  try {
    const {
      name,
      description = '',
      coverImage = '',
      accentColor = '#5f8b78',
      trackIds = [],
      tags = [],
      isPublic = true,
      position,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Playlist name is required' });
    }

    const totalDuration = await resolvePlaylistDuration(trackIds);

    const playlist = await MantraPlaylist.create({
      name: name.trim(),
      description: description.trim(),
      coverImage,
      accentColor,
      trackIds,
      tags,
      isPublic,
      totalDuration,
      position: position ?? 0,
    });

    return res.status(201).json({ success: true, playlist });
  } catch (error) {
    console.error('[MantraPlaylist] createCuratedPlaylist error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * PUT /mantras/playlists/:id
 * Admin: Update a curated playlist.
 */
exports.updateCuratedPlaylist = async (req, res) => {
  try {
    const {
      name,
      description,
      coverImage,
      accentColor,
      trackIds,
      tags,
      isPublic,
      isActive,
      position,
    } = req.body;

    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description.trim();
    if (coverImage !== undefined) update.coverImage = coverImage;
    if (accentColor !== undefined) update.accentColor = accentColor;
    if (trackIds !== undefined) {
      update.trackIds = trackIds;
      update.totalDuration = await resolvePlaylistDuration(trackIds);
    }
    if (tags !== undefined) update.tags = tags;
    if (isPublic !== undefined) update.isPublic = isPublic;
    if (isActive !== undefined) update.isActive = isActive;
    if (position !== undefined) update.position = position;

    const playlist = await MantraPlaylist.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    return res.status(200).json({ success: true, playlist });
  } catch (error) {
    console.error('[MantraPlaylist] updateCuratedPlaylist error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /mantras/playlists/:id
 * Admin: Delete a curated playlist.
 */
exports.deleteCuratedPlaylist = async (req, res) => {
  try {
    const playlist = await MantraPlaylist.findByIdAndDelete(req.params.id);
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }
    return res.status(200).json({ success: true, message: 'Playlist deleted' });
  } catch (error) {
    console.error('[MantraPlaylist] deleteCuratedPlaylist error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /mantras/playlists/:id/increment-play
 * Increment play count for a playlist (fire-and-forget from client).
 */
exports.incrementPlayCount = async (req, res) => {
  try {
    await MantraPlaylist.findByIdAndUpdate(req.params.id, { $inc: { playCount: 1 } });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[MantraPlaylist] incrementPlayCount error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AI Track Generation – Admin endpoint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /mantras/playlists/:id/ai-tracks
 * Admin: Auto-generate track list for a playlist using AI based on mantra categories.
 * Body: { count? } – desired number of tracks (default: 6)
 */
exports.aiGenerateTracks = async (req, res) => {
  try {
    const playlist = await MantraPlaylist.findById(req.params.id).lean();
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    const desiredCount = Math.min(parseInt(req.body.count ?? 6), 99);

    // Pull all available active mantras for context
    const allMantras = await Mantra.find({ isActive: true })
      .select('_id title deity benefit tags description duration')
      .lean();

    if (allMantras.length === 0) {
      return res.status(422).json({ success: false, message: 'No active mantras available' });
    }

    const mantraList = allMantras.map((m) =>
      `ID:${m._id} | ${m.title} | Deity:${m.deity} | Benefit:${m.benefit} | Tags:${(m.tags || []).join(',')} | Duration:${m.duration}s`
    ).join('\n');

    const prompt = `You are a sacred music curator selecting mantras for a themed playlist.

Playlist Name: "${playlist.name}"
Playlist Description: "${playlist.description || 'No description'}"
Playlist Tags: ${(playlist.tags || []).join(', ') || 'none'}
Desired Track Count: ${desiredCount}

Available Mantras:
${mantraList}

Select exactly ${desiredCount} mantras that best match the playlist theme. Consider:
- Deity and benefit alignment with the playlist name/description
- Good mix of deities and benefits where appropriate
- Flow and progression (opening to closing energy)
- No duplicates

Return ONLY a JSON array of mantra IDs (the string after "ID:"), like:
["id1", "id2", "id3"]
No explanation, no markdown, just the JSON array.`;

    const geminiApiKey = GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(503).json({
        success: false,
        message: 'AI service not configured (GEMINI_API_KEY missing)',
      });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    });

    const aiResult = await model.generateContent(prompt);
    const rawContent = aiResult.response.text().trim();

    let selectedIds;
    try {
      // Strip markdown code fences if present
      const cleaned = rawContent.replace(/```json?/gi, '').replace(/```/g, '').trim();
      selectedIds = JSON.parse(cleaned);
      if (!Array.isArray(selectedIds)) throw new Error('Not an array');
    } catch {
      console.error('[MantraPlaylist] AI returned invalid JSON:', rawContent);
      return res.status(502).json({
        success: false,
        message: 'AI returned unexpected format',
        raw: rawContent,
      });
    }

    // Validate that returned IDs exist
    const validIdSet = new Set(allMantras.map((m) => String(m._id)));
    const validatedIds = selectedIds
      .map((id) => String(id))
      .filter((id) => validIdSet.has(id))
      .slice(0, desiredCount);

    if (validatedIds.length === 0) {
      return res.status(422).json({ success: false, message: 'AI returned no valid track IDs' });
    }

    // Persist updated trackIds to the playlist
    const totalDuration = await resolvePlaylistDuration(validatedIds);
    const updated = await MantraPlaylist.findByIdAndUpdate(
      playlist._id,
      { trackIds: validatedIds, totalDuration },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      playlist: updated,
      selectedIds: validatedIds,
    });
  } catch (error) {
    console.error('[MantraPlaylist] aiGenerateTracks error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// User Playlist – per-user "My Practice"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /mantras/user-playlist?email=...
 * Returns the user's personal playlist with resolved mantra tracks.
 */
exports.getUserPlaylist = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }

    const userPlaylist = await UserMantraPlaylist.findOne({
      email: email.toLowerCase().trim(),
    }).lean();

    if (!userPlaylist) {
      return res.status(200).json({
        success: true,
        playlist: { email, name: 'My Practice', trackIds: [] },
        tracks: [],
      });
    }

    const tracks = await Mantra.find({ _id: { $in: userPlaylist.trackIds } }).lean();
    const trackMap = new Map(tracks.map((t) => [String(t._id), t]));
    const orderedTracks = userPlaylist.trackIds.map((id) => trackMap.get(id)).filter(Boolean);

    return res.status(200).json({
      success: true,
      playlist: userPlaylist,
      tracks: orderedTracks,
    });
  } catch (error) {
    console.error('[MantraPlaylist] getUserPlaylist error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * PUT /mantras/user-playlist
 * Upsert the full user playlist (name + ordered trackIds).
 * Body: { email, name?, trackIds }
 */
exports.upsertUserPlaylist = async (req, res) => {
  try {
    const { email, name, trackIds } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }
    if (!Array.isArray(trackIds)) {
      return res.status(400).json({ success: false, message: 'trackIds must be an array' });
    }

    const update = { trackIds };
    if (name !== undefined) update.name = name.trim() || 'My Practice';

    const playlist = await UserMantraPlaylist.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, playlist });
  } catch (error) {
    console.error('[MantraPlaylist] upsertUserPlaylist error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /mantras/user-playlist/tracks
 * Add a single track to the user's playlist (appended at end).
 * Body: { email, trackId }
 */
exports.addTrackToUserPlaylist = async (req, res) => {
  try {
    const { email, trackId } = req.body;
    if (!email || !trackId) {
      return res.status(400).json({ success: false, message: 'email and trackId are required' });
    }

    const playlist = await UserMantraPlaylist.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { $addToSet: { trackIds: trackId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, playlist });
  } catch (error) {
    console.error('[MantraPlaylist] addTrackToUserPlaylist error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /mantras/user-playlist/tracks/:trackId
 * Remove a track from the user's playlist.
 * Query: ?email=...
 */
exports.removeTrackFromUserPlaylist = async (req, res) => {
  try {
    const { email } = req.query;
    const { trackId } = req.params;
    if (!email || !trackId) {
      return res.status(400).json({ success: false, message: 'email and trackId are required' });
    }

    const playlist = await UserMantraPlaylist.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { $pull: { trackIds: trackId } },
      { new: true }
    );

    if (!playlist) {
      return res.status(404).json({ success: false, message: 'User playlist not found' });
    }

    return res.status(200).json({ success: true, playlist });
  } catch (error) {
    console.error('[MantraPlaylist] removeTrackFromUserPlaylist error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * PUT /mantras/user-playlist/name
 * Rename the user's playlist.
 * Body: { email, name }
 */
exports.renameUserPlaylist = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }

    const playlist = await UserMantraPlaylist.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { $set: { name: (name || 'My Practice').trim() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, playlist });
  } catch (error) {
    console.error('[MantraPlaylist] renameUserPlaylist error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
