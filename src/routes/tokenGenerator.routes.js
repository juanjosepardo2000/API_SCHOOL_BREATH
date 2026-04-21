const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  generateApiKey,
  getAllApiKeys,
  getDefaultKeysInfo
} = require('../controllers/tokenGenerator.controller');

// Validation middleware
const validateApiKeyGeneration = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),
  body('permissions.*')
    .optional()
    .isIn(['read', 'write', 'admin'])
    .withMessage('Each permission must be one of: read, write, admin'),
  body('expiresInDays')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Expires in days must be between 1 and 365')
];

/**
 * @route   GET /api/tokens/info
 * @desc    Get information about default API keys
 * @access  Public
 */
router.get('/info', getDefaultKeysInfo);

/**
 * @route   GET /api/tokens
 * @desc    Get all API keys (without exposing actual keys)
 * @access  Public
 */
router.get('/', getAllApiKeys);

/**
 * @route   POST /api/tokens/generate
 * @desc    Generate a new API key
 * @access  Public
 * @body    { name?: string, description?: string, permissions?: string[], expiresInDays?: number }
 */
router.post('/generate', 
  validateApiKeyGeneration, 
  generateApiKey
);

module.exports = router;
