/**
 * fix-active-in-archive.js
 *
 * Finds the Active tournament inside the Archive session and marks it Completed
 * with the hardcoded details below. One-time fix script — safe to re-run
 * (it no-ops if no Active tournament is found).
 *
 * Usage:
 *   node scripts/fix-active-in-archive.js          # dry-run
 *   node scripts/fix-active-in-archive.js --run    # apply
 */

const fs = require("fs");
const path = require("path");

// Load .env.local
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
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "PokerMTTTracker";
const ARCHIVE_ID = "session_archive";
const DRY_RUN = !process.argv.includes("--run");

// ── Details to apply ──────────────────────────────────────────────────────────
const FINISH_POSITION = 23;
const FIELD_SIZE = 221;
const CASH_WON = 3.18;
const BOUNTIES_WON = 0;
const REVIEW = `77 in BUT with 21BBs. HJ jam and seeing that a rebuy was still viable, i shove, BB calls and we go three way all in

KK HJ and UTG raise 2x, i opt to call in attempts to reserve my stack. flop came TJQ with a flush draw, he half pots and i call. turn A and he quarter pots, i call agn reluctantly. river came Q completing the straight and he jams. now im in a blender. flushes beat my straight, a boat. so many combos can crack my KK. but seeing that a call still gives me a healthy stack, i make the call and he shows KQo. hero call but honestly, -EV in the long run if i had a shorter stack

dont remember the details but i was 88 IP and one seat to right limped, i jam and he calls with random Kx offsuit. turn came K and he busted me out. i think it was good jam regardless, low stacked and already blinding out, there was not gonna be a better time`;

// ── DynamoDB client ───────────────────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== Fix Active Tournament in Archive (${DRY_RUN ? "DRY RUN" : "LIVE RUN"}) ===\n`);

  // Load Archive session
  const res = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { TournamentId: ARCHIVE_ID },
  }));

  if (!res.Item) {
    console.error(`Archive session "${ARCHIVE_ID}" not found. Run the migration script first.`);
    process.exit(1);
  }

  const session = res.Item;
  const tournaments = session.tournaments || [];
  const activeOnes = tournaments.filter(t => t.status === "Active");

  if (activeOnes.length === 0) {
    console.log("No Active tournaments found in Archive. Nothing to do.");
    return;
  }

  if (activeOnes.length > 1) {
    console.warn(`WARNING: Found ${activeOnes.length} Active tournaments — will patch all of them.`);
  }

  activeOnes.forEach(t => {
    console.log(`  Found Active: ${t.id}  (${t.type || "unknown type"}  |  ${t.date || "no date"})`);
  });

  const updated = tournaments.map(t => {
    if (t.status !== "Active") return t;
    return {
      ...t,
      status: "Completed",
      finishPosition: FINISH_POSITION,
      fieldSize: FIELD_SIZE,
      cashWon: CASH_WON,
      bountiesWon: BOUNTIES_WON,
      review: REVIEW,
    };
  });

  if (DRY_RUN) {
    console.log("\nWould apply:");
    console.log(`  status        : Completed`);
    console.log(`  finishPosition: ${FINISH_POSITION}`);
    console.log(`  fieldSize     : ${FIELD_SIZE}`);
    console.log(`  cashWon       : ${CASH_WON}`);
    console.log(`  bountiesWon   : ${BOUNTIES_WON}`);
    console.log(`  review        : ${REVIEW.slice(0, 60)}…`);
    console.log("\nDry run complete. Add --run to apply.");
    return;
  }

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { TournamentId: ARCHIVE_ID },
    UpdateExpression: "SET tournaments = :t",
    ExpressionAttributeValues: { ":t": updated },
  }));

  console.log("\nDone — tournament patched to Completed.");
}

main().catch(err => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
