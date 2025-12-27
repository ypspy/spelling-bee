const tableDiv = document.getElementById("table");

/* =========================
   Google Cloud TTS
========================= */
function speak(text) {
  // 이전 음성 중단
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

  // record lookup: wordId_sessionId -> result
  const recordMap = {};
  records.forEach(r => {
    recordMap[`${r.wordId}_${r.sessionId}`] = r.result;
  });

  const table = document.createElement("table");

  /* ---------- header ---------- */
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");

  // Word column
  const thWord = document.createElement("th");
  thWord.innerText = "Word";
  hr.appendChild(thWord);

  // Stats column
  const thStats = document.createElement("th");
  thStats.innerText = "Stats";
  hr.appendChild(thStats);

  // Session columns (latest → past)
  sessions.forEach(s => {
    const th = document.createElement("th");
    th.innerText = s.sessionId;

    if (s.status === "open") {
      th.style.background = "#222";
    } else {
      th.style.opacity = "0.4";
    }

    hr.appendChild(th);
  });

  thead.appendChild(hr);
  table.appendChild(thead);

  /* ---------- body ---------- */
  const tbody = document.createElement("tbody");

  words.forEach(w => {
    const tr = document.createElement("tr");

    /* --- Word cell (TTS + Long Press Delete) --- */
    const wordTd = document.createElement("td");
    wordTd.innerText = w.text;
    wordTd.style.cursor = "pointer";

    let pressTimer = null;
    let longPressed = false;

    // touch start: long press timer
    wordTd.addEventListener("touchstart", () => {
      longPressed = false;
      pressTimer = setTimeout(async () => {
        longPressed = true;
        if (!confirm(`"${w.text}" 단어를 삭제할까요?\n모든 기록이 함께 삭제됩니다.`)) return;

        await fetch(`/words/${w._id}`, { method: "DELETE" });
        loadTable();
      }, 600); // 600ms = long press
    });

    // touch end: cancel if short tap
    wordTd.addEventListener("touchend", () => {
      clearTimeout(pressTimer);
      pressTimer = null;
    });

    wordTd.addEventListener("touchmove", () => {
      clearTimeout(pressTimer);
      pressTimer = null;
    });

    // click (short tap): speak
    wordTd.addEventListener("click", () => {
      if (longPressed) return;
      speak(w.text);
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
        td.addEventListener("click", async () => {
          await toggleRecord(w._id, s._id);
          loadTable();
        });
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

/* =========================
   Init
========================= */
loadTable();
