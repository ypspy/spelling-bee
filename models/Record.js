const mongoose = require("mongoose");

const RecordSchema = new mongoose.Schema({
  wordId: { type: mongoose.Schema.Types.ObjectId, ref: "Word", index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session", index: true },
  result: { type: String, enum: ["success", "fail"] },
  createdAt: { type: Date, default: Date.now }
});

// 복합 인덱스: wordId + sessionId 조회 최적화
RecordSchema.index({ wordId: 1, sessionId: 1 });

module.exports = mongoose.model("Record", RecordSchema);
