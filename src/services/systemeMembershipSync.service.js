const axios = require('axios');
const { API_SYSTEME_KEY, SYSTEME_API_URL, REVENUECAT } = require('../configs/vars');

const SYSTEME_TAGS = {
  monthly: 'monthly_app_subscription',
  yearly: 'yearly_app_subscription',
  enrollTags: ['Enrolled_Holistic Membership', 'Enrolled_to_Membership'],
  canceledTags: [
    'Canceled Holistic Membership',
    'Canceled Holistic Membership App',
    'CanceledHolisticMembershipAppInitiated',
  ],
};
const PROTECTED_TAG_NAMES = new Set(['new_app_user']);

const isSystemeConfigured = () => Boolean(API_SYSTEME_KEY && SYSTEME_API_URL);

const createSystemeClient = () => {
  const baseURL = String(SYSTEME_API_URL || '').replace(/\/$/, '');
  return axios.create({
    baseURL,
    timeout: 12000,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': API_SYSTEME_KEY,
    },
  });
};

const parseAxiosStatus = (error) => error?.response?.status || null;

const fetchContactById = async (client, contactId) => {
  if (!contactId) return null;
  try {
    const response = await client.get(`/contacts/${encodeURIComponent(contactId)}`);
    const contact = response?.data;
    if (!contact?.id) return null;
    return { id: contact.id, email: contact.email || null };
  } catch (error) {
    if (parseAxiosStatus(error) === 404) return null;
    throw error;
  }
};

const fetchContactByEmail = async (client, email) => {
  if (!email) return null;
  try {
    const response = await client.get('/contacts', {
      params: { email, limit: 100 },
    });
    const items = response?.data?.items;
    if (!Array.isArray(items) || items.length === 0) return null;
    const first = items[0];
    if (!first?.id) return null;
    return { id: first.id, email: first.email || email };
  } catch (error) {
    const status = parseAxiosStatus(error);
    // Systeme can return 422 for invalid query shapes; treat as not found for lookup flow.
    if (status === 404 || status === 422) return null;
    throw error;
  }
};

const fetchContactTags = async (client, contactId) => {
  const response = await client.get(`/contacts/${encodeURIComponent(contactId)}`);
  const tags = response?.data?.tags;
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag) => tag?.id && tag?.name)
    .map((tag) => ({ id: String(tag.id), name: String(tag.name) }));
};

const fetchAllTags = async (client) => {
  const collected = [];
  let startingAfter = null;
  let guard = 0;

  // Systeme collections use cursor pagination via `startingAfter` + `hasMore`
  // (not page-based pagination).
  while (guard < 200) {
    guard += 1;
    const params = { limit: 100, order: 'asc' };
    if (startingAfter !== null && startingAfter !== undefined) {
      params.startingAfter = startingAfter;
    }

    const response = await client.get('/tags', {
      params,
    });

    const items = response?.data?.items;
    if (!Array.isArray(items) || items.length === 0) break;

    for (const tag of items) {
      if (tag?.id && tag?.name) {
        collected.push({ id: String(tag.id), name: String(tag.name) });
      }
    }

    const hasMore = Boolean(response?.data?.hasMore);
    const lastId = items[items.length - 1]?.id;
    if (!hasMore || !lastId) break;

    startingAfter = lastId;
  }

  return collected;
};

const removeContactTag = async (client, contactId, tagId) => {
  try {
    await client.delete(`/contacts/${encodeURIComponent(contactId)}/tags/${encodeURIComponent(tagId)}`);
    return true;
  } catch (error) {
    const status = parseAxiosStatus(error);
    if (status === 404 || status === 409 || status === 422) return false;
    throw error;
  }
};

const addContactTag = async (client, contactId, tagId) => {
  try {
    await client.post(`/contacts/${encodeURIComponent(contactId)}/tags`, { tagId });
    return true;
  } catch (error) {
    const status = parseAxiosStatus(error);
    if (status === 409 || status === 422) return false;
    throw error;
  }
};

const pickDesiredSubscriptionTag = (membershipKind) => {
  if (membershipKind === 'monthly') return SYSTEME_TAGS.monthly;
  if (membershipKind === 'yearly') return SYSTEME_TAGS.yearly;
  return null;
};

const shouldRemoveEnrollTagsOnExpire = () => {
  if (typeof REVENUECAT?.removeEnrollTagsOnExpire === 'boolean') {
    return REVENUECAT.removeEnrollTagsOnExpire;
  }
  return String(process.env.REVENUECAT_REMOVE_ENROLL_TAGS_ON_EXPIRE || 'true').toLowerCase() !== 'false';
};

