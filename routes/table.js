const express = require("express");
const router = express.Router();
const Word = require("../models/Word");
const Session = require("../models/Session");
const Record = require("../models/Record");

router.get("/", async (req, res) => {
  try {
    // 병렬 쿼리 실행으로 응답 시간 단축
    const [words, sessions, records, statsAgg] = await Promise.all([
      // 필요한 필드만 선택 (projection)
      Word.find({ active: true })
        .select("text alphabet level priority bookmarked active meaning")
        .sort({ createdAt: 1 })
        .lean(), // lean()으로 Mongoose 문서 대신 일반 객체 반환 (메모리 절약)
      
      Session.find()
        .select("sessionId date sequence status")
        .sort({ date: -1, sequence: -1 })
        .lean(),
      
      // records는 필요한 필드만 선택
      Record.find()
        .select("wordId sessionId result")
        .lean(),
      
      // 통계 집계
      Record.aggregate([
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
      ])
    ]);

    // statsByWord 맵 생성
    const statsByWord = {};
    for (const r of statsAgg) {
      statsByWord[String(r._id)] = {
        success: r.success,
        attempts: r.attempts
      };
    }

    res.json({ words, sessions, records, statsByWord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
