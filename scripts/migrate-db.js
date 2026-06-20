/**
 * Copy this project's MongoDB database from one cluster/server to another.
 *
 *   Source: MONGODB_URI     + DATABASE_NAME
 *   Target: NEW_MONGODB_URI + NEW_DATABASE_NAME (falls back to DATABASE_NAME)
 *
 * Database names come from the *_DATABASE_NAME vars; if unset, they fall back
 * to whatever each URI's path resolves to.
 *
 * All quiz-related collections are dropped (not copied), so the destination
 * is a clean ticketing-only database.
 *
 * Usage:
 *   node scripts/migrate-db.js            # copy
 *   node scripts/migrate-db.js --dry-run  # show what would be copied, change nothing
 *
 * Env is loaded from .env.local first (Next.js convention), then .env.
 */

require('dotenv/config');
const { config } = require('dotenv');
const { resolve } = require('path');
const { MongoClient } = require('mongodb');

// Load .env.local (Next.js convention) then fall back to .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const SOURCE_URI = process.env.MONGODB_URI;
const TARGET_URI = process.env.NEW_MONGODB_URI;
// Database names come from env vars, not the URI path.
// NEW_DATABASE_NAME falls back to DATABASE_NAME so a same-name copy needs only one var.
const SOURCE_DB = process.env.DATABASE_NAME;
const TARGET_DB = process.env.NEW_DATABASE_NAME || process.env.DATABASE_NAME;
const DRY_RUN = process.argv.includes('--dry-run');

// Any collection whose name contains one of these (case-insensitive) is skipped.
const QUIZ_PATTERNS = ['quiz', 'leaderboard', 'question'];
const BATCH_SIZE = 1000;

function isQuizCollection(name) {
    const lower = name.toLowerCase();
    return QUIZ_PATTERNS.some((p) => lower.includes(p));
}

function resolveDbName(uri, envValue) {
    // Prefer the explicit env var; otherwise fall back to whatever the URI path
    // resolves to (the driver defaults to "test" when the path is empty).
    if (envValue) return envValue;
    return new MongoClient(uri).db().databaseName;
}

async function copyCollection(sourceDb, targetDb, name) {
    const sourceColl = sourceDb.collection(name);
    const targetColl = targetDb.collection(name);

    const total = await sourceColl.estimatedDocumentCount();

    if (DRY_RUN) {
        console.log(`  • ${name}: would copy ~${total} documents`);
        return total;
    }

    // Start from a clean target collection so the copy is exact (no leftovers).
    await targetColl.deleteMany({});

    let copied = 0;
    let batch = [];
    const cursor = sourceColl.find({});

    for await (const doc of cursor) {
        batch.push(doc);
        if (batch.length >= BATCH_SIZE) {
            await targetColl.insertMany(batch, { ordered: false });
            copied += batch.length;
            batch = [];
            process.stdout.write(`\r  • ${name}: ${copied}/${total} documents`);
        }
    }
    if (batch.length > 0) {
        await targetColl.insertMany(batch, { ordered: false });
        copied += batch.length;
    }
    process.stdout.write(`\r  • ${name}: ${copied}/${total} documents\n`);

    // Recreate indexes (skip the implicit _id index, which always exists).
    const indexes = await sourceColl.indexes();
    for (const idx of indexes) {
        if (idx.name === '_id_') continue;
        const { key, name: idxName, v, ns, background, ...options } = idx;
        try {
            await targetColl.createIndex(key, { name: idxName, ...options });
        } catch (err) {
            console.warn(`    ! index "${idxName}" on ${name} skipped: ${err.message}`);
        }
    }

    return copied;
}

async function main() {
    if (!SOURCE_URI) {
        console.error('Error: MONGODB_URI (source) is not set in the environment.');
        process.exit(1);
    }
    if (!TARGET_URI) {
        console.error('Error: NEW_MONGODB_URI (target) is not set in the environment.');
        process.exit(1);
    }

    const sourceDbName = resolveDbName(SOURCE_URI, SOURCE_DB);
    const targetDbName = resolveDbName(TARGET_URI, TARGET_DB);

    console.log(`Source DB : ${sourceDbName}${SOURCE_DB ? ' (from DATABASE_NAME)' : ' (from URI)'}`);
    console.log(`Target DB : ${targetDbName}${TARGET_DB ? ' (from NEW_DATABASE_NAME)' : ' (from URI)'}`);
    console.log(`Mode      : ${DRY_RUN ? 'DRY RUN (no writes)' : 'COPY'}`);
    console.log('');

    const sourceClient = new MongoClient(SOURCE_URI);
    const targetClient = new MongoClient(TARGET_URI);

    try {
        await sourceClient.connect();
        await targetClient.connect();
        console.log('✓ Connected to both databases\n');

        const sourceDb = sourceClient.db(sourceDbName);
        const targetDb = targetClient.db(targetDbName);

        const collections = await sourceDb.listCollections({ type: 'collection' }).toArray();

        const toCopy = [];
        const toDrop = [];
        for (const { name } of collections) {
            if (name.startsWith('system.')) continue;
            (isQuizCollection(name) ? toDrop : toCopy).push(name);
        }

        if (toDrop.length > 0) {
            console.log(`Dropping quiz data (not copied): ${toDrop.join(', ')}\n`);
        }

        console.log('Copying collections:');
        let grandTotal = 0;
        for (const name of toCopy) {
            grandTotal += await copyCollection(sourceDb, targetDb, name);
        }

        // Ensure quiz collections do not linger on the target either.
        if (!DRY_RUN) {
            for (const name of toDrop) {
                await targetDb.collection(name).drop().catch(() => { });
            }
        }

        console.log('');
        console.log(
            DRY_RUN
                ? `✓ Dry run complete. ${toCopy.length} collections, ~${grandTotal} documents would be copied.`
                : `✓ Done. Copied ${toCopy.length} collections, ${grandTotal} documents.`
        );
    } catch (err) {
        console.error('\n✗ Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await sourceClient.close().catch(() => { });
        await targetClient.close().catch(() => { });
    }
}

main();
