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

  // ⭐️ 새로 추가
  priority: {
    type: Number,
    default: 0,      // 0=기본, 1=중요, 2=핵심
    index: true
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
