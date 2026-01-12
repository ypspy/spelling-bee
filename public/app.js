const tableDiv = document.getElementById("table");
const alphabetFilterDiv = document.getElementById("alphabetFilters");
const examModeBtn = document.getElementById("examModeBtn");

const PAGE_SIZE = 10;
let currentPage = 0;

/* =========================
   Filter State
========================= */
let filters = {
  alphabet: "all",
  level: "all",
  mode: {
    wrong: false,
    today: false,
    exam: false
  }
};

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

async function updateWordText(wordId, text) {
  await fetch(`/words/${wordId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
}

async function toggleBookmark(wordId, value) {
  await fetch(`/words/${wordId}/bookmark`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value })
  });
}

/* ★ HIDE 전용 helper (추가) */
async function hideWord(wordId) {
  await fetch(`/words/${wordId}/hide`, {
    method: "PATCH"
  });
}

/* =========================
   Filter Wiring
========================= */
function wireFilters() {
  // Level
  document
    .querySelectorAll('#filters button[data-type="level"]')
    .forEach(btn => {
      btn.onclick = () => {
        filters.level = btn.dataset.level;
        currentPage = 0;

        document
          .querySelectorAll('#filters button[data-type="level"]')
          .forEach(b => b.classList.remove("active"));

        btn.classList.add("active");
        loadTable();
      };
    });

  // Mode
  document
    .querySelectorAll('#filters button[data-type="mode"]')
    .forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.mode;
        filters.mode[key] = !filters.mode[key];
        currentPage = 0;

        btn.classList.toggle("active", filters.mode[key]);
        loadTable();
      };
    });

  // Alphabet
  alphabetFilterDiv.onclick = e => {
    if (e.target.tagName !== "BUTTON") return;

    filters.alphabet = e.target.dataset.level;
    currentPage = 0;

    alphabetFilterDiv
      .querySelectorAll("button")
      .forEach(b => b.classList.remove("active"));

    e.target.classList.add("active");
    loadTable();
  };
}

/* =========================
   Exam Mode
========================= */
if (examModeBtn) {
  examModeBtn.onclick = () => {
    filters.mode.exam = !filters.mode.exam;
    currentPage = 0;

    examModeBtn.innerText = filters.mode.exam
      ? "시험 모드 종료"
      : "시험 모드";

    document.body.classList.toggle("exam", filters.mode.exam);
    loadTable();
  };
}

/* =========================
   Main Render
========================= */
async function loadTable() {
  const res = await fetch("/table");
  const { words, sessions, records, statsByWord } = await res.json();

  /* Alphabet buttons */
  const alphabets = Array.from(
    new Set(words.map(w => w.alphabet).filter(Boolean))
  ).sort();

  alphabetFilterDiv.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.innerText = "All";
  allBtn.dataset.level = "all";
  if (filters.alphabet === "all") allBtn.classList.add("active");
  alphabetFilterDiv.appendChild(allBtn);

  alphabets.forEach(a => {
    const btn = document.createElement("button");
    btn.innerText = a;
    btn.dataset.level = a;
    if (filters.alphabet === a) btn.classList.add("active");
    alphabetFilterDiv.appendChild(btn);
  });

  /* Record Map */
  const recordMap = {};
  records.forEach(r => {
    recordMap[`${r.wordId}_${r.sessionId}`] = r.result;
  });

  /* Filtering */
  let filtered = words.filter(w => {
    if (filters.alphabet !== "all" && w.alphabet !== filters.alphabet)
      return false;
    if (filters.level !== "all" && w.level !== filters.level)
      return false;
    if (filters.mode.exam && w.priority !== 2)
      return false;

    if (filters.mode.wrong) {
      if (sessions.length < 2) return false;
      if (recordMap[`${w._id}_${sessions[1]._id}`] !== "fail")
        return false;
    }

    if (filters.mode.today && w.priority < 1)
      return false;

    return true;
  });

  filtered.sort((a, b) => {
    if (a.alphabet !== b.alphabet)
      return a.alphabet.localeCompare(b.alphabet);
    return a.text.localeCompare(b.text);
  });

  /* Pagination */
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = currentPage * PAGE_SIZE;
  const pageWords = filtered.slice(start, start + PAGE_SIZE);

  /* =========================
     Table
  ========================= */
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");

  ["#", "Word", "Stats"].forEach(h => {
    const th = document.createElement("th");
    th.innerText = h;
    hr.appendChild(th);
  });

  sessions.forEach((s, i) => {
    const th = document.createElement("th");
    th.innerText = `T${sessions.length - i}`;
    hr.appendChild(th);
  });

  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  pageWords.forEach((w, i) => {
    const tr = document.createElement("tr");
    tr.classList.add(`level-${w.level}`);

    /* ---------- # : Bookmark ---------- */
    const numTd = document.createElement("td");
    numTd.innerText = `${start + i + 1}/${filtered.length}`;
    numTd.style.cursor = "pointer";

    if (w.bookmarked) {
      numTd.style.color = "#ffd966";
      numTd.style.fontWeight = "600";
    }

    numTd.onclick = e => {
      e.stopPropagation();
      toggleBookmark(w._id, !w.bookmarked).then(loadTable);
    };

    tr.appendChild(numTd);

    /* ---------- Word ---------- */
    const wordTd = document.createElement("td");
    wordTd.className = "word";
    wordTd.innerText = w.text;

    if (w.priority > 0) {
      const dot = document.createElement("span");
      dot.className = "priority-dot";
      dot.innerText = " ●".repeat(w.priority);
      wordTd.appendChild(dot);
    }

    wordTd.onclick = e => {
      if (filters.mode.exam) return speak(w.text);
      if (e.shiftKey) return updatePriority(w._id, +1).then(loadTable);
      if (e.altKey) return updatePriority(w._id, -1).then(loadTable);
      speak(w.text);
    };

    tr.appendChild(wordTd);

    /* ---------- Stats : Edit / HIDE ---------- */
    const stat = statsByWord[w._id] || { success: 0, attempts: 0 };
    const statTd = document.createElement("td");
    statTd.innerText = `${stat.success}/${stat.attempts}`;
    statTd.style.cursor = "pointer";

    statTd.onclick = () => {
      if (filters.mode.exam) return;

      const input = document.createElement("input");
      input.type = "text";
      input.value = w.text;
      input.style.width = "100%";

      statTd.innerHTML = "";
      statTd.appendChild(input);
      input.focus();
      input.select();

      const finish = async save => {
        if (save) {
          const newText = input.value.trim();

          /* 🔒 HIDE 명령 */
          if (newText.toUpperCase() === "HIDE") {
            const ok = confirm("이 단어를 숨기시겠습니까?");
            if (ok) {
              await hideWord(w._id);
            }
            return loadTable();
          }

          /* 기존 수정 */
          if (newText && newText !== w.text) {
            await updateWordText(w._id, newText);
          }
        }
        loadTable();
      };

      input.onkeydown = e => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      };

      input.onblur = () => finish(true);
    };

    tr.appendChild(statTd);

    /* ---------- Records ---------- */
    sessions.forEach(s => {
      const td = document.createElement("td");
      const val = recordMap[`${w._id}_${s._id}`];
      if (val === "success") td.innerText = "✓";
      if (val === "fail") td.innerText = "✕";

      if (s.status === "open" && !filters.mode.exam) {
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

  /* =========================
     Pager
  ========================= */
  const pager = document.createElement("div");
  pager.style.marginTop = "12px";
  pager.style.textAlign = "left";

  const prev = document.createElement("button");
  prev.innerText = "◀ 이전";
  prev.disabled = currentPage === 0;
  prev.onclick = () => {
    currentPage--;
    loadTable();
  };

  const next = document.createElement("button");
  next.innerText = "다음 ▶";
  next.disabled = currentPage >= totalPages - 1;
  next.onclick = () => {
    currentPage++;
    loadTable();
  };

  const bookmarkBtn = document.createElement("button");
  bookmarkBtn.innerText = "북마크";

  bookmarkBtn.onclick = () => {
    const startIdx = (currentPage + 1) * PAGE_SIZE;
    let idx = filtered.slice(startIdx).findIndex(w => w.bookmarked);

    if (idx === -1) {
      idx = filtered.findIndex(w => w.bookmarked);
      if (idx === -1) {
        alert("현재 필터 조건에 북마크된 단어가 없습니다.");
        return;
      }
    } else {
      idx = startIdx + idx;
    }

    currentPage = Math.floor(idx / PAGE_SIZE);
    loadTable();
  };

  pager.appendChild(prev);
  pager.appendChild(next);
  pager.appendChild(bookmarkBtn);
  pager.appendChild(
    document.createTextNode(` ${currentPage + 1}/${totalPages} `)
  );

  tableDiv.appendChild(pager);

  wireFilters();
}

/* =========================
   Init
========================= */
wireFilters();
loadTable();
