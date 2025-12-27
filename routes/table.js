const express = require("express");
const router = express.Router();
const Word = require("../models/Word");
const Session = require("../models/Session");
const Record = require("../models/Record");

router.get("/", async (req, res) => {
  try {
    const words = await Word.find().sort({ createdAt: 1 });

    // 최신이 먼저(내림차순): date DESC, sequence DESC
    const sessions = await Session.find().sort({ date: -1, sequence: -1 });

    const records = await Record.find();

    // wordId -> stats
    const agg = await Record.aggregate([
      {
        $group: {
          _id: "$wordId",
          success: { $sum: { $cond: [{ $eq: ["$result", "success"] }, 1, 0] } },
          attempts: { $sum: 1 }
        }
      }
    ]);

    const statsByWord = {};
    for (const r of agg) {
      statsByWord[String(r._id)] = { success: r.success, attempts: r.attempts };
    }

    res.json({ words, sessions, records, statsByWord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
