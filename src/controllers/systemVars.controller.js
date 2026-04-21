const { 
  API_SYSTEME_KEY,
  API_URL,
  DEV_API_URL,
  SYSTEME_API_URL,
  WEB_APP_URL,
  MERCHANT_IDENTIFIER,
  SUPPORTED_NETWORKS,
  SEND_GRID,
  WHATSAPP_KEY,
  OPENAI_API_KEY,
  GROQ_API_KEY,
  GROQ_API_URL,
  GROQ_TTS_URL,
  GROQ_STT_URL,
  GEMINI_API_KEY,
  OPENAI_MODEL,
  ASSISTANT_ID

} = require('../configs/vars');

/**
 * Get all system variables configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.getAllSystemVars = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'System variables configuration retrieved successfully',
      data: {
        // Systeme + Membership API
        systeme: {
          apiKey: API_SYSTEME_KEY ? API_SYSTEME_KEY : 'Not configured',
          apiUrl: API_URL || 'Not configured',
          devApiUrl: DEV_API_URL || 'Not configured',
          systemeApiUrl: SYSTEME_API_URL || 'Not configured',
          webAppUrl: WEB_APP_URL || 'Not configured'
        },
        
        // Payment / Commerce
        payment: {
          merchantIdentifier: MERCHANT_IDENTIFIER || 'Not configured',
          supportedNetworks: SUPPORTED_NETWORKS || 'Not configured'
        },
        
        // Messaging & Email
        messaging: {
          sendGrid: SEND_GRID ? SEND_GRID : 'Not configured',
          whatsappKey: WHATSAPP_KEY ? WHATSAPP_KEY : 'Not configured'
        },
        
        // LLMs
        llm: {
          openaiApiKey: OPENAI_API_KEY ? OPENAI_API_KEY : 'Not configured',
          groqApiKey: GROQ_API_KEY ? GROQ_API_KEY : 'Not configured',
          geminiApiKey: GEMINI_API_KEY ? GEMINI_API_KEY : 'Not configured',
          groqApiUrl: GROQ_API_URL || 'Not configured',
          groqTtsUrl: GROQ_TTS_URL || 'Not configured',
          groqSttUrl: GROQ_STT_URL || 'Not configured',
          openaiModel: OPENAI_MODEL || 'gpt-4o-mini',
          assistantId: ASSISTANT_ID || 'Not configured'
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get Systeme.io system variables
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.getSystemeSystemVars = async (req, res, next) => {
  try {
    if (!API_SYSTEME_KEY || !SYSTEME_API_URL) {
      return res.status(503).json({
        success: false,
        message: 'Systeme.io configuration missing',
        error: 'MISSING_CONFIG'
      });
    }

    // Simple test - just check if the configuration is present
    res.status(200).json({
      success: true,
      message: 'Systeme.io system variables retrieved successfully',
      data: {
        configured: true,
        apiUrl: SYSTEME_API_URL,
        keyLength: API_SYSTEME_KEY.length,
        keyPrefix: API_SYSTEME_KEY.substring(0, 8) + '...'
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get LLM system variables
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.getLLMSystemVars = async (req, res, next) => {
  try {
    const services = {
      openai: {
        configured: !!OPENAI_API_KEY,
        keyLength: OPENAI_API_KEY ? OPENAI_API_KEY.length : 0,
        keyPrefix: OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 8) + '...' : 'Not configured'
      },
      groq: {
        configured: !!GROQ_API_KEY,
        keyLength: GROQ_API_KEY ? GROQ_API_KEY.length : 0,
        keyPrefix: GROQ_API_KEY ? GROQ_API_KEY.substring(0, 8) + '...' : 'Not configured',
        endpoints: {
          chat: GROQ_API_URL || 'Not configured',
          tts: GROQ_TTS_URL || 'Not configured',
          stt: GROQ_STT_URL || 'Not configured'
        }
      },
      gemini: {
        configured: !!GEMINI_API_KEY,
        keyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
        keyPrefix: GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 8) + '...' : 'Not configured'
      }
    };

    res.status(200).json({
      success: true,
      message: 'LLM system variables retrieved successfully',
      data: services
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get messaging system variables
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.getMessagingSystemVars = async (req, res, next) => {
  try {
    const services = {
      email: {
        sendGrid: {
          configured: !!SEND_GRID,
          keyLength: SEND_GRID ? SEND_GRID.length : 0,
          keyPrefix: SEND_GRID ? SEND_GRID.substring(0, 8) + '...' : 'Not configured'
        }
      },
      whatsapp: {
        configured: !!WHATSAPP_KEY,
        keyLength: WHATSAPP_KEY ? WHATSAPP_KEY.length : 0,
        keyPrefix: WHATSAPP_KEY ? WHATSAPP_KEY.substring(0, 8) + '...' : 'Not configured'
      }
    };

    res.status(200).json({
      success: true,
      message: 'Messaging system variables retrieved successfully',
      data: services
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get payment system variables
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.getPaymentSystemVars = async (req, res, next) => {
  try {
    const payment = {
      merchantIdentifier: MERCHANT_IDENTIFIER || 'Not configured',
      supportedNetworks: SUPPORTED_NETWORKS ? SUPPORTED_NETWORKS.split(',') : [],
      configured: !!(MERCHANT_IDENTIFIER && SUPPORTED_NETWORKS)
    };

    res.status(200).json({
      success: true,
      message: 'Payment system variables retrieved successfully',
      data: payment
    });

  } catch (error) {
    next(error);
  }
};
