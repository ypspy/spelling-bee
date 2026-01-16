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
    const includeFull = req.query.full === "1";
    
    const word = await Word.findById(wordId).select("text meaning");
    if (!word) {
      return res.status(404).json({ error: "Word not found" });
    }

    // 이미 뜻이 있으면 반환
    if (word.meaning && !includeFull) {
      return res.json({ meaning: word.meaning });
    }

    // 뜻이 없거나 full 요청이면 번역 API를 통해 가져오기
    console.log("Fetching translation for:", englishWord, "includeFull:", includeFull);
    const result = await fetchKoreanMeaning(word.text);
    console.log("Fetch result:", result);
    const meaning = result?.meaning || "";
    
    // DB에 저장 (처음 생성 시)
    if (!word.meaning && meaning) {
      await Word.findByIdAndUpdate(wordId, { meaning });
    }

    if (includeFull) {
      const parsed = parseDefinition(result?.raw || "");
      console.log("Parsed:", parsed);
      return res.json({ meaning, raw: result?.raw || "", ...parsed });
    }

    res.json({ meaning });
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
      
      const prompt = `너의 역할은 초등학교 3학년이 이해할 수 있는 단어 설명 생성기다.
아래 규칙을 반드시 지켜서 단어의 설명을 만들어라.

출력 형식(Output Format)
아래 네 가지를 반드시 순서대로 출력한다:

단어: (입력된 영어 단어)

부르는 말: 단어를 아주 쉽게 부르도록 만든 짧은 별명

간단한 뜻: 초등학교 3학년이 이해할 수 있는 1~2문장의 설명

발음: 영어 발음을 한국어로 쉽게 표시(사용자가 요청한 경우만 넣기)

설명 규칙(Definition Rules)
[어휘 수준]
반드시 초등학교 3학년 수준의 쉬운 말만 사용
어려운 단어 금지
예: 용제(X) → 지우는 액체(O)
증류(X) → 끓여서 만든(O)

[문장 길이]
1문장에 10~12개 단어 이하
전체 1~2문장으로 끝내기

[부르는 말 규칙]
“명사구 형태”로 짧고 직관적이어야 한다
예: gravity → “당기는 힘”, orbit → “도는 길”

[비유 허용]
필요하면 간단한 비유 사용 가능
예: “보이지 않는 자석처럼 아래로 끌어당겨.”

[예외 규칙]
단어가 매우 어려워도 핵심만 풀어쓴다
절대 긴 설명 금지

[단어 입력: ${englishWord}]
[발음 포함: no]`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const raw = response.text().trim();
      let meaning = raw;

      const lines = meaning
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

      const pickValue = (label) => {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = line.match(new RegExp(`^${label}\\s*[:：]\\s*(.*)$`));
          if (match) {
            if (match[1]) return match[1].trim();
            if (lines[i + 1]) return lines[i + 1].trim();
          }
        }
        return "";
      };

      const simpleMeaning = pickValue("간단한 뜻");
      if (simpleMeaning) {
        const cleaned = sanitizeMeaning(simpleMeaning);
        if (cleaned) {
          console.log("Gemini raw output:", raw);
          return { meaning: cleaned, raw };
        }
      }

      // fallback: 불필요한 문자 및 접두사 제거
      meaning = meaning.replace(/^한국어\s*뜻[:：]\s*/i, "");
      meaning = meaning.replace(/^답변[:：]\s*/i, "");
      meaning = meaning.replace(/^["'`]|["'`]$/g, "");
      meaning = meaning.replace(/^\(|\)$/g, "");
      meaning = meaning.replace(/→/g, "").trim();

      // 영어나 특수문자가 포함된 경우 제거
      if (/[a-zA-Z]/.test(meaning)) {
        meaning = meaning.replace(/[a-zA-Z\s]+/g, "").trim();
      }

      meaning = sanitizeMeaning(meaning);

      // 최종 검증: 한국어만 포함되어 있고 적절한 길이인지 확인
      if (meaning && meaning.length > 0 && meaning.length <= 60 && /[가-힣]/.test(meaning)) {
        console.log("Gemini raw output:", raw);
        return { meaning, raw };
      }
    } catch (err) {
      console.error("Gemini API error:", err?.message || err);
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
        translated = sanitizeMeaning(translated);
        if (translated) return { meaning: translated, raw: translated };
      }
    }
  } catch (err) {
    console.log("LibreTranslate failed, trying alternative...", err?.message || err);
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
        translated = sanitizeMeaning(translated);
        if (translated) return { meaning: translated, raw: translated };
      }
    }
  } catch (err) {
    console.log("MyMemory API failed", err?.message || err);
  }

  // 모든 API 실패 시 빈 문자열 반환
  return { meaning: "", raw: "" };
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

function sanitizeMeaning(text) {
  if (!text) return "";

  let out = text.trim();

  out = out.replace(/^단어\s*[:：]\s*/i, "");
  out = out.replace(/^부르는 말\s*[:：]\s*/i, "");
  out = out.replace(/^간단한 뜻\s*[:：]\s*/i, "");
  out = out.replace(/^발음\s*[:：]\s*/i, "");
  out = out.replace(/^["'`]|["'`]$/g, "");

  // 영문, 숫자, 기호 제거 (한글과 공백, 기본 문장부호만 유지)
  out = out.replace(/[^가-힣\s.!?]/g, "");
  out = out.replace(/\s+/g, " ").trim();

  if (!/[가-힣]/.test(out)) return "";

  return out;
}

function parseDefinition(raw) {
  if (!raw) return {};

  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const pickValue = (label) => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(new RegExp(`^${label}\\s*[:：]\\s*(.*)$`));
      if (match) {
        if (match[1]) return match[1].trim();
        if (lines[i + 1]) return lines[i + 1].trim();
      }
    }
    return "";
  };

  const word = pickValue("단어");
  const nickname = pickValue("부르는 말");
  const definition = pickValue("간단한 뜻");
  const pronunciation = pickValue("발음");

  return {
    word,
    nickname,
    definition,
    pronunciation
  };
}

module.exports = router;
