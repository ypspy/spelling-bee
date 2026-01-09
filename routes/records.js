const express = require("express");
const router = express.Router();
const Record = require("../models/Record");
const Word = require("../models/Word");

/**
 * POST /records/toggle
 * body: { wordId, sessionId }
 *
 * 상태 순환:
 * 없음 → success → fail → 없음
 *
 * priority 규칙:
 * - success → fail : priority +1
 * - fail → 취소   : priority -1
 * - priority 범위 : 0 ~ 2
 */
router.post("/toggle", async (req, res) => {
  try {
    const { wordId, sessionId } = req.body;

    if (!wordId || !sessionId) {
      return res.status(400).json({ error: "wordId and sessionId required" });
    }

    const record = await Record.findOne({ wordId, sessionId });

    /* =========================
       1️⃣ 없음 → success
    ========================= */
    if (!record) {
      const created = await Record.create({
        wordId,
        sessionId,
        result: "success"
      });
      return res.json(created);
    }

    /* =========================
       2️⃣ success → fail
    ========================= */
    if (record.result === "success") {
      record.result = "fail";
      await record.save();

      const word = await Word.findById(wordId);
      if (word) {
        word.priority = Math.min(2, (word.priority || 0) + 1);
        await word.save();
      }

      return res.json(record);
    }

    /* =========================
       3️⃣ fail → 취소(삭제)
    ========================= */
    if (record.result === "fail") {
      await Record.deleteOne({ _id: record._id });

      const word = await Word.findById(wordId);
      if (word) {
        word.priority = Math.max(0, (word.priority || 0) - 1);
        await word.save();
      }

      return res.json({ canceled: true });
    }

  } catch (err) {
    console.error("records/toggle error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
