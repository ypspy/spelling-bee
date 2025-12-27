const express = require("express");
const router = express.Router();
const Word = require("../models/Word");
const Record = require("../models/Record");

// POST /words
// body: { text: "apple", level: "one" }
router.post("/", async (req, res) => {
  try {
    const { text, level = "one" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text" });
    }

    const word = await Word.create({
      text: text.trim().toLowerCase(),
      level
    });

    res.json(word);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /words
 * 단어 목록 조회 (생성순)
 */
router.get("/", async (req, res) => {
  try {
    const words = await Word.find().sort({ createdAt: 1 });
    res.json(words);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /words/:id
 * 단어 삭제 + 관련 Record 삭제
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await Word.findByIdAndDelete(id);
    await Record.deleteMany({ wordId: id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /words/bulk
// body: { text: "apple\nbanana, cherry", level: "two" }
router.post("/bulk", async (req, res) => {
  try {
    const { text, level = "one" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text" });
    }

    // 1️⃣ 줄바꿈/콤마로 분리
    const words = text
      .split(/[\n,]+/)
      .map(w => w.trim().toLowerCase())
      .filter(Boolean);

    // 2️⃣ 중복 제거
    const unique = [...new Set(words)];

    // 3️⃣ 이미 DB에 있는 단어 찾기
    const existing = await Word.find({
      text: { $in: unique }
    }).select("text");

    const existingSet = new Set(existing.map(w => w.text));

    // 4️⃣ 새로 넣을 단어만 추림
    const toInsert = unique
      .filter(w => !existingSet.has(w))
      .map(w => ({
        text: w,
        level
      }));

    if (toInsert.length === 0) {
      return res.json({ inserted: 0, skipped: unique.length });
    }

    // 5️⃣ 한 번에 insert
    await Word.insertMany(toInsert);

    res.json({
      inserted: toInsert.length,
      skipped: unique.length - toInsert.length,
      level
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
