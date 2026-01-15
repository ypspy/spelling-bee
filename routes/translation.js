const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Word = require("../models/Word");

// Gemini API 초기화
const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * GET /translation/:wordId
 * 단어의 한국어 뜻을 가져오거나 생성
 */
router.get("/:wordId", async (req, res) => {
  try {
    const { wordId } = req.params;
    
    const word = await Word.findById(wordId).select("text meaning");
    if (!word) {
      return res.status(404).json({ error: "Word not found" });
    }

    // 이미 뜻이 있으면 반환
    if (word.meaning) {
      return res.json({ meaning: word.meaning });
    }

    // 뜻이 없으면 번역 API를 통해 가져오기
    const meaning = await fetchKoreanMeaning(word.text);
    
    // DB에 저장
    if (meaning) {
      await Word.findByIdAndUpdate(wordId, { meaning });
    }

    res.json({ meaning: meaning || "" });
  } catch (err) {
    console.error("Translation error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 한국어 뜻을 가져오는 함수
 * Gemini AI를 사용하여 초등학교 3-5학년 수준으로 번역
 */
async function fetchKoreanMeaning(englishWord) {
  // 옵션 1: Gemini AI (우선 사용)
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const prompt = `다음 영어 단어의 한국어 뜻을 초등학교 3-5학년 학생이 이해할 수 있게 간단하게 설명해주세요.

단어: "${englishWord}"

규칙:
1. 한 단어 또는 짧은 구로 답변 (최대 15자)
2. 초등학생이 아는 쉬운 단어만 사용
3. 복잡한 설명이나 예시는 제외
4. 순수 한국어로만 답변 (영어 단어나 기호 포함 금지)
5. 명사는 그대로, 동사는 "~하다" 형태, 형용사는 "~한" 형태로

예시:
- "apple" → "사과"
- "happy" → "기쁜"
- "run" → "달리다"
- "beautiful" → "아름다운"
- "teacher" → "선생님"

한국어 뜻:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let meaning = response.text().trim();
      
      // 불필요한 문자 및 접두사 제거
      meaning = meaning.replace(/^한국어\s*뜻[:：]\s*/i, "");
      meaning = meaning.replace(/^답변[:：]\s*/i, "");
      meaning = meaning.replace(/^["'`]|["'`]$/g, "");
      meaning = meaning.replace(/^\(|\)$/g, "");
      meaning = meaning.replace(/→/g, "").trim();
      
      // 영어나 특수문자가 포함된 경우 제거
      if (/[a-zA-Z]/.test(meaning)) {
        // 영어가 포함되어 있으면 영어 부분 제거
        meaning = meaning.replace(/[a-zA-Z\s]+/g, "").trim();
      }
      
      // 최종 검증: 한국어만 포함되어 있고 적절한 길이인지 확인
      if (meaning && meaning.length > 0 && meaning.length <= 20 && /[가-힣]/.test(meaning)) {
        return meaning;
      } else if (meaning && meaning.length > 0 && meaning.length <= 30) {
        // 길이가 조금 길어도 한국어가 포함되어 있으면 반환
        return meaning.substring(0, 20);
      }
    } catch (err) {
      console.error("Gemini API error:", err.message);
    }
  }

  // 옵션 2: LibreTranslate (fallback)
  try {
    const response = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: englishWord,
        source: "en",
        target: "ko",
        format: "text"
      })
    });

    if (response.ok) {
      const data = await response.json();
      let translated = data.translatedText || "";
      
      if (translated) {
        translated = simplifyForElementary(translated);
        return translated;
      }
    }
  } catch (err) {
    console.log("LibreTranslate failed, trying alternative...");
  }

  // 옵션 3: MyMemory Translation API (최종 fallback)
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(englishWord)}&langpair=en|ko`
    );

    if (response.ok) {
      const data = await response.json();
      let translated = data.responseData?.translatedText || "";
      
      if (translated && translated !== "MYMEMORY WARNING") {
        translated = simplifyForElementary(translated);
        return translated;
      }
    }
  } catch (err) {
    console.log("MyMemory API failed");
  }

  // 모든 API 실패 시 빈 문자열 반환
  return "";
}

/**
 * 번역된 텍스트를 초등학교 3-5학년 수준으로 단순화
 */
function simplifyForElementary(text) {
  if (!text) return "";
  
  // 너무 긴 문장은 자르기
  if (text.length > 50) {
    text = text.substring(0, 50) + "...";
  }
  
  // 복잡한 표현을 간단하게 (예: "~하는 것" -> "~")
  text = text.replace(/하는 것/g, "");
  text = text.replace(/것/g, "");
  
  return text.trim();
}

module.exports = router;
