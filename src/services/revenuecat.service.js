const axios = require('axios');
const { REVENUECAT } = require('../configs/vars');

const parseDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isActiveFromExpiry = (expiryDate) => {
  if (!expiryDate) return false;
  return expiryDate.getTime() > Date.now();
};

const inferStoreMembershipKind = (productIdentifier = '') => {
  const normalized = String(productIdentifier || '').toLowerCase();
  if (!normalized) return 'none';
  if (
    normalized.includes('year') ||
    normalized.includes('annual') ||
    normalized.includes('1y')
  ) {
    return 'yearly';
  }
  if (normalized.includes('month') || normalized.includes('1m')) {
    return 'monthly';
  }
  return 'unknown';
};

const pickLatestSubscription = (subscriptions) => {
  const entries = Object.entries(subscriptions || {});
  if (entries.length === 0) return { productIdentifier: null, subscription: null };

  let selected = { productIdentifier: null, subscription: null, expiresAtMs: -1 };

  for (const [productIdentifier, subscription] of entries) {
    const expiry = parseDateOrNull(subscription?.expires_date);
    const expiresAtMs = expiry ? expiry.getTime() : -1;
    if (expiresAtMs > selected.expiresAtMs) {
      selected = { productIdentifier, subscription, expiresAtMs };
    }
  }

  return { productIdentifier: selected.productIdentifier, subscription: selected.subscription };
};

const resolveWillRenew = (subscription, isActive) => {
  if (!isActive) return false;
  if (!subscription) return null;
  if (subscription.unsubscribe_detected_at) return false;
  return true;
};

const normalizeSubscriberSnapshot = (subscriber, entitlementId) => {
  const subscriptions = subscriber?.subscriptions || {};
  const entitlements = subscriber?.entitlements || {};
  const entitlement = entitlementId ? entitlements[entitlementId] : null;

  let productIdentifier = entitlement?.product_identifier || null;
  let activeSubscription = null;

  if (productIdentifier && subscriptions[productIdentifier]) {
    activeSubscription = subscriptions[productIdentifier];
  } else {
    const latest = pickLatestSubscription(subscriptions);
    productIdentifier = productIdentifier || latest.productIdentifier;
    activeSubscription = latest.subscription;
  }

  const entitlementExpiry = parseDateOrNull(entitlement?.expires_date);
  const subscriptionExpiry = parseDateOrNull(activeSubscription?.expires_date);
  const expiresAt = entitlementExpiry || subscriptionExpiry || null;

  const hasEntitlement = Boolean(entitlement);
  const storeSubscriptionActive = hasEntitlement
    ? entitlementExpiry
      ? isActiveFromExpiry(entitlementExpiry)
      : true
    : isActiveFromExpiry(expiresAt);

  return {
    storeSubscriptionActive,
    storeMembershipKind: storeSubscriptionActive
      ? inferStoreMembershipKind(productIdentifier)
      : 'none',
    storeEntitlementExpiresAt: expiresAt,
    storeWillRenew: resolveWillRenew(activeSubscription, storeSubscriptionActive),
    productIdentifier: productIdentifier || null,
    entitlementId: entitlementId || null,
  };
};

const getRevenueCatStoreSnapshot = async (appUserId) => {
  const apiKey = REVENUECAT?.apiKey || '';
  const apiBaseUrl = REVENUECAT?.apiBaseUrl || 'https://api.revenuecat.com/v1';
  const entitlementId = REVENUECAT?.entitlementId || 'pro';

  if (!apiKey) {
    return {
      available: false,
      reason: 'api_key_missing',
    };
  }

  const url = `${apiBaseUrl.replace(/\/$/, '')}/subscribers/${encodeURIComponent(appUserId)}`;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 12000,
  });

  const subscriber = response?.data?.subscriber;
  if (!subscriber) {
    throw new Error('RevenueCat subscriber payload missing');
  }

  return {
    available: true,
    ...normalizeSubscriberSnapshot(subscriber, entitlementId),
  };
};

module.exports = {
  getRevenueCatStoreSnapshot,
};
