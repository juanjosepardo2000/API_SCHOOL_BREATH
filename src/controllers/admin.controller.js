/**
 * Admin controller – dashboard overview stats for admin panel
 * - activeUsers: total User count
 * - satisfaction: average Review rating as % (1–5 scale → 0–100%)
 */
const User = require('../models/user.model');
const Review = require('../models/review.model');

exports.getDashboardStats = async (req, res) => {
  try {
    const [userCount, reviewStats] = await Promise.all([
      User.countDocuments(),
      Review.aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id: null,
            average: { $avg: '$rating' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const satisfactionResult = reviewStats[0];
    const satisfactionPct = satisfactionResult
      ? Math.round((satisfactionResult.average / 5) * 100)
      : null;

    res.status(200).json({
      activeUsers: userCount,
      satisfaction: satisfactionPct,
      reviewCount: satisfactionResult?.count ?? 0
    });
  } catch (error) {
    console.error('Admin getDashboardStats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};
