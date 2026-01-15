# Copilot instructions — Spelling Bee (Node + Express + MongoDB)

Purpose: quick, actionable guidance for AI coding agents to be immediately productive in this codebase.

- **Big picture**
  - This is a single-process Node/Express app serving a small SPA in `public/` and a REST API under `routes/`.
  - Persistent store is MongoDB via `mongoose` (`models/Word.js`, `models/Session.js`, `models/Record.js`).
  - Key routes: `server.js` registers routers mounted at `/sessions`, `/words`, `/records`, `/stats`, `/table`, `/tts`, `/translation`.
  - External services:
    - Google Text-to-Speech via `@google-cloud/text-to-speech` (`routes/tts.js`). Uses application default credentials or `GOOGLE_APPLICATION_CREDENTIALS` pointing to the provided `spelling-bee-tts-b2b438fa4805.json` file.
    - Google Generative AI (Gemini) via `@google/generative-ai` in `routes/translation.js`. Controlled by `GEMINI_API_KEY` env var; the route falls back to public translation APIs if Gemini is unavailable.

- **Important data conventions (follow these when editing/adding features)**
  - Words are stored normalized: `text` is saved as lowercase (see `routes/words.js` POST/patch). Preserve casing rules when inserting/updating.
  - `alphabet` is stored uppercase. `level` is enum: `one|two|three`.
  - `priority`: 0=default, 1=important, 2=core. Bound between 0 and 2 by existing endpoints.
  - `bookmarked` and `active` are boolean flags used for filtering; many queries explicitly use `active: true` (e.g. GET `/words`).
  - Deleting a `Word` route also deletes related `Record` documents (`routes/words.js` DELETE) — preserve this application-level cascade or replicate it when adding features.

- **API / code patterns to match**
  - Use `findByIdAndUpdate(id, update, { new: true, runValidators: true })` when appropriate — existing routes rely on `new:true` and validators.
  - When returning lists, prefer `.select(...).sort(...).lean()` for lightweight responses (seen in `routes/words.js`).
  - Error handling: routes typically return `res.status(500).json({ error: err.message })`. Follow this convention rather than throwing raw errors.
  - Input normalization: trim and `toLowerCase()` for `text`; `alphabet` is uppercased if provided.

- **Key files to inspect when making changes**
  - `server.js` — route registration, middleware, Mongo connection
  - `routes/words.js`, `routes/sessions.js`, `routes/records.js`, `routes/tts.js`, `routes/translation.js`
  - `models/Word.js`, `models/Session.js`, `models/Record.js`
  - `public/` — front-end assets served statically
  - `package.json` — scripts and dependency list

- **Dev / run / debug workflow**
  - Install deps: `npm install`.
  - Local development: set environment variables in `.env` (create one if missing):
    - `MONGO_URI` (required)
    - optional: `GEMINI_API_KEY`, `PORT`
    - set `GOOGLE_APPLICATION_CREDENTIALS` to the path of `spelling-bee-tts-b2b438fa4805.json` if running TTS locally.
  - Start dev server with live reload: `npm run dev` (uses `nodemon`). Production/test: `npm start`.
  - Health check: GET `/health` returns `OK`.

- **External integrations & secrets**
  - Google TTS: uses `@google-cloud/text-to-speech`. If tests or CI run need TTS, ensure a service account JSON is available and `GOOGLE_APPLICATION_CREDENTIALS` points to it.
  - Gemini: `GEMINI_API_KEY` toggles use of `@google/generative-ai` in `routes/translation.js`. If missing, the route falls back to LibreTranslate and MyMemory.

- **Safe change guidance (project-specific)**
  - Maintain existing field normalizations (lowercase `text`, uppercase `alphabet`). Many client-side UI features assume these formats.
  - Preserve index usage in `models/*.js`. If you add queries, prefer using indexed fields (`text`, `alphabet`, `level`, `priority`, `bookmarked`, `active`) to avoid performance regressions.
  - When removing or permanently deleting words, ensure associated `Record` documents are removed (current code calls `Record.deleteMany({ wordId: id })`).
  - Avoid changing route mounts in `server.js` without updating `public/app.js` if the front-end depends on specific endpoints.

- **Concrete examples**
  - Add a word (follow `routes/words.js`):

    POST /words
    Body: { "text": "Apple", "level": "one", "alphabet": "a" }

    Server creates `text` => `apple`, `alphabet` => `A`.

  - TTS example:

    GET /tts?text=hello&lang=en

    Responds with `audio/mpeg` (MP3) from Google TTS client.

- **What not to assume**
  - There are no automated tests in the repo; rely on manual testing and `nodemon` during development.
  - The repo expects environment-driven credentials; do not hardcode keys or service account JSON contents.

If anything above is unclear or you'd like more detail on a specific area (storage patterns, API examples, or how the translation fallbacks behave), tell me which section to expand and I'll iterate.
