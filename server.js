const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

const sessionRoutes = require("./routes/sessions");
const wordRoutes = require("./routes/words");
const recordRoutes = require("./routes/records");
const statsRoutes = require("./routes/stats");
const tableRoutes = require("./routes/table");
const ttsRoutes = require("./routes/tts");

// middleware
app.use(express.json());
app.use(express.static("public"));

// Router 등록부
app.use("/sessions", sessionRoutes);
app.use("/words", wordRoutes);
app.use("/records", recordRoutes);
app.use("/stats", statsRoutes);
app.use("/table", tableRoutes);
app.use("/tts", ttsRoutes);

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// 테스트용
app.get("/health", (req, res) => {
  res.send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
