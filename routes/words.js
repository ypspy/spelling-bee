const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Word = require("../models/Word");
const { todayKST, isValidDateStr, clampWordRange } = require("../lib/date");
const { normalizeText, validateWordText } = require("../lib/validate");

router.get("/", async (req, res) => {
  try {
    const { from, to } = clampWordRange(req.query.from, req.query.to);
    const words = await Word.find({ addedDate: { $gte: from, $lte: to } })
      .select("text meaning addedDate")
      .sort({ addedDate: -1, text: 1 })
      .lean();
    res.json({ words });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const text = normalizeText(req.body.text);
    const addedDate = req.body.addedDate;

    const textError = validateWordText(text);
    if (textError) return res.status(400).json({ error: textError });

    if (!isValidDateStr(addedDate) || addedDate !== todayKST()) {
      return res.status(400).json({ error: "오늘 날짜로만 단어를 추가할 수 있습니다" });
    }

    const word = await Word.create({ text, addedDate, meaning: "" });
    res.status(201).json(word);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "이미 추가된 단어입니다" });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid word ID" });
    }
    const result = await Word.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ error: "Word not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
