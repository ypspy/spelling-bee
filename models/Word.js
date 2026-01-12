const mongoose = require("mongoose");

const WordSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    index: true
  },

  alphabet: {
    type: String,
    index: true
  },

  level: {
    type: String,
    enum: ["one", "two", "three"],
    index: true
  },

  // ⭐️ 중요도 (이미 있음)
  priority: {
    type: Number,
    default: 0,      // 0=기본, 1=중요, 2=핵심
    index: true
  },

  // ⭐️ 북마크 (추가)
  bookmarked: {
    type: Boolean,
    default: false,
    index: true       // 북마크 검색/점프 성능용
  },

  active: {
    type: Boolean,
    default: true
  },

  source: {
    type: String,
    default: "bulk-v2"
  }

}, { timestamps: true });

module.exports = mongoose.model("Word", WordSchema);
