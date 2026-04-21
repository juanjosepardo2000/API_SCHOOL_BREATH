const axios = require('axios');
const { REVENUECAT } = require('../configs/vars');

const normalizeStatus = (processingResult, fallback = 'processed') => {
  if (!processingResult) return fallback;
  if (processingResult.status === 'ignored') return 'ignored';
  if (typeof processingResult.storeSubscriptionActive === 'boolean') {
    return processingResult.storeSubscriptionActive ? 'active' : 'inactive';
  }
  return processingResult.action || processingResult.status || fallback;
};

const normalizeMembershipType = (membershipType) => {
  if (!membershipType) return 'unknown';
  const value = String(membershipType).toLowerCase().trim();
  if (value === 'monthly' || value === 'yearly' || value === 'none' || value === 'unknown') {
    return value;
  }
  return 'unknown';
};

const postRevenueCatForwardWebhook = async ({
  userEmail,
  userId,
  status,
  membershipType,
}) => {
  const url = REVENUECAT?.forwardWebhookUrl || '';
  if (!url) {
    return { sent: false, reason: 'forward_webhook_url_missing' };
  }

  const payload = {
    userEmail: userEmail || '',
    userId: userId || '',
    status: status || 'unknown',
    membershipType: normalizeMembershipType(membershipType),
    'membship type': normalizeMembershipType(membershipType),
  };

  try {
    await axios.post(url, payload, {
      timeout: Number.isFinite(REVENUECAT?.forwardWebhookTimeoutMs)
        ? REVENUECAT.forwardWebhookTimeoutMs
        : 8000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return { sent: true, payload };
  } catch (error) {
    const statusCode = error?.response?.status || null;
    const message = error?.message || 'forward webhook request failed';
    console.warn('[RevenueCatWebhook] Failed to post forward webhook', {
      userId,
      status,
      statusCode,
      message,
    });
    return { sent: false, reason: message, statusCode };
  }
};

module.exports = {
  normalizeStatus,
  postRevenueCatForwardWebhook,
};
