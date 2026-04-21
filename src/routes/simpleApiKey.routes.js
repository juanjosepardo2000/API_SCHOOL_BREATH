const express = require('express');
const router = express.Router();

const { oauth2ApiKeyAuth, requireScopes } = require('../utils/oauth2Auth');

/**
 * @route   GET /api/simple/test
 * @desc    Simple test endpoint that doesn't require authentication
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Simple API is working!',
    timestamp: new Date().toISOString(),
    data: {
      status: 'healthy',
      version: '1.0.0'
    }
  });
});

/**
 * @route   GET /api/simple/protected
 * @desc    Protected endpoint that requires API key authentication
 * @access  API Key required
 * @headers Authorization: Bearer <api_key>
 */
router.get('/protected', 
  oauth2ApiKeyAuth, 
  (req, res) => {
    res.json({
      success: true,
      message: 'Protected endpoint accessed successfully!',
      timestamp: new Date().toISOString(),
      data: {
        apiKey: {
          name: req.apiKey.name,
          permissions: req.apiKey.permissions,
          usageCount: req.apiKey.usageCount
        },
        user: req.user
      }
    });
  }
);

/**
 * @route   GET /api/simple/read-only
 * @desc    Read-only endpoint that requires read permission
 * @access  API Key with read permission
 * @headers Authorization: Bearer <api_key>
 */
router.get('/read-only', 
  oauth2ApiKeyAuth, 
  requireScopes('read'), 
  (req, res) => {
    res.json({
      success: true,
      message: 'Read-only endpoint accessed successfully!',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is read-only data',
        apiKey: {
          name: req.apiKey.name,
          permissions: req.apiKey.permissions
        }
      }
    });
  }
);

/**
 * @route   POST /api/simple/write-data
 * @desc    Write endpoint that requires write permission
 * @access  API Key with write permission
 * @headers Authorization: Bearer <api_key>
 */
router.post('/write-data', 
  oauth2ApiKeyAuth, 
  requireScopes('write'), 
  (req, res) => {
    res.json({
      success: true,
      message: 'Data written successfully!',
      timestamp: new Date().toISOString(),
      data: {
        receivedData: req.body,
        apiKey: {
          name: req.apiKey.name,
          permissions: req.apiKey.permissions
        }
      }
    });
  }
);

/**
 * @route   DELETE /api/simple/admin-action
 * @desc    Admin endpoint that requires admin permission
 * @access  API Key with admin permission
 * @headers Authorization: Bearer <api_key>
 */
router.delete('/admin-action', 
  oauth2ApiKeyAuth, 
  requireScopes('admin'), 
  (req, res) => {
    res.json({
      success: true,
      message: 'Admin action performed successfully!',
      timestamp: new Date().toISOString(),
      data: {
        action: 'admin-action-completed',
        apiKey: {
          name: req.apiKey.name,
          permissions: req.apiKey.permissions
        }
      }
    });
  }
);

/**
 * @route   GET /api/simple/api-key-info
 * @desc    Get information about the current API key
 * @access  Any valid API Key
 * @headers Authorization: Bearer <api_key>
 */
router.get('/api-key-info', 
  oauth2ApiKeyAuth, 
  (req, res) => {
    res.json({
      success: true,
      message: 'API key information retrieved successfully!',
      timestamp: new Date().toISOString(),
      data: {
        apiKey: {
          id: req.apiKey.id,
          name: req.apiKey.name,
          description: req.apiKey.description,
          permissions: req.apiKey.permissions,
          isActive: req.apiKey.isActive,
          usageCount: req.apiKey.usageCount,
          lastUsed: req.apiKey.lastUsed,
          createdAt: req.apiKey.createdAt,
          expiresAt: req.apiKey.expiresAt
        },
        user: req.user
      }
    });
  }
);

module.exports = router;
