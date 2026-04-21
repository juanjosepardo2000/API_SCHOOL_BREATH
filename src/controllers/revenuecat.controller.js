const { RevenuecatWebhookEventModel } = require('../models/revenuecatWebhookEvent.model');
const { handleRevenueCatWebhookEvent } = require('../services/revenuecatWebhookOrchestrator.service');
const {
  normalizeStatus,
  postRevenueCatForwardWebhook,
} = require('../services/revenuecatForwardWebhook.service');
const {
  computePayloadHash,
  extractRevenueCatAppUserId,
  extractRevenueCatEventId,
  extractRevenueCatEventType,
  getRawBodyOrThrow,
  isAllowedRevenueCatEventType,
  parseRevenueCatPayloadOrThrow,
  verifyOptionalHmacSignature,
  verifyWebhookAuthorization,
} = require('../services/revenuecatWebhook.service');

exports.receiveWebhook = async (req, res) => {
  const authCheck = verifyWebhookAuthorization(req);
  if (!authCheck.ok) {
    return res.status(401).json({
      success: false,
      message: authCheck.reason,
    });
  }

  let rawBody;
  let payload;
  try {
    rawBody = getRawBodyOrThrow(req);
    payload = parseRevenueCatPayloadOrThrow(rawBody);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Invalid webhook payload',
    });
  }

  const signatureCheck = verifyOptionalHmacSignature(rawBody, req);
  if (!signatureCheck.ok) {
    return res.status(401).json({
      success: false,
      message: signatureCheck.reason,
    });
  }

  const eventId = extractRevenueCatEventId(payload);
  const eventType = extractRevenueCatEventType(payload);
  const appUserId = extractRevenueCatAppUserId(payload);
  const payloadHash = computePayloadHash(rawBody);

  console.log('[RevenueCatWebhook] Received event', {
    eventId,
    eventType,
    appUserId,
  });

  if (!eventId) {
    return res.status(400).json({
      success: false,
      message: 'Missing event id',
    });
  }

  if (!isAllowedRevenueCatEventType(eventType)) {
    console.log('[RevenueCatWebhook] Ignored by allowlist', { eventId, eventType });
    await postRevenueCatForwardWebhook({
      userEmail: '',
      userId: appUserId || '',
      status: 'ignored_allowlist',
      membershipType: 'unknown',
    });
    return res.status(200).json({
      success: true,
      ignored: true,
      eventId,
      eventType,
      reason: 'Event type not in allowlist',
    });
  }

  try {
    await RevenuecatWebhookEventModel.create({
      eventId,
      eventType,
      appUserId,
      payloadHash,
      status: 'received',
    });
  } catch (error) {
    if (error?.code === 11000) {
      console.log('[RevenueCatWebhook] Duplicate event ignored', { eventId, eventType });
      await postRevenueCatForwardWebhook({
        userEmail: '',
        userId: appUserId || '',
        status: 'duplicate',
        membershipType: 'unknown',
      });
      return res.status(200).json({
        success: true,
        duplicate: true,
        eventId,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to persist webhook event',
    });
  }

  try {
    const processingResult = await handleRevenueCatWebhookEvent({
      payload,
      eventId,
      eventType,
      appUserId,
      payloadHash,
    });

    await RevenuecatWebhookEventModel.updateOne(
      { eventId },
      {
        $set: {
          status: processingResult?.status === 'ignored' ? 'ignored' : 'processed',
          processedAt: new Date(),
          processingResult: processingResult || null,
          errorMessage: null,
        },
      }
    );

    await postRevenueCatForwardWebhook({
      userEmail: processingResult?.userEmail || '',
      userId: appUserId || '',
      status: normalizeStatus(processingResult),
      membershipType: processingResult?.storeMembershipKind || 'unknown',
    });

    return res.status(200).json({
      success: true,
      eventId,
      status: processingResult?.status || 'processed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('[RevenueCatWebhook] Processing failed', {
      eventId,
      eventType,
      appUserId,
      error: errorMessage,
    });

    await RevenuecatWebhookEventModel.updateOne(
      { eventId },
      {
        $set: {
          status: 'failed',
          processedAt: new Date(),
          errorMessage,
        },
      }
    );

    await postRevenueCatForwardWebhook({
      userEmail: '',
      userId: appUserId || '',
      status: 'failed',
      membershipType: 'unknown',
    });

    return res.status(500).json({
      success: false,
      eventId,
      message: errorMessage,
    });
  }
};
