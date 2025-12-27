const mongoose = require("mongoose");

const RecordSchema = new mongoose.Schema({
  wordId: { type: mongoose.Schema.Types.ObjectId, ref: "Word" },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
  result: { type: String, enum: ["success", "fail"] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Record", RecordSchema);
