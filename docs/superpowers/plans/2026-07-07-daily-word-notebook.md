# Daily Word Notebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the session-based Spelling Bee app with a mobile-first daily word notebook that shows today + 3 prior days, fetches meanings via translation API, and plays English TTS only.

**Architecture:** Simplify the existing Express/MongoDB codebase in place. Drop Session/Record models and legacy routes. Rewrite `Word` schema and `routes/words.js` around `addedDate`. Rebuild `public/` as a single-screen mobile UI. Run `reset_db.js` before starting the new server to avoid index conflicts.

**Tech Stack:** Node.js, Express 5, Mongoose 9, vanilla JS frontend, Google TTS, Gemini translation API

**Spec:** `docs/superpowers/specs/2026-07-07-daily-word-notebook-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `lib/date.js` | KST date helpers (`todayKST`, `addDays`, `clampRange`) |
| `lib/validate.js` | Word text validation regex/length |
| `models/Word.js` | Simplified schema + indexes |
| `routes/words.js` | GET (date range), POST, DELETE |
| `routes/translation.js` | Meaning-only translation (trim nickname/definition) |
| `routes/tts.js` | English TTS only (`GET /tts`) |
| `server.js` | Mount only words, translation, tts |
| `scripts/reset_db.js` | Drop legacy collections |
| `public/index.html` | Minimal mobile layout |
| `public/app.js` | Daily notebook UI logic |
| `public/style.css` | Mobile-first dark theme |
| `package.json` | Script updates |

**Delete:** `models/Session.js`, `models/Record.js`, `routes/sessions.js`, `routes/records.js`, `routes/stats.js`, `routes/table.js`, `scripts/populate_meanings.js`, `scripts/clear_meanings.js`, `scripts/test_translation_full.js`, `scripts/test_endpoints.js`

---

### Task 1: Shared date and validation helpers

**Files:**
- Create: `lib/date.js`
- Create: `lib/validate.js`

- [ ] **Step 1: Create `lib/date.js`**

```js
const TZ = "Asia/Seoul";

function formatDateKST(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function todayKST() {
  return formatDateKST(new Date());
}

function addDaysKST(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

function isValidDateStr(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function clampWordRange(from, to) {
  const today = todayKST();
  const maxFrom = addDaysKST(today, -3);
  if (from && !isValidDateStr(from)) from = maxFrom;
  if (to && !isValidDateStr(to)) to = today;
  const effectiveTo = !to || to > today ? today : to;
  const effectiveFrom = !from || from < maxFrom ? maxFrom : from;
  if (effectiveFrom > effectiveTo) return { from: today, to: today };
  return { from: effectiveFrom, to: effectiveTo };
}

module.exports = { todayKST, addDaysKST, isValidDateStr, clampWordRange };
```

- [ ] **Step 2: Create `lib/validate.js`**

```js
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
```

- [ ] **Step 3: Smoke-test helpers in Node REPL**

Run:
```bash
node -e "const d=require('./lib/date'); const v=require('./lib/validate'); console.log(d.todayKST(), d.clampWordRange('2020-01-01','2099-01-01')); console.log(v.validateWordText('well-known'), v.validateWordText('ice cream'));"
```
Expected: today's date printed, clamped `from` is today-3, `null` then error string for space.

- [ ] **Step 4: Commit**

```bash
git add lib/date.js lib/validate.js
git commit -m "feat: add KST date and word validation helpers"
```

---

### Task 2: Simplify Word model

**Files:**
- Modify: `models/Word.js` (full rewrite)

- [ ] **Step 1: Replace `models/Word.js`**

```js
const mongoose = require("mongoose");

const WordSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  meaning: {
    type: String,
    default: ""
  },
  addedDate: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/
  }
}, { timestamps: true });

WordSchema.index({ addedDate: -1, text: 1 });
WordSchema.index({ text: 1, addedDate: 1 }, { unique: true });

