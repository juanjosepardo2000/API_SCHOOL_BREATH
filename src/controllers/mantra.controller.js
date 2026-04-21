const Mantra = require("../models/mantra.model");
const axios = require("axios");

/**
 * Access control configuration
 * Users with these tags have full access to all mantras
 */
const fullAccessTagsMantra = [
  'Enrolled_to_Membership',
  'Enrolled_Holistic Membership',
];

/**
 * Check if user has any of the specified tags
 */
const hasAnyTag = (userTags, tagsToCheck) => {
  return tagsToCheck.some(tag => userTags.includes(tag));
};

/**
 * Get user tags from Systeme.io
 */
const getUserTags = async (userEmail) => {
  if (!userEmail) return [];

  try {
    const response = await axios.get(`https://api.systeme.io/api/contacts?email=${userEmail}`, {
      headers: {
        'x-api-key': process.env.API_SYSTEME_KEY
      },
    });

    const contacts = response.data?.items[0] ?? null;
    return contacts ? contacts.tags.map(tag => tag.name) : [];
  } catch (error) {
    console.error('Error fetching user tags:', error);
    return [];
  }
};

/**
 * GET /mantras - Get all mantras with access control
 * Query params:
 *   - email: user email for access check
 *   - deity: filter by deity (SHIVA, KRISHNA, etc.)
 *   - benefit: filter by benefit (ENERGY, CALM, etc.)
 *   - difficulty: filter by difficulty (BEGINNER, INTERMEDIATE, ADVANCED)
 *   - page: page number (default: 1)
 *   - limit: items per page (default: 99)
 */
exports.getMantras = async (req, res) => {
  try {
    const { email, deity, benefit, difficulty, page = 1, limit = 99, includeInactive } = req.query;

    // Build query (admin can pass includeInactive=true to see all mantras)
    const query = includeInactive === 'true' ? {} : { isActive: true };

    if (deity) query.deity = deity.toUpperCase();
    if (benefit) query.benefit = benefit.toUpperCase();
    if (difficulty) query.difficulty = difficulty.toUpperCase();

    // Check user access
    let hasAccess = false;
    if (email) {
      const userTags = await getUserTags(email);
      hasAccess = hasAnyTag(userTags, fullAccessTagsMantra);
    }

    // Pagination options
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { position: 1, popularityScore: -1, createdAt: -1 },
    };

    const result = await Mantra.paginate(query, options);

    return res.status(200).json({
      success: true,
      mantras: result.docs,
      hasAccess,
      pagination: {
        total: result.totalDocs,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    });
  } catch (error) {
    console.error('Error in getMantras:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch mantras',
      error: error.message,
    });
  }
};

/**
 * GET /mantras/:id - Get single mantra by ID
 */
exports.getMantraById = async (req, res) => {
  try {
    const mantra = await Mantra.findById(req.params.id);

    if (!mantra) {
      return res.status(404).json({
        success: false,
        message: "Mantra not found"
      });
    }

    // Increment views happens in post-findOne middleware

    return res.status(200).json({
      success: true,
      data: mantra
    });
  } catch (error) {
    console.error('Error in getMantraById:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET /mantras/explore/by-deity - Get mantras grouped by deity
 */
exports.getMantrasByDeity = async (req, res) => {
  try {
    const { email } = req.query;

    // Check user access
    let hasAccess = false;
    if (email) {
      const userTags = await getUserTags(email);
      hasAccess = hasAnyTag(userTags, fullAccessTagsMantra);
    }

    const deities = ['SHIVA', 'KRISHNA', 'HANUMAN', 'DEVI', 'GANESHA', 'GURU', 'UNIVERSAL'];
    const result = {};

    for (const deity of deities) {
      const mantras = await Mantra.find({ deity, isActive: true })
        .sort({ position: 1, popularityScore: -1 })
        .lean();
      result[deity] = mantras;
    }

    return res.status(200).json({
      success: true,
      data: result,
      hasAccess,
    });
  } catch (error) {
    console.error('Error in getMantrasByDeity:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET /mantras/explore/by-benefit - Get mantras grouped by benefit
 */
exports.getMantrasByBenefit = async (req, res) => {
  try {
    const { email } = req.query;

    // Check user access
    let hasAccess = false;
    if (email) {
      const userTags = await getUserTags(email);
      hasAccess = hasAnyTag(userTags, fullAccessTagsMantra);
    }

    const benefits = ['ENERGY', 'CALM', 'SLEEP', 'PROTECTION', 'HEALING', 'DEVOTION', 'CONFIDENCE', 'FORGIVENESS'];
    const result = {};

    for (const benefit of benefits) {
      const mantras = await Mantra.find({ benefit, isActive: true })
        .sort({ position: 1, popularityScore: -1 })
        .lean();
      result[benefit] = mantras;
    }

    return res.status(200).json({
      success: true,
      data: result,
      hasAccess,
    });
  } catch (error) {
    console.error('Error in getMantrasByBenefit:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET /mantras/popular - Get most popular mantras
 */
exports.getPopularMantras = async (req, res) => {
  try {
    const { limit = 99 } = req.query;

    const mantras = await Mantra.find({ isActive: true })
      .sort({ popularityScore: -1, views: -1 })
      .limit(parseInt(limit))
      .lean();

    return res.status(200).json({
      success: true,
      data: mantras
    });
  } catch (error) {
    console.error('Error in getPopularMantras:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * POST /mantras - Create new mantra (Admin only)
 */
exports.createMantra = async (req, res) => {
  try {
    const mantraData = req.body;

    // Validate required fields
    const requiredFields = ['title', 'description', 'duration', 'audioUrl', 'deity', 'benefit'];
    for (const field of requiredFields) {
      if (!mantraData[field]) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`
        });
      }
    }

    const mantra = new Mantra(mantraData);
    await mantra.save();

    return res.status(201).json({
      success: true,
      data: mantra,
      message: 'Mantra created successfully'
    });
  } catch (error) {
    console.error('Error in createMantra:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * PUT /mantras/:id - Update mantra (Admin only)
 */
exports.updateMantra = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const mantra = await Mantra.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!mantra) {
      return res.status(404).json({
        success: false,
        message: 'Mantra not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: mantra,
      message: 'Mantra updated successfully'
    });
  } catch (error) {
    console.error('Error in updateMantra:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * DELETE /mantras/:id - Delete mantra (Admin only)
 */
exports.deleteMantra = async (req, res) => {
  try {
    const { id } = req.params;

    const mantra = await Mantra.findByIdAndDelete(id);

    if (!mantra) {
      return res.status(404).json({
        success: false,
        message: 'Mantra not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Mantra deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteMantra:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * PATCH /mantras/:id/position - Update mantra position (Admin only)
 */
exports.updatePosition = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items must be an array'
      });
    }

    for (const item of items) {
      await Mantra.findByIdAndUpdate(item.id, {
        position: item.position
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Positions updated successfully'
    });
  } catch (error) {
    console.error('Error in updatePosition:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * PATCH /mantras/:id/toggle-active - Toggle mantra active status (Admin only)
 */
exports.toggleActive = async (req, res) => {
  try {
    const { id } = req.params;

    const mantra = await Mantra.findById(id);
    if (!mantra) {
      return res.status(404).json({
        success: false,
        message: 'Mantra not found'
      });
    }

    mantra.isActive = !mantra.isActive;
    await mantra.save();

    return res.status(200).json({
      success: true,
      data: mantra,
      message: `Mantra ${mantra.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error in toggleActive:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
