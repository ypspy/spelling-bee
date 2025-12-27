const express = require("express");
const router = express.Router();
const Word = require("../models/Word");
const Record = require("../models/Record");

/**
 * POST /words
 * 단어 추가
 */
router.post("/", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Word text required" });
    }

    const word = await Word.create({
      text: text.trim()
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

module.exports = router;
