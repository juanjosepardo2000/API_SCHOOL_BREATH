const controller = require('../controllers/auth.controller')
const { Router } = require('express')
const { authorize, ADMIN, LOGGED_USER } = require('../utils/auth');

let router = Router()

router
    .route('/register')
    .post(controller.store)

router
    .route('/login')
    .post(controller.login)

// Unified social sign-in
router
    .route('/social')
    .post(controller.socialLogin)

// Unlink / revoke provider
router
    .route('/unlink')
    .post(controller.unlinkProvider)

// Link a provider to an existing account (user must be authenticated via JWT)
router
    .route('/social/link')
    .post(authorize(), controller.socialLink)
router
    .route('/generateResetToken')
    .post(controller.generateResetToken)
router
    .route('/resetPassword')
    .post(controller.resetPassword)

router
    .route('/changepassword')
    .post(authorize(LOGGED_USER), controller.changePassword)

// New, app-friendly change-password endpoint (same controller)
router
    .route('/change-password')
    .post(authorize(LOGGED_USER), controller.changePassword)







module.exports = router
