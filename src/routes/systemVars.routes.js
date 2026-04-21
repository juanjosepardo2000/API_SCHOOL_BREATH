const express = require('express');
const router = express.Router();

const {
  getAllSystemVars
} = require('../controllers/systemVars.controller');

const { oauth2ApiKeyAuth, requireScopes } = require('../utils/oauth2Auth');
const { SYSTEM_VARS_API_KEY } = require('../configs/vars');

// Middleware to automatically add Bearer token from environment
const autoAuthMiddleware = (req, res, next) => {
  // Automatically set the Authorization header with the Bearer token from environment
  req.headers.authorization = `Bearer ${SYSTEM_VARS_API_KEY}`;
  next();
};

/**
 * @route   GET /system-vars
 * @desc    Get all system variables configuration
 * @access  API Key automatically provided by backend
 * @headers Authorization: Bearer <api_key> (automatically set)
 */
router.get('/', 
  autoAuthMiddleware,
  oauth2ApiKeyAuth, 
  requireScopes('read'), 
  getAllSystemVars
);

module.exports = router;
