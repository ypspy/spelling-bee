const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Record = require("../models/Record");

/**
 * GET /stats/words
 * 단어별 성공/시도 집계
 * 반환: { wordId: { success, attempts } }
 */
router.get("/words", async (req, res) => {
  try {
    const rows = await Record.aggregate([
      {
        $group: {
          _id: "$wordId",
          success: {
            $sum: {
              $cond: [{ $eq: ["$result", "success"] }, 1, 0]
            }
          },
          attempts: { $sum: 1 }
        }
      }
    ]);

    // wordId -> stats map
    const out = {};
    for (const r of rows) {
      out[String(r._id)] = { success: r.success, attempts: r.attempts };
    }

    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
