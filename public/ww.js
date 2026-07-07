window.WordlyWise = (() => {
  const BOOK_MIN = 1;
  const BOOK_MAX = 12;
  const LESSON_MIN = 1;
  const LESSON_MAX = 10;

  const bookSelect = document.getElementById("wwBookSelect");
  const lessonSelect = document.getElementById("wwLessonSelect");
  const recentEl = document.getElementById("wwRecentLessons");
  const addForm = document.getElementById("wwAddForm");
  const wordInput = document.getElementById("wwWordInput");
  const addBtn = document.getElementById("wwAddBtn");
  const lessonTitle = document.getElementById("wwLessonTitle");
  const wordList = document.getElementById("wwWordList");

  let adding = false;
  let initialized = false;

  function populateSelects() {
    bookSelect.innerHTML = "";
    lessonSelect.innerHTML = "";
    for (let b = BOOK_MIN; b <= BOOK_MAX; b++) {
      const opt = document.createElement("option");
      opt.value = String(b);
      opt.textContent = String(b);
      bookSelect.appendChild(opt);
    }
    for (let l = LESSON_MIN; l <= LESSON_MAX; l++) {
      const opt = document.createElement("option");
      opt.value = String(l);
      opt.textContent = String(l);
      lessonSelect.appendChild(opt);
    }
  }

  function getBookLesson() {
    const book = Number(bookSelect.value) || BOOK_MIN;
    const lesson = Number(lessonSelect.value) || LESSON_MIN;
    localStorage.setItem("wwBook", String(book));
    localStorage.setItem("wwLesson", String(lesson));
    return { book, lesson };
  }

  function restoreBookLesson() {
    const book = Number(localStorage.getItem("wwBook")) || BOOK_MIN;
    const lesson = Number(localStorage.getItem("wwLesson")) || LESSON_MIN;
    bookSelect.value = String(Math.min(BOOK_MAX, Math.max(BOOK_MIN, book)));
    lessonSelect.value = String(Math.min(LESSON_MAX, Math.max(LESSON_MIN, lesson)));
  }

  function setBookLesson(book, lesson) {
    bookSelect.value = String(book);
    lessonSelect.value = String(lesson);
    localStorage.setItem("wwBook", String(book));
    localStorage.setItem("wwLesson", String(lesson));
  }

  async function loadRecentLessons() {
    const res = await fetch("/ww/recent-lessons");
    const data = await res.json();
    const lessons = data.lessons || [];

    if (!lessons.length) {
      recentEl.classList.add("hidden");
      recentEl.innerHTML = "";
      return;
    }

    recentEl.classList.remove("hidden");
    recentEl.innerHTML = `<span class="recent-label">최근:</span> `;

    lessons.forEach((item, i) => {
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = "recent-sep";
        sep.textContent = " · ";
        recentEl.appendChild(sep);
      }
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "recent-chip";
      chip.textContent = `B${item.book}-L${item.lesson}`;
      chip.onclick = () => {
        setBookLesson(item.book, item.lesson);
        loadWords();
        updateLessonTitle();
      };
      recentEl.appendChild(chip);
    });
  }

  function updateLessonTitle() {
    const { book, lesson } = getBookLesson();
    lessonTitle.textContent = `Book ${book} · Lesson ${lesson}`;
  }

  async function loadWords() {
    const { book, lesson } = getBookLesson();
    updateLessonTitle();
    const res = await fetch(`/ww/words?book=${book}&lesson=${lesson}`);
    const data = await res.json();
    renderWords(data.words || []);
  }

  function renderWords(words) {
    wordList.innerHTML = "";
    if (!words.length) {
      wordList.innerHTML = `
        <div class="empty-state">
          <p>이 레슨에 추가한 단어가 없어요</p>
          <p class="subtitle">위에서 영어 단어를 입력해 보세요</p>
        </div>`;
      return;
    }

    words.forEach(w => {
      wordList.appendChild(Shared.createWordCard(w, { onDelete: deleteWord }));
    });
  }

  async function addWord(text) {
    if (adding) return;
    adding = true;
    addBtn.disabled = true;
    const { book, lesson } = getBookLesson();
    try {
      const res = await fetch("/ww/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, book, lesson })
      });
      const data = await res.json();
      if (!res.ok) {
        Shared.showToast(data.error || "추가 실패");
        return;
      }
      wordInput.value = "";
      await loadWords();
      await loadRecentLessons();
    } finally {
      adding = false;
      addBtn.disabled = !navigator.onLine;
    }
  }

  async function deleteWord(id) {
    await fetch(`/ww/words/${id}`, { method: "DELETE" });
    Shared.expandedIds.delete(id);
    await loadWords();
    await loadRecentLessons();
  }

  function setOfflineState(offline) {
    wordInput.disabled = offline;
    addBtn.disabled = offline || adding;
  }

  function init() {
    if (initialized) return;
    initialized = true;

    populateSelects();
    restoreBookLesson();
    updateLessonTitle();

    bookSelect.addEventListener("change", () => {
      getBookLesson();
      loadWords();
    });
    lessonSelect.addEventListener("change", () => {
      getBookLesson();
      loadWords();
    });

    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = wordInput.value.trim();
      if (text) addWord(text);
    });

    window.addEventListener("online", () => setOfflineState(false));
    window.addEventListener("offline", () => setOfflineState(true));
    setOfflineState(!navigator.onLine);

    loadRecentLessons();
    loadWords();
  }

  return { init };
})();
