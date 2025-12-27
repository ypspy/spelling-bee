const express = require("express");
const router = express.Router();
const textToSpeech = require("@google-cloud/text-to-speech");

const client = new textToSpeech.TextToSpeechClient();

router.get("/", async (req, res) => {
  try {
    const text = (req.query.text || "").trim();
    if (!text) return res.status(400).send("No text");

    const request = {
      input: { text },
      voice: {
        languageCode: "en-US",
        name: "en-US-Wavenet-D"   // ⭐ Google Translate급
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.9
      }
    };

    const [response] = await client.synthesizeSpeech(request);

    res.set({
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400" // 하루 캐시
    });

    res.send(response.audioContent);
  } catch (err) {
    console.error(err);
    res.status(500).send("TTS error");
  }
});

module.exports = router;
