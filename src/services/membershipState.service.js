const { UserModel } = require('../models/user.model');
const { getRevenueCatStoreSnapshot } = require('./revenuecat.service');
const {
  isSystemeConfigured,
  getSystemeMembershipStatus,
  syncSystemeMembershipFromRevenueCatSnapshot,
} = require('./systemeMembershipSync.service');

const toIso = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toMembershipState = ({ user, systemeStatus }) => {
  const storeActive = Boolean(user?.storeSubscriptionActive);
  const systemeFullAccess = Boolean(systemeStatus?.hasFullAccess);
  const premium = storeActive || systemeFullAccess;

  let source = 'none';
  if (storeActive) {
    source = 'store';
  } else if (systemeFullAccess) {
    source = 'web';
  }

  let lifecycle = 'inactive';
  if (storeActive && user?.storeWillRenew === false) {
    lifecycle = 'active_cancel_pending';
  } else if (storeActive) {
    lifecycle = 'active_renewing';
  } else if (systemeFullAccess) {
    lifecycle = 'active_web';
  }

  return {
    userId: String(user?._id || ''),
    email: user?.email || null,
    premium,
    source,
    lifecycle,
    store: {
      active: storeActive,
      hasEverBeenActive: Boolean(user?.storeHasEverBeenActive),
      membershipKind: user?.storeMembershipKind || 'none',
      willRenew: user?.storeWillRenew ?? null,
      entitlementExpiresAt: toIso(user?.storeEntitlementExpiresAt),
      snapshotSource: user?.subscriptionSnapshotSource || 'none',
      snapshotAt: toIso(user?.subscriptionSnapshotAt),
    },
    systeme: {
      configured: Boolean(systemeStatus?.configured),
      contactId: systemeStatus?.contactId || user?.systemIoId || null,
      contactResolvedBy: systemeStatus?.contactResolvedBy || 'unknown',
      hasFullAccess: Boolean(systemeStatus?.hasFullAccess),
      hasActiveStoreSubscriptionTags: Boolean(systemeStatus?.hasActiveStoreSubscriptionTags),
      hasAnyCanceledTags: Boolean(systemeStatus?.hasAnyCanceledTags),
      tags: Array.isArray(systemeStatus?.tags) ? systemeStatus.tags : [],
      status: systemeStatus?.status || 'unknown',
      action: systemeStatus?.action || 'unknown',
    },
  };
};

const loadUserOrThrow = async (userId) => {
  if (!userId) {
    const error = new Error('Missing user id');
    error.statusCode = 400;
    throw error;
  }

  const user = await UserModel.findById(userId).select(
    '_id email systemIoId storeSubscriptionActive storeHasEverBeenActive storeMembershipKind storeEntitlementExpiresAt storeWillRenew subscriptionSnapshotSource subscriptionSnapshotAt'
  );
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  return user;
};

