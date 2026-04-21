/**
 * patch-sync.js  — fast batch sync
 *
 * Pass 1: collect missing docs in memory, insertMany in batches of 500.
 * Pass 2: for conflicting docs where source.updatedAt > target.updatedAt,
 *         bulkWrite replaceOne in batches of 500.
 *
 * Safe to run repeatedly — idempotent (ordered:false ignores duplicates).
 */

const { MongoClient } = require('mongodb');

const SOURCE_URI = 'mongodb+srv://shurakd8:parzival-13@cluster0.jxlb3.mongodb.net/school-of-breath?retryWrites=true&w=majority&appName=Cluster0';
const TARGET_URI = 'mongodb+srv://abhishekdug:AONgv5tx5LngDz4b@cluster0.j2ulcwk.mongodb.net/school-of-breath?retryWrites=true&w=majority';

const SKIP       = new Set(['system.views', 'system.profile']);
const BATCH_SIZE = 500;

function stableStr(obj) {
  if (obj === null || obj === undefined) return String(obj);
  if (obj && obj._bsontype === 'ObjectId') return `OID:${obj.toHexString()}`;
  if (obj instanceof Date) return `DATE:${obj.toISOString()}`;
  if (Buffer.isBuffer(obj)) return `BUF:${obj.toString('hex')}`;
  if (Array.isArray(obj)) return `[${obj.map(stableStr).join(',')}]`;
  if (typeof obj === 'object') {
    return `{${Object.keys(obj).sort().map(k => `${k}:${stableStr(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(obj);
}

function docsEqual(a, b) { return stableStr(a) === stableStr(b); }

function getTs(doc) {
  const v = doc.updatedAt || doc.updated_at || doc.lastAccessDate || doc.lastSeenAt;
  return v ? new Date(v).getTime() : 0;
}

async function batchInsert(coll, docs) {
  if (!docs.length) return 0;
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    try {
      const r = await coll.insertMany(batch, { ordered: false });
      inserted += r.insertedCount;
    } catch (e) {
      // ordered:false — partial success; count what was inserted
      if (e.result) inserted += e.result.nInserted || 0;
      else if (e.code !== 11000) throw e;
    }
  }
  return inserted;
}

async function batchReplace(coll, docs) {
  if (!docs.length) return 0;
  let updated = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const ops = batch.map(doc => ({
      replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: false }
    }));
    const r = await coll.bulkWrite(ops, { ordered: false });
    updated += r.modifiedCount || 0;
  }
  return updated;
}

async function main() {
  console.log('='.repeat(65));
  console.log('  FAST BATCH SYNC  source → target');
  console.log('='.repeat(65));

  const srcClient = new MongoClient(SOURCE_URI, { serverSelectionTimeoutMS: 15000 });
  const tgtClient = new MongoClient(TARGET_URI, { serverSelectionTimeoutMS: 15000 });

  try {
    await Promise.all([srcClient.connect(), tgtClient.connect()]);
    console.log('[OK] Connected.\n');

    const srcDb = srcClient.db('school-of-breath');
    const tgtDb = tgtClient.db('school-of-breath');

    const colls = (await srcDb.listCollections().toArray())
      .map(c => c.name).filter(n => !SKIP.has(n)).sort();

    let totalInserted = 0, totalUpdated = 0, totalSkipped = 0;

    for (const name of colls) {
      process.stdout.write(`  ${name} ... `);
      const srcColl = srcDb.collection(name);
      const tgtColl = tgtDb.collection(name);

      // Load target _id → {doc or just ts} into memory
      const tgtMap = new Map();
      for await (const doc of tgtColl.find({})) {
        tgtMap.set(doc._id.toString(), doc);
      }

      const toInsert  = [];
      const toUpdate  = [];
      let   skipped   = 0;

      for await (const srcDoc of srcColl.find({})) {
        const id     = srcDoc._id.toString();
        const tgtDoc = tgtMap.get(id);

        if (!tgtDoc) {
          toInsert.push(srcDoc);
        } else if (!docsEqual(srcDoc, tgtDoc)) {
          if (getTs(srcDoc) > getTs(tgtDoc)) {
            toUpdate.push(srcDoc);
          } else {
            skipped++;
          }
        }
      }

      const inserted = await batchInsert(tgtColl, toInsert);
      const updated  = await batchReplace(tgtColl, toUpdate);

      const parts = [];
      if (inserted) parts.push(`inserted ${inserted}`);
      if (updated)  parts.push(`updated ${updated}`);
      if (skipped)  parts.push(`kept ${skipped} (target newer)`);
      console.log(parts.length ? parts.join(', ') : 'OK (no changes)');

      totalInserted += inserted;
      totalUpdated  += updated;
      totalSkipped  += skipped;
    }

    console.log('\n' + '='.repeat(65));
    console.log('  DONE');
    console.log(`  Inserted : ${totalInserted.toLocaleString()}`);
    console.log(`  Updated  : ${totalUpdated.toLocaleString()}  (source was newer)`);
    console.log(`  Kept     : ${totalSkipped.toLocaleString()}  (target was newer)`);
    console.log('='.repeat(65));

  } finally {
    await Promise.all([srcClient.close(), tgtClient.close()]);
  }
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
