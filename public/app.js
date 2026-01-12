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
   Filter Wiring
========================= */
function wireFilterButtons() {
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
}

/* =========================
   Exam Mode
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

  /* Alphabet Filters */
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

  /* Record Map */
  const recordMap = {};
  records.forEach(r => {
    recordMap[`${r.wordId}_${r.sessionId}`] = r.result;
  });

  /* Filtering */
  const filteredWords = words.filter(w => {
    if (examMode && w.priority !== 2) return false;

    if (/^[A-Z]$/.test(currentFilter)) {
      return w.alphabet === currentFilter;
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

  /* Sort A–Z */
  filteredWords.sort((a, b) => {
    if (a.alphabet !== b.alphabet) {
      return (a.alphabet || "").localeCompare(b.alphabet || "");
    }
    return a.text.localeCompare(b.text);
  });

  const totalWords = filteredWords.length;
  const totalSessions = sessions.length;

  /* Table */
  const table = document.createElement("table");

  /* Header */
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");

  ["#", "Word", "Stats"].forEach(h => {
    const th = document.createElement("th");
    th.innerText = h;
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
    tr.classList.add(`level-${w.level}`);

    const numTd = document.createElement("td");
    numTd.innerText = `${i + 1}/${totalWords}`;
    tr.appendChild(numTd);

    const wordTd = document.createElement("td");
    wordTd.classList.add("word");
    wordTd.innerText = w.text;

    if (w.priority > 0) {
      const dot = document.createElement("span");
      dot.innerText = "●".repeat(w.priority);
      wordTd.appendChild(dot);
    }

    wordTd.onclick = (e) => {
      if (examMode) {
        speak(w.text);
        return;
      }

      if (e.shiftKey) {
        updatePriority(w._id, +1).then(loadTable);
        return;
      }

      if (e.altKey) {
        updatePriority(w._id, -1).then(loadTable);
        return;
      }

      speak(w.text);
    };

    tr.appendChild(wordTd);

    const stat = statsByWord[w._id] || { success: 0, attempts: 0 };
    const statTd = document.createElement("td");
    statTd.innerText = `${stat.success} / ${stat.attempts}`;
    tr.appendChild(statTd);

    sessions.forEach(s => {
      const td = document.createElement("td");
      const val = recordMap[`${w._id}_${s._id}`];

      if (val === "success") td.innerText = "✓";
      else if (val === "fail") td.innerText = "✕";

      if (s.status === "open" && !examMode) {
        td.style.cursor = "pointer";
        td.onclick = () => toggleRecord(w._id, s._id).then(loadTable);
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

  wireFilterButtons();
}

/* =========================
   Controls
========================= */
document.addEventListener("DOMContentLoaded", () => {
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

  wireFilterButtons();
});

/* =========================
   Init
========================= */
loadTable();
