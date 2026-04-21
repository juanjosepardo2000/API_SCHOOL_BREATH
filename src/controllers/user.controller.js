// Temporarily using direct model access until hexagonal architecture is fully integrated
const { UserModel } = require("../models/user.model");
const Music = require("../models/music.model");
const {
  getMembershipStateForUser,
  reconcileMembershipStateForUser,
} = require('../services/membershipState.service');

exports.addFavoriteMusic = async (req, res, next) => {
  try {
    const { music } = req.params; // Get musicId from URL parameter
    const userId = req.user._id; // Get userId from authenticated user

    // Find the music item
    const musicItem = await Music.findById(music);
    if (!musicItem) {
      return res.status(404).json({
        success: false,
        message: 'Music not found'
      });
    }

    // Check if already favorited
    const isFavorited = musicItem.favorites.includes(userId);

    if (isFavorited) {
      // Remove from favorites
      musicItem.favorites = musicItem.favorites.filter(id => id.toString() !== userId.toString());
      await musicItem.save();
      
      res.json({ 
        success: true, 
        message: 'Music removed from favorites',
        isFavorited: false,
        favoritesCount: musicItem.favorites.length
      });
    } else {
      // Add to favorites
      musicItem.favorites.push(userId);
      await musicItem.save();
      
      res.json({ 
        success: true, 
        message: 'Music added to favorites',
        isFavorited: true,
        favoritesCount: musicItem.favorites.length
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.addFavoriteVideo = async (req, res, next) => {
  try {
    const { userId, videoId } = req.body;
    // TODO: Implement video favorite logic
    res.json({ success: true, message: 'Video added to favorites' });
  } catch (error) {
    next(error);
  }
};

exports.getUserByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    
    // Use the new check and create functionality
    const { Container } = require('../../infrastructure/di/Container');
    const container = Container.getInstance();
    const userService = container.getUserService();
    
    const result = await userService.checkAndCreateUser(email);
    
    if (!result.success) {
      return res.status(404).json({ 
        success: false, 
        message: result.info 
      });
    }
    
    res.json({ 
      success: true, 
      data: result.data,
      created: result.created || false,
      message: result.info
    });
  } catch (error) {
    next(error);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    // For /user/me route, user info comes from req.user (set by JWT auth middleware)
    if (req.user) {
      return res.json({ 
        success: true, 
        data: {
          _id: req.user._id,
          email: req.user.email,
          fullName: req.user.fullName,
          role: req.user.role,
          subscription: req.user.subscription,
          isStartSubscription: req.user.isStartSubscription,
          systemIoId: req.user.systemIoId,
          storeSubscriptionActive: req.user.storeSubscriptionActive,
          storeMembershipKind: req.user.storeMembershipKind,
          storeEntitlementExpiresAt: req.user.storeEntitlementExpiresAt,
          storeWillRenew: req.user.storeWillRenew,
          subscriptionSnapshotSource: req.user.subscriptionSnapshotSource,
          subscriptionSnapshotAt: req.user.subscriptionSnapshotAt,
          social: req.user.social,
          createdAt: req.user.createdAt,
          updatedAt: req.user.updatedAt,
          promotionDays: req.user.promotionDays,
          picture: null
        }
      });
    }
    
    // Fallback: if no user in req.user, try to get from params (for other routes)
    const { userId, email } = req.params;
    if (userId) {
      const user = await UserModel.findById(userId, { password: 0, __v: 0, role: 0 });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      return res.json({ success: true, data: user });
    }
    
    // If email is provided, use the new check and create functionality
    if (email) {
      const { Container } = require('../../infrastructure/di/Container');
      const container = Container.getInstance();
      const userService = container.getUserService();
      
      const result = await userService.checkAndCreateUser(email);
      
      if (!result.success) {
        return res.status(404).json({ 
          success: false, 
          message: result.info 
        });
      }
      
      return res.json({ 
        success: true, 
        data: result.data,
        created: result.created || false,
        message: result.info
      });
    }
    
    return res.status(401).json({ success: false, message: 'User not authenticated' });
  } catch (error) {
    next(error);
  }
};

exports.getMembership = async (req, res, next) => {
  try {
    const membership = await getMembershipStateForUser({ userId: req.user?._id });
    return res.status(200).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
};

exports.reconcileMembership = async (req, res, next) => {
  try {
    const result = await reconcileMembershipStateForUser({ userId: req.user?._id });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
};

exports.updateSubscriptionStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isStartSubscription } = req.body;
    
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { isStartSubscription },
      { new: true, select: '-password -__v -role' }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: 'Subscription status updated', user });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    // Get user ID from the authenticated user (req.user is set by JWT middleware)
    const userId = req.user._id;
    
    const user = await UserModel.findByIdAndDelete(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

