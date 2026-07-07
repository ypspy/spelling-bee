const mongoose = require("mongoose");

const WordSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  meaning: {
    type: String,
    default: ""
  },
  addedDate: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/
  }
}, { timestamps: true });

WordSchema.index({ addedDate: -1, text: 1 });
WordSchema.index({ text: 1, addedDate: 1 }, { unique: true });

module.exports = mongoose.model("Word", WordSchema);
