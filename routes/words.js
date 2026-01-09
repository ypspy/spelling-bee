const express = require("express");
const router = express.Router();
const Word = require("../models/Word");
const Record = require("../models/Record");

/**
 * POST /words
 * body: { text: "apple", level: "one", alphabet?: "A" }
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
      priority: 0
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
// body: { text: "A | abaft | one bee\nB | badger | one bee" }
router.post("/bulk", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text" });

    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    const parsed = lines.map(line => {
      const [alphabet, word, levelRaw] = line.split("|").map(s => s.trim());

      return {
        alphabet: alphabet.toUpperCase(),
        text: word.toLowerCase(),
        level: levelRaw.startsWith("one") ? "one"
             : levelRaw.startsWith("two") ? "two"
             : "three",
        priority: 0
      };
    });

    // 중복 제거 (text 기준)
    const texts = parsed.map(p => p.text);
    const existing = await Word.find({ text: { $in: texts } }).select("text");
    const existingSet = new Set(existing.map(w => w.text));

    const toInsert = parsed.filter(p => !existingSet.has(p.text));

    if (toInsert.length === 0) {
      return res.json({ inserted: 0, skipped: parsed.length });
    }

    await Word.insertMany(toInsert);

    res.json({
      inserted: toInsert.length,
      skipped: parsed.length - toInsert.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /words/:id/priority
 * body: { delta: 1 }  // +1 또는 -1
 */
router.patch("/:id/priority", async (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body;

    if (typeof delta !== "number") {
      return res.status(400).json({ error: "delta must be a number" });
    }

    const word = await Word.findById(id);
    if (!word) {
      return res.status(404).json({ error: "Word not found" });
    }

    // priority 범위: 0 ~ 2
    const next = Math.max(0, Math.min(2, (word.priority || 0) + delta));
    word.priority = next;

    await word.save();

    res.json({
      success: true,
      priority: word.priority
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}); 

module.exports = router;
