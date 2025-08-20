/* MCQ Quiz — unique 24, saved locally, proper scroll offset */

(function () {
  const QUIZ_SIZE = 24;
  const LS_KEY = "mcq24.save.v2"; // bump key to avoid restoring old buggy sets

  const quizEl = document.getElementById('quiz');
  const scoreEl = document.getElementById('score');
  const newSetBtn = document.getElementById('newSetBtn');
  const clearBtn = document.getElementById('clearBtn');
  const lastVisitEl = document.getElementById('lastVisit');

  if (!Array.isArray(window.ALL_QUESTIONS) || window.ALL_QUESTIONS.length === 0) {
    quizEl.innerHTML = `<div class="card"><div class="q">No question data found.</div>
      <div class="meta">Add items to <code>ALL_QUESTIONS</code> in questions.js.</div></div>`;
    return;
  }

  // ---------- utils ----------
  const nowIso = () => new Date().toISOString();

  function formatWhen(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch { return ""; }
  }

  // Stable normaliser for duplicate detection
  function normKey(q) {
    // prefer explicit id if provided and stable
    if (q.id && typeof q.id === "string") return `id:${q.id}`;
    // fallback: normalise question text aggressively
    return String(q.q || "")
      .toLowerCase()
      .replace(/[\s\n\r\t]+/g, " ")
      .replace(/[^\p{L}\p{N}]+/gu, "") // drop punctuation and symbols
      .trim();
  }

  // Build a unique pool from ALL_QUESTIONS (first occurrence wins)
  function uniquePool(arr) {
    const seen = new Set();
    const out = [];
    for (const q of arr) {
      const key = normKey(q);
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }
    return out;
  }

  // Seeded PRNG to reproduce shuffles when restoring
  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (n, rnd) => Math.floor(rnd() * n);

  function shuffleInPlace(arr, rnd = Math.random) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Sample N without replacement using Fisher–Yates partial shuffle
  function sampleNNoReplace(arr, n, rnd = Math.random) {
    const a = arr.slice();
    for (let i = 0; i < Math.min(n, a.length); i++) {
      const j = i + randInt(a.length - i, rnd);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, Math.min(n, a.length));
  }

  // Shuffle choices while tracking the correct answer index
  function shuffleChoicesWithAnswer(choices, answerIndex, rnd = Math.random) {
    const pairs = choices.map((text, i) => ({ text, isAnswer: i === answerIndex }));
    shuffleInPlace(pairs, rnd);
    const newChoices = pairs.map(p => p.text);
    const newAnswerIndex = pairs.findIndex(p => p.isAnswer);
    return { newChoices, newAnswerIndex };
  }

  function updateScore() {
    scoreEl.textContent = `Score: ${state.correct} / ${state.answered}`;
  }

  function scrollToNext(fromCard) {
    const cards = Array.from(quizEl.querySelectorAll('.card'));
    const idx = cards.indexOf(fromCard);
    const next = cards[idx + 1];
    if (!next) return;
    const header = document.querySelector('header');
    const offset = header ? header.offsetHeight + 80 : 0; // 8px gap
    const top = next.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  // ---------- state & persistence ----------
  let state = {
    seed: 0,
    picked: [],          // [{id,q,choices,answer}]
    choiceOrders: [],    // per question choice order mapping, derived from seed
    answered: 0,
    correct: 0,
    answers: {},         // cardIndex -> clickedIndex
    savedAt: null
  };

  function save() {
    try {
      const payload = {
        ...state,
        savedAt: nowIso()
      };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      if (lastVisitEl) lastVisitEl.textContent = `• saved ${formatWhen(payload.savedAt)}`;
    } catch {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj && Array.isArray(obj.picked)) {
        if (lastVisitEl && obj.savedAt) lastVisitEl.textContent = `• last visit ${formatWhen(obj.savedAt)}`;
        return obj;
      }
    } catch {}
    return null;
  }

  function clearSave() {
    try { localStorage.removeItem(LS_KEY); } catch {}
    if (lastVisitEl) lastVisitEl.textContent = "";
  }

  // ---------- render ----------
  function renderQuiz() {
    quizEl.innerHTML = '';
    state.answered = 0;
    state.correct = 0;

    // Seeded RNG so choices are deterministic across reloads
    const rnd = mulberry32(state.seed || 1);

    state.picked.forEach((q, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.done = '0';

      // Choice shuffle: keep deterministic order per question index
      const baseChoices = q.choices.slice();
      const { newChoices, newAnswerIndex } = shuffleChoicesWithAnswer(baseChoices, q.answer, rnd);
      card.dataset.answerIndex = String(newAnswerIndex);

      const qNum = i + 1;
      const qHtml = `
        <div class="q">${qNum}. ${q.q}</div>
        <div class="choices" role="group" aria-label="Question ${qNum}">
          ${newChoices.map((c, idx) => `
            <button class="choice" data-index="${idx}" type="button">${String.fromCharCode(65+idx)}. ${c}</button>
          `).join('')}
        </div>
        <div class="meta" aria-live="polite"></div>
      `;
      card.innerHTML = qHtml;

      // If this question was answered before, restore highlight
      const savedIdx = state.answers && Number.isInteger(state.answers[i]) ? state.answers[i] : null;
      if (savedIdx !== null) {
        const btns = Array.from(card.querySelectorAll('.choice'));
        btns.forEach(b => b.disabled = true);
        btns[newAnswerIndex].classList.add('correct');
        if (savedIdx !== newAnswerIndex) btns[savedIdx].classList.add('wrong');
        card.dataset.done = '1';
        state.answered += 1;
        if (savedIdx === newAnswerIndex) state.correct += 1;
      }

      quizEl.appendChild(card);
    });

    updateScore();
  }

  // ---------- new set ----------
  function newSet() {
    // De‑dupe entire dataset first
    const pool = uniquePool(window.ALL_QUESTIONS);
    if (pool.length < QUIZ_SIZE) {
      console.warn(`Unique pool smaller than ${QUIZ_SIZE}. Using ${pool.length}.`);
    }

    // Fresh seed per set for deterministic choice shuffles
    state.seed = Math.floor(Math.random() * 1e9) >>> 0;

    // Sample without replacement
    const rnd = mulberry32(state.seed ^ 0x9e3779b9);
    state.picked = sampleNNoReplace(pool, QUIZ_SIZE, rnd);

    // Reset progress
    state.answered = 0;
    state.correct = 0;
    state.answers = {};
    save();
    renderQuiz();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- events ----------
  quizEl.addEventListener('click', function (e) {
    const btn = e.target.closest('.choice');
    if (!btn) return;

    const card = btn.closest('.card');
    if (!card || card.dataset.done === '1') return;

    const answerIndex = Number(card.dataset.answerIndex);
    const clickedIndex = Number(btn.dataset.index);
    const buttons = Array.from(card.querySelectorAll('.choice'));
    const meta = card.querySelector('.meta');

    // Reveal: correct always green
    buttons.forEach(b => b.disabled = true);
    buttons[answerIndex].classList.add('correct');
    if (clickedIndex !== answerIndex) {
      btn.classList.add('wrong');
      meta.textContent = 'Incorrect — the correct answer is highlighted in green.';
    } else {
      state.correct += 1;
      meta.textContent = 'Correct.';
    }

    card.dataset.done = '1';
    state.answered += 1;

    // Persist the answer by card index
    const cards = Array.from(quizEl.querySelectorAll('.card'));
    const idx = cards.indexOf(card);
    state.answers[idx] = clickedIndex;

    updateScore();
    save();

    // Auto scroll to next with header offset
    setTimeout(() => scrollToNext(card), 220);
  }, { passive: true });

  if (newSetBtn) newSetBtn.addEventListener('click', newSet);
  if (clearBtn) clearBtn.addEventListener('click', () => { clearSave(); newSet(); });

  // ---------- boot ----------
  const saved = load();
  if (saved) {
    // Validate saved set against de‑duped pool to avoid zombie duplicates
    const pool = uniquePool(window.ALL_QUESTIONS);
    const poolKeys = new Set(pool.map(normKey));
    const savedAllExist = Array.isArray(saved.picked) && saved.picked.every(q => poolKeys.has(normKey(q)));

    if (savedAllExist) {
      state = { ...state, ...saved };
      renderQuiz();
    } else {
      // If dataset changed, start a clean set
      newSet();
    }
  } else {
    newSet();
  }
})();
