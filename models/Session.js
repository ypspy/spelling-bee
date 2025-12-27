const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  sessionId: String,
  date: String,
  sequence: Number,
  status: { type: String, enum: ["open", "posted"] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Session", SessionSchema);
