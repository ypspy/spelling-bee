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
    setOfflineState(!navigator.onLine);
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