module.exports = mongoose.model("Word", WordSchema);
```

- [ ] **Step 2: Commit**

```bash
git add models/Word.js
git commit -m "feat: simplify Word schema for daily notebook"
```

---

### Task 3: Rewrite words routes

**Files:**
- Modify: `routes/words.js` (full rewrite)

- [ ] **Step 1: Replace `routes/words.js`**

```js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Word = require("../models/Word");
const { todayKST, isValidDateStr, clampWordRange } = require("../lib/date");
const { normalizeText, validateWordText } = require("../lib/validate");

router.get("/", async (req, res) => {
  try {
    const { from, to } = clampWordRange(req.query.from, req.query.to);
    const words = await Word.find({ addedDate: { $gte: from, $lte: to } })
      .select("text meaning addedDate")
      .sort({ addedDate: -1, text: 1 })
      .lean();
    res.json({ words });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const text = normalizeText(req.body.text);
    const addedDate = req.body.addedDate;

    const textError = validateWordText(text);
    if (textError) return res.status(400).json({ error: textError });

    if (!isValidDateStr(addedDate) || addedDate !== todayKST()) {
      return res.status(400).json({ error: "오늘 날짜로만 단어를 추가할 수 있습니다" });
    }

    const word = await Word.create({ text, addedDate, meaning: "" });
    res.status(201).json(word);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "이미 추가된 단어입니다" });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid word ID" });
    }
    const result = await Word.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ error: "Word not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add routes/words.js
