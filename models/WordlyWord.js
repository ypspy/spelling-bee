const mongoose = require("mongoose");

const WordlyWordSchema = new mongoose.Schema({
  book: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    validate: { validator: Number.isInteger, message: "book must be an integer" }
  },
  lesson: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    validate: { validator: Number.isInteger, message: "lesson must be an integer" }
  },
  text: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  meaning: { type: String, default: "" }
}, { timestamps: true });

WordlyWordSchema.index({ book: 1, lesson: 1, text: 1 }, { unique: true });
WordlyWordSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("WordlyWord", WordlyWordSchema);
