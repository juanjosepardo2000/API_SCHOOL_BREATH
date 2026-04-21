/**
 * validate-sync.js  (bulk/fast version)
 * Compares source and target MongoDB databases.
 * Loads each collection in bulk (two cursor scans) — no per-doc round trips.
 */

const { MongoClient, ObjectId } = require('mongodb');

const SOURCE_URI = 'mongodb+srv://shurakd8:parzival-13@cluster0.jxlb3.mongodb.net/school-of-breath?retryWrites=true&w=majority&appName=Cluster0';
const TARGET_URI = 'mongodb+srv://abhishekdug:AONgv5tx5LngDz4b@cluster0.j2ulcwk.mongodb.net/school-of-breath?retryWrites=true&w=majority';

const SOURCE_DB = 'school-of-breath';
const TARGET_DB = 'school-of-breath';

const SKIP_COLLECTIONS = new Set(['system.views', 'system.profile']);
const MAX_MISSING_SHOWN  = 10;
const MAX_DIFF_SHOWN     = 5;

// ─── helpers ─────────────────────────────────────────────────────────────────

function stableStringify(obj) {
  if (obj === null || obj === undefined) return String(obj);
  if (obj instanceof ObjectId) return `OID:${obj.toHexString()}`;
  if (obj instanceof Date) return `DATE:${obj.toISOString()}`;
  if (Buffer.isBuffer(obj)) return `BUF:${obj.toString('hex')}`;
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  if (typeof obj === 'object') {
    return `{${Object.keys(obj).sort().map(k => `${k}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(obj);
}

function fieldDiff(src, tgt) {
  const sKeys = new Set(Object.keys(src));
  const tKeys = new Set(Object.keys(tgt));
  return {
    onlyInSrc: [...sKeys].filter(k => !tKeys.has(k)),
    onlyInTgt: [...tKeys].filter(k => !sKeys.has(k)),
    changed:   [...sKeys].filter(k => tKeys.has(k) && stableStringify(src[k]) !== stableStringify(tgt[k])),
  };
}

function fmt(n) { return n.toLocaleString(); }

// Load entire collection into a Map<idStr, doc>
async function loadCollection(coll) {
  const map = new Map();
  const cursor = coll.find({});
  for await (const doc of cursor) {
    map.set(doc._id.toString(), doc);
  }
  return map;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70));
  console.log('  DB SYNC VALIDATION  (bulk mode)');
  console.log(`  Source: ${SOURCE_URI.replace(/\/\/.*@/, '//***@')}`);
  console.log(`  Target: ${TARGET_URI.replace(/\/\/.*@/, '//***@')}`);
  console.log('='.repeat(70));

  const srcClient = new MongoClient(SOURCE_URI, { serverSelectionTimeoutMS: 15000 });
  const tgtClient = new MongoClient(TARGET_URI, { serverSelectionTimeoutMS: 15000 });

  try {
    await Promise.all([srcClient.connect(), tgtClient.connect()]);
    console.log('\n[OK] Connected to both databases.\n');

    const srcDb = srcClient.db(SOURCE_DB);
    const tgtDb = tgtClient.db(TARGET_DB);

    const [srcColls, tgtColls] = await Promise.all([
      srcDb.listCollections().toArray(),
      tgtDb.listCollections().toArray(),
    ]);

    const srcNames = new Set(srcColls.map(c => c.name).filter(n => !SKIP_COLLECTIONS.has(n)));
    const tgtNames = new Set(tgtColls.map(c => c.name).filter(n => !SKIP_COLLECTIONS.has(n)));

    const missingInTarget = [...srcNames].filter(n => !tgtNames.has(n));
    const extraInTarget   = [...tgtNames].filter(n => !srcNames.has(n));
    const common          = [...srcNames].filter(n => tgtNames.has(n)).sort();

    console.log(`Collections in source : ${srcNames.size}`);
    console.log(`Collections in target : ${tgtNames.size}`);

    if (missingInTarget.length) {
      console.log(`\n[WARN] Collections in SOURCE but MISSING in target (${missingInTarget.length}):`);
      missingInTarget.forEach(n => console.log(`  - ${n}`));
    }
    if (extraInTarget.length) {
      console.log(`\n[INFO] Collections only in TARGET (not in source) (${extraInTarget.length}):`);
      extraInTarget.forEach(n => console.log(`  + ${n}`));
    }

    let totalOk = 0, totalMissing = 0, totalConflict = 0;
    const summaryRows = [];

    for (const name of common) {
      process.stdout.write(`\nChecking [${name}] ... `);

      const srcColl = srcDb.collection(name);
      const tgtColl = tgtDb.collection(name);

      // Load both sides in parallel
      const [srcMap, tgtMap] = await Promise.all([
        loadCollection(srcColl),
        loadCollection(tgtColl),
      ]);

      const srcCount = srcMap.size;
      const tgtCount = tgtMap.size;
      process.stdout.write(`src=${fmt(srcCount)}  tgt=${fmt(tgtCount)}  ${srcCount === tgtCount ? '✓' : '≠'}\n`);

      const missingDocs  = [];
      const conflictDocs = [];

      for (const [id, srcDoc] of srcMap) {
        if (!tgtMap.has(id)) {
          missingDocs.push(id);
          totalMissing++;
        } else {
          const tgtDoc = tgtMap.get(id);
          if (stableStringify(srcDoc) !== stableStringify(tgtDoc)) {
            const diff = fieldDiff(srcDoc, tgtDoc);
            conflictDocs.push({ id, diff });
            totalConflict++;
          } else {
            totalOk++;
          }
        }
      }

      summaryRows.push({ name, srcCount, tgtCount, missing: missingDocs.length, conflicts: conflictDocs.length });

      if (missingDocs.length) {
        console.log(`  [MISSING in target] ${missingDocs.length} doc(s):`);
        missingDocs.slice(0, MAX_MISSING_SHOWN).forEach(id => console.log(`    _id: ${id}`));
        if (missingDocs.length > MAX_MISSING_SHOWN)
          console.log(`    ... and ${missingDocs.length - MAX_MISSING_SHOWN} more`);
      }

      if (conflictDocs.length) {
        console.log(`  [CONFLICTS] ${conflictDocs.length} doc(s) differ:`);
        conflictDocs.slice(0, MAX_DIFF_SHOWN).forEach(({ id, diff }) => {
          console.log(`    _id: ${id}`);
          if (diff.onlyInSrc.length) console.log(`      fields only in src : ${diff.onlyInSrc.join(', ')}`);
          if (diff.onlyInTgt.length) console.log(`      fields only in tgt : ${diff.onlyInTgt.join(', ')}`);
          if (diff.changed.length)   console.log(`      fields with diffs   : ${diff.changed.join(', ')}`);
        });
        if (conflictDocs.length > MAX_DIFF_SHOWN)
          console.log(`    ... and ${conflictDocs.length - MAX_DIFF_SHOWN} more conflicts`);
      }

      if (!missingDocs.length && !conflictDocs.length) {
        console.log(`  [OK] All ${fmt(srcCount)} documents match.`);
      }
    }

    // ── summary table ─────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(70));
    console.log('  SUMMARY');
    console.log('='.repeat(70));
    console.log(`${'Collection'.padEnd(35)} ${'Src'.padStart(8)} ${'Tgt'.padStart(8)} ${'Missing'.padStart(9)} ${'Conflicts'.padStart(10)}`);
    console.log('-'.repeat(70));
    for (const r of summaryRows) {
      const ok = r.missing === 0 && r.conflicts === 0;
      console.log(
        `${ok ? '✓' : '✗'} ${r.name.padEnd(33)} ${fmt(r.srcCount).padStart(8)} ${fmt(r.tgtCount).padStart(8)} ${String(r.missing).padStart(9)} ${String(r.conflicts).padStart(10)}`
      );
    }
    console.log('-'.repeat(70));
    console.log(`Total docs OK       : ${fmt(totalOk)}`);
    console.log(`Total docs MISSING  : ${fmt(totalMissing)}`);
    console.log(`Total docs CONFLICT : ${fmt(totalConflict)}`);

    if (missingInTarget.length)
      console.log(`\nCollections entirely missing from target: ${missingInTarget.join(', ')}`);

    if (totalMissing === 0 && totalConflict === 0 && missingInTarget.length === 0) {
      console.log('\n[SUCCESS] Databases are fully in sync. ');
    } else {
      console.log('\n[ACTION NEEDED] Differences found — see details above.');
    }
    console.log('='.repeat(70));

  } finally {
    await Promise.all([srcClient.close(), tgtClient.close()]);
  }
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
