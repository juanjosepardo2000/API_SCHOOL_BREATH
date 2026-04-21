const controller = require('../controllers/user.controller')
const { Router } = require('express')
const { authorize, ADMIN, LOGGED_USER } = require('../utils/auth');

let router = Router()



// Get current user profile
router
    .route('/me')
    .get(authorize(), controller.getOne)

// Backend-authoritative membership state
router
    .route('/membership')
    .get(authorize(), controller.getMembership)

// Force backend reconciliation with RevenueCat + Systeme sync
router
    .route('/membership/reconcile')
    .post(authorize(), controller.reconcileMembership)

// Delete current user account
router
    .route('/delete')
    .delete(authorize(), controller.deleteUser)

// Get user by email (public endpoint)
router
    .route('/users/:email')
    .get(controller.getUserByEmail)

// Update user subscription status
router
    .route('/updateSubscriptionStatus')
    .put(authorize(), controller.updateSubscriptionStatus)

// Add music to favorites
router
    .route('/add-favorite/music/:music')
    .put(authorize(), controller.addFavoriteMusic)

// Add video to favorites
router
    .route('/add-favorite/video/:video')
    .put(authorize(), controller.addFavoriteVideo)

// Check and create user (creates in both MongoDB and Systeme.io)
router
    .route('/check-and-create/:email')
    .get(controller.getUserByEmail)

module.exports = router
