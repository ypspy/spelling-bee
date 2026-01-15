const express = require("express");
const router = express.Router();
const Word = require("../models/Word");
const Record = require("../models/Record");

/**
 * POST /words
 */
router.post("/", async (req, res) => {
  try {
    const { text, level = "one", alphabet } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text" });
    }

    const word = await Word.create({
      text: text.trim().toLowerCase(),
      level,
      alphabet: alphabet ? alphabet.toUpperCase() : undefined,
      priority: 0,
      active: true,
      bookmarked: false
    });

    res.json(word);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /words
 * 👉 active=true 만 조회
 */
router.get("/", async (req, res) => {
  try {
    const words = await Word.find({ active: true })
      .select("text alphabet level priority bookmarked active meaning createdAt")
      .sort({ createdAt: 1 })
      .lean();
    res.json(words);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /words/:id
 * 단어 수정
 */
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text" });
    }

    const word = await Word.findByIdAndUpdate(
      id,
      { text: text.trim().toLowerCase() },
      { new: true, runValidators: true }
    );

    if (!word) {
      return res.status(404).json({ error: "Word not found" });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ⭐ PATCH /words/:id/bookmark
 * 북마크 on/off
 */
router.patch("/:id/bookmark", async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;

    const word = await Word.findByIdAndUpdate(
      id,
      { bookmarked: !!value },
      { new: true }
    );

    if (!word) {
      return res.status(404).json({ error: "Word not found" });
    }

    res.json({
      success: true,
      bookmarked: word.bookmarked
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ⭐ PATCH /words/:id/priority
 * 우선순위 증가/감소
 */
router.patch("/:id/priority", async (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body;

    if (typeof delta !== "number") {
      return res.status(400).json({ error: "delta must be a number" });
    }

    const word = await Word.findById(id).select("priority");
    if (!word) {
      return res.status(404).json({ error: "Word not found" });
    }

    const currentPriority = word.priority || 0;
    const newPriority = Math.max(0, Math.min(2, currentPriority + delta));

    await Word.findByIdAndUpdate(id, { priority: newPriority });

    res.json({ success: true, priority: newPriority });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ⭐ PATCH /words/:id/meaning
 * 한국어 뜻 업데이트
 */
router.patch("/:id/meaning", async (req, res) => {
  try {
    const { id } = req.params;
    const { meaning } = req.body;

    const word = await Word.findByIdAndUpdate(
      id,
      { meaning: meaning || "" },
      { new: true }
    );

    if (!word) {
      return res.status(404).json({ error: "Word not found" });
    }

    res.json({ success: true, meaning: word.meaning });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ⭐ PATCH /words/:id/hide
 * HIDE → inactive 처리
 */
router.patch("/:id/hide", async (req, res) => {
  try {
    const { id } = req.params;

    const word = await Word.findByIdAndUpdate(
      id,
      { active: false },
      { new: true }
    );

    if (!word) {
      return res.status(404).json({ error: "Word not found" });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /words/:id
 * 완전 삭제 (Record 포함)
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
