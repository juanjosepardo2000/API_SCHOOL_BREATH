const MantraCategory = require("../models/mantraCategory.model");
const Mantra = require("../models/mantra.model");

/**
 * GET /mantras/categories/deities - Get all deity categories with mantra counts
 */
exports.getDeities = async (req, res) => {
  try {
    const deities = await MantraCategory.find({
      type: 'DEITY',
      isActive: true
    }).sort({ order: 1 }).lean();

    // Get mantra counts for each deity
    const deitiesWithCounts = await Promise.all(
      deities.map(async (deity) => {
        const count = await Mantra.countDocuments({
          deity: deity.identifier,
          isActive: true
        });
        return {
          ...deity,
          mantraCount: count
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: deitiesWithCounts
    });
  } catch (error) {
    console.error('Error in getDeities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch deities',
      error: error.message
    });
  }
};

/**
 * GET /mantras/categories/benefits - Get all benefit categories with mantra counts
 */
exports.getBenefits = async (req, res) => {
  try {
    const benefits = await MantraCategory.find({
      type: 'BENEFIT',
      isActive: true
    }).sort({ order: 1 }).lean();

    // Get mantra counts for each benefit
    const benefitsWithCounts = await Promise.all(
      benefits.map(async (benefit) => {
        const count = await Mantra.countDocuments({
          benefit: benefit.identifier,
          isActive: true
        });
        return {
          ...benefit,
          mantraCount: count
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: benefitsWithCounts
    });
  } catch (error) {
    console.error('Error in getBenefits:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch benefits',
      error: error.message
    });
  }
};

/**
 * GET /mantras/categories/difficulties - Get all difficulty levels with mantra counts
 */
exports.getDifficulties = async (req, res) => {
  try {
    const difficulties = await MantraCategory.find({
      type: 'DIFFICULTY',
      isActive: true
    }).sort({ order: 1 }).lean();

    // Get mantra counts for each difficulty
    const difficultiesWithCounts = await Promise.all(
      difficulties.map(async (difficulty) => {
        const count = await Mantra.countDocuments({
          difficulty: difficulty.identifier,
          isActive: true
        });
        return {
          ...difficulty,
          mantraCount: count
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: difficultiesWithCounts
    });
  } catch (error) {
    console.error('Error in getDifficulties:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch difficulties',
      error: error.message
    });
  }
};

/**
 * GET /mantras/categories/all - Get all categories grouped by type
 */
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await MantraCategory.find({ isActive: true })
      .sort({ type: 1, order: 1 })
      .lean();

    // Group by type
    const grouped = {
      deities: [],
      benefits: [],
      difficulties: []
    };

    // Get counts for all categories
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        let count = 0;

        if (category.type === 'DEITY') {
          count = await Mantra.countDocuments({
            deity: category.identifier,
            isActive: true
          });
        } else if (category.type === 'BENEFIT') {
          count = await Mantra.countDocuments({
            benefit: category.identifier,
            isActive: true
          });
        } else if (category.type === 'DIFFICULTY') {
          count = await Mantra.countDocuments({
            difficulty: category.identifier,
            isActive: true
          });
        }

        return {
          ...category,
          mantraCount: count
        };
      })
    );

    // Group them
    categoriesWithCounts.forEach(category => {
      if (category.type === 'DEITY') {
        grouped.deities.push(category);
      } else if (category.type === 'BENEFIT') {
        grouped.benefits.push(category);
      } else if (category.type === 'DIFFICULTY') {
        grouped.difficulties.push(category);
      }
    });

    return res.status(200).json({
      success: true,
      data: grouped
    });
  } catch (error) {
    console.error('Error in getAllCategories:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

/**
 * GET /mantras/categories/stats - Get overall statistics
 */
exports.getCategoryStats = async (req, res) => {
  try {
    // Get total mantra count
    const totalMantras = await Mantra.countDocuments({ isActive: true });

    // Get counts by deity
    const deityStats = await Mantra.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$deity', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get counts by benefit
    const benefitStats = await Mantra.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$benefit', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get counts by difficulty
    const difficultyStats = await Mantra.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get most popular mantras
    const topMantras = await Mantra.find({ isActive: true })
      .sort({ popularityScore: -1 })
      .limit(5)
      .select('title deity benefit popularityScore')
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        totalMantras,
        byDeity: deityStats,
        byBenefit: benefitStats,
        byDifficulty: difficultyStats,
        topMantras
      }
    });
  } catch (error) {
    console.error('Error in getCategoryStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

/**
 * POST /mantras/categories - Create new category (Admin)
 */
exports.createCategory = async (req, res) => {
  try {
    const categoryData = req.body;

    // Validate required fields
    if (!categoryData.type || !categoryData.identifier || !categoryData.label) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type, identifier, label'
      });
    }

    const category = new MantraCategory(categoryData);
    await category.save();

    return res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this type and identifier already exists'
      });
    }

    console.error('Error in createCategory:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * PUT /mantras/categories/:id - Update category (Admin)
 */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const category = await MantraCategory.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('Error in updateCategory:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * DELETE /mantras/categories/:id - Delete category (Admin)
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await MantraCategory.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteCategory:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