const getSystemeMembershipStatusSafe = async ({ email, preferredContactId }) => {
  try {
    return await getSystemeMembershipStatus({
      email,
      preferredContactId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'systeme_status_error';
    console.error('[MembershipState] Systeme status read failed', {
      email: email || null,
      preferredContactId: preferredContactId || null,
      error: errorMessage,
    });

    return {
      status: 'failed',
      action: 'systeme_status_error',
      configured: Boolean(isSystemeConfigured()),
      contactId: preferredContactId || null,
      contactResolvedBy: 'error',
      tags: [],
      hasFullAccess: false,
      hasActiveStoreSubscriptionTags: false,
      hasAnyCanceledTags: false,
      error: errorMessage,
    };
  }
};

const getMembershipStateForUser = async ({ userId }) => {
  const user = await loadUserOrThrow(userId);
  const systemeStatus = await getSystemeMembershipStatusSafe({
    email: user.email || null,
    preferredContactId: user.systemIoId || null,
  });

  return toMembershipState({ user, systemeStatus });
};

const toMembershipStateFromSnapshot = ({ user, snapshotUpdate, systemeStatus }) =>
  toMembershipState({
    user: {
      _id: user._id,
      email: user.email || null,
      systemIoId: user.systemIoId || null,
      storeSubscriptionActive: snapshotUpdate.storeSubscriptionActive,
      storeHasEverBeenActive: snapshotUpdate.storeHasEverBeenActive,
      storeMembershipKind: snapshotUpdate.storeMembershipKind,
      storeEntitlementExpiresAt: snapshotUpdate.storeEntitlementExpiresAt,
      storeWillRenew: snapshotUpdate.storeWillRenew,
      subscriptionSnapshotSource: snapshotUpdate.subscriptionSnapshotSource,
      subscriptionSnapshotAt: snapshotUpdate.subscriptionSnapshotAt,
    },
    systemeStatus,
  });

const reconcileMembershipStateForUser = async ({ userId }) => {
  const user = await loadUserOrThrow(userId);

  let snapshot;
  try {
    snapshot = await getRevenueCatStoreSnapshot(String(user._id));
  } catch (snapshotError) {
    const errorMessage =
      snapshotError instanceof Error ? snapshotError.message : 'snapshot_fetch_failed';

    console.error('[MembershipState] RevenueCat snapshot fetch failed during reconcile', {
      userId: String(user._id),
      email: user.email || null,
      error: errorMessage,
    });

    return {
      status: 'partial',
      action: 'snapshot_fetch_failed',
      membership: await getMembershipStateForUser({ userId: user._id }),
      snapshot: {
        available: false,
        reason: 'snapshot_fetch_failed',
        error: errorMessage,
      },
      systeme: null,
    };
  }

  if (!snapshot?.available) {
    return {
      status: 'skipped',
      action: snapshot?.reason || 'snapshot_unavailable',
      membership: await getMembershipStateForUser({ userId: user._id }),
      snapshot: snapshot || null,
      systeme: null,
    };
  }

  const snapshotUpdate = {
    storeSubscriptionActive: snapshot.storeSubscriptionActive,
    storeHasEverBeenActive: Boolean(user.storeHasEverBeenActive || snapshot.storeSubscriptionActive),
    storeMembershipKind: snapshot.storeMembershipKind,
    storeEntitlementExpiresAt: snapshot.storeEntitlementExpiresAt,
    storeWillRenew: snapshot.storeWillRenew,
    subscriptionSnapshotSource: 'login_reconcile',
    subscriptionSnapshotAt: new Date(),
  };

  await UserModel.updateOne({ _id: user._id }, { $set: snapshotUpdate });

  let systemeResult = null;
  let reconcileStatus = 'processed';
  let reconcileAction = 'snapshot_and_systeme_synced';

  try {
    systemeResult = await syncSystemeMembershipFromRevenueCatSnapshot({
      appUserId: String(user._id),
      email: user.email || null,
      preferredContactId: user.systemIoId || null,
      snapshot,
      hasEverBeenActive: snapshotUpdate.storeHasEverBeenActive,
    });
  } catch (syncError) {
    const errorMessage = syncError instanceof Error ? syncError.message : 'systeme_sync_error';
    console.error('[MembershipState] Systeme sync failed during reconcile', {
      userId: String(user._id),
      email: user.email || null,
      error: errorMessage,
    });
    reconcileStatus = 'partial';
    reconcileAction = 'snapshot_synced_systeme_failed';
    systemeResult = {
      status: 'failed',
      action: 'systeme_sync_error',
      error: errorMessage,
    };
  }

  if (systemeResult?.contactId && systemeResult.contactId !== user.systemIoId) {
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { systemIoId: systemeResult.contactId } }
    );
    user.systemIoId = systemeResult.contactId;
  }

  // Fast path for active store subscriptions:
  // avoid a second Systeme status fetch in the same request to keep reconcile latency low.
  if (snapshotUpdate.storeSubscriptionActive) {
    const membership = toMembershipStateFromSnapshot({
      user,
      snapshotUpdate,
      systemeStatus: {
        status: systemeResult?.status || 'unknown',
        action: systemeResult?.action || 'unknown',
        configured: Boolean(isSystemeConfigured()),
        contactId: systemeResult?.contactId || user.systemIoId || null,
        contactResolvedBy: systemeResult?.contactResolvedBy || 'reconcile',
        tags: [],
        hasFullAccess: true,
        hasActiveStoreSubscriptionTags: true,
        hasAnyCanceledTags: false,
      },
    });

    return {
      status: reconcileStatus,
      action: reconcileAction,
      snapshot,
      systeme: systemeResult || null,
      membership,
    };
  }

  return {
    status: reconcileStatus,
    action: reconcileAction,
    snapshot,
    systeme: systemeResult || null,
    membership: await getMembershipStateForUser({ userId: user._id }),
  };
};

module.exports = {
  getMembershipStateForUser,
  reconcileMembershipStateForUser,
};
