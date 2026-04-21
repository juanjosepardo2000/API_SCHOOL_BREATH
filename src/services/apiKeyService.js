const crypto = require('crypto');

/**
 * Simple in-memory API key storage service
 * No database required - stores API keys in memory
 */
class ApiKeyService {
  constructor() {
    this.apiKeys = new Map();
    this.initializeDefaultKeys();
  }

  /**
   * Initialize with some default API keys
   */
  initializeDefaultKeys() {
    // Only register the API key from environment/config
    try {
      const { SYSTEM_VARS_API_KEY } = require('../configs/vars');
      if (SYSTEM_VARS_API_KEY) {
        this.addExistingApiKey({
          apiKey: SYSTEM_VARS_API_KEY,
          name: 'Env System Vars Key',
          description: 'Preconfigured API key from environment for system-vars',
          permissions: ['read']
        });
        console.log('✅ Environment API key loaded successfully');
      } else {
        console.log('❌ SYSTEM_VARS_API_KEY not found in environment');
      }
    } catch (e) {
      console.log('❌ Error loading SYSTEM_VARS_API_KEY:', e.message);
    }
  }

  /**
   * Generate a new API key
   */
  generateApiKey() {
    return 'sk_' + crypto.randomBytes(32).toString('hex');
  }

  /**
   * Add a new API key
   */
  addApiKey({ name, description = '', permissions = ['read'], expiresAt = null, ipWhitelist = [] }) {
    const apiKey = this.generateApiKey();
    const keyData = {
      id: crypto.randomUUID(),
      name,
      description,
      apiKey,
      permissions,
      isActive: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      ipWhitelist,
      createdAt: new Date(),
      lastUsed: null,
      usageCount: 0
    };

    this.apiKeys.set(apiKey, keyData);
    return keyData;
  }

  /**
   * Add an existing API key (provided value) to the store
   */
  addExistingApiKey({ apiKey, name, description = '', permissions = ['read'], expiresAt = null, ipWhitelist = [] }) {
    if (!apiKey) return null;
    const keyData = {
      id: crypto.randomUUID(),
      name,
      description,
      apiKey,
      permissions,
      isActive: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      ipWhitelist,
      createdAt: new Date(),
      lastUsed: null,
      usageCount: 0
    };

    this.apiKeys.set(apiKey, keyData);
    return keyData;
  }

  /**
   * Get API key by the actual key string
   */
  getApiKey(apiKey) {
    return this.apiKeys.get(apiKey) || null;
  }

  /**
   * Get all API keys
   */
  getAllApiKeys() {
    return Array.from(this.apiKeys.values()).map(key => ({
      ...key,
      apiKey: undefined // Don't expose the actual key in listings
    }));
  }

  /**
   * Update an API key
   */
  updateApiKey(apiKey, updates) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return null;
    }

    const updatedKey = { ...keyData, ...updates };
    this.apiKeys.set(apiKey, updatedKey);
    return updatedKey;
  }

  /**
   * Delete an API key
   */
  deleteApiKey(apiKey) {
    return this.apiKeys.delete(apiKey);
  }

  /**
   * Regenerate an API key
   */
  regenerateApiKey(oldApiKey) {
    const keyData = this.apiKeys.get(oldApiKey);
    if (!keyData) {
      return null;
    }

    // Remove old key
    this.apiKeys.delete(oldApiKey);

    // Generate new key
    const newApiKey = this.generateApiKey();
    const newKeyData = {
      ...keyData,
      apiKey: newApiKey,
      createdAt: new Date()
    };

    this.apiKeys.set(newApiKey, newKeyData);
    return newKeyData;
  }

  /**
   * Toggle API key status
   */
  toggleApiKeyStatus(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return null;
    }

    keyData.isActive = !keyData.isActive;
    this.apiKeys.set(apiKey, keyData);
    return keyData;
  }

  /**
   * Record API key usage
   */
  recordUsage(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return false;
    }

    keyData.lastUsed = new Date();
    keyData.usageCount += 1;
    this.apiKeys.set(apiKey, keyData);
    return true;
  }

  /**
   * Validate API key
   */
  validateApiKey(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return { valid: false, reason: 'API key not found' };
    }

    if (!keyData.isActive) {
      return { valid: false, reason: 'API key is inactive' };
    }

    if (keyData.expiresAt && keyData.expiresAt < new Date()) {
      return { valid: false, reason: 'API key has expired' };
    }

    return { valid: true, keyData };
  }

  /**
   * Check if API key has required permissions
   */
  hasPermission(apiKey, requiredPermissions) {
    const validation = this.validateApiKey(apiKey);
    if (!validation.valid) {
      return false;
    }

    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    return permissions.every(permission => validation.keyData.permissions.includes(permission));
  }

  /**
   * Check IP whitelist
   */
  isIpAllowed(apiKey, clientIp) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData || keyData.ipWhitelist.length === 0) {
      return true; // No IP restrictions
    }

    return keyData.ipWhitelist.includes(clientIp);
  }

  /**
   * Get API key statistics
   */
  getStats(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return null;
    }

    return {
      id: keyData.id,
      name: keyData.name,
      usageCount: keyData.usageCount,
      lastUsed: keyData.lastUsed,
      createdAt: keyData.createdAt,
      daysSinceCreation: Math.floor((new Date() - keyData.createdAt) / (1000 * 60 * 60 * 24))
    };
  }
}

// Create a singleton instance
const apiKeyService = new ApiKeyService();

module.exports = apiKeyService;
