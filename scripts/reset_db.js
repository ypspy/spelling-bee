require("dotenv").config();
const db = require("../lib/db");

const COLLECTIONS = ["words", "sessions", "records"];

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Usage: node scripts/reset_db.js --yes");
    process.exit(1);
  }

  await db.connect();
  const database = require("mongoose").connection.db;

  for (const name of COLLECTIONS) {
    try {
      await database.collection(name).drop();
      console.log(`Dropped collection: ${name}`);
    } catch (err) {
      if (err.code === 26) {
        console.log(`Skipped (not found): ${name}`);
      } else {
        throw err;
      }
    }
  }

  await db.disconnect();
  console.log("Reset complete.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
