# Wordly Wise 3000 Section — Design Spec

**Date:** 2026-07-08  
**Status:** Draft  
**Approach:** Separate model + API (Approach 1)

## Summary

Add a **Wordly Wise 3000** section alongside the existing **오늘의 단어장** (daily word notebook). Users register words one at a time per Book and Lesson, browse the current lesson's word list, and jump to recently practiced lessons. The daily notebook remains unchanged.

## Goals

- Keep 오늘의 단어장 behavior, data model, and API untouched
- Add Book (1–12) / Lesson (1–10) vocabulary organization for Wordly Wise 3000
- Reuse English TTS, translation API, tap-to-expand meaning, and long-press delete UX
- Mobile/tablet-first UI with top tab navigation

## Non-Goals

- Bulk import (CSV, paste multiple lines)
- Merging Wordly Wise words into the daily 4-day window
- User accounts or multi-device sync of "recent lessons"
- Pre-populating official Wordly Wise 3000 word lists
- Korean meaning TTS

## User Workflow

1. User opens app, taps **Wordly Wise** tab
2. Selects Book and Lesson (selection persists while adding words)
3. Types one English word and taps add
4. Word appears in current lesson list; meaning loads via translation API
5. User taps word for English TTS, taps to expand/collapse meaning
6. User long-presses card to delete a word
7. User taps a **recent lesson** chip to switch Book/Lesson quickly
8. User switches to **오늘의 단어장** tab for daily practice (unchanged)

## Architecture

```
┌─────────────────────────────────────────┐
│  public/ (tabs: Daily | Wordly Wise)   │
└──────────────┬──────────────────────────┘
               │
     ┌─────────┴─────────┐
     ▼                   ▼
 /words (daily)    /ww/words (WW3000)
     │                   │
     ▼                   ▼
  Word model        WordlyWord model
     │                   │
     └─────────┬─────────┘
               ▼
    /translation/:id  /tts
```

## What Stays Unchanged

- `models/Word.js`, `routes/words.js`, daily `public/app.js` daily panel logic
- 4-day KST window, `addedDate` today-only POST rule
- `GET /tts`, daily translation flow for `Word` documents

## Data Model

### WordlyWord (new)

```js
{
  book: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    validate: { validator: Number.isInteger, message: "book must be an integer" }
  },
  lesson: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    validate: { validator: Number.isInteger, message: "lesson must be an integer" }
  },
  text: String,     // lowercase, trimmed, required
  meaning: String,  // default "", filled by translation API
}, { timestamps: true });
```

### Indexes

- `{ book: 1, lesson: 1, text: 1 }` — **unique** (also covers lesson list queries via prefix)
- `{ updatedAt: -1 }` — recent lessons aggregation

### Constraints

- `text` validation: reuse `lib/validate.js` (`normalizeText`, `validateWordText`)
- `book` must be integer 1–12 inclusive
- `lesson` must be integer 1–10 inclusive
- Duplicate `book` + `lesson` + `text` → 409 Conflict

### Constants

```js
const WW_BOOK_MIN = 1;
const WW_BOOK_MAX = 12;
const WW_LESSON_MIN = 1;
const WW_LESSON_MAX = 10;
const WW_RECENT_LESSONS_LIMIT = 5;
```

Place in `lib/wordlyWise.js` for server routes. Duplicate the same numeric constants in `public/ww.js` (no bundler — browser cannot import `lib/`).

## API

### `GET /ww/words?book=N&lesson=M`

Returns words for the lesson, sorted by `text` ascending.

- `book` and `lesson` query params **required**
- Parse as integers; reject non-integers (`"3.5"`, `"abc"`, empty) with 400
- Validate ranges 1–12 / 1–10; 400 on invalid

Response:

```json
{
  "words": [
    { "_id": "...", "book": 3, "lesson": 5, "text": "abandon", "meaning": "..." }
  ]
}
```

### `POST /ww/words`

Body: `{ "text": "abandon", "book": 3, "lesson": 5 }`

- Normalize and validate `text`
- Validate `book` / `lesson` as integers in range
- Create with empty `meaning`
- 409 on duplicate
- **Response:** raw created `WordlyWord` document (same shape as daily `POST /words`), status 201

### `DELETE /ww/words/:id`

Delete one WordlyWord. Invalid ObjectId → 400. Not found → 404.

- **Response:** `{ "success": true }` (matches daily DELETE)

### `GET /ww/recent-lessons?limit=5`

Returns recently practiced lessons grouped by `book` + `lesson`, ordered by most recent activity.

**Aggregation (required):**

```js
WordlyWord.aggregate([
  { $group: {
      _id: { book: "$book", lesson: "$lesson" },
      lastActivity: { $max: "$updatedAt" }
  }},
  { $sort: { lastActivity: -1 } },
  { $limit: limit }
])
```

Map `_id` to `{ book, lesson, lastActivity }` in the response.

Response:

```json
{
  "lessons": [
    { "book": 3, "lesson": 4, "lastActivity": "2026-07-08T12:00:00.000Z" }
  ]
}
```

Default `limit` = 5, max 10. Parse as integer; invalid/missing → 5; clamp to `[1, 10]`.

Client refetch triggers: WW panel init, after add, after delete.

### `GET /translation/:wordId` (extend existing)

Lookup order:

1. `Word.findById(wordId)` — daily notebook (existing)
2. If not found, `WordlyWord.findById(wordId)` — Wordly Wise
3. If neither found → 404 `{ error: "Word not found" }`
4. If `meaning` already set, return cached
5. Else `fetchKoreanMeaning(text)`, save via `findByIdAndUpdate` on whichever model matched (mirror existing `Word` path)

Response when found: `{ meaning }`

**404 UI (both sections via `shared.js`):** show error text; **no retry button** on 404 (word deleted). Retry only on network/500 failures.

