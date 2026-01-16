const db = require('../lib/db');
const readline = require('readline');
const Word = require('../models/Word');

async function promptConfirm() {
  if (process.argv.includes('--yes')) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => rl.question("This will clear the `meaning` field on all Word documents. Type YES to proceed: ", ans => { rl.close(); resolve(ans); }));
  return answer === 'YES';
}

async function main() {
  const ok = await promptConfirm();
  if (!ok) {
    console.log('Aborted. No changes made.');
    process.exit(0);
  }

  await db.connect();

  // Only update documents with a non-empty meaning to minimize writes
  const filter = { meaning: { $exists: true, $ne: '' } };
  const update = { $set: { meaning: '' } };

  try {
    const res = await Word.updateMany(filter, update);
    // Mongoose may return different keys depending on version
    const matched = res.matchedCount ?? res.n ?? 0;
    const modified = res.modifiedCount ?? res.nModified ?? 0;
    console.log(`Matched ${matched} documents. Modified ${modified} documents.`);
  } catch (err) {
    console.error('Update failed:', err.message);
  } finally {
    await db.disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