const resolveContactId = async ({ client, preferredContactId, email }) => {
  if (preferredContactId) {
    const byId = await fetchContactById(client, preferredContactId);
    if (byId?.id) {
      return { contactId: byId.id, source: 'user.systemIoId' };
    }
  }

  if (email) {
    const byEmail = await fetchContactByEmail(client, email);
    if (byEmail?.id) {
      return { contactId: byEmail.id, source: 'email_lookup' };
    }
  }

  return { contactId: null, source: 'not_found' };
};

const getSystemeMembershipStatus = async ({ email, preferredContactId } = {}) => {
  if (!isSystemeConfigured()) {
    return {
      status: 'skipped',
      action: 'systeme_not_configured',
      configured: false,
      contactId: null,
      contactResolvedBy: 'not_configured',
      tags: [],
      hasFullAccess: false,
      hasActiveStoreSubscriptionTags: false,
      hasAnyCanceledTags: false,
    };
  }

  const client = createSystemeClient();
  const resolved = await resolveContactId({
    client,
    preferredContactId,
    email,
  });

  if (!resolved.contactId) {
    return {
      status: 'skipped',
      action: 'systeme_contact_not_found',
      configured: true,
      contactId: null,
      contactResolvedBy: resolved.source,
      tags: [],
      hasFullAccess: false,
      hasActiveStoreSubscriptionTags: false,
      hasAnyCanceledTags: false,
    };
  }

  const currentTags = await fetchContactTags(client, resolved.contactId);
  const tagNames = currentTags.map((tag) => tag.name);

  const hasFullAccess = SYSTEME_TAGS.enrollTags.some((tagName) => tagNames.includes(tagName));
  const hasActiveStoreSubscriptionTags =
    tagNames.includes(SYSTEME_TAGS.monthly) || tagNames.includes(SYSTEME_TAGS.yearly);
  const hasAnyCanceledTags = SYSTEME_TAGS.canceledTags.some((tagName) => tagNames.includes(tagName));

  return {
    status: 'processed',
    action: 'systeme_membership_status_read',
    configured: true,
    contactId: resolved.contactId,
    contactResolvedBy: resolved.source,
    tags: tagNames,
    hasFullAccess,
    hasActiveStoreSubscriptionTags,
    hasAnyCanceledTags,
  };
};

