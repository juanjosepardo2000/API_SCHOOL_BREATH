const mongoose = require('mongoose');
const { UserModel } = require('../models/user.model');
const { getRevenueCatStoreSnapshot } = require('./revenuecat.service');
const { syncSystemeMembershipFromRevenueCatSnapshot } = require('./systemeMembershipSync.service');

const RETRYABLE_HTTP_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getAxiosStatus = (error) => error?.response?.status || null;
const isRetryableError = (error) => RETRYABLE_HTTP_STATUS.has(getAxiosStatus(error));

const withRetry = async (task, { attempts = 2, delayMs = 350, label = 'task' } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableError(error)) {
        throw error;
      }
      console.warn('[RevenueCatWebhook] Retrying task after transient failure', {
        label,
        attempt,
        status: getAxiosStatus(error),
      });
      await sleep(delayMs * attempt);
    }
  }
  throw lastError;
};

/**
 * Webhook orchestration:
 * 1) Resolve RC truth for app_user_id
 * 2) Update MongoDB store snapshot fields
 * 3) Sync Systeme store-mirror tags from snapshot state
 */
const handleRevenueCatWebhookEvent = async ({ eventId, eventType, appUserId }) => {
  if (!appUserId) {
    return {
      status: 'ignored',
      action: 'missing_app_user_id',
    };
  }

  if (String(eventType || '').toUpperCase() === 'TEST') {
    return {
      status: 'ignored',
      action: 'test_event',
      appUserId,
      userEmail: null,
    };
  }

  if (!mongoose.Types.ObjectId.isValid(appUserId)) {
    return {
      status: 'ignored',
      action: 'invalid_app_user_id',
      appUserId,
      userEmail: null,
    };
  }

  const user = await UserModel.findById(appUserId).select('_id email systemIoId storeHasEverBeenActive');
  if (!user) {
    return {
      status: 'ignored',
      action: 'user_not_found',
      appUserId,
      userEmail: null,
    };
  }

  const snapshot = await withRetry(() => getRevenueCatStoreSnapshot(appUserId), {
    attempts: 2,
    label: 'revenuecat_snapshot',
  });
  if (!snapshot.available) {
    return {
      status: 'ignored',
      action: snapshot.reason || 'snapshot_unavailable',
      appUserId,
      userEmail: user.email || null,
    };
  }

  const snapshotUpdate = {
    storeSubscriptionActive: snapshot.storeSubscriptionActive,
    storeHasEverBeenActive: Boolean(user.storeHasEverBeenActive || snapshot.storeSubscriptionActive),
    storeMembershipKind: snapshot.storeMembershipKind,
    storeEntitlementExpiresAt: snapshot.storeEntitlementExpiresAt,
    storeWillRenew: snapshot.storeWillRenew,
    subscriptionSnapshotSource: 'revenuecat_webhook',
    subscriptionSnapshotAt: new Date(),
  };

  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: snapshotUpdate,
    }
  );

  let systemeResult = null;
  let webhookAction = 'snapshot_and_systeme_synced';

  try {
    systemeResult = await withRetry(
      () =>
        syncSystemeMembershipFromRevenueCatSnapshot({
          appUserId,
          email: user.email || null,
          preferredContactId: user.systemIoId || null,
          snapshot,
          hasEverBeenActive: snapshotUpdate.storeHasEverBeenActive,
        }),
      {
        attempts: 2,
        label: 'systeme_membership_sync',
      }
    );
  } catch (syncError) {
    const errorMessage = syncError instanceof Error ? syncError.message : 'systeme_sync_error';
    console.error('[RevenueCatWebhook] Systeme sync failed, keeping snapshot update', {
      eventId,
      eventType,
      appUserId,
      error: errorMessage,
    });
    webhookAction = 'snapshot_synced_systeme_failed';
    systemeResult = {
      status: 'failed',
      action: 'systeme_sync_error',
      error: errorMessage,
    };
  }

  if (systemeResult?.contactId && systemeResult.contactId !== user.systemIoId) {
    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: { systemIoId: systemeResult.contactId },
      }
    );
  }

  console.log('[RevenueCatWebhook] Snapshot updated', {
    eventId,
    eventType,
    appUserId,
    storeSubscriptionActive: snapshot.storeSubscriptionActive,
    storeMembershipKind: snapshot.storeMembershipKind,
    storeEntitlementExpiresAt: snapshot.storeEntitlementExpiresAt,
    systemeStatus: systemeResult?.status || 'unknown',
    systemeAction: systemeResult?.action || 'unknown',
  });

  return {
    status: 'processed',
    action: webhookAction,
    appUserId,
    userEmail: user.email || null,
    storeSubscriptionActive: snapshot.storeSubscriptionActive,
    storeMembershipKind: snapshot.storeMembershipKind,
    storeEntitlementExpiresAt: snapshot.storeEntitlementExpiresAt,
    storeWillRenew: snapshot.storeWillRenew,
    systeme: systemeResult || null,
  };
};

module.exports = { handleRevenueCatWebhookEvent };
