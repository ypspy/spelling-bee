require("dotenv").config();
const db = require("../lib/db");
const Word = require("../models/Word");
const WordlyWord = require("../models/WordlyWord");
const { fetchKoreanMeaning } = require("../routes/translation");

const DELAY_MS = 800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clearAllMeanings() {
  const [daily, ww] = await Promise.all([
    Word.updateMany({}, { $set: { meaning: "" } }),
    WordlyWord.updateMany({}, { $set: { meaning: "" } })
  ]);
  console.log(`Cleared ${daily.modifiedCount} daily word(s), ${ww.modifiedCount} WW word(s).`);
}

async function refreshCollection(Model, label) {
  const words = await Model.find().select("text meaning").sort({ text: 1 });
  if (!words.length) {
    console.log(`No ${label} words to refresh.`);
    return { ok: 0, fail: 0 };
  }

  let ok = 0;
  let fail = 0;

  for (const word of words) {
    process.stdout.write(`[${label}] ${word.text} … `);
    try {
      const result = await fetchKoreanMeaning(word.text);
      const meaning = result?.meaning || "";
      if (meaning) {
        await Model.findByIdAndUpdate(word._id, { meaning });
        console.log(meaning);
        ok++;
      } else {
        console.log("(empty)");
        fail++;
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      fail++;
    }
    await sleep(DELAY_MS);
  }

  return { ok, fail };
}

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Usage: node scripts/refresh_meanings.js --yes");
    console.error("Clears all meanings and re-fetches via Gemini/fallback APIs.");
    process.exit(1);
  }

  await db.connect();

  await clearAllMeanings();
  console.log("");

  const daily = await refreshCollection(Word, "daily");
  const ww = await refreshCollection(WordlyWord, "ww");

  console.log("");
  console.log(`Done. daily: ${daily.ok} ok / ${daily.fail} fail, ww: ${ww.ok} ok / ${ww.fail} fail`);

  await db.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
