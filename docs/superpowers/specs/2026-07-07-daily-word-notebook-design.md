# Daily Word Notebook — Design Spec

**Date:** 2026-07-07  
**Status:** Draft  
**Approach:** Simplify existing codebase (Approach 1)

## Summary

Transform Spelling Bee from a session-based spelling practice table into a **daily word notebook** for mobile and tablet. Users add one English word per entry; meanings are fetched via the existing translation API. The UI shows words from **today plus the previous 3 days** (4-day window). Older words are automatically hidden with no archive view.

## Goals

- Delete legacy content and features (sessions, records, filters, bookmarks, levels, Korean meaning TTS)
- Support a simple daily workflow: add English word → auto-fetch Korean meaning → review recent words
- Optimize for mobile and tablet touch interaction
- Reuse existing `translation` and English `tts` integrations

## Non-Goals

- Bulk word import
- Viewing words older than the 4-day window
- Korean meaning TTS
- Success/fail tracking, sessions, exam mode
- Desktop-first layout

## User Workflow

1. User opens the app on mobile/tablet
2. Screen shows words grouped by date (today, yesterday, etc.) within the 4-day window
3. User types an English word and taps add
4. Word appears in today's section; meaning loads asynchronously via translation API
5. User taps a word card to hear English pronunciation (TTS)
6. User taps meaning area (or expand affordance) to reveal/hide the Korean meaning
7. Words older than 3 days before today are not shown

## What Gets Removed

### Models

- Delete `Session` (`models/Session.js`)
- Delete `Record` (`models/Record.js`)

### Routes

- Delete `routes/sessions.js`
- Delete `routes/records.js`
- Delete `routes/stats.js`
- Delete `routes/table.js`
- Remove Korean word TTS endpoint `GET /tts/word/:wordId` from `routes/tts.js`

### Word Schema Fields

Remove: `level`, `priority`, `bookmarked`, `active`, `nickname`, `definition`, `source`, `alphabet`

### Frontend Features

Remove: alphabet/level/mode filters, session columns, bookmark, hide, priority dots, exam mode, `speakKoreanDefinition`, pagination by alphabet, stats editing, session controls

### Scripts

Remove or deprecate: `scripts/populate_meanings.js`, `scripts/clear_meanings.js`, `scripts/test_translation_full.js`, `scripts/test_endpoints.js` (update or replace with simpler smoke tests if needed)

### Data

- One-time full database reset: drop or clear all `words`, `sessions`, `records` collections

## Data Model

### Word (simplified)

```js
{
  text: String,       // required, lowercase, trimmed, indexed
  meaning: String,    // default "", filled by translation API
  addedDate: String,  // required, "YYYY-MM-DD", indexed (client local date, KST)
  createdAt: Date,    // timestamps
  updatedAt: Date
}
```

### Indexes

- `{ addedDate: -1, text: 1 }` — date-range queries and duplicate check per day
- `{ text: 1 }` — optional lookup

### Constraints

- Duplicate prevention: same `text` + `addedDate` returns 409 Conflict
- `addedDate` is sent by the client using local KST date (`YYYY-MM-DD`)

### Date Window Logic

- **Visible range:** `addedDate >= (today - 3 days)` through `today` (inclusive)
- **4 days total:** today + 3 prior calendar days
- Words outside this range remain in DB but are never returned by the list API

## API

### `GET /words?from=YYYY-MM-DD&to=YYYY-MM-DD`

Returns words in date range, sorted by `addedDate` descending then `text` ascending.

Response:

```json
{
  "words": [
    { "_id": "...", "text": "apple", "meaning": "사과", "addedDate": "2026-07-07" }
  ]
}
```

Default behavior when query omitted: compute `from` = today - 3 days, `to` = today (server can accept client-sent dates for timezone accuracy).

### `POST /words`

Body: `{ "text": "apple", "addedDate": "2026-07-07" }`

- Normalize `text` to lowercase trimmed
- Validate `addedDate` format
- Reject duplicate (`text` + `addedDate`)
- Return created word with empty `meaning`

### `DELETE /words/:id`

Delete a single word (for typo correction). Validate ObjectId.

### `GET /translation/:wordId` (existing, keep)

Fetch Korean meaning via Gemini/LibreTranslate fallback. Save to DB on first success. No changes to core logic except removing references to removed fields (`nickname`, `definition` display can be dropped from API response if unused).

### `GET /tts?text=...&lang=en` (existing, keep)

English pronunciation only.

### Removed Endpoints

