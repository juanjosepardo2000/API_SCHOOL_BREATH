const apiKeyService = require('../services/apiKeyService');

/**
 * Generate a new API key
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.generateApiKey = async (req, res, next) => {
  try {
    const { name, description, permissions, expiresInDays } = req.body;
    
    // Calculate expiration date if expiresInDays is provided
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expiresInDays);
      expiresAt = expirationDate;
    }
    
    // Create a new API key
    const newApiKey = apiKeyService.addApiKey({
      name: name || 'Generated API Key',
      description: description || 'Auto-generated API key',
      permissions: permissions || ['read'],
      expiresAt: expiresAt
    });

    res.status(201).json({
      success: true,
      message: 'API key generated successfully',
      data: {
        id: newApiKey.id,
        name: newApiKey.name,
        apiKey: newApiKey.apiKey, // Only returned on generation
        description: newApiKey.description,
        permissions: newApiKey.permissions,
        expiresAt: newApiKey.expiresAt,
        expiresInDays: expiresInDays || 'Never',
        createdAt: newApiKey.createdAt
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get all available API keys (without exposing the actual keys)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.getAllApiKeys = async (req, res, next) => {
  try {
    const apiKeys = apiKeyService.getAllApiKeys();

    res.status(200).json({
      success: true,
      message: 'API keys retrieved successfully',
      data: {
        totalKeys: apiKeys.length,
        keys: apiKeys.map(key => ({
          id: key.id,
          name: key.name,
          description: key.description,
          permissions: key.permissions,
          isActive: key.isActive,
          usageCount: key.usageCount,
          lastUsed: key.lastUsed,
          createdAt: key.createdAt
        }))
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get default API keys info
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.getDefaultKeysInfo = async (req, res, next) => {
  try {
    const apiKeys = apiKeyService.getAllApiKeys();
    
    res.status(200).json({
      success: true,
      message: 'Default API keys information',
      data: {
        totalKeys: apiKeys.length,
        defaultKeys: apiKeys.map(key => ({
          name: key.name,
          permissions: key.permissions,
          isActive: key.isActive,
          usageCount: key.usageCount
        })),
        note: 'API keys are generated automatically when the server starts. Check server logs for the actual keys.'
      }
    });

  } catch (error) {
    next(error);
  }
};
