const express = require("express");
const router = express.Router();
const textToSpeech = require("@google-cloud/text-to-speech");

const client = new textToSpeech.TextToSpeechClient();

router.get("/", async (req, res) => {
  try {
    const text = (req.query.text || "").trim();
    const lang = (req.query.lang || "en").toLowerCase(); // 언어 파라미터 추가
    
    if (!text) return res.status(400).send("No text");

    // 언어에 따라 음성 설정
    let voiceConfig;
    if (lang === "ko" || lang === "kr") {
      // 한국어 음성
      voiceConfig = {
        languageCode: "ko-KR",
        name: "ko-KR-Wavenet-A"  // 한국어 여성 음성
      };
    } else {
      // 영어 음성 (기본)
      voiceConfig = {
        languageCode: "en-US",
        name: "en-US-Wavenet-D"
      };
    }

    const request = {
      input: { text },
      voice: voiceConfig,
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: lang === "ko" ? 0.85 : 0.9  // 한국어는 조금 느리게
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
