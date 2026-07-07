const WORD_PATTERN = /^[a-z]+(?:[-'][a-z]+)*$/;

function normalizeText(raw) {
  return (raw || "").trim().toLowerCase();
}

function validateWordText(text) {
  if (!text) return "단어를 입력해 주세요";
  if (text.length > 40) return "40자 이하로 입력해 주세요";
  if (/\s/.test(text)) return "한 단어만 입력해 주세요";
  if (!WORD_PATTERN.test(text)) return "영어 단어만 입력해 주세요";
  return null;
}

module.exports = { normalizeText, validateWordText };
