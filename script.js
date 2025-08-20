/* MCQ Quiz logic — draws 24 questions, reveals correct answer in green after every answer. */

(function () {
  const QUIZ_SIZE = 24;
  const quizEl = document.getElementById('quiz');
  const scoreEl = document.getElementById('score');
  const newSetBtn = document.getElementById('newSetBtn');

  // Guard
  if (!window.ALL_QUESTIONS || !Array.isArray(window.ALL_QUESTIONS) || window.ALL_QUESTIONS.length === 0) {
    quizEl.innerHTML = `<div class="card"><div class="q">No question data found.</div>
      <div class="meta">Add items to <code>ALL_QUESTIONS</code> in questions.js.</div></div>`;
    console.warn('ALL_QUESTIONS is missing or empty');
    return;
  }

  let state = {
    picked: [],
    answered: 0,
    correct: 0
  };

  function randInt(n) { return Math.floor(Math.random() * n); }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Shuffle choices while tracking the answer index
  function shuffleChoicesWithAnswer(choices, answerIndex) {
    const pairs = choices.map((text, i) => ({ text, isAnswer: i === answerIndex }));
    shuffleInPlace(pairs);
    const newChoices = pairs.map(p => p.text);
    const newAnswerIndex = pairs.findIndex(p => p.isAnswer);
    return { newChoices, newAnswerIndex };
  }

  function sampleN(arr, n) {
    const copy = arr.slice();
    shuffleInPlace(copy);
    return copy.slice(0, Math.min(n, copy.length));
  }

  function updateScore() {
    scoreEl.textContent = `Score: ${state.correct} / ${state.answered}`;
  }

function scrollToNext(fromCard) {
  const cards = Array.from(quizEl.querySelectorAll('.card'));
  const idx = cards.indexOf(fromCard);
  const next = cards[idx + 1];
  if (next) {
    const header = document.querySelector('header');
    const offset = header ? header.offsetHeight + 50 : 0; // + gap
    const top = next.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

  function renderQuiz() {
    quizEl.innerHTML = '';
    state.answered = 0;
    state.correct = 0;

    state.picked.forEach((q, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.done = '0';

      // Randomise choices per question
      const { newChoices, newAnswerIndex } = shuffleChoicesWithAnswer(q.choices, q.answer);
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
      quizEl.appendChild(card);
    });

    updateScore();
  }

  function newSet() {
    state.picked = sampleN(window.ALL_QUESTIONS, QUIZ_SIZE);
    renderQuiz();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Event delegation for answers
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
    updateScore();

    // Auto scroll to next after a short pause
    setTimeout(() => scrollToNext(card), 420);
  }, { passive: true });

  newSetBtn.addEventListener('click', newSet);

  // Initial draw
  newSet();
})();