const syncSystemeMembershipFromRevenueCatSnapshot = async ({
  appUserId,
  email,
  preferredContactId,
  snapshot,
  hasEverBeenActive = false,
}) => {
  if (!isSystemeConfigured()) {
    return {
      status: 'skipped',
      action: 'systeme_not_configured',
    };
  }

  if (!snapshot) {
    return {
      status: 'skipped',
      action: 'missing_snapshot',
    };
  }

  const client = createSystemeClient();
  const resolved = await resolveContactId({
    client,
    preferredContactId,
    email,
  });

  if (!resolved.contactId) {
    return {
      status: 'skipped',
      action: 'systeme_contact_not_found',
      appUserId,
      email: email || null,
    };
  }

  const contactId = resolved.contactId;
  const [currentTags, allTags] = await Promise.all([
    fetchContactTags(client, contactId),
    fetchAllTags(client),
  ]);

  const currentTagByName = new Map(currentTags.map((tag) => [tag.name, tag]));
  const currentTagNames = new Set(currentTags.map((tag) => tag.name));
  const globalTagByName = new Map(allTags.map((tag) => [tag.name, tag.id]));

  const removed = [];
  const added = [];
  const missingTagDefinitions = [];

  const tagsToRemove = [];
  const tagsToAdd = [];
  const desiredSubscriptionTag = pickDesiredSubscriptionTag(snapshot.storeMembershipKind);
  const hasCurrentStoreSubscriptionTags =
    currentTagNames.has(SYSTEME_TAGS.monthly) || currentTagNames.has(SYSTEME_TAGS.yearly);
  const shouldProcessInactiveStoreCancellation =
    !snapshot.storeSubscriptionActive &&
    (hasCurrentStoreSubscriptionTags || Boolean(hasEverBeenActive));

  if (snapshot.storeSubscriptionActive) {
    tagsToAdd.push(...SYSTEME_TAGS.enrollTags);
    tagsToAdd.push(...(desiredSubscriptionTag ? [desiredSubscriptionTag] : []));
    tagsToRemove.push(...SYSTEME_TAGS.canceledTags);

    if (desiredSubscriptionTag === SYSTEME_TAGS.monthly) {
      tagsToRemove.push(SYSTEME_TAGS.yearly);
    } else if (desiredSubscriptionTag === SYSTEME_TAGS.yearly) {
      tagsToRemove.push(SYSTEME_TAGS.monthly);
    }
  } else if (shouldProcessInactiveStoreCancellation) {
    tagsToRemove.push(SYSTEME_TAGS.monthly, SYSTEME_TAGS.yearly);
    if (shouldRemoveEnrollTagsOnExpire()) {
      tagsToRemove.push(...SYSTEME_TAGS.enrollTags);
    }
    tagsToAdd.push(...SYSTEME_TAGS.canceledTags);
  }

  const uniqueRemove = [...new Set(tagsToRemove)].filter((tagName) => !PROTECTED_TAG_NAMES.has(tagName));
  const uniqueAdd = [...new Set(tagsToAdd)];

  for (const tagName of uniqueRemove) {
    const existing = currentTagByName.get(tagName);
    if (!existing?.id) continue;
    const removedNow = await removeContactTag(client, contactId, existing.id);
    if (removedNow) {
      removed.push(tagName);
      currentTagNames.delete(tagName);
    }
  }

  for (const tagName of uniqueAdd) {
    if (currentTagNames.has(tagName)) continue;
    const globalTagId = globalTagByName.get(tagName);
    if (!globalTagId) {
      missingTagDefinitions.push(tagName);
      continue;
    }
    const addedNow = await addContactTag(client, contactId, globalTagId);
    if (addedNow) {
      added.push(tagName);
      currentTagNames.add(tagName);
    }
  }

  const refreshedTags = await fetchContactTags(client, contactId);
  const refreshedNames = new Set(refreshedTags.map((tag) => tag.name));

  const requiredTags = snapshot.storeSubscriptionActive
    ? [...SYSTEME_TAGS.enrollTags, ...(desiredSubscriptionTag ? [desiredSubscriptionTag] : [])]
    : [];

  const expectedAbsentTags = snapshot.storeSubscriptionActive
    ? [
        ...SYSTEME_TAGS.canceledTags,
        ...(desiredSubscriptionTag === SYSTEME_TAGS.monthly ? [SYSTEME_TAGS.yearly] : []),
        ...(desiredSubscriptionTag === SYSTEME_TAGS.yearly ? [SYSTEME_TAGS.monthly] : []),
      ]
    : shouldProcessInactiveStoreCancellation
    ? [
        SYSTEME_TAGS.monthly,
        SYSTEME_TAGS.yearly,
        ...(shouldRemoveEnrollTagsOnExpire() ? SYSTEME_TAGS.enrollTags : []),
      ]
    : [];

  const missingRequiredTags = requiredTags.filter((tagName) => !refreshedNames.has(tagName));
  const staleTags = expectedAbsentTags.filter((tagName) => refreshedNames.has(tagName));

  const verificationWarnings = [];
  if (missingRequiredTags.length > 0) {
    verificationWarnings.push(
      `Systeme required tags missing after sync: ${missingRequiredTags.join(', ')}`
    );
  }
  if (staleTags.length > 0) {
    verificationWarnings.push(
      `Systeme stale tags still present after sync: ${staleTags.join(', ')}`
    );
  }

  if (verificationWarnings.length > 0) {
    console.warn('[SystemeMembershipSync] Tag verification warnings', {
      contactId,
      appUserId,
      warnings: verificationWarnings,
    });
  }

  const syncAction = snapshot.storeSubscriptionActive
    ? 'systeme_tags_synced_active'
    : shouldProcessInactiveStoreCancellation
    ? 'systeme_tags_synced_inactive'
    : 'systeme_tags_sync_skipped_no_store_history';

  return {
    status: verificationWarnings.length > 0 ? 'processed_with_warnings' : 'processed',
    action: syncAction,
    appUserId,
    contactId,
    contactResolvedBy: resolved.source,
    addedTags: added,
    removedTags: removed,
    missingTagDefinitions,
    requiredTags,
    missingRequiredTags,
    staleTags,
    verificationWarnings,
    inactiveCancellationEligible: shouldProcessInactiveStoreCancellation,
    hasEverBeenActive: Boolean(hasEverBeenActive),
    hadCurrentStoreSubscriptionTags: hasCurrentStoreSubscriptionTags,
  };
};

module.exports = {
  SYSTEME_TAGS,
  isSystemeConfigured,
  getSystemeMembershipStatus,
  syncSystemeMembershipFromRevenueCatSnapshot,
};
