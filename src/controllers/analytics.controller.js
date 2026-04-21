const ContentPlay = require('../models/contentPlay.model');

const VALID_TYPES = ['mantra', 'guided', 'sleep', 'chakra', 'music'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the user identity for a request.
 * Priority: JWT-authenticated user email → body-supplied email → 'anonymous'.
 * Returns a lowercase trimmed string, never null/undefined.
 */
const resolveUserEmail = (req) => {
  const email =
    req.user?.email ||
    (typeof req.body?.userEmail === 'string' ? req.body.userEmail : '');
  const cleaned = email.toLowerCase().trim();
  return cleaned || 'anonymous';
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /analytics/play
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a qualified play event (fire-and-forget from client).
 *
 * "Qualified" means the client already decided the play counted
 * (e.g. track reached ≥50% duration or ended). This endpoint just
 * atomically upserts the counter — it does no duration validation itself.
 *
 * ALWAYS returns HTTP 200 immediately. Analytics failures must never
 * break or block audio playback on the client.
 *
 * Body:
 *   contentId        string  (required) – mantra or music document _id
 *   contentType      string  (required) – 'mantra' | 'guided' | 'sleep' | 'chakra' | 'music'
 *   contentTitle     string  (optional) – track title for dashboard display
 *   userEmail        string  (optional) – if JWT auth is not used
 *   listenedSeconds  number  (optional) – seconds listened in this play session
 */
exports.recordPlay = async (req, res) => {
  // Respond immediately — caller treats this as fire-and-forget.
  res.status(200).json({ success: true });

  try {
    const {
      contentId,
      contentType,
      contentTitle = '',
      listenedSeconds = 0,
    } = req.body;

    if (!contentId || !contentType) {
      console.warn('[Analytics] recordPlay: missing contentId or contentType — skipping');
      return;
    }

    if (!VALID_TYPES.includes(contentType)) {
      console.warn('[Analytics] recordPlay: invalid contentType:', contentType, '— skipping');
      return;
    }

    const userEmail = resolveUserEmail(req);

    await ContentPlay.findOneAndUpdate(
      {
        userEmail,
        contentId: String(contentId),
        contentType,
      },
      {
        $inc: {
          playCount: 1,
          totalListenedSeconds: Math.max(0, Number(listenedSeconds) || 0),
        },
        $set: {
          contentTitle: String(contentTitle || '').trim(),
          lastPlayedAt: new Date(),
        },
        $setOnInsert: {
          userEmail,
          contentId: String(contentId),
          contentType,
        },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    // Silent failure — analytics must never surface errors to the client.
    console.error('[Analytics] recordPlay error (silent):', error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/popular-content
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns content items ranked by total play count across all users.
 *
 * Query params:
 *   type   string   required  – 'mantra' | 'guided' | 'sleep' | 'chakra' | 'music'
 *   limit  number   optional  – results per page (default 20, max 100)
 *   page   number   optional  – 1-indexed page (default 1)
 *   days   number   optional  – restrict to last N days by lastPlayedAt;
 *                               omit for all-time stats
 *
 * Response: { success, type, days, items: [...], pagination: { page, limit, total, totalPages } }
 *
 * Example – top 10 mantras this week:
 *   GET /analytics/popular-content?type=mantra&limit=10&days=7
 *
 * Example – all-time top 20 guided meditations:
 *   GET /analytics/popular-content?type=guided&limit=20
 */
exports.getPopularContent = async (req, res) => {
  try {
    const { type, limit = 20, page = 1, days } = req.query;

    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Query param 'type' is required and must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    const parsedLimit = Math.min(parseInt(limit) || 20, 100);
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    // Build match stage
    const matchStage = { contentType: type };
    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - Math.max(1, parseInt(days)));
      matchStage.lastPlayedAt = { $gte: since };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$contentId',
          contentTitle: { $first: '$contentTitle' },
          contentType: { $first: '$contentType' },
          // Sum playCount from all per-user rows → global total plays
          totalPlays: { $sum: '$playCount' },
          // Each row = one listener
          uniqueListeners: { $sum: 1 },
          lastPlayedAt: { $max: '$lastPlayedAt' },
          totalListenedSeconds: { $sum: '$totalListenedSeconds' },
        },
      },
      { $sort: { totalPlays: -1, lastPlayedAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: parsedLimit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await ContentPlay.aggregate(pipeline);

    const items = (result?.data || []).map((item) => ({
      contentId: item._id,
      contentTitle: item.contentTitle,
      contentType: item.contentType,
      totalPlays: item.totalPlays,
      uniqueListeners: item.uniqueListeners,
      lastPlayedAt: item.lastPlayedAt,
      totalListenedHours: +(((item.totalListenedSeconds || 0) / 3600).toFixed(1)),
    }));

    const total = result?.totalCount?.[0]?.count || 0;

    return res.status(200).json({
      success: true,
      type,
      days: days ? parseInt(days) : null,
      items,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error('[Analytics] getPopularContent error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/content-stats/:contentId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns aggregated play stats for a single content item.
 * Useful for displaying the play count badge next to a specific track.
 *
 * Query params:
 *   type  string  optional – narrow to a specific contentType
 *
 * Response: { success, stats: { contentId, contentTitle, totalPlays, uniqueListeners, ... } }
 */
exports.getContentStats = async (req, res) => {
  try {
    const { contentId } = req.params;
    const { type } = req.query;

    if (!contentId) {
      return res.status(400).json({ success: false, message: 'contentId is required' });
    }

    const match = { contentId: String(contentId) };
    if (type && VALID_TYPES.includes(type)) {
      match.contentType = type;
    }

    const [stats] = await ContentPlay.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$contentId',
          contentTitle: { $first: '$contentTitle' },
          totalPlays: { $sum: '$playCount' },
          uniqueListeners: { $sum: 1 },
          totalListenedSeconds: { $sum: '$totalListenedSeconds' },
          firstPlayedAt: { $min: '$createdAt' },
          lastPlayedAt: { $max: '$lastPlayedAt' },
        },
      },
    ]);

    if (!stats) {
      return res.status(200).json({
        success: true,
        stats: { contentId, totalPlays: 0, uniqueListeners: 0 },
      });
    }

    return res.status(200).json({
      success: true,
      stats: {
        contentId: stats._id,
        contentTitle: stats.contentTitle,
        totalPlays: stats.totalPlays,
        uniqueListeners: stats.uniqueListeners,
        totalListenedHours: +(((stats.totalListenedSeconds || 0) / 3600).toFixed(1)),
        firstPlayedAt: stats.firstPlayedAt,
        lastPlayedAt: stats.lastPlayedAt,
      },
    });
  } catch (error) {
    console.error('[Analytics] getContentStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/bulk-stats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns play stats for multiple content items in one request.
 * Use this to populate the admin dashboard table without N+1 calls.
 *
 * Query params:
 *   ids   comma-separated list of contentId strings  (required)
 *   type  string  optional – narrow to a specific contentType
 *
 * Response: { success, stats: { [contentId]: { totalPlays, uniqueListeners } } }
 *
 * Example:
 *   GET /analytics/bulk-stats?type=mantra&ids=abc123,def456,ghi789
 */
exports.getBulkStats = async (req, res) => {
  try {
    const { ids, type } = req.query;

    if (!ids) {
      return res.status(400).json({ success: false, message: 'ids query param is required' });
    }

    const idList = String(ids)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200); // hard cap to prevent abuse

    if (idList.length === 0) {
      return res.status(400).json({ success: false, message: 'ids is empty' });
    }

    const match = { contentId: { $in: idList } };
    if (type && VALID_TYPES.includes(type)) {
      match.contentType = type;
    }

    const rows = await ContentPlay.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$contentId',
          totalPlays: { $sum: '$playCount' },
          uniqueListeners: { $sum: 1 },
        },
      },
    ]);

    // Build a map keyed by contentId for easy O(1) lookup on the client
    const stats = {};
    for (const row of rows) {
      stats[row._id] = {
        totalPlays: row.totalPlays,
        uniqueListeners: row.uniqueListeners,
      };
    }

    // Ensure every requested id is present in the response (even if 0 plays)
    for (const id of idList) {
      if (!stats[id]) {
        stats[id] = { totalPlays: 0, uniqueListeners: 0 };
      }
    }

    return res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('[Analytics] getBulkStats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
