const express = require("express");
const router = express.Router();
const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const path = require("path");

// 개발 환경에서만 로그 표시
const isDev = process.env.NODE_ENV !== "production";
const log = (...args) => isDev && console.log(...args);

// Google Cloud credentials 설정
let credentials = undefined;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
  try {
    const credentialsJson = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('utf8');
    credentials = JSON.parse(credentialsJson);
  } catch (err) {
    log("Failed to parse TTS credentials:", err.message);
  }
}

const client = new textToSpeech.TextToSpeechClient({ credentials });

router.get("/", async (req, res) => {
  try {
    const text = (req.query.text || "").trim();
    const lang = (req.query.lang || "en").toLowerCase();

    if (!text || text.length > 500) {
      return res.status(400).send("Invalid text");
    }

    if (lang !== "en") {
      return res.status(400).send("Unsupported language");
    }

    const request = {
      input: { text },
      voice: {
        languageCode: "en-US",
        name: "en-US-Wavenet-D"
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.9
      }
    };

    const [response] = await client.synthesizeSpeech(request);

    res.set({
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400"
    });

    res.send(response.audioContent);
  } catch (err) {
    log("TTS error:", err.message);
    res.status(500).send("TTS service unavailable");
  }
});

module.exports = router;
