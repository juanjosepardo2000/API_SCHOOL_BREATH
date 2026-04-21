const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();

const {
  getSystemeContacts,
  createSystemeContact,
  getApiConfig,
  testWhatsApp,
  testLLMServices
} = require('../controllers/systeme.controller');

const { oauth2ApiKeyAuth, requireScopes } = require('../utils/oauth2Auth');

// Validation middleware
const validateContactQuery = [
  query('email')
    .optional()
    .isEmail()
    .withMessage('Email must be a valid email address'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const validateContactCreation = [
  body('email')
    .isEmail()
    .withMessage('Email must be a valid email address'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('First name must not exceed 100 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Last name must not exceed 100 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each tag must not exceed 50 characters')
];

/**
 * @route   GET /api/systeme/contacts
 * @desc    Get Systeme.io contacts
 * @access  API Key with read permission
 * @headers Authorization: Bearer <api_key>
 * @query   { email?: string, page?: number, limit?: number }
 */
router.get('/contacts', 
  oauth2ApiKeyAuth, 
  requireScopes('read'), 
  validateContactQuery, 
  getSystemeContacts
);

/**
 * @route   POST /api/systeme/contacts
 * @desc    Create a new contact in Systeme.io
 * @access  API Key with write permission
 * @headers Authorization: Bearer <api_key>
 * @body    { email: string, firstName?: string, lastName?: string, tags?: string[] }
 */
router.post('/contacts', 
  oauth2ApiKeyAuth, 
  requireScopes('write'), 
  validateContactCreation, 
  createSystemeContact
);

/**
 * @route   GET /api/systeme/config
 * @desc    Get API configuration information
 * @access  API Key with read permission
 * @headers Authorization: Bearer <api_key>
 */
router.get('/config', 
  oauth2ApiKeyAuth, 
  requireScopes('read'), 
  getApiConfig
);

/**
 * @route   GET /api/systeme/whatsapp/test
 * @desc    Test WhatsApp integration configuration
 * @access  API Key with read permission
 * @headers Authorization: Bearer <api_key>
 */
router.get('/whatsapp/test', 
  oauth2ApiKeyAuth, 
  requireScopes('read'), 
  testWhatsApp
);

/**
 * @route   GET /api/systeme/llm/test
 * @desc    Test LLM services configuration
 * @access  API Key with read permission
 * @headers Authorization: Bearer <api_key>
 */
router.get('/llm/test', 
  oauth2ApiKeyAuth, 
  requireScopes('read'), 
  testLLMServices
);

module.exports = router;
