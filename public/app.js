const tableDiv = document.getElementById("table");
const alphabetFilterDiv = document.getElementById("alphabetFilters");
const examModeBtn = document.getElementById("examModeBtn");

let currentFilter = "all";
let examMode = false;

/* =========================
   Google TTS
========================= */
function speak(text) {
  if (window._ttsAudio) window._ttsAudio.pause();
  const audio = new Audio(`/tts?text=${encodeURIComponent(text)}`);
  window._ttsAudio = audio;
  audio.play();
}

/* =========================
   API Helpers
========================= */
async function toggleRecord(wordId, sessionId) {
  await fetch("/records/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wordId, sessionId })
  });
}

async function updatePriority(wordId, delta) {
  await fetch(`/words/${wordId}/priority`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delta })
  });
}

/* =========================
   Exam Mode Toggle
========================= */
if (examModeBtn) {
  examModeBtn.onclick = () => {
    examMode = !examMode;
    examModeBtn.innerText = examMode ? "시험 모드 종료" : "시험 모드";
    document.body.classList.toggle("exam", examMode);
    loadTable();
  };
}

/* =========================
   Main Render
========================= */
async function loadTable() {
  const res = await fetch("/table");
  const { words, sessions, records, statsByWord } = await res.json();

  /* ---------- Alphabet Filters ---------- */
  const alphabets = Array.from(
    new Set(words.map(w => w.alphabet).filter(Boolean))
  ).sort();

  if (alphabetFilterDiv) {
    alphabetFilterDiv.innerHTML = "";

    const allBtn = document.createElement("button");
    allBtn.innerText = "All";
    allBtn.dataset.level = "all";
    if (currentFilter === "all") allBtn.classList.add("active");
    alphabetFilterDiv.appendChild(allBtn);

    alphabets.forEach(a => {
      const btn = document.createElement("button");
      btn.innerText = a;
      btn.dataset.level = a;
      if (currentFilter === a) btn.classList.add("active");
      alphabetFilterDiv.appendChild(btn);
    });
  }

  /* ---------- Record Map ---------- */
  const recordMap = {};
  records.forEach(r => {
    recordMap[`${r.wordId}_${r.sessionId}`] = r.result;
  });

  /* ---------- Filtering ---------- */
  const filteredWords = words.filter(w => {
    if (examMode && w.priority !== 2) return false;

    if (/^[A-Z]$/.test(currentFilter)) {
      if (w.alphabet !== currentFilter) return false;
    }

    if (currentFilter === "today") {
      if (w.priority < 1) return false;
      if (sessions.length < 2) return false;
      const prev = sessions[1];
      return recordMap[`${w._id}_${prev._id}`] === "fail";
    }

    if (["one", "two", "three"].includes(currentFilter)) {
      return w.level === currentFilter;
    }

    if (currentFilter === "wrong") {
      if (sessions.length < 2) return false;
      const prev = sessions[1];
      return recordMap[`${w._id}_${prev._id}`] === "fail";
    }

    return true;
  });

  const totalWords = filteredWords.length;
  const totalSessions = sessions.length;

  /* ---------- Table ---------- */
  const table = document.createElement("table");

  /* Header */
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");

  ["#", "Word", "Stats"].forEach(label => {
    const th = document.createElement("th");
    th.innerText = label;
    hr.appendChild(th);
  });

  sessions.forEach((s, idx) => {
    const th = document.createElement("th");
    th.innerText = `T${totalSessions - idx}`;
    if (s.status === "open") th.style.background = "#222";
    else th.style.opacity = "0.4";
    hr.appendChild(th);
  });

  thead.appendChild(hr);
  table.appendChild(thead);

  /* Body */
  const tbody = document.createElement("tbody");

  filteredWords.forEach((w, i) => {
    const tr = document.createElement("tr");

    /* Number */
    const numTd = document.createElement("td");
    numTd.innerText = `${i + 1}/${totalWords}`;
    tr.appendChild(numTd);

    /* Word cell */
    const wordTd = document.createElement("td");
    wordTd.innerText = w.text;
    wordTd.style.cursor = "pointer";

    if (w.priority > 0) {
      const badge = document.createElement("span");
      badge.style.marginLeft = "6px";
      badge.style.fontSize = "11px";
      badge.style.color = "#ff5555";
      badge.innerText = "●".repeat(w.priority);
      wordTd.appendChild(badge);
    }

    /* ===== Mobile Touch Logic ===== */
    let pressTimer = null;
    let longPressed = false;
    let lastTapTime = 0;
    let singleTapTimer = null;

    const DOUBLE_TAP_DELAY = 300;
    const LONG_PRESS_DELAY = 600;

    wordTd.addEventListener("touchstart", () => {
      if (examMode) return;
      longPressed = false;

      pressTimer = setTimeout(async () => {
        longPressed = true;
        if (w.priority < 2) {
          await updatePriority(w._id, +1);
          loadTable();
        }
      }, LONG_PRESS_DELAY);
    });

    wordTd.addEventListener("touchend", async () => {
      clearTimeout(pressTimer);
      const now = Date.now();

      if (!examMode && !longPressed && now - lastTapTime < DOUBLE_TAP_DELAY) {
        lastTapTime = 0;
        if (singleTapTimer) clearTimeout(singleTapTimer);
        if (w.priority > 0) {
          await updatePriority(w._id, -1);
          loadTable();
        }
        return;
      }

      lastTapTime = now;
      singleTapTimer = setTimeout(() => {
        speak(w.text);
        singleTapTimer = null;
      }, DOUBLE_TAP_DELAY);
    });

    /* ===== Desktop Mouse Logic ===== */
    wordTd.addEventListener("click", async (e) => {
      // 모바일에서 이미 처리됨 → 중복 방지
      if (e.pointerType === "touch") return;

      if (examMode) {
        speak(w.text);
        return;
      }

      if (e.shiftKey) {
        if (w.priority < 2) {
          await updatePriority(w._id, +1);
          loadTable();
        }
        return;
      }

      if (e.altKey) {
        if (w.priority > 0) {
          await updatePriority(w._id, -1);
          loadTable();
        }
        return;
      }

      speak(w.text);
    });

    tr.appendChild(wordTd);

    /* Stats */
    const stat = statsByWord[w._id] || { success: 0, attempts: 0 };
    const statTd = document.createElement("td");
    statTd.innerText = `${stat.success} / ${stat.attempts}`;
    tr.appendChild(statTd);

    /* Sessions */
    sessions.forEach(s => {
      const td = document.createElement("td");
      const val = recordMap[`${w._id}_${s._id}`];

      if (val === "success") td.innerText = "✓";
      else if (val === "fail") td.innerText = "✕";

      if (s.status === "open" && !examMode) {
        td.style.cursor = "pointer";
        td.onclick = async () => {
          await toggleRecord(w._id, s._id);
          loadTable();
        };
      } else {
        td.style.opacity = "0.35";
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableDiv.innerHTML = "";
  tableDiv.appendChild(table);

  /* ---------- Filter Buttons ---------- */
  document
    .querySelectorAll("#filters button, #alphabetFilters button")
    .forEach(btn => {
      btn.onclick = () => {
        document
          .querySelectorAll("#filters button, #alphabetFilters button")
          .forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.level;
        loadTable();
      };
    });

  /* ---------- Controls Lock ---------- */
  ["addWord", "addSession", "deleteSession"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = examMode;
  });
}

/* =========================
   Controls
========================= */
const addWordBtn = document.getElementById("addWord");
if (addWordBtn) {
  addWordBtn.onclick = async () => {
    const text = prompt("추가할 단어");
    if (!text) return;
    await fetch("/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    loadTable();
  };
}

const addSessionBtn = document.getElementById("addSession");
if (addSessionBtn) {
  addSessionBtn.onclick = async () => {
    if (!confirm("새 세션을 시작할까요?")) return;
    await fetch("/sessions", { method: "POST" });
    loadTable();
  };
}

const deleteSessionBtn = document.getElementById("deleteSession");
if (deleteSessionBtn) {
  deleteSessionBtn.onclick = async () => {
    if (!confirm("현재 세션을 삭제할까요?")) return;
    await fetch("/sessions/current", { method: "DELETE" });
    loadTable();
  };
}

/* =========================
   Init
========================= */
loadTable();
