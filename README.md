# 오늘의 단어장 (Spelling Bee)

모바일·태블릿에 맞춘 **일일 영어 단어장** 웹 앱입니다. 매일 영어 단어를 추가하고, **오늘 + 최근 3일**(총 4일) 동안 배운 단어를 복습할 수 있습니다. **Wordly Wise 3000** 탭에서 Book/Lesson별 단어도 관리할 수 있습니다.

## 주요 기능

### 오늘의 단어장
- **단어 추가** — 영어 단어만 입력하면 한국어 뜻을 자동으로 가져옵니다 (Gemini API)
- **4일 창** — 오늘을 포함해 최근 4일치 단어만 표시합니다
- **영어 발음** — 단어를 탭하면 Google TTS로 영어 발음을 재생합니다
- **뜻 보기** — 탭해서 한국어 뜻을 펼치거나 접을 수 있습니다
- **삭제** — 카드를 길게 눌러 오입력 단어를 삭제할 수 있습니다

### Wordly Wise 3000
- **Book/Lesson 선택** — Book 1–12, Lesson 1–10 (선택값은 localStorage에 저장)
- **단어 등록** — 현재 레슨에 영어 단어를 하나씩 추가
- **최근 레슨** — 최근 활동한 레슨 5개를 `B3-L4` 형식 칩으로 표시
- **동일 UX** — TTS, 뜻 보기, 길게 눌러 삭제 (오늘의 단어장과 동일)

## 기술 스택

- **백엔드:** Node.js, Express 5, Mongoose 9
- **프론트엔드:** HTML / CSS / Vanilla JavaScript
- **데이터베이스:** MongoDB (Atlas 권장)
- **외부 API:** Google Gemini (뜻), Google Cloud TTS (발음)

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 만듭니다.

```env
# 필수
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=Cluster0

# 선택 (기본값 3000)
PORT=3001

# 한국어 뜻 (없으면 LibreTranslate 등으로 폴백)
GEMINI_API_KEY=

# TTS — 아래 중 하나만 설정
GOOGLE_APPLICATION_CREDENTIALS=./spelling-bee-tts-b2b438fa4805.json
# GOOGLE_APPLICATION_CREDENTIALS_BASE64=   # 배포(Render)용
```

| 변수 | 필수 | 설명 |
|------|------|------|
| `MONGO_URI` | ✅ | MongoDB 연결 문자열 |
| `PORT` | | 서버 포트 (기본 `3000`) |
| `GEMINI_API_KEY` | | Gemini API 키 (뜻 자동 생성) |
| `GOOGLE_APPLICATION_CREDENTIALS` | | TTS 서비스 계정 JSON 파일 경로 |
| `GOOGLE_APPLICATION_CREDENTIALS_BASE64` | | TTS JSON을 base64로 인코딩한 값 (배포용) |

> `spelling-bee-tts-*.json` 파일은 Git에 포함되지 않습니다. Google Cloud 콘솔에서 받아 프로젝트 루트에 두세요.

### 3. 서버 실행

```bash
# 개발 (자동 재시작)
npm run dev

# 프로덕션
npm start
```

브라우저에서 `http://localhost:3000` (또는 `.env`의 `PORT`)으로 접속합니다.

### 4. 헬스 체크

```bash
curl http://localhost:3000/health
```

## API

### 오늘의 단어장

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/words?from=&to=` | 기간 내 단어 목록 (서버가 4일 창으로 자동 제한) |
| `POST` | `/words` | 오늘 날짜로 단어 추가 `{ text, addedDate }` |
| `DELETE` | `/words/:id` | 단어 삭제 |
| `GET` | `/translation/:wordId` | 한국어 뜻 조회·생성 (일일·WW 공용) |
| `GET` | `/tts?text=...&lang=en` | 영어 발음 MP3 |
| `GET` | `/health` | 서버 상태 확인 |

### Wordly Wise 3000

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/ww/words?book=&lesson=` | 해당 Book/Lesson 단어 목록 |
| `POST` | `/ww/words` | 단어 추가 `{ text, book, lesson }` |
| `DELETE` | `/ww/words/:id` | 단어 삭제 |
| `GET` | `/ww/recent-lessons?limit=5` | 최근 활동 레슨 (기본 5, 최대 10) |

### 단어 추가 예시

```bash
curl -X POST http://localhost:3000/words \
  -H "Content-Type: application/json" \
  -d '{"text":"apple","addedDate":"2026-07-08"}'
```

`addedDate`는 **오늘 날짜(KST)** 만 허용됩니다.

### Wordly Wise 단어 추가 예시

```bash
curl -X POST http://localhost:3000/ww/words \
  -H "Content-Type: application/json" \
  -d '{"text":"abandon","book":3,"lesson":5}'
```

## 데이터 모델

### Word (오늘의 단어장)

| 필드 | 설명 |
|------|------|
| `text` | 영어 단어 (소문자) |
| `meaning` | 한국어 뜻 |
| `addedDate` | 추가 날짜 (`YYYY-MM-DD`, KST) |

같은 날 같은 단어는 중복 추가할 수 없습니다.

### WordlyWord (Wordly Wise 3000)

| 필드 | 설명 |
|------|------|
| `book` | 1–12 |
| `lesson` | 1–10 |
| `text` | 영어 단어 (소문자) |
| `meaning` | 한국어 뜻 |

같은 Book+Lesson+text 조합은 중복 추가할 수 없습니다.

## DB 초기화

스키마 변경 후 또는 데이터를 전부 지울 때:

```bash
# 서버를 먼저 중지한 뒤 실행
npm run reset-db
```

`words`, `sessions`, `records` 컬렉션을 삭제합니다.

## 프로젝트 구조

```
spelling-bee/
├── lib/
│   ├── date.js         # KST 날짜·4일 창
│   ├── validate.js     # 단어 입력 검증
│   ├── wordlyWise.js   # WW Book/Lesson 검증
│   └── db.js           # MongoDB 연결
├── models/
│   ├── Word.js
│   └── WordlyWord.js
├── routes/
│   ├── words.js
│   ├── wwWords.js
│   ├── translation.js
│   └── tts.js
├── public/             # 프론트엔드 (SPA)
│   ├── shared.js       # TTS, 뜻, 카드 공통
│   ├── daily.js        # 오늘의 단어장
│   ├── ww.js           # Wordly Wise
│   └── app.js          # 탭 전환
├── scripts/
│   └── reset_db.js
└── server.js
```

## 배포 (Render 등)

1. 환경 변수에 `MONGO_URI`, `GEMINI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS_BASE64` 설정
2. MongoDB Atlas **Network Access**에 `0.0.0.0/0` 또는 배포 서버 IP 허용
3. `npm start`로 실행

## 로컬 개발 시 참고

- **`mongodb+srv://` DNS 오류:** 일부 ISP DNS에서 SRV 조회가 실패할 수 있습니다. `lib/db.js`에서 Google DNS(`8.8.8.8`)로 우회하도록 처리되어 있습니다. 그래도 안 되면 Atlas에서 **Standard connection string**을 사용하세요.
- **포트 충돌:** 다른 앱이 `3000`을 쓰고 있으면 `.env`에서 `PORT=3001` 등으로 변경하세요.
- **TTS 503:** `GOOGLE_APPLICATION_CREDENTIALS` JSON 파일이 없거나, 서버를 파일 추가 전에 시작한 경우입니다. JSON을 넣은 뒤 서버를 재시작하세요.

## 라이선스

ISC
