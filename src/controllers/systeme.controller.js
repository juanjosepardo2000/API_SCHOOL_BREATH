const axios = require('axios');
const { 
  API_SYSTEME_KEY, 
  SYSTEME_API_URL, 
  API_URL, 
  DEV_API_URL,
  WEB_APP_URL 
} = require('../configs/vars');

/**
 * Get Systeme.io contacts with API key authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.getSystemeContacts = async (req, res, next) => {
  try {
    const { email, page = 1, limit = 10 } = req.query;

    let url = `${SYSTEME_API_URL}/contacts`;
    const params = new URLSearchParams();
    
    if (email) {
      params.append('email', email);
    }
    params.append('page', page);
    params.append('limit', limit);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await axios.get(url, {
      headers: {
        'x-api-key': API_SYSTEME_KEY,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Systeme.io contacts retrieved successfully',
      data: response.data,
      meta: {
        apiKey: req.apiKey ? req.apiKey.name : 'Direct access',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Systeme.io API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Systeme.io API key',
        error: 'UNAUTHORIZED'
      });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found',
        error: 'NOT_FOUND'
      });
    }

    next(error);
  }
};

/**
 * Create a new contact in Systeme.io
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.createSystemeContact = async (req, res, next) => {
  try {
    const { email, firstName, lastName, tags = [] } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        error: 'VALIDATION_ERROR'
      });
    }

    const contactData = {
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      tags: tags.map(tag => ({ name: tag }))
    };

    const response = await axios.post(`${SYSTEME_API_URL}/contacts`, contactData, {
      headers: {
        'x-api-key': API_SYSTEME_KEY,
        'Content-Type': 'application/json'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Contact created successfully in Systeme.io',
      data: response.data,
      meta: {
        apiKey: req.apiKey ? req.apiKey.name : 'Direct access',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Systeme.io Create Contact Error:', error.response?.data || error.message);
    
    if (error.response?.status === 409) {
      return res.status(409).json({
        success: false,
        message: 'Contact already exists',
        error: 'DUPLICATE_CONTACT'
      });
    }

    next(error);
  }
};

/**
 * Get API configuration information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.getApiConfig = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'API configuration retrieved successfully',
      data: {
        apiUrls: {
          production: API_URL,
          development: DEV_API_URL,
          webApp: WEB_APP_URL,
          systeme: SYSTEME_API_URL
        },
        features: {
          systemeIntegration: !!API_SYSTEME_KEY,
          apiKeyAuth: true,
          oauth2Compliant: true
        },
        meta: {
          apiKey: req.apiKey ? req.apiKey.name : 'Direct access',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Test WhatsApp integration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.testWhatsApp = async (req, res, next) => {
  try {
    const { WHATSAPP_KEY } = require('../configs/vars');
    
    if (!WHATSAPP_KEY) {
      return res.status(503).json({
        success: false,
        message: 'WhatsApp integration not configured',
        error: 'SERVICE_UNAVAILABLE'
      });
    }

    res.status(200).json({
      success: true,
      message: 'WhatsApp integration is configured',
      data: {
        configured: true,
        keyLength: WHATSAPP_KEY.length,
        keyPrefix: WHATSAPP_KEY.substring(0, 8) + '...'
      },
      meta: {
        apiKey: req.apiKey ? req.apiKey.name : 'Direct access',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Test LLM services configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.testLLMServices = async (req, res, next) => {
  try {
    const { 
      OPENAI_API_KEY, 
      GROQ_API_KEY, 
      GROQ_API_URL, 
      GROQ_TTS_URL, 
      GROQ_STT_URL,
      GEMINI_API_KEY
    } = require('../configs/vars');

    const services = {
      openai: {
        configured: !!OPENAI_API_KEY,
        keyLength: OPENAI_API_KEY ? OPENAI_API_KEY.length : 0
      },
      groq: {
        configured: !!GROQ_API_KEY,
        keyLength: GROQ_API_KEY ? GROQ_API_KEY.length : 0,
        endpoints: {
          chat: GROQ_API_URL,
          tts: GROQ_TTS_URL,
          stt: GROQ_STT_URL
        }
      },
      gemini: {
        configured: !!GEMINI_API_KEY,
        keyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0
      }
    };

    res.status(200).json({
      success: true,
      message: 'LLM services configuration retrieved',
      data: services,
      meta: {
        apiKey: req.apiKey ? req.apiKey.name : 'Direct access',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
};
