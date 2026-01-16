const db = require('../lib/db');
const Word = require('../models/Word');

// Translation API 호출 함수 (routes/translation.js에서 복사)
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

async function fetchKoreanMeaning(englishWord) {
  // Gemini AI 우선 사용
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
"명사구 형태"로 짧고 직관적이어야 한다
예: gravity → "당기는 힘", orbit → "도는 길"

[비유 허용]
필요하면 간단한 비유 사용 가능
예: "보이지 않는 자석처럼 아래로 끌어당겨."

[예외 규칙]
단어가 매우 어려워도 핵심만 풀어쓴다
절대 긴 설명 금지

[단어 입력: ${englishWord}]
[발음 포함: no]`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const raw = response.text().trim();

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

      const simpleMeaning = pickValue("간단한 뜻");
      if (simpleMeaning) {
        const cleaned = sanitizeMeaning(simpleMeaning);
        if (cleaned) {
          return { meaning: cleaned, raw };
        }
      }

      // Fallback parsing
      let meaning = raw.replace(/^한국어\s*뜻[:：]\s*/i, "").replace(/^답변[:：]\s*/i, "").replace(/^["'`]|["'`]$/g, "").replace(/^\(|\)$/g, "").replace(/→/g, "").trim();
      if (/[a-zA-Z]/.test(meaning)) {
        meaning = meaning.replace(/[a-zA-Z\s]+/g, "").trim();
      }
      meaning = sanitizeMeaning(meaning);
      if (meaning && meaning.length > 0 && meaning.length <= 60 && /[가-힣]/.test(meaning)) {
        return { meaning, raw };
      }
    } catch (err) {
      console.error("Gemini API error:", err?.message || err);
    }
  }

  // LibreTranslate fallback
  try {
    const response = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    console.log("LibreTranslate failed");
  }

  // MyMemory fallback
  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(englishWord)}&langpair=en|ko`);
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
    console.log("MyMemory failed");
  }

  return null;
}

function sanitizeMeaning(text) {
  if (!text) return "";
  return text.replace(/[^\w\s가-힣]/g, "").trim();
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

async function main() {
  await db.connect();

  // level이 "one"이고 meaning이 없는 단어들 (또는 nickname/definition 없는 경우)
  const words = await Word.find({
    level: "one",
    $or: [
      { meaning: { $in: [null, ""] } },
      { nickname: { $in: [null, ""] } },
      { definition: { $in: [null, ""] } }
    ]
  }).select("_id text");

  console.log(`Found ${words.length} words without meaning.`);

  for (const word of words) {
    console.log(`Processing: ${word.text}`);
    try {
      const result = await fetchKoreanMeaning(word.text);
      if (result?.meaning) {
        // parseDefinition으로 nickname과 definition 추출
        const parsed = parseDefinition(result.raw || "");
        await Word.findByIdAndUpdate(word._id, { 
          meaning: result.meaning,
          nickname: parsed.nickname || "",
          definition: parsed.definition || ""
        });
        console.log(`Updated ${word.text}: ${result.meaning}`);
      } else {
        console.log(`Failed to get meaning for ${word.text}`);
      }
      // API 호출 간격 (속도 제한 방지)
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`Error processing ${word.text}:`, err.message);
    }
  }

  console.log("Done!");
  process.exit(0);
}

main().catch(console.error);