git commit -m "feat: rewrite words API for daily notebook"
```

---

### Task 4: Trim translation and TTS routes

**Files:**
- Modify: `routes/translation.js`
- Modify: `routes/tts.js`

- [ ] **Step 1: Simplify `routes/translation.js`**

Remove `includeFull` query handling, `nickname`/`definition` fields, and `parseDefinition` usage from the GET handler. Keep core flow:

```js
router.get("/:wordId", async (req, res) => {
  try {
    const { wordId } = req.params;
    if (!wordId || !wordId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid word ID" });
    }
    const word = await Word.findById(wordId).select("text meaning");
    if (!word) return res.status(404).json({ error: "Word not found" });

    if (word.meaning) return res.json({ meaning: word.meaning });

    const result = await fetchKoreanMeaning(word.text);
    const meaning = result?.meaning || "";
    if (meaning) await Word.findByIdAndUpdate(wordId, { meaning });
    res.json({ meaning });
  } catch (err) {
    log("Translation error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

Delete unused helper functions: `parseDefinition` and any nickname/definition-only code paths. Keep `fetchKoreanMeaning` and Gemini/fallback logic intact.

- [ ] **Step 2: Simplify `routes/tts.js`**

Remove `Word` import and entire `GET /word/:wordId` handler (lines 71–117). Keep only `GET /` for English TTS. **Required:** restrict `lang` to `"en"` only:

```js
if (lang !== "en") {
  return res.status(400).send("Unsupported language");
}
```

- [ ] **Step 3: Commit**

```bash
git add routes/translation.js routes/tts.js
git commit -m "refactor: trim translation and remove Korean word TTS"
```

---

### Task 5: Remove legacy backend files and update server

**Files:**
- Delete: `models/Session.js`, `models/Record.js`
- Delete: `routes/sessions.js`, `routes/records.js`, `routes/stats.js`, `routes/table.js`
- Modify: `server.js`

- [ ] **Step 1: Delete legacy model and route files**

```bash
rm models/Session.js models/Record.js
rm routes/sessions.js routes/records.js routes/stats.js routes/table.js
```

- [ ] **Step 2: Replace route registration in `server.js`**

```js
const wordRoutes = require("./routes/words");
const ttsRoutes = require("./routes/tts");
const translationRoutes = require("./routes/translation");

app.use("/words", wordRoutes);
app.use("/tts", ttsRoutes);
app.use("/translation", translationRoutes);
```

Remove imports and `app.use` for sessions, records, stats, table.

- [ ] **Step 3: Commit (do NOT start server yet — reset first in Task 6)**

```bash
git add -A
git commit -m "refactor: remove legacy session/record routes and models"
```

---

### Task 6: Database reset script

**Files:**
- Create: `scripts/reset_db.js`
- Modify: `package.json`
- Delete: `scripts/populate_meanings.js`, `scripts/clear_meanings.js`, `scripts/test_translation_full.js`, `scripts/test_endpoints.js`

- [ ] **Step 1: Create `scripts/reset_db.js`**

```js
require("dotenv").config();
const db = require("../lib/db");

const COLLECTIONS = ["words", "sessions", "records"];

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Usage: node scripts/reset_db.js --yes");
    process.exit(1);
  }

  await db.connect();
  const database = require("mongoose").connection.db;

  for (const name of COLLECTIONS) {
    try {
      await database.collection(name).drop();
      console.log(`Dropped collection: ${name}`);
    } catch (err) {
      if (err.code === 26) {
        console.log(`Skipped (not found): ${name}`);
      } else {
        throw err;
      }
    }
  }

  await db.disconnect();
  console.log("Reset complete.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Update `package.json` scripts**

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "reset-db": "node scripts/reset_db.js --yes"
}
```

Remove `populate-meanings` and `clear-meanings` entries.

- [ ] **Step 3: Delete obsolete scripts**

```bash
rm scripts/populate_meanings.js scripts/clear_meanings.js scripts/test_translation_full.js scripts/test_endpoints.js
```

- [ ] **Step 4: Stop any running server, then run reset**

Ensure no `node server.js` / `nodemon` process is running, then:

Run: `npm run reset-db`
Expected: `Dropped collection: words` (and sessions/records), `Reset complete.`

- [ ] **Step 5: Verify server starts on clean DB**

Run: `npm start`
Expected: `MongoDB connected` and `Server running on port 3000` with no require errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/reset_db.js package.json
git add -u scripts/
git commit -m "feat: add reset-db script and remove legacy scripts"
```

---

### Task 7: Rebuild frontend HTML and CSS

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css` (full rewrite)

- [ ] **Step 1: Replace `public/index.html`**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>오늘의 단어장</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="header">
    <h1>오늘의 단어장</h1>
  </header>

  <form id="addForm" class="add-bar">
    <input id="wordInput" type="text" placeholder="영어 단어" autocomplete="off" autocapitalize="off" />
    <button type="submit" id="addBtn">+</button>
  </form>

  <div id="offlineMsg" class="offline hidden">오프라인입니다</div>
  <main id="wordList"></main>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Replace `public/style.css`** with mobile-first styles:

Key rules to include:
- `body`: dark bg `#000`, padding with `env(safe-area-inset-*)`, font-size ~18px
- `.add-bar`: `position: sticky; top: 0; z-index: 10; display: flex; gap: 8px`
- `#wordInput`, `#addBtn`: min-height 44px
- `.date-section h2`: muted label for "오늘", "어제", or `M/D`
- `.word-card`: border `1px solid #222`, border-radius 12px, padding 12px, margin-bottom 8px
- `.word-row`: flex, tap target for TTS
- `.meaning-toggle`: collapsed by default; `.expanded .meaning-text` visible
- `.empty-state`: centered, muted color
- `.toast`: fixed bottom snackbar for TTS errors

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/style.css
git commit -m "feat: mobile-first layout for daily word notebook"
```

---

### Task 8: Rebuild frontend app.js

**Files:**
- Modify: `public/app.js` (full rewrite)

- [ ] **Step 1: Replace `public/app.js`**

Core structure:

```js
const wordInput = document.getElementById("wordInput");
const addForm = document.getElementById("addForm");
const addBtn = document.getElementById("addBtn");
const wordList = document.getElementById("wordList");
const offlineMsg = document.getElementById("offlineMsg");

const expandedIds = new Set();
let adding = false;

function todayKST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function formatMD(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

function dateLabel(addedDate) {
  const today = todayKST();
  const yesterday = addDays(today, -1);
  if (addedDate === today) return `오늘 (${formatMD(addedDate)})`;
  if (addedDate === yesterday) return `어제 (${formatMD(addedDate)})`;
  return formatMD(addedDate);
}

function speak(text) {
  if (window._ttsAudio) { window._ttsAudio.pause(); window._ttsAudio = null; }
  const audio = new Audio(`/tts?text=${encodeURIComponent(text)}&lang=en`);
  window._ttsAudio = audio;
  return audio.play().catch(() => showToast("발음을 재생할 수 없습니다"));
}

function showToast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

async function loadWords() {
  const today = todayKST();
  const from = addDays(today, -3);
  const res = await fetch(`/words?from=${from}&to=${today}`);
  const data = await res.json();
  renderWords(data.words || []);
}

async function fetchMeaning(wordId, cardEl) {
  const toggle = cardEl.querySelector(".meaning-toggle");
  toggle.textContent = "뜻 불러오는 중…";
  try {
    const res = await fetch(`/translation/${wordId}`);
    const data = await res.json();
    const meaning = data.meaning || "";
    cardEl.dataset.meaning = meaning;
    cardEl.dataset.meaningState = meaning ? "loaded" : "error";
    updateMeaningUI(cardEl);
  } catch {
    cardEl.dataset.meaningState = "error";
    updateMeaningUI(cardEl);
  }
}

function updateMeaningUI(cardEl) {
  const toggle = cardEl.querySelector(".meaning-toggle");
  const textEl = cardEl.querySelector(".meaning-text");
  const state = cardEl.dataset.meaningState;
  const meaning = cardEl.dataset.meaning || "";

  if (state === "loading") {
    toggle.textContent = "뜻 불러오는 중…";
    textEl.textContent = "";
    return;
  }
  if (state === "error") {
    toggle.innerHTML = '뜻을 가져오지 못했습니다 <button type="button" class="retry-btn">재시도</button>';
    toggle.querySelector(".retry-btn").onclick = (e) => {
      e.stopPropagation();
      cardEl.dataset.meaningState = "loading";
      fetchMeaning(cardEl.dataset.id, cardEl);
    };
    return;
  }
  toggle.textContent = expandedIds.has(cardEl.dataset.id) ? "▼ 뜻 숨기기" : "▶ 뜻 보기";
  textEl.textContent = meaning;
  textEl.classList.toggle("hidden", !expandedIds.has(cardEl.dataset.id));
}

function renderWords(words) {
  wordList.innerHTML = "";
  if (!words.length) {
    wordList.innerHTML = `
      <div class="empty-state">
        <p>아직 추가한 단어가 없어요</p>
        <p class="subtitle">위에서 영어 단어를 입력해 보세요</p>
      </div>`;
    return;
  }

  const byDate = {};
  words.forEach(w => {
    if (!byDate[w.addedDate]) byDate[w.addedDate] = [];
    byDate[w.addedDate].push(w);
  });

  Object.keys(byDate).sort((a, b) => b.localeCompare(a)).forEach(date => {
    const section = document.createElement("section");
    section.className = "date-section";
    section.innerHTML = `<h2>${dateLabel(date)}</h2>`;

    byDate[date].forEach(w => {
      const card = document.createElement("article");
      card.className = "word-card";
      card.dataset.id = w._id;
      card.dataset.meaning = w.meaning || "";
      card.dataset.meaningState = w.meaning ? "loaded" : "loading";

      card.innerHTML = `
        <div class="word-row">
          <span class="word-text">${w.text}</span>
          <button type="button" class="speak-btn" aria-label="발음">🔊</button>
        </div>
        <div class="meaning-toggle"></div>
        <div class="meaning-text hidden"></div>`;

      card.querySelector(".word-row").onclick = () => speak(w.text);
      card.querySelector(".meaning-toggle").onclick = (e) => {
        e.stopPropagation();
        if (card.dataset.meaningState === "loading") return;
        if (card.dataset.meaningState === "error") return;
        if (expandedIds.has(w._id)) expandedIds.delete(w._id);
        else expandedIds.add(w._id);
        updateMeaningUI(card);
      };

      let pressTimer;
      card.addEventListener("touchstart", (e) => {
        pressTimer = setTimeout(() => {
          if (confirm(`"${w.text}" 단어를 삭제할까요?`)) deleteWord(w._id);
        }, 500);
      }, { passive: true });
      card.addEventListener("touchend", () => clearTimeout(pressTimer));
      card.addEventListener("touchmove", () => clearTimeout(pressTimer));

      section.appendChild(card);
      if (!w.meaning) fetchMeaning(w._id, card);
      else updateMeaningUI(card);
    });

    wordList.appendChild(section);
  });
}

async function addWord(text) {
  if (adding) return;
  adding = true;
  addBtn.disabled = true;
  try {
    const res = await fetch("/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, addedDate: todayKST() })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "추가 실패");
      return;
    }
    wordInput.value = "";
    await loadWords();
  } finally {
    adding = false;
    addBtn.disabled = false;
  }
}

async function deleteWord(id) {
  await fetch(`/words/${id}`, { method: "DELETE" });
  expandedIds.delete(id);
  await loadWords();
}

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = wordInput.value.trim();
  if (text) addWord(text);
});

function setOfflineState(offline) {
  offlineMsg.classList.toggle("hidden", !offline);
  wordInput.disabled = offline;
  addBtn.disabled = offline || adding;
}

window.addEventListener("online", () => setOfflineState(false));
window.addEventListener("offline", () => setOfflineState(true));
setOfflineState(!navigator.onLine);

loadWords();
```

- [ ] **Step 2: Manual browser test**

Run: `npm run dev`
Open `http://localhost:3000` in mobile viewport (375px).
Expected: empty state message, add word works, meaning loads, tap expands meaning, tap word plays TTS.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: daily word notebook frontend"
```

---

### Task 9: Update Copilot instructions

**Files:**
- Modify: `.github/copilot-instructions.md`

- [ ] **Step 1: Rewrite instructions** to reflect:
- Daily word notebook purpose
- Simplified Word schema (`text`, `meaning`, `addedDate`)
- Routes: `/words`, `/translation`, `/tts` only
- 4-day window clamp
- `npm run reset-db` migration
- No Session/Record models

- [ ] **Step 2: Commit**

```bash
git add .github/copilot-instructions.md
git commit -m "docs: update copilot instructions for daily notebook"
```

---

### Task 10: End-to-end verification

- [ ] **Step 1: API smoke tests**

With server running after reset:

```bash
# List (empty)
curl -s "http://localhost:3000/words" | head -c 200

# Add word
curl -s -X POST http://localhost:3000/words \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"apple\",\"addedDate\":\"$(node -e "console.log(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))")\"}"

# Duplicate → 409
# (repeat same POST, expect "이미 추가된 단어입니다")

# Invalid → 400
curl -s -X POST http://localhost:3000/words \
  -H "Content-Type: application/json" \
  -d '{"text":"ice cream","addedDate":"2026-07-07"}'
```

- [ ] **Step 2: Manual checklist** (from spec)

- [ ] Fresh DB empty state
- [ ] Add word → meaning loads → tap to expand
- [ ] English TTS on word tap
- [ ] Duplicate rejected (409)
- [ ] Long-press delete works
- [ ] Mobile 375px and tablet 768px layouts usable

- [ ] **Step 3: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: address issues found during daily notebook verification"
```

---

## Deploy Order (Production)

1. Stop running server
2. `npm run reset-db`
3. Deploy new code
4. `npm start` (or hosting platform restart)
5. Verify `/health` and add one test word

---

## Risk Notes

- **Index build:** Never start new server on legacy data — always reset first
- **TTS/Translation:** Require `GOOGLE_APPLICATION_CREDENTIALS` (or base64 env) and `GEMINI_API_KEY` in production
- **Timezone:** Both client and server use `Asia/Seoul`; do not use server local timezone