## Frontend

### Tab navigation

- Two tabs at top: **오늘의 단어장** | **Wordly Wise**
- Wrap existing daily UI in `<div id="dailyPanel">` (header, add bar, word list)
- WW UI in `<div id="wwPanel" class="hidden">`
- Only one panel visible at a time
- Active tab persisted in `localStorage` (`activeTab: 'daily' | 'ww'`)
- On page load, `app.js` reads `activeTab`, shows matching panel, calls that module's `init()` (lazy)

### Wordly Wise panel layout

```
┌─────────────────────────────────┐
│ [오늘의 단어장] [Wordly Wise]    │
├─────────────────────────────────┤
│ Book [▼]   Lesson [▼]           │
├─────────────────────────────────┤
│ 최근: B3-L4 · B3-L2 · B2-L1     │
├─────────────────────────────────┤
│ [ english word          ] [+]   │
├─────────────────────────────────┤
│ Book 3 · Lesson 5               │
│  word cards...                  │
└─────────────────────────────────┘
```

### Book / Lesson selectors

- Dropdowns: Book 1–12, Lesson 1–10
- **Defaults when `localStorage` empty:** Book 1, Lesson 1
- Selected values persist in `localStorage` (`wwBook`, `wwLesson`)
- Changing dropdown reloads word list for that lesson

### Element IDs (no collision with daily panel)

Daily panel keeps existing IDs: `wordInput`, `addForm`, `addBtn`, `wordList`.

WW panel uses **prefixed IDs**:

| Element | ID |
|---------|-----|
| Input | `wwWordInput` |
| Form | `wwAddForm` |
| Add button | `wwAddBtn` |
| Word list | `wwWordList` |
| Book select | `wwBookSelect` |
| Lesson select | `wwLessonSelect` |
| Recent row | `wwRecentLessons` |

Refactor shared card styles to **classes** (`.word-card`, `.add-bar`, `.word-input`, `.add-btn`); style both panels via classes, not IDs. WW keeps prefixed IDs only for `getElementById`.

### Script load order (`index.html`)

```html
<script src="shared.js"></script>
<script src="daily.js"></script>
<script src="ww.js"></script>
<script src="app.js"></script>
```

Each module attaches to `window`: `window.DailyNotebook`, `window.WordlyWise`, `window.Shared`. `app.js` handles tab switching and calls `DailyNotebook.init()` / `WordlyWise.init()` on first tab activation (lazy load lists).

### Recent lessons row

- Fetch `GET /ww/recent-lessons`
- Render chips: `B3-L4` format
- Tap chip → set Book/Lesson selectors, **persist `wwBook`/`wwLesson` to localStorage**, reload list
- Hide row when empty

### Word cards (same as daily)

- Collapsed meaning by default
- Tap word row / speaker → English TTS
- Tap meaning toggle → expand/collapse
- Long-press 500ms → delete confirm
- Meaning fetch via `GET /translation/:wordId`
- Retry on translation failure

### Empty state

When lesson has no words:

- Message: "이 레슨에 추가한 단어가 없어요"
- Subtitle: "위에서 영어 단어를 입력해 보세요"

### Daily panel

- Existing UI and behavior unchanged when daily tab is active

## File Changes

| File | Action |
|------|--------|
| `models/WordlyWord.js` | Create |
| `lib/wordlyWise.js` | Create — range constants, validators |
| `routes/wwWords.js` | Create — GET/POST/DELETE + recent-lessons |
| `routes/translation.js` | Modify — lookup WordlyWord fallback |
| `server.js` | Mount `/ww` router |
| `public/index.html` | Add tabs; wrap existing daily UI in `#dailyPanel`; add `#wwPanel` markup |
| `public/style.css` | Tab bar, selectors, recent chips; class-based shared card styles |
| `public/shared.js` | Create — speak, toast, meaning UI helpers |
| `public/daily.js` | Create — extract existing daily logic unchanged |
| `public/ww.js` | Create — Wordly Wise panel logic |
| `public/app.js` | Thin bootstrap — tabs, load daily/ww modules |
| `README.md` | Document WW section (optional, post-implementation) |

## Error Handling

| Case | Response / UX |
|------|----------------|
| Duplicate word in lesson | 409 + "이미 추가된 단어입니다" |
| Invalid book/lesson range | 400 + Korean message |
| Invalid word text | 400 (reuse validate messages) |
| Translation failure | Word kept; retry button in UI |
| Translation 404 (deleted word) | Show error; disable retry (no infinite loop) |
| TTS failure | Toast; app continues |
| Offline | Disable add; show offline banner (shared) |

## Testing (Manual)

- [ ] Daily tab unchanged after WW addition
- [ ] Add word to Book 3 Lesson 5 → appears in list
- [ ] Switch lesson → different list
- [ ] Recent lessons chips update after add
- [ ] Tap recent chip → correct lesson loads
- [ ] Duplicate same word same lesson → 409
- [ ] Lesson 11 rejected; Book 13 rejected
- [ ] TTS, meaning expand, long-press delete work on WW cards
- [ ] Translation works for WordlyWord IDs
- [ ] Mobile viewport usable

## Decisions Log

| Decision | Choice |
|----------|--------|
| Isolation from daily | Separate WordlyWord model + `/ww` API |
| Navigation | Top tabs (오늘의 단어장 \| Wordly Wise) |
| Word entry | One at a time per lesson |
| Book/Lesson picker | Sticky dropdowns while adding |
| Lesson list view | Current Book+Lesson only |
| Recent lessons | Server-side, top 5 by `updatedAt` |
| Card UX | Same as daily (TTS, meaning, delete) |
| Book range | 1–12 |
| Lesson range | 1–10 |
| Meaning source | Existing translation API |
