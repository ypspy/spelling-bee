const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

// middleware
app.use(express.json({ limit: "10mb" })); // 요청 크기 제한
app.use(express.static("public"));

// Router 등록부
const sessionRoutes = require("./routes/sessions");
const wordRoutes = require("./routes/words");
const recordRoutes = require("./routes/records");
const statsRoutes = require("./routes/stats");
const tableRoutes = require("./routes/table");
const ttsRoutes = require("./routes/tts");
const translationRoutes = require("./routes/translation");

app.use("/sessions", sessionRoutes);
app.use("/words", wordRoutes);
app.use("/records", recordRoutes);
app.use("/stats", statsRoutes);
app.use("/table", tableRoutes);
app.use("/tts", ttsRoutes);
app.use("/translation", translationRoutes);

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// 글로벌 에러 핸들러
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// MongoDB 연결
const db = require('./lib/db');
db.connect()
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// 헬스 체크
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
