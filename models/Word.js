const mongoose = require("mongoose");

const WordSchema = new mongoose.Schema({
  text: { type: String, required: true, unique: true },

  // 난이도 군
  level: {
    type: String,
    enum: ["one", "two", "three"],
    default: "one"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Word", WordSchema);
