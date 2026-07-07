const express = require("express");
const router = express.Router();
const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const path = require("path");

const isDev = process.env.NODE_ENV !== "production";
const log = (...args) => isDev && console.log(...args);

function loadCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
    try {
      return JSON.parse(
        Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, "base64").toString("utf8")
      );
    } catch (err) {
      log("Failed to parse TTS credentials (base64):", err.message);
    }
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    const resolved = path.resolve(credPath);
    if (fs.existsSync(resolved)) {
      try {
        return JSON.parse(fs.readFileSync(resolved, "utf8"));
      } catch (err) {
        log("Failed to read TTS credentials file:", err.message);
      }
    } else {
      log("TTS credentials file not found:", resolved);
    }
  }

  return null;
}

function getClient() {
  if (getClient._client) return getClient._client;
  const credentials = loadCredentials();
  if (!credentials) return null;
  getClient._client = new textToSpeech.TextToSpeechClient({ credentials });
  return getClient._client;
}

router.get("/", async (req, res) => {
  try {
    const client = getClient();
    if (!client) {
      return res.status(503).send("TTS not configured");
    }

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
