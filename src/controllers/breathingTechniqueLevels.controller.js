const BreathingTechniqueLevels = require('../models/breathingTechniqueLevels.model');

// ─── GET /breathing-sessions/technique-levels ─────────────────────────────────
/**
 * Returns the saved technique level states for the authenticated user.
 * Returns an empty techniqueStates object for users who have never synced.
 */
exports.getTechniqueLevels = async (req, res) => {
  try {
    const userId = req.user._id;

    const doc = await BreathingTechniqueLevels.findOne({ userId }).lean();

    return res.status(200).json({
      success: true,
      data: {
        techniqueStates: doc?.techniqueStates ?? {},
      },
    });
  } catch (error) {
    console.error('[BreathingTechniqueLevels] getTechniqueLevels error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching technique levels',
    });
  }
};

// ─── PATCH /breathing-sessions/technique-levels ───────────────────────────────
/**
 * Saves (upserts) the full technique level states for the authenticated user.
 *
 * Body: { techniqueStates: Record<string, { level, cyclesInLevel, isFrozen }> }
 *
 * The frontend sends the complete map on every meaningful change (level up/down,
 * freeze toggle, reset). Fire-and-forget from the client side.
 */
exports.saveTechniqueLevels = async (req, res) => {
  try {
    const userId = req.user._id;
    const { techniqueStates } = req.body;

    if (!techniqueStates || typeof techniqueStates !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'techniqueStates must be a non-null object',
      });
    }

    // Sanitize: only keep known fields per technique entry
    const sanitized = {};
    for (const [patternId, state] of Object.entries(techniqueStates)) {
      if (!state || typeof state !== 'object') continue;
      sanitized[patternId] = {
        level:         Math.max(1, Number(state.level)  || 1),
        cyclesInLevel: Math.max(0, Number(state.cyclesInLevel) || 0),
        isFrozen:      Boolean(state.isFrozen),
      };
    }

    const email = req.user.email ?? null;

    await BreathingTechniqueLevels.findOneAndUpdate(
      { userId },
      { $set: { techniqueStates: sanitized, ...(email && { email }) } },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[BreathingTechniqueLevels] saveTechniqueLevels error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error saving technique levels',
    });
  }
};
