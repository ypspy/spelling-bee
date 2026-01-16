const express = require("express");
const router = express.Router();
const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const path = require("path");
const Word = require("../models/Word");

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

    // 지원하는 언어 검증
    if (!["en", "ko", "kr"].includes(lang)) {
      return res.status(400).send("Unsupported language");
    }

    // 언어에 따라 음성 설정
    const voiceConfig = (lang === "ko" || lang === "kr") ? {
      languageCode: "ko-KR",
      name: "ko-KR-Wavenet-A"
    } : {
      languageCode: "en-US",
      name: "en-US-Wavenet-D"
    };

    const request = {
      input: { text },
      voice: voiceConfig,
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: lang === "ko" ? 0.85 : 0.9
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

/**
 * GET /tts/word/:wordId
 * DB에서 단어의 meaning을 가져와서 한국어로 TTS
 */
router.get("/word/:wordId", async (req, res) => {
  try {
    const { wordId } = req.params;

    if (!wordId || !wordId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).send("Invalid word ID");
    }

    const word = await Word.findById(wordId).select("meaning");
    if (!word || !word.meaning) {
      return res.status(404).send("Word or meaning not found");
    }

    const text = word.meaning.trim();
    if (!text || text.length > 500) {
      return res.status(400).send("Invalid meaning text");
    }

    const request = {
      input: { text },
      voice: {
        languageCode: "ko-KR",
        name: "ko-KR-Wavenet-A"
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.85
      }
    };

    const [response] = await client.synthesizeSpeech(request);

    res.set({
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400"
    });

    res.send(response.audioContent);
  } catch (err) {
    log("TTS word error:", err.message);
    res.status(500).send("TTS service unavailable");
  }
});

module.exports = router;
