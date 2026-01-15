const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  date: { type: String, index: true },
  sequence: Number,
  status: { type: String, enum: ["open", "posted"], index: true },
  createdAt: { type: Date, default: Date.now }
});

// 복합 인덱스: 정렬 쿼리 최적화
SessionSchema.index({ date: -1, sequence: -1 });
SessionSchema.index({ status: 1, date: -1, sequence: -1 });

module.exports = mongoose.model("Session", SessionSchema);
