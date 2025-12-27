const express = require("express");
const router = express.Router();
const Record = require("../models/Record");
const Session = require("../models/Session");

/**
 * POST /records/toggle
 * cell 클릭 토글
 */
router.post("/toggle", async (req, res) => {
  try {
    const { wordId, sessionId } = req.body;

    if (!wordId || !sessionId) {
      return res.status(400).json({ error: "wordId and sessionId required" });
    }

    // 1. 세션이 open인지 확인
    const session = await Session.findById(sessionId);
    if (!session || session.status !== "open") {
      return res.status(403).json({ error: "Session is not editable" });
    }

    // 2. 기존 record 조회
    const record = await Record.findOne({ wordId, sessionId });

    // 3. 상태 순환
    if (!record) {
      // 없음 → success
      const created = await Record.create({
        wordId,
        sessionId,
        result: "success"
      });
      return res.json(created);
    }

    if (record.result === "success") {
      // success → fail
      record.result = "fail";
      await record.save();
      return res.json(record);
    }

    // fail → 없음 (삭제)
    await Record.deleteOne({ _id: record._id });
    res.json({ deleted: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
