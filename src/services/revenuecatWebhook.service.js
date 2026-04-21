const crypto = require('crypto');
const { REVENUECAT } = require('../configs/vars');

const toBuffer = (value) => {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  return null;
};

const secureCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const normalizeAuthorizationValue = (headerValue) => {
  if (!headerValue || typeof headerValue !== 'string') return '';
  const trimmed = headerValue.trim();
  if (!trimmed) return '';

  const bearerPrefix = /^bearer\s+/i;
  if (bearerPrefix.test(trimmed)) {
    return trimmed.replace(bearerPrefix, '').trim();
  }

  return trimmed;
};

const getConfiguredAllowedEventTypes = () => {
  const raw = REVENUECAT?.webhookAllowedEventTypes || '';
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

const getRawBodyOrThrow = (req) => {
  const rawBody = toBuffer(req.body);
  if (!rawBody) {
    throw new Error('Webhook body must be raw JSON bytes (Buffer)');
  }
  return rawBody;
};

const parseRevenueCatPayloadOrThrow = (rawBody) => {
  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new Error('Invalid JSON payload');
  }
};

const extractRevenueCatEventId = (payload) => {
  return (
    payload?.event?.id ||
    payload?.event?.event_id ||
    payload?.id ||
    payload?.event_id ||
    null
  );
};

const extractRevenueCatEventType = (payload) => {
  return (
    payload?.event?.type ||
    payload?.event?.event_type ||
    payload?.type ||
    payload?.event_type ||
    'unknown'
  );
};

const extractRevenueCatAppUserId = (payload) => {
  return (
    payload?.event?.app_user_id ||
    payload?.event?.appUserId ||
    payload?.app_user_id ||
    payload?.appUserId ||
    null
  );
};

const computePayloadHash = (rawBody) =>
  crypto.createHash('sha256').update(rawBody).digest('hex');

const normalizeSignatureHeader = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^sha256=/i, '');
};

const verifyOptionalHmacSignature = (rawBody, req) => {
  const expectedSecret = REVENUECAT?.webhookHmacSecret || '';
  if (!expectedSecret) {
    return { ok: true, mode: 'not_configured' };
  }

  const headerValue =
    req.headers['x-revenuecat-signature'] ||
    req.headers['x-revenuecat-signature-v1'] ||
    req.headers['x-signature'];

  const providedSignature = normalizeSignatureHeader(headerValue);
  if (!providedSignature) {
    return { ok: false, mode: 'hmac', reason: 'Missing signature header' };
  }

  const digestHex = crypto.createHmac('sha256', expectedSecret).update(rawBody).digest('hex');
  const digestBase64 = crypto.createHmac('sha256', expectedSecret).update(rawBody).digest('base64');

  const valid =
    secureCompare(providedSignature, digestHex) ||
    secureCompare(providedSignature, digestBase64);

  if (!valid) {
    return { ok: false, mode: 'hmac', reason: 'Invalid webhook signature' };
  }

  return { ok: true, mode: 'hmac' };
};

const verifyWebhookAuthorization = (req) => {
  const expectedToken = REVENUECAT?.webhookAuthToken || '';
  if (!expectedToken) {
    return { ok: false, reason: 'RevenueCat webhook auth token is not configured' };
  }

  const providedToken = normalizeAuthorizationValue(req.headers.authorization);
  if (!providedToken) {
    return { ok: false, reason: 'Missing Authorization header' };
  }

  if (!secureCompare(providedToken, expectedToken)) {
    return { ok: false, reason: 'Invalid Authorization token' };
  }

  return { ok: true };
};

const isAllowedRevenueCatEventType = (eventType) => {
  const allowed = getConfiguredAllowedEventTypes();
  if (allowed.length === 0) return true;
  return allowed.includes(eventType);
};

module.exports = {
  computePayloadHash,
  extractRevenueCatAppUserId,
  extractRevenueCatEventId,
  extractRevenueCatEventType,
  getRawBodyOrThrow,
  isAllowedRevenueCatEventType,
  parseRevenueCatPayloadOrThrow,
  verifyOptionalHmacSignature,
  verifyWebhookAuthorization,
};
