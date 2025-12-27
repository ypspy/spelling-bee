const tableDiv = document.getElementById("table");
let currentFilter = "all";

/* =========================
   Google Cloud TTS
========================= */
function speak(text) {
  if (window._ttsAudio) {
    window._ttsAudio.pause();
    window._ttsAudio = null;
  }

  const audio = new Audio(`/tts?text=${encodeURIComponent(text)}`);
  window._ttsAudio = audio;
  audio.play();
}

/* =========================
   API helpers
========================= */
async function toggleRecord(wordId, sessionId) {
  await fetch("/records/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wordId, sessionId })
  });
}

/* =========================
   Main table render
========================= */
async function loadTable() {
  const res = await fetch("/table");
  const { words, sessions, records, statsByWord } = await res.json();

  // record lookup
  const recordMap = {};
  records.forEach(r => {
    recordMap[`${r.wordId}_${r.sessionId}`] = r.result;
  });

  /* ===== APPLY FILTER ===== */
  const filteredWords = words.filter(w => {
    if (currentFilter === "all") return true;
    return w.level === currentFilter;
  });

  const table = document.createElement("table");

  /* ---------- header ---------- */
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");

  ["Word", "Stats", ...sessions.map(s => s.sessionId)].forEach(text => {
    const th = document.createElement("th");
    th.innerText = text;
    hr.appendChild(th);
  });

  thead.appendChild(hr);
  table.appendChild(thead);

  /* ---------- body ---------- */
  const tbody = document.createElement("tbody");

  filteredWords.forEach(w => {
    const tr = document.createElement("tr");

    /* --- Word cell --- */
    const wordTd = document.createElement("td");
    wordTd.innerText = w.text;
    wordTd.style.cursor = "pointer";

    let pressTimer = null;
    let longPressed = false;

    wordTd.addEventListener("touchstart", () => {
      longPressed = false;
      pressTimer = setTimeout(async () => {
        longPressed = true;
        if (!confirm(`"${w.text}" 단어를 삭제할까요?\n모든 기록이 함께 삭제됩니다.`)) return;

        await fetch(`/words/${w._id}`, { method: "DELETE" });
        loadTable();
      }, 600);
    });

    wordTd.addEventListener("touchend", () => {
      clearTimeout(pressTimer);
      pressTimer = null;
    });

    wordTd.addEventListener("touchmove", () => {
      clearTimeout(pressTimer);
      pressTimer = null;
    });

    wordTd.addEventListener("click", () => {
      if (!longPressed) speak(w.text);
    });

    tr.appendChild(wordTd);

    /* --- Stats cell --- */
    const stat = statsByWord[w._id] || { success: 0, attempts: 0 };
    const statTd = document.createElement("td");
    statTd.innerText = `${stat.success} / ${stat.attempts}`;
    tr.appendChild(statTd);

    /* --- Session cells --- */
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
        td.style.opacity = "0.3";
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
   Controls
========================= */

// + 단어 추가
document.getElementById("addWord").onclick = async () => {
  const text = prompt("추가할 단어를 입력하세요");
  if (!text || !text.trim()) return;

  await fetch("/words", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.trim() })
  });

  loadTable();
};

// + 세션 추가
document.getElementById("addSession").onclick = async () => {
  if (!confirm("새 세션을 시작할까요?")) return;

  await fetch("/sessions", { method: "POST" });
  loadTable();
};

// 현재 세션 삭제
document.getElementById("deleteSession").onclick = async () => {
  if (!confirm("현재 세션과 모든 기록이 삭제됩니다. 계속할까요?")) return;

  await fetch("/sessions/current", { method: "DELETE" });
  loadTable();
};

// 벌크 단어 추가
const bulkBtn = document.getElementById("bulkAddWords");

if (bulkBtn) {
  bulkBtn.onclick = async () => {
    const textArea = document.getElementById("bulkWords");
    const levelSelect = document.getElementById("wordLevel");

    if (!textArea || !levelSelect) return;

    const text = textArea.value.trim();
    const level = levelSelect.value;

    if (!text) return;

    const res = await fetch("/words/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, level })
    });

    const result = await res.json();

    alert(
      `난이도: ${level}\n추가됨: ${result.inserted}개\n중복: ${result.skipped}개`
    );

    textArea.value = "";
    loadTable();
  };
}


/* =========================
   Filter buttons
========================= */
document.querySelectorAll("#filters button").forEach(btn => {
  btn.onclick = () => {
    currentFilter = btn.dataset.level;

    document
      .querySelectorAll("#filters button")
      .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");

    loadTable();
  };
});

/* =========================
   Init
========================= */
loadTable();
