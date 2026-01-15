const express = require("express");
const router = express.Router();

const Session = require("../models/Session");
const Record = require("../models/Record");

/**
 * 오늘 날짜 (YYYY-MM-DD)
 */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /sessions
 * 새 세션 생성
 * - 기존 open → posted
 * - 새 세션 → open
 * - sessionId: YYYY-MM-DD-N
 */
router.post("/", async (req, res) => {
  try {
    // 1. 기존 open 세션을 posted로 전환
    await Session.updateOne(
      { status: "open" },
      { status: "posted" }
    );

    const date = today();

    // 2. 오늘 날짜 기준 마지막 sequence 조회 (최적화: 필요한 필드만)
    const last = await Session.findOne({ date })
      .select("sequence")
      .sort({ sequence: -1 })
      .lean();

    const nextSeq = last ? last.sequence + 1 : 1;

    // 3. 새 세션 생성
    const session = await Session.create({
      sessionId: `${date}-${nextSeq}`,
      date,
      sequence: nextSeq,
      status: "open"
    });

    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /sessions
 * 세션 목록 조회
 * - 최신 → 과거
 */
router.get("/", async (req, res) => {
  try {
    const sessions = await Session.find()
      .select("sessionId date sequence status")
      .sort({ date: -1, sequence: -1 })
      .lean();

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /sessions/current
 * 현재(open) 세션 삭제
 *
 * 동작:
 * 1. open 세션 찾기
 * 2. 해당 세션의 Record 전부 삭제
 * 3. 세션 삭제
 * 4. 가장 최신 posted 세션을 open으로 승격
 * 5. posted 세션이 없으면 새 open 세션 생성
 */
router.delete("/current", async (req, res) => {
  try {
    // 1. 현재 open 세션 찾기 (필요한 필드만)
    const current = await Session.findOne({ status: "open" })
      .select("_id sessionId")
      .sort({ date: -1, sequence: -1 })
      .lean();

    if (!current) {
      return res.status(400).json({ error: "No open session" });
    }

    // 2. 해당 세션의 모든 기록 삭제
    await Record.deleteMany({ sessionId: current._id });

    // 3. 세션 삭제
    await Session.deleteOne({ _id: current._id });

    // 4. 가장 최신 posted 세션을 open으로 복구
    const prev = await Session.findOne({ status: "posted" })
      .select("_id sessionId")
      .sort({ date: -1, sequence: -1 });

    if (prev) {
      prev.status = "open";
      await prev.save();

      return res.json({
        deleted: current.sessionId,
        reopened: prev.sessionId
      });
    }

    // 5. posted 세션도 하나도 없으면 새 세션 생성 (안전장치)
    const date = today();

    const newSession = await Session.create({
      sessionId: `${date}-1`,
      date,
      sequence: 1,
      status: "open"
    });

    res.json({
      deleted: current.sessionId,
      created: newSession.sessionId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
