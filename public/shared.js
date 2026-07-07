window.Shared = {
  expandedIds: new Set(),

  speak(text) {
    if (window._ttsAudio) {
      window._ttsAudio.pause();
      window._ttsAudio = null;
    }
    const audio = new Audio(`/tts?text=${encodeURIComponent(text)}&lang=en`);
    window._ttsAudio = audio;
    return audio.play().catch(() => this.showToast("발음을 재생할 수 없습니다"));
  },

  showToast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  },

  async fetchMeaning(wordId, cardEl) {
    const toggle = cardEl.querySelector(".meaning-toggle");
    toggle.textContent = "뜻 불러오는 중…";
    try {
      const res = await fetch(`/translation/${wordId}`);
      if (res.status === 404) {
        cardEl.dataset.meaningState = "notfound";
        this.updateMeaningUI(cardEl);
        return;
      }
      const data = await res.json();
      const meaning = data.meaning || "";
      cardEl.dataset.meaning = meaning;
      cardEl.dataset.meaningState = meaning ? "loaded" : "error";
      this.updateMeaningUI(cardEl);
    } catch {
      cardEl.dataset.meaningState = "error";
      this.updateMeaningUI(cardEl);
    }
  },

  updateMeaningUI(cardEl) {
    const toggle = cardEl.querySelector(".meaning-toggle");
    const textEl = cardEl.querySelector(".meaning-text");
    const state = cardEl.dataset.meaningState;
    const meaning = cardEl.dataset.meaning || "";
    const id = cardEl.dataset.id;

    if (state === "loading") {
      toggle.textContent = "뜻 불러오는 중…";
      textEl.textContent = "";
      return;
    }
    if (state === "notfound") {
      toggle.textContent = "단어를 찾을 수 없습니다";
      textEl.textContent = "";
      textEl.classList.add("hidden");
      return;
    }
    if (state === "error") {
      toggle.innerHTML = '뜻을 가져오지 못했습니다 <button type="button" class="retry-btn">재시도</button>';
      toggle.querySelector(".retry-btn").onclick = (e) => {
        e.stopPropagation();
        cardEl.dataset.meaningState = "loading";
        this.fetchMeaning(id, cardEl);
      };
      return;
    }
    toggle.textContent = this.expandedIds.has(id) ? "▼ 뜻 숨기기" : "▶ 뜻 보기";
    textEl.textContent = meaning;
    textEl.classList.toggle("hidden", !this.expandedIds.has(id));
  },

  bindLongPressDelete(card, wordText, onDelete) {
    let pressTimer;
    card.addEventListener("touchstart", () => {
      pressTimer = setTimeout(() => {
        if (confirm(`"${wordText}" 단어를 삭제할까요?`)) onDelete();
      }, 500);
    }, { passive: true });
    card.addEventListener("touchend", () => clearTimeout(pressTimer));
    card.addEventListener("touchmove", () => clearTimeout(pressTimer));
  },

  createWordCard(w, { onDelete }) {
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

    card.querySelector(".word-row").onclick = () => this.speak(w.text);
    card.querySelector(".meaning-toggle").onclick = (e) => {
      e.stopPropagation();
      if (card.dataset.meaningState === "loading") return;
      if (card.dataset.meaningState === "error") return;
      if (card.dataset.meaningState === "notfound") return;
      if (this.expandedIds.has(w._id)) this.expandedIds.delete(w._id);
      else this.expandedIds.add(w._id);
      this.updateMeaningUI(card);
    };

    this.bindLongPressDelete(card, w.text, () => onDelete(w._id));

    if (!w.meaning) this.fetchMeaning(w._id, card);
    else this.updateMeaningUI(card);

    return card;
  }
};
