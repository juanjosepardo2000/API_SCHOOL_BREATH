#!/usr/bin/env node

/**
 * Read-only membership audit:
 * Compares RevenueCat snapshot truth vs Systeme tags for users in MongoDB.
 *
 * Safety:
 * - No writes to MongoDB / Systeme / RevenueCat
 * - Controlled concurrency + per-user delay
 * - CSV report output for manual review
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { connectDB, closeDB } = require('../src/configs/database');
const { UserModel } = require('../src/models/user.model');
const { getRevenueCatStoreSnapshot } = require('../src/services/revenuecat.service');
const { getSystemeMembershipStatus } = require('../src/services/systemeMembershipSync.service');

const nowStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = (argv) => {
  const args = {
    limit: 200,
    skip: 0,
    concurrency: 2,
    delayMs: 150,
    output: `/tmp/sob-membership-audit-${nowStamp()}.csv`,
    onlyMismatches: false,
    all: false,
    storeFocus: false,
  };

  for (const raw of argv.slice(2)) {
    if (raw === '--all') args.all = true;
    else if (raw === '--only-mismatches') args.onlyMismatches = true;
    else if (raw === '--store-focus') args.storeFocus = true;
    else if (raw.startsWith('--limit=')) args.limit = Number(raw.split('=')[1]);
    else if (raw.startsWith('--skip=')) args.skip = Number(raw.split('=')[1]);
    else if (raw.startsWith('--concurrency=')) args.concurrency = Number(raw.split('=')[1]);
    else if (raw.startsWith('--delay-ms=')) args.delayMs = Number(raw.split('=')[1]);
    else if (raw.startsWith('--output=')) args.output = raw.slice('--output='.length);
  }

  if (!Number.isFinite(args.limit) || args.limit <= 0) args.limit = 200;
  if (!Number.isFinite(args.skip) || args.skip < 0) args.skip = 0;
  if (!Number.isFinite(args.concurrency) || args.concurrency <= 0) args.concurrency = 2;
  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) args.delayMs = 150;

  if (args.all) args.limit = 0;

  return args;
};

const csvEscape = (value) => {
  const v = value == null ? '' : String(value);
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
};

const classify = ({
  rcAvailable,
  rcActive,
  systemeHasEnroll,
  systemeHasStoreTag,
  systemeHasCanceledTag,
  systemeConfigured,
  hasEverBeenActive,
  rcError,
  systemeError,
}) => {
  if (rcError || systemeError) return 'ERROR';
  if (!rcAvailable) return 'RC_UNAVAILABLE';
  if (systemeConfigured === false) return 'SYSTEME_NOT_CONFIGURED';

  if (rcActive && systemeHasCanceledTag) return 'FALSE_CANCEL_RISK';
  if (rcActive && !systemeHasStoreTag) return 'MISSING_STORE_TAG';
  if (!rcActive && (systemeHasStoreTag || hasEverBeenActive)) return 'STORE_INACTIVE_VERIFY_CANCEL';

  if (!rcActive && systemeHasEnroll && !systemeHasStoreTag && !hasEverBeenActive) {
    return 'WEB_ONLY_OK';
  }

  if (rcActive) return 'OK_ACTIVE';
  if (!rcActive && !systemeHasEnroll && !systemeHasStoreTag) return 'OK_INACTIVE';
  return 'REVIEW';
};

const processUsers = async (users, { concurrency, delayMs }) => {
  const results = new Array(users.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= users.length) return;

      const user = users[current];
      const row = {
        userId: String(user._id),
        email: user.email || '',
        systemIoId: user.systemIoId || '',
        dbStoreActive: Boolean(user.storeSubscriptionActive),
        dbStoreKind: user.storeMembershipKind || 'none',
        dbStoreWillRenew: user.storeWillRenew,
        dbStoreExpiresAt: user.storeEntitlementExpiresAt ? new Date(user.storeEntitlementExpiresAt).toISOString() : '',
        dbSnapshotSource: user.subscriptionSnapshotSource || 'none',
        dbSnapshotAt: user.subscriptionSnapshotAt ? new Date(user.subscriptionSnapshotAt).toISOString() : '',
        dbStoreHasEverBeenActive: Boolean(user.storeHasEverBeenActive),
        rcAvailable: null,
        rcActive: null,
        rcKind: '',
        rcWillRenew: null,
        rcExpiresAt: '',
        systemeConfigured: null,
        systemeContactId: '',
        systemeContactResolvedBy: '',
        systemeHasEnroll: null,
        systemeHasStoreTag: null,
        systemeHasCanceledTag: null,
        systemeTags: '',
        classification: 'ERROR',
        rcError: '',
        systemeError: '',
      };

      try {
        const snapshot = await getRevenueCatStoreSnapshot(String(user._id));
        row.rcAvailable = Boolean(snapshot?.available);
        if (snapshot?.available) {
          row.rcActive = Boolean(snapshot.storeSubscriptionActive);
          row.rcKind = snapshot.storeMembershipKind || 'none';
          row.rcWillRenew = snapshot.storeWillRenew;
          row.rcExpiresAt = snapshot.storeEntitlementExpiresAt
            ? new Date(snapshot.storeEntitlementExpiresAt).toISOString()
            : '';
        }
      } catch (error) {
        row.rcError = error?.message || 'RevenueCat error';
      }

      try {
        const status = await getSystemeMembershipStatus({
          email: user.email || null,
          preferredContactId: user.systemIoId || null,
        });

        row.systemeConfigured = Boolean(status?.configured);
        row.systemeContactId = status?.contactId || '';
        row.systemeContactResolvedBy = status?.contactResolvedBy || '';
        row.systemeHasEnroll = Boolean(status?.hasFullAccess);
        row.systemeHasStoreTag = Boolean(status?.hasActiveStoreSubscriptionTags);
        row.systemeHasCanceledTag = Boolean(status?.hasAnyCanceledTags);
        row.systemeTags = Array.isArray(status?.tags) ? status.tags.join('|') : '';
      } catch (error) {
        row.systemeError = error?.message || 'Systeme error';
      }

      row.classification = classify({
        rcAvailable: row.rcAvailable,
        rcActive: row.rcActive,
        systemeHasEnroll: row.systemeHasEnroll,
        systemeHasStoreTag: row.systemeHasStoreTag,
        systemeHasCanceledTag: row.systemeHasCanceledTag,
        systemeConfigured: row.systemeConfigured,
        hasEverBeenActive: row.dbStoreHasEverBeenActive,
        rcError: row.rcError,
        systemeError: row.systemeError,
      });

      results[current] = row;

      if ((current + 1) % 25 === 0 || current + 1 === users.length) {
        console.log(`[Audit] Processed ${current + 1}/${users.length}`);
      }

      if (delayMs > 0) await sleep(delayMs);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, users.length) }, () => worker());
  await Promise.all(workers);
  return results;
};

const writeCsv = (rows, outputPath) => {
  const headers = [
    'userId',
    'email',
    'systemIoId',
    'dbStoreActive',
    'dbStoreKind',
    'dbStoreWillRenew',
    'dbStoreExpiresAt',
    'dbSnapshotSource',
    'dbSnapshotAt',
    'dbStoreHasEverBeenActive',
    'rcAvailable',
    'rcActive',
    'rcKind',
    'rcWillRenew',
    'rcExpiresAt',
    'systemeConfigured',
    'systemeContactId',
    'systemeContactResolvedBy',
    'systemeHasEnroll',
    'systemeHasStoreTag',
    'systemeHasCanceledTag',
    'systemeTags',
    'classification',
    'rcError',
    'systemeError',
  ];

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((key) => csvEscape(row[key])).join(','));
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
};

const printSummary = (rows) => {
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.classification, (counts.get(row.classification) || 0) + 1);
  }

  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log('\n[Audit] Classification summary:');
  for (const [name, count] of ordered) {
    console.log(`  - ${name}: ${count}`);
  }
};

async function main() {
  const args = parseArgs(process.argv);

  console.log('[Audit] Starting read-only membership audit');
  console.log(
    `[Audit] Options: limit=${args.limit || 'ALL'} skip=${args.skip} concurrency=${args.concurrency} delayMs=${args.delayMs} storeFocus=${args.storeFocus}`
  );

  await connectDB();

  try {
    const projection = {
      _id: 1,
      email: 1,
      systemIoId: 1,
      storeSubscriptionActive: 1,
      storeHasEverBeenActive: 1,
      storeMembershipKind: 1,
      storeEntitlementExpiresAt: 1,
      storeWillRenew: 1,
      subscriptionSnapshotSource: 1,
      subscriptionSnapshotAt: 1,
    };

    const baseFilter = { email: { $exists: true, $ne: null } };
    const storeFocusFilter = {
      $and: [
        baseFilter,
        {
          $or: [
            { storeSubscriptionActive: true },
            { storeHasEverBeenActive: true },
            { storeMembershipKind: { $in: ['monthly', 'yearly', 'unknown'] } },
            { subscriptionSnapshotSource: { $in: ['revenuecat_webhook', 'revenuecat_rest', 'login_reconcile'] } },
          ],
        },
      ],
    };

    const mongoFilter = args.storeFocus ? storeFocusFilter : baseFilter;

    let query = UserModel.find(mongoFilter, projection)
      .sort({ _id: 1 })
      .skip(args.skip)
      .lean();

    if (args.limit > 0) {
      query = query.limit(args.limit);
    }

    const users = await query.exec();
    console.log(`[Audit] Loaded ${users.length} users from MongoDB`);
    if (args.storeFocus) {
      console.log('[Audit] Filter mode: store-focused cohort only');
    }

    const rows = await processUsers(users, {
      concurrency: args.concurrency,
      delayMs: args.delayMs,
    });

    const outRows = args.onlyMismatches
      ? rows.filter((r) => !['OK_ACTIVE', 'OK_INACTIVE', 'WEB_ONLY_OK', 'SYSTEME_NOT_CONFIGURED'].includes(r.classification))
      : rows;

    writeCsv(outRows, args.output);
    printSummary(rows);
    console.log(`[Audit] CSV report saved: ${args.output}`);
    console.log(`[Audit] Rows written: ${outRows.length}`);
  } finally {
    await closeDB();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Audit][FATAL]', error?.message || error);
    process.exit(1);
  });
