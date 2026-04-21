//TODO: cambiar a variables de entorno
module.exports = {
    port: process.env.PORT || 8085,
    allowedOrigins: ["*"],
    mongoUri: "mongodb+srv://abhishekdug:AONgv5tx5LngDz4b@cluster0.j2ulcwk.mongodb.net/school-of-breath?retryWrites=true&w=majority",
    jwtSecret: process.env.JWT_SECRET || '5up3r53cr3tk3y',
    resendKey: process.env.ROSSI_KEY,
    sendEmail: process.env.SEND_EMAIL,
    receiveEmail: process.env.RECEIVE_EMAIL,
    AWS: {
        awsId: process.env.AWS_ID,
        awsSecret: process.env.AWS_SECRET,
        awsBucketName: process.env.AWS_BUCKET_NAME
    },
    STRIPE:{
        secret: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.WEB_HOOK_KEY
    },
    REVENUECAT: {
        webhookAuthToken: process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN || '',
        webhookHmacSecret: process.env.REVENUECAT_WEBHOOK_HMAC_SECRET || '',
        webhookAllowedEventTypes: process.env.REVENUECAT_WEBHOOK_EVENT_TYPES || '',
        apiKey: process.env.REVENUECAT_SECRET_API_KEY || '',
        apiBaseUrl: process.env.REVENUECAT_API_BASE_URL || 'https://api.revenuecat.com/v1',
        entitlementId: process.env.REVENUECAT_ENTITLEMENT_ID || 'pro',
        removeEnrollTagsOnExpire: String(process.env.REVENUECAT_REMOVE_ENROLL_TAGS_ON_EXPIRE || 'true').toLowerCase() !== 'false',
        forwardWebhookUrl: "https://n8n-production-bbef9.up.railway.app/webhook/60141343-f118-4fb0-a692-1e7b0af74370",
        forwardWebhookTimeoutMs: Number(process.env.REVENUECAT_FORWARD_WEBHOOK_TIMEOUT_MS || 8000),
    },
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SMTP: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true' || false,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    // Systeme + Membership API
    API_SYSTEME_KEY: process.env.API_SYSTEME_KEY,
    API_URL: process.env.API_URL,
    DEV_API_URL: process.env.DEV_API_URL,
    SYSTEME_API_URL: process.env.SYSTEME_API_URL,
    WEB_APP_URL: process.env.WEB_APP_URL,
    
    // Payment / Commerce
    MERCHANT_IDENTIFIER: process.env.MERCHANT_IDENTIFIER,
    SUPPORTED_NETWORKS: process.env.SUPPORTED_NETWORKS,
    
    // Messaging & Email
    SEND_GRID: process.env.SEND_GRID,
    WHATSAPP_KEY: process.env.WHATSAPP_KEY,
    
    // LLMs
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_API_URL: process.env.GROQ_API_URL,
    GROQ_TTS_URL: process.env.GROQ_TTS_URL,
    GROQ_STT_URL: process.env.GROQ_STT_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    ASSISTANT_ID: process.env.ASSISTANT_ID,
    
    // API Authentication
    SYSTEM_VARS_API_KEY: process.env.SYSTEM_VARS_API_KEY || null
}
