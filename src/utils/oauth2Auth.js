const apiKeyService = require('../services/apiKeyService');
const User = require('../models/user.model');

/**
 * OAuth 2.0 style Bearer token authentication for API keys
 * This middleware validates API keys and provides OAuth 2.0 compliant responses
 */
exports.oauth2ApiKeyAuth = async (req, res, next) => {
  try {
    // Extract token from Authorization header (Bearer token format)
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'invalid_request',
        error_description: 'Missing or invalid Authorization header. Expected format: Bearer <token>',
        success: false
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate API key
    const validation = apiKeyService.validateApiKey(token);

    if (!validation.valid) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: validation.reason,
        success: false
      });
    }

    const apiKeyDoc = validation.keyData;

    // Check IP whitelist if configured
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    
    // Get the actual client IP (considering proxies)
    const actualIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || clientIp);
    
    if (!apiKeyService.isIpAllowed(token, actualIp)) {
      return res.status(403).json({
        error: 'access_denied',
        error_description: 'Access denied from this IP address',
        success: false
      });
    }

    // Record usage
    apiKeyService.recordUsage(token);

    // Attach API key and user info to request
    req.apiKey = apiKeyDoc;
    // Since we don't have createdBy in in-memory mode, we'll create a default user object
    req.user = {
      _id: 'system',
      email: 'system@api',
      fullName: 'API System',
      role: 'admin'
    };
    
    // Add OAuth 2.0 style scopes based on permissions
    req.scopes = apiKeyDoc.permissions;
    req.tokenType = 'Bearer';
    req.accessToken = token;

    next();

  } catch (error) {
    console.error('OAuth2 API Key Auth Error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'An internal server error occurred during authentication',
      success: false
    });
  }
};

/**
 * Middleware to check if the API key has required permissions/scopes
 * @param {string|Array} requiredScopes - Required scopes/permissions
 */
exports.requireScopes = (requiredScopes) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'No valid API key found',
        success: false
      });
    }

    const scopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];
    const userScopes = req.apiKey.permissions || [];

    // Check if user has all required scopes
    const hasRequiredScopes = scopes.every(scope => userScopes.includes(scope));

    if (!hasRequiredScopes) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: `Required scopes: ${scopes.join(', ')}. Available scopes: ${userScopes.join(', ')}`,
        success: false
      });
    }

    next();
  };
};

/**
 * Middleware to check if the API key has admin permissions
 */
exports.requireAdmin = (req, res, next) => {
  if (!req.apiKey) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'No valid API key found',
      success: false
    });
  }

  if (!req.apiKey.permissions.includes('admin')) {
    return res.status(403).json({
      error: 'insufficient_scope',
      error_description: 'Admin scope required',
      success: false
    });
  }

  next();
};

/**
 * Middleware to check if the API key has write permissions
 */
exports.requireWrite = (req, res, next) => {
  if (!req.apiKey) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'No valid API key found',
      success: false
    });
  }

  const hasWritePermission = req.apiKey.permissions.includes('write') || req.apiKey.permissions.includes('admin');

  if (!hasWritePermission) {
    return res.status(403).json({
      error: 'insufficient_scope',
      error_description: 'Write scope required',
      success: false
    });
  }

  next();
};

/**
 * Generate OAuth 2.0 compliant token response
 * @param {Object} apiKeyDoc - API key document
 * @param {Object} user - User document
 */
exports.generateTokenResponse = (apiKeyDoc, user) => {
  return {
    access_token: apiKeyDoc.apiKey,
    token_type: 'Bearer',
    expires_in: apiKeyDoc.expiresAt ? Math.floor((apiKeyDoc.expiresAt - new Date()) / 1000) : null,
    scope: apiKeyDoc.permissions.join(' '),
    user: {
      id: user._id,
      email: user.email,
      name: user.fullName,
      role: user.role
    },
    api_key: {
      id: apiKeyDoc.id,
      name: apiKeyDoc.name,
      description: apiKeyDoc.description,
      permissions: apiKeyDoc.permissions,
      created_at: apiKeyDoc.createdAt
    }
  };
};

/**
 * OAuth 2.0 error response helper
 * @param {string} error - Error code
 * @param {string} description - Error description
 * @param {number} statusCode - HTTP status code
 */
exports.oauth2Error = (error, description, statusCode = 400) => {
  return {
    error,
    error_description: description,
    success: false,
    statusCode
  };
};
