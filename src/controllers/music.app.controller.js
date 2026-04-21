const Music = require("../models/music.model");
const axios = require("axios");
const Category = require('../models/categories.model')
const AccessChakraTagsConfig = require('../configs/access')
const fullAccessTags = [
  'Enrolled_to_Membership',
  'Enrolled_Holistic Membership',
  'Enrolled_Swara Yoga Membership',
  'UPIPayerMonthly',
  'UPIPayerAnnual',
  'Order Bump - Monthly Holistic Membership',
  'Enrolled_to_Sleep_Membership',
];

const limitedAccessTags = [
  'Purchased_9-Day Breathwork Course',
  'Purchased_9-Day Meditation Course'
];



const hasAnyTag = (userTags, tagsToCheck) => {
  return tagsToCheck.some(tag => userTags.includes(tag));
};

const CATEGORY_NAME_ALIASES = {
  mantra: ['mantras', 'mantra'],
  chakra: ['shakra', 'chakra', 'chakras'],
  guidedMeditation: ['guided meditation', 'guided-meditation', 'guided meditations'],
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getUserTags = async (userEmail) => {
  if (!userEmail) return [];

  const response = await axios.get(`https://api.systeme.io/api/contacts?email=${userEmail}`, {
    headers: {
      'x-api-key': process.env.API_SYSTEME_KEY
    },
  });

  const contacts = response.data?.items[0] ?? null;
  return contacts ? contacts.tags.map(tag => tag.name) : [];
};

const resolveCategoryIdsByNames = async (categoryNames = []) => {
  if (!categoryNames.length) return [];

  const categoryMatchers = categoryNames.map(
    (name) => new RegExp(`^${escapeRegExp(name)}$`, 'i')
  );

  const categories = await Category.find({
    name: { $in: categoryMatchers }
  }).select('_id');

  return categories.map((category) => category._id);
};

const getFavoriteAppMusic = async ({ userId, userEmail, categoryIds = [], categoryId }) => {
  const userTags = await getUserTags(userEmail);

  const query = { favorites: userId, typeContent: 'app' };

  if (categoryIds.length) {
    query.categories = { $in: categoryIds };
  } else if (categoryId) {
    query.categories = { $in: [categoryId] };
  }

  const musicList = await Music.find(query).populate('categories');
  const isPremium = hasAnyTag(userTags, fullAccessTags);

  return { musicList, isPremium };
};

const getFavoritesByCategoryAliases = async (req, res, aliases, categoryLabel) => {
  try {
    const categoryIds = await resolveCategoryIdsByNames(aliases);

    if (!categoryIds.length) {
      return res.status(404).json({
        message: `${categoryLabel} category not found in system`
      });
    }

    const { musicList, isPremium } = await getFavoriteAppMusic({
      userId: req.user._id,
      userEmail: req.user.email,
      categoryIds
    });

    return res.status(200).json({ musicList, isPremium });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getPreviewMusicsByCategory = async (req, res, next) => {
  try {
    const { category } = req.query;
    let query = { typeContent: 'app' };

    // Find categories to exclude
    const excludedCategories = await Category.find({ 
      name: { $in: ['shakra', 'guided meditation'] } 
    });

    const excludedCategoryIds = excludedCategories.map(cat => cat._id);

    // Add exclusion to the query
    query.categories = { $nin: excludedCategoryIds };

    // If a specific category is requested
    if (category) {
      query.categories.$in = [category];
    }

    const musicList = await Music.find(query).populate('categories');

    return res.status(200).json({ musicList, isPremium: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.getMusicsByCategory = async (req, res, next) => {
  try {
    const { category } = req.query;
    const userEmail = req.user.email;

    const response = await axios.get(`https://api.systeme.io/api/contacts?email=${userEmail}`, {
      headers: {
        'x-api-key': process.env.API_SYSTEME_KEY
      },
    });

    const contacts = response.data?.items[0] ?? null;
    const userTags = contacts ? contacts.tags.map(tag => tag.name) : [];

    // Base query
    let query = { typeContent: 'app' };

    // Find categories to exclude
    const excludedCategories = await Category.find({ 
      name: { $in: ['shakra', 'guided meditation'] } 
    });

    const excludedCategoryIds = excludedCategories.map(cat => cat._id);

    // Add exclusion to the query
    query.categories = { $nin: excludedCategoryIds };

    // If a specific category is requested
    if (category) {
      query.categories.$in = [category];
    }

    let isPremium = true;
    let musicList = [];

    const hasFullAccess = hasAnyTag(userTags, fullAccessTags);
    const hasLimitedAccess = hasAnyTag(userTags, limitedAccessTags);

    if (hasFullAccess) {
      musicList = await Music.find(query).populate('categories');
    } else if (hasLimitedAccess) {
      musicList = await Music.find(query).populate('categories');
      isPremium = false;
    } else {
      musicList = await Music.find(query).populate('categories');
      isPremium = false;
    }

    return res.status(200).json({ musicList, isPremium });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllFavoritesByCategory = async (req, res, next) => {
  try {
    const { category } = req.query;
    const userEmail = req.user.email;
    const userId = req.user._id;
    const { musicList, isPremium } = await getFavoriteAppMusic({
      userId,
      userEmail,
      categoryId: category
    });

    return res.status(200).json({ musicList, isPremium });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMantraFavoritesByCategory = async (req, res, next) => {
  return getFavoritesByCategoryAliases(req, res, CATEGORY_NAME_ALIASES.mantra, 'Mantra');
};

exports.getShakraFavoritesByCategory = async (req, res, next) => {
  return getFavoritesByCategoryAliases(req, res, CATEGORY_NAME_ALIASES.chakra, 'Shakra/Chakra');
};

exports.getGuidedMeditationFavoritesByCategory = async (req, res, next) => {
  return getFavoritesByCategoryAliases(req, res, CATEGORY_NAME_ALIASES.guidedMeditation, 'Guided meditation');
};



exports.getShakraMusicByCategory = async (req, res, next) => {
  try {
    const userEmail = req.query.email;
    
    // First, get the shakra category ObjectId
    const shakraCategory = await Category.findOne({ name: 'shakra' });
    if (!shakraCategory) {
      return res.status(404).json({ message: "Shakra category not found in system" });
    }

    let userTags = [];
    if(userEmail){
      try {
        // Get user tags from Systeme.io
        const response = await axios.get(`https://api.systeme.io/api/contacts?email=${userEmail}`, {
          headers: {
            'x-api-key': process.env.API_SYSTEME_KEY,
          },
        });
        const contacts = response.data?.items[0] ?? null;
        userTags = contacts ? contacts.tags.map(tag => tag.name) : [];
      } catch (error) {
        // If there's an error fetching user tags or user doesn't exist, continue with empty tags
        console.error('Error fetching user tags:', error);
        userTags = [];
      }
    }

    // Base query for Shakra music using ObjectId
    let query = {
      typeContent: 'app',
      categories: shakraCategory._id  // Use the ObjectId directly
    };
    
    let isPremium = true;
    let musicList = [];

    const hasFullAccess = hasAnyTag(userTags, AccessChakraTagsConfig.fullAccessTagsForChakra);
    const hasLimitedAccess = hasAnyTag(userTags, AccessChakraTagsConfig.limitedAccessTagsChakra);

    if (hasFullAccess || hasLimitedAccess) {
      // Full access members can see all Shakra music
      musicList = await Music.find(query).populate('categories');
    } else {
      // Non-members see only non-premium Shakra music
      musicList = await Music.find(query).populate('categories');
      isPremium = false;
    }

    // Add total count to response
    const totalCount = musicList.length;

    // Optional: Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 99;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    //const paginatedMusic = musicList.slice(startIndex, endIndex);

    return res.status(200).json({
      musicList:  musicList,
      isPremium,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit)
    });

  } catch (error) {
    console.error('Error in getShakraMusicByCategory:', error);
    res.status(500).json({
      message: 'Failed to fetch Shakra music',
      error: error.message
    });
  }
};
