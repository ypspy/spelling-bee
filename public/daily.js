window.DailyNotebook = (() => {
  const wordInput = document.getElementById("wordInput");
  const addForm = document.getElementById("addForm");
  const addBtn = document.getElementById("addBtn");
  const wordList = document.getElementById("wordList");
  const offlineMsg = document.getElementById("offlineMsg");

  let adding = false;
  let initialized = false;

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

  async function loadWords() {
    const today = todayKST();
    const from = addDays(today, -3);
    const res = await fetch(`/words?from=${from}&to=${today}`);
    const data = await res.json();
    renderWords(data.words || []);
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
        section.appendChild(Shared.createWordCard(w, { onDelete: deleteWord }));
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
        Shared.showToast(data.error || "추가 실패");
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
    Shared.expandedIds.delete(id);
    await loadWords();
  }

  function setOfflineState(offline) {
    offlineMsg.classList.toggle("hidden", !offline);
    wordInput.disabled = offline;
    addBtn.disabled = offline || adding;
  }

  function init() {
    if (initialized) return;
    initialized = true;

    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = wordInput.value.trim();
      if (text) addWord(text);
    });

    window.addEventListener("online", () => setOfflineState(false));
    window.addEventListener("offline", () => setOfflineState(true));
    setOfflineState(!navigator.onLine);

    loadWords();
  }

  return { init };
})();
