const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const WordlyWord = require("../models/WordlyWord");
const { normalizeText, validateWordText } = require("../lib/validate");
const { parseBook, parseLesson, parseRecentLimit } = require("../lib/wordlyWise");

router.get("/words", async (req, res) => {
  try {
    const bookResult = parseBook(req.query.book);
    if (bookResult.error) return res.status(400).json({ error: bookResult.error });

    const lessonResult = parseLesson(req.query.lesson);
    if (lessonResult.error) return res.status(400).json({ error: lessonResult.error });

    const words = await WordlyWord.find({
      book: bookResult.value,
      lesson: lessonResult.value
    })
      .select("book lesson text meaning")
      .sort({ text: 1 })
      .lean();

    res.json({ words });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/words", async (req, res) => {
  try {
    const text = normalizeText(req.body.text);
    const textError = validateWordText(text);
    if (textError) return res.status(400).json({ error: textError });

    const bookResult = parseBook(req.body.book);
    if (bookResult.error) return res.status(400).json({ error: bookResult.error });

    const lessonResult = parseLesson(req.body.lesson);
    if (lessonResult.error) return res.status(400).json({ error: lessonResult.error });

    const word = await WordlyWord.create({
      text,
      book: bookResult.value,
      lesson: lessonResult.value,
      meaning: ""
    });
    res.status(201).json(word);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "이미 추가된 단어입니다" });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/words/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid word ID" });
    }
    const result = await WordlyWord.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ error: "Word not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/recent-lessons", async (req, res) => {
  try {
    const limit = parseRecentLimit(req.query.limit);
    const rows = await WordlyWord.aggregate([
      {
        $group: {
          _id: { book: "$book", lesson: "$lesson" },
          lastActivity: { $max: "$updatedAt" }
        }
      },
      { $sort: { lastActivity: -1 } },
      { $limit: limit }
    ]);

    const lessons = rows.map((row) => ({
      book: row._id.book,
      lesson: row._id.lesson,
      lastActivity: row.lastActivity
    }));

    res.json({ lessons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
