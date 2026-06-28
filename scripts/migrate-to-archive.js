/**
 * migrate-to-archive.js
 *
 * Wraps every standalone MTT tournament item in DynamoDB into a single
 * "Archive" session, then deletes the original items.
 *
 * Usage:
 *   node scripts/migrate-to-archive.js          # dry-run (safe, no writes)
 *   node scripts/migrate-to-archive.js --run    # actually migrate
 *
 * AWS credentials are picked up from environment variables
 * (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY for local dev, or
 * the Amplify IAM role when run in production).
 */

const fs = require("fs");
const path = require("path");

// Load .env.local from the project root (no dotenv dependency needed)
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach(line => {
      const match = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
      if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    });
}

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "PokerMTTTracker";
const ARCHIVE_ID = "session_archive";
const DRY_RUN = !process.argv.includes("--run");

// ── DynamoDB client (mirrors src/lib/dynamodb.ts) ────────────────────────────
const clientConfig = { region: process.env.AWS_REGION || "ap-southeast-1" };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig), {
  marshallOptions: { removeUndefinedValues: true },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Delete up to 25 items at a time (DynamoDB BatchWrite limit). */
async function batchDelete(keys) {
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: chunk.map(key => ({ DeleteRequest: { Key: key } })),
      },
    }));
    console.log(`  deleted items ${i + 1}–${i + chunk.length}`);
  }
}

/** Earliest ISO date string from a list (undefined-safe). */
function earliest(dates) {
  const valid = dates.filter(Boolean);
  if (!valid.length) return new Date().toISOString();
  return valid.reduce((a, b) => (a < b ? a : b));
}

/** Latest ISO date string from a list (undefined-safe). */
function latest(dates) {
  const valid = dates.filter(Boolean);
  if (!valid.length) return new Date().toISOString();
  return valid.reduce((a, b) => (a > b ? a : b));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== MTT Archive Migration (${DRY_RUN ? "DRY RUN — no writes" : "LIVE RUN"}) ===\n`);

  // 1. Scan everything
  let allItems = [];
  let lastKey;
  do {
    const res = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      ExclusiveStartKey: lastKey,
    }));
    allItems = allItems.concat(res.Items || []);
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Total items in table: ${allItems.length}`);

  // 2. Bail if Archive already exists
  if (allItems.some(i => i.TournamentId === ARCHIVE_ID)) {
    console.error(`\nERROR: Archive session "${ARCHIVE_ID}" already exists. Aborting to avoid duplication.`);
    process.exit(1);
  }

  // 3. Identify standalone MTT tournaments
  //    - no recordType (not "session" / "wallet")
  //    - no gameCategory (not "HomeGame" / "CashGame")
  const mttItems = allItems.filter(
    i => !i.recordType && !i.gameCategory
  );

  if (mttItems.length === 0) {
    console.log("\nNo standalone MTT tournaments found. Nothing to migrate.");
    return;
  }

  console.log(`\nStandalone MTT tournaments found: ${mttItems.length}`);
  mttItems.forEach(t => console.log(`  • ${t.TournamentId}  (${t.date || "no date"})`));

  // 4. Build the Archive session item
  const startedAt = earliest(mttItems.map(t => t.date || (t.bullets?.[0]?.registeredAt)));
  const endedAt = latest(
    mttItems.flatMap(t => [
      t.date,
      ...(t.bullets || []).map(b => b.bustedAt).filter(Boolean),
    ])
  );

  const archiveSession = {
    TournamentId: ARCHIVE_ID,
    id: ARCHIVE_ID,
    recordType: "session",
    name: "Archive",
    status: "Completed",
    startedAt,
    endedAt,
    tournaments: mttItems,
  };

  console.log(`\nArchive session to create:`);
  console.log(`  TournamentId : ${archiveSession.TournamentId}`);
  console.log(`  startedAt    : ${archiveSession.startedAt}`);
  console.log(`  endedAt      : ${archiveSession.endedAt}`);
  console.log(`  tournaments  : ${archiveSession.tournaments.length} items`);

  // 5. Keys of items to delete after migration
  const keysToDelete = mttItems.map(t => ({ TournamentId: t.TournamentId }));

  if (DRY_RUN) {
    console.log("\nDry run complete. Re-run with --run to apply changes.");
    return;
  }

  // 6. Write Archive session
  console.log("\nWriting Archive session…");
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: archiveSession }));
  console.log("  Archive session written.");

  // 7. Delete originals
  console.log(`\nDeleting ${keysToDelete.length} original tournament items…`);
  await batchDelete(keysToDelete);

  console.log("\nMigration complete.");
}

main().catch(err => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
