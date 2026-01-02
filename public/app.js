const tableDiv = document.getElementById("table");
let currentFilter = "all";

/* =========================
   Google TTS
========================= */
function speak(text) {
  if (window._ttsAudio) {
    window._ttsAudio.pause();
  }
  const audio = new Audio(`/tts?text=${encodeURIComponent(text)}`);
  window._ttsAudio = audio;
  audio.play();
}

/* =========================
   API Helper
========================= */
async function toggleRecord(wordId, sessionId) {
  await fetch("/records/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wordId, sessionId })
  });
}

/* =========================
   Main Table Render
========================= */
async function loadTable() {
  const res = await fetch("/table");
  const { words, sessions, records, statsByWord } = await res.json();

  /* ---------- record lookup ---------- */
  const recordMap = {};
  records.forEach(r => {
    recordMap[`${r.wordId}_${r.sessionId}`] = r.result;
  });

  /* ---------- filtering ---------- */
  const filteredWords = words.filter(w => {
    if (currentFilter === "all") return true;

    // 직전 오답만: TN-1 기준
    if (currentFilter === "wrong") {
      if (sessions.length < 2) return false;

      const prevSession = sessions[1]; // TN-1
      const key = `${w._id}_${prevSession._id}`;
      return recordMap[key] === "fail";
    }

    // 난이도 필터
    if (["one", "two", "three"].includes(currentFilter)) {
      return w.level === currentFilter;
    }

    return true;
  });

  const totalWords = filteredWords.length;
  const totalSessions = sessions.length;

  const table = document.createElement("table");

  /* ---------- header ---------- */
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");

  ["#", "Word", "Stats"].forEach(label => {
    const th = document.createElement("th");
    th.innerText = label;
    hr.appendChild(th);
  });

  // 왼쪽 = 최신 = TN
  sessions.forEach((s, idx) => {
    const th = document.createElement("th");
    th.innerText = `T${totalSessions - idx}`;

    if (s.status === "open") {
      th.style.background = "#222";
      th.style.fontWeight = "600";
    } else {
      th.style.opacity = "0.4";
    }

    hr.appendChild(th);
  });

  thead.appendChild(hr);
  table.appendChild(thead);

  /* ---------- body ---------- */
  const tbody = document.createElement("tbody");

  filteredWords.forEach((w, i) => {
    const tr = document.createElement("tr");

    /* # */
    const numTd = document.createElement("td");
    numTd.innerText = `${i + 1}/${totalWords}`;
    tr.appendChild(numTd);

    /* Word */
    const wordTd = document.createElement("td");
    wordTd.innerText = w.text;
    wordTd.style.cursor = "pointer";
    wordTd.onclick = () => speak(w.text);
    tr.appendChild(wordTd);

    /* Stats */
    const stat = statsByWord[w._id] || { success: 0, attempts: 0 };
    const statTd = document.createElement("td");
    statTd.innerText = `${stat.success} / ${stat.attempts}`;
    tr.appendChild(statTd);

    /* Sessions */
    sessions.forEach(s => {
      const td = document.createElement("td");
      const key = `${w._id}_${s._id}`;
      const val = recordMap[key];

      if (val === "success") td.innerText = "✓";
      else if (val === "fail") td.innerText = "✕";

      if (s.status === "open") {
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
}

/* =========================
   Filters
========================= */
document.querySelectorAll("#filters button").forEach(btn => {
  btn.onclick = () => {
    document
      .querySelectorAll("#filters button")
      .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");
    currentFilter = btn.dataset.level;
    loadTable();
  };
});

/* =========================
   Controls
========================= */
document.getElementById("addWord").onclick = async () => {
  const text = prompt("추가할 단어");
  if (!text || !text.trim()) return;

  await fetch("/words", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.trim() })
  });

  loadTable();
};

document.getElementById("addSession").onclick = async () => {
  if (!confirm("새 세션을 시작할까요?")) return;
  await fetch("/sessions", { method: "POST" });
  loadTable();
};

document.getElementById("deleteSession").onclick = async () => {
  if (!confirm("현재 세션을 삭제할까요?")) return;
  await fetch("/sessions/current", { method: "DELETE" });
  loadTable();
};

/* =========================
   Init
========================= */
loadTable();
