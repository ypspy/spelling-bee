# Copilot instructions — Daily Word Notebook (오늘의 단어장)

Purpose: quick, actionable guidance for AI coding agents to be immediately productive in this codebase.

- **Big picture**
  - Mobile-first daily English word notebook. Users add words for today, browse a rolling 4-day window, and fetch Korean meanings + TTS on demand.
  - Single-process Node/Express app serving a vanilla JS SPA in `public/` and a REST API under `routes/`.
  - Persistent store is MongoDB via `mongoose` (`models/Word.js` only — no Session, Record, or legacy spelling-bee models).
  - Key routes in `server.js`: `/words`, `/translation`, `/tts`, `/health`. No `/sessions`, `/records`, `/stats`, or `/table`.
  - External services:
    - Google Text-to-Speech via `@google-cloud/text-to-speech` (`routes/tts.js`). English only.
    - Google Generative AI (Gemini) via `@google/generative-ai` in `routes/translation.js`. Falls back to LibreTranslate and MyMemory if Gemini is unavailable.

- **Word model (`models/Word.js`)**
  - Fields: `text` (lowercase, required), `meaning` (string, default `""`), `addedDate` (YYYY-MM-DD, required).
  - Unique index on `{ text, addedDate }`. Do not add legacy fields (`alphabet`, `level`, `priority`, `bookmarked`, `active`, etc.).

- **Date & validation helpers**
  - `lib/date.js` — KST date utilities: `todayKST()`, `isValidDateStr()`, `clampWordRange(from, to)`.
  - `lib/validate.js` — `normalizeText()`, `validateWordText()` (single English word, ≤40 chars).
  - Server enforces a 4-day window: today + 3 prior days (KST). `clampWordRange` is applied on GET `/words`; POST rejects any `addedDate` other than today.

- **API patterns to match**
  - GET `/words?from=YYYY-MM-DD&to=YYYY-MM-DD` — returns `{ words }` clamped to the 4-day window.
  - POST `/words` — body `{ text, addedDate }`; `addedDate` must equal `todayKST()`. Creates word with empty `meaning`.
  - DELETE `/words/:id` — removes a single word by ObjectId.
  - GET `/translation/:wordId` — returns cached `meaning` or generates via Gemini, then saves.
  - GET `/tts?text=hello&lang=en` — returns `audio/mpeg`; `lang` must be `en`.
  - Error handling: routes return `res.status(...).json({ error: ... })`. Follow this convention.

- **Key files to inspect when making changes**
  - `server.js` — route registration, middleware, Mongo connection
  - `routes/words.js`, `routes/translation.js`, `routes/tts.js`
  - `models/Word.js`
  - `lib/date.js`, `lib/validate.js`, `lib/db.js`
  - `public/` — front-end assets served statically
  - `package.json` — scripts and dependency list

- **Dev / run / debug workflow**
  - Install deps: `npm install`.
  - Local development: set environment variables in `.env`:
    - `MONGO_URI` (required)
    - optional: `GEMINI_API_KEY`, `PORT`
    - TTS credentials: `GOOGLE_APPLICATION_CREDENTIALS` (path to JSON) **or** `GOOGLE_APPLICATION_CREDENTIALS_BASE64`
  - Start dev server with live reload: `npm run dev` (uses `nodemon`). Production: `npm start`.
  - Health check: GET `/health` returns `{ status: "OK", timestamp: ... }`.
  - DB migration / reset: stop the server first, then `npm run reset-db` (drops all collections via `scripts/reset_db.js`).

- **External integrations & secrets**
  - Google TTS: uses `@google-cloud/text-to-speech`. Provide credentials via file path or base64 env var.
  - Gemini: `GEMINI_API_KEY` enables AI-generated Korean meanings in `routes/translation.js`.

- **Safe change guidance (project-specific)**
  - Preserve lowercase `text` normalization and YYYY-MM-DD `addedDate` format.
  - Keep the 4-day KST window logic in `lib/date.js`; do not move date clamping to the client only.
  - POST is today-only — do not allow backdating words without an explicit product decision.
  - Avoid changing route mounts in `server.js` without updating `public/app.js`.

- **Concrete examples**
  - Add a word today:

    POST /words
    Body: { "text": "Apple", "addedDate": "2026-07-07" }

    Server creates `text` => `apple`, `meaning` => `""`.

  - Fetch words for a date range:

    GET /words?from=2026-07-04&to=2026-07-07

    Server clamps to the allowed 4-day KST window and returns `{ words: [...] }`.

  - TTS:

    GET /tts?text=hello&lang=en

    Responds with `audio/mpeg` (MP3).

- **What not to assume**
  - No automated tests; rely on manual testing and `nodemon` during development.
  - No Session, Record, stats, or table routes — do not reintroduce them.
  - Environment-driven credentials only; do not hardcode keys or service account JSON.
