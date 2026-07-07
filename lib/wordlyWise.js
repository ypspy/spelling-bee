const WW_BOOK_MIN = 1;
const WW_BOOK_MAX = 12;
const WW_LESSON_MIN = 1;
const WW_LESSON_MAX = 10;
const WW_RECENT_LESSONS_DEFAULT = 5;
const WW_RECENT_LESSONS_MAX = 10;

function parseIntInRange(raw, min, max, label) {
  if (raw === undefined || raw === null || raw === "") {
    return { error: `${label} is required` };
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) return { error: `${label} must be an integer` };
  if (n < min || n > max) return { error: `${label} must be between ${min} and ${max}` };
  return { value: n };
}

function parseBook(raw) {
  return parseIntInRange(raw, WW_BOOK_MIN, WW_BOOK_MAX, "book");
}

function parseLesson(raw) {
  return parseIntInRange(raw, WW_LESSON_MIN, WW_LESSON_MAX, "lesson");
}

function parseRecentLimit(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return WW_RECENT_LESSONS_DEFAULT;
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) return WW_RECENT_LESSONS_DEFAULT;
  return Math.max(1, Math.min(WW_RECENT_LESSONS_MAX, n));
}

module.exports = {
  WW_BOOK_MIN, WW_BOOK_MAX, WW_LESSON_MIN, WW_LESSON_MAX,
  parseBook, parseLesson, parseRecentLimit
};