All `/sessions`, `/records`, `/stats`, `/table`, and `/tts/word/:wordId` routes.

## Frontend (Mobile / Tablet)

### Layout

```
┌─────────────────────────┐
│  오늘의 단어장           │
├─────────────────────────┤
│ [ english word    ] [+] │  ← sticky top input bar
├─────────────────────────┤
│ 오늘 (7/7)              │
│ ┌─────────────────────┐ │
│ │ apple           🔊  │ │  ← tap word row → English TTS
│ │ ▶ 뜻 보기           │ │  ← tap to expand meaning
│ │   사과              │ │  ← collapsed by default
│ └─────────────────────┘ │
│                         │
│ 어제 (7/6)              │
│  ...                    │
└─────────────────────────┘
```

### Interaction Details

| Action | Behavior |
|--------|----------|
| Tap word / speaker icon | Play English TTS |
| Tap "뜻 보기" / meaning row | Toggle meaning visibility (accordion per card) |
| Swipe left or long-press | Delete word (confirm dialog) — pick one pattern during implementation |
| Add button | POST word, then GET translation, update card |

### Meaning Display

- **Collapsed by default** on each card
- Expand/collapse is per-card independent state (client-side only, not persisted)
- While loading: show "뜻 불러오는 중…"
- On failure: show "뜻을 가져오지 못했습니다" + retry button

### Responsive Design

- Minimum touch target: 44×44px
- Font size readable on phone without zoom
- Sticky add bar at top (safe-area padding for notched devices)
- Vertical scroll only; no horizontal table
- Dark theme retained from existing `style.css` as base, simplified

### Client Date Handling

- Compute `addedDate` and `from`/`to` range in client using `Asia/Seoul` timezone
- Pass explicit dates to API to avoid server timezone mismatch

## Server Changes

### `server.js`

- Remove mounts for deleted routes
- Keep: `/words`, `/translation`, `/tts`, `/health`

### `routes/words.js`

Rewrite to support simplified CRUD and date-range query only.

### `routes/translation.js`

- Remove `nickname`/`definition`/`full` query handling if no longer needed (YAGNI)
- Keep Gemini + fallback translation for `meaning` only

### `routes/tts.js`

- Keep generic `GET /tts`
- Remove `GET /tts/word/:wordId`

## Migration

### `scripts/reset_db.js` (new)

One-time script to:

1. `deleteMany({})` on words, sessions, records collections (or drop collections)
2. Log counts cleared
3. Require `--yes` flag to prevent accidental runs

Run once before first use of the new app.

## Error Handling

| Case | Response / UX |
|------|----------------|
| Duplicate word same day | 409 + "이미 추가된 단어입니다" |
| Invalid word text | 400 + validation message |
| Translation API failure | Word kept; meaning empty; retry in UI |
| TTS failure | Toast/inline message; app continues |
| Network offline | Disable add; show offline message |

## Testing (Manual)

- [ ] Fresh DB: empty state renders correctly
- [ ] Add word → meaning loads and expands on tap
- [ ] English TTS plays on word tap
- [ ] Duplicate same-day word rejected
- [ ] Word from 4+ days ago not shown in list
- [ ] Delete word removes from list
- [ ] Mobile viewport (375px) and tablet (768px) usable
- [ ] Reset script clears all legacy data

## File Change Summary

| File | Action |
|------|--------|
| `models/Word.js` | Simplify schema |
| `models/Session.js` | Delete |
| `models/Record.js` | Delete |
| `routes/words.js` | Rewrite |
| `routes/sessions.js` | Delete |
| `routes/records.js` | Delete |
| `routes/stats.js` | Delete |
| `routes/table.js` | Delete |
| `routes/translation.js` | Trim unused fields |
| `routes/tts.js` | Remove word meaning endpoint |
| `server.js` | Update route mounts |
| `public/index.html` | New minimal layout |
| `public/app.js` | Rewrite for daily notebook |
| `public/style.css` | Mobile-first restyle |
| `scripts/reset_db.js` | New |
| `.github/copilot-instructions.md` | Update to reflect new architecture |

## Decisions Log

| Decision | Choice |
|----------|--------|
| Workflow | B — daily add + view recent days |
| Visible window | Today + previous 3 days (4 days) |
| Word entry | Single English word; meaning from translation API |
| Meaning display | Tap to expand/collapse |
| Older words | Auto-hidden only; no archive UI |
| TTS | English only on word tap |
| Platform | Mobile and tablet first |
| Legacy data | Full wipe (Option A) |
| Approach | Simplify existing codebase |
