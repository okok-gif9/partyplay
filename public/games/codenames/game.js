/* ============================================================
 * Bengali Codenames — game logic with shared-link multiplayer
 * ============================================================
 * Each game has a 6-char code (e.g. "K7M2QX"). The code seeds
 * a deterministic PRNG so anyone with the same code — on any
 * device, anywhere — sees the exact same 25 words and the
 * exact same color key.
 *
 * The code is also stored in the URL (?game=K7M2QX) so a
 * shared link is enough — recipients don't need to type
 * anything.
 *
 * Card clicks are local to each device so the spymaster's
 * private view stays private. Players coordinate by speaking
 * to each other (in person, voice/video call) like in real
 * Codenames.
 * ============================================================ */

(function () {
  'use strict';

  // ----- Constants -----
  const GRID_SIZE = 25;
  const TYPE_RED = 'red';
  const TYPE_BLUE = 'blue';
  const TYPE_NEUTRAL = 'neutral';
  const TYPE_ASSASSIN = 'assassin';
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  const CODE_LENGTH = 6;

  // ----- DOM -----
  const boardEl = document.getElementById('board');
  const redCountEl = document.getElementById('red-count');
  const blueCountEl = document.getElementById('blue-count');
  const redScoreEl = document.getElementById('red-score');
  const blueScoreEl = document.getElementById('blue-score');
  const turnIndicatorEl = document.getElementById('turn-indicator');
  const turnTextEl = document.getElementById('turn-text');
  const newGameBtn = document.getElementById('new-game-btn');
  const spymasterBtn = document.getElementById('spymaster-btn');
  const helpBtn = document.getElementById('help-btn');
  const helpModal = document.getElementById('help-modal');
  const helpCloseBtn = document.getElementById('help-close');
  const gameoverModal = document.getElementById('gameover-modal');
  const gameoverTitle = document.getElementById('gameover-title');
  const gameoverText = document.getElementById('gameover-text');
  const gameoverNewGameBtn = document.getElementById('gameover-newgame');

  // Multiplayer DOM
  const codeDisplayEl = document.getElementById('code-display');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const joinCodeInput = document.getElementById('join-code-input');
  const joinBtn = document.getElementById('join-btn');
  const toastEl = document.getElementById('toast');

  // ----- State -----
  let cards = [];
  let firstTeam = TYPE_RED;
  let currentTurn = TYPE_RED;
  let redRemaining = 0;
  let blueRemaining = 0;
  let spymasterMode = false;
  let gameOver = false;
  let currentCode = '';

  // ============================================================
  // Seeded PRNG — Mulberry32. Deterministic, fast, browser-safe.
  // Same seed → same sequence on any device.
  // ============================================================
  function seedFromCode(code) {
    // FNV-1a-like hash → 32-bit unsigned integer
    let h = 2166136261 >>> 0;
    for (let i = 0; i < code.length; i++) {
      h ^= code.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleSeeded(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ----- Code generation -----
  function generateCode() {
    let code = '';
    const arr = new Uint32Array(CODE_LENGTH);
    crypto.getRandomValues(arr);
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[arr[i] % CODE_ALPHABET.length];
    }
    return code;
  }

  function normalizeCode(input) {
    if (!input) return '';
    return String(input).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
  }

  function isValidCode(code) {
    if (!code || code.length !== CODE_LENGTH) return false;
    for (const ch of code) {
      if (!CODE_ALPHABET.includes(ch)) return false;
    }
    return true;
  }

  // ============================================================
  // Build a board deterministically from a code.
  // Same code → identical 25 words, identical colors, identical
  // first-team — on every device.
  // ============================================================
  function buildGameFromCode(code) {
    const rng = makeRng(seedFromCode(code));
    const pool = [...new Set(BENGALI_WORDS)];

    // 1. Pick 25 unique words, deterministically
    const words = shuffleSeeded(pool, rng).slice(0, GRID_SIZE);

    // 2. Decide first team deterministically from the same RNG
    const first = rng() < 0.5 ? TYPE_RED : TYPE_BLUE;

    // 3. Build the color key with the right distribution
    const types = [];
    if (first === TYPE_RED) {
      for (let i = 0; i < 9; i++) types.push(TYPE_RED);
      for (let i = 0; i < 8; i++) types.push(TYPE_BLUE);
    } else {
      for (let i = 0; i < 9; i++) types.push(TYPE_BLUE);
      for (let i = 0; i < 8; i++) types.push(TYPE_RED);
    }
    for (let i = 0; i < 7; i++) types.push(TYPE_NEUTRAL);
    types.push(TYPE_ASSASSIN);

    // 4. Shuffle types deterministically
    const shuffledTypes = shuffleSeeded(types, rng);

    return {
      first,
      cards: words.map((word, i) => ({
        word,
        type: shuffledTypes[i],
        revealed: false,
      })),
    };
  }

  // ----- New game -----
  function startGame(code) {
    currentCode = code;
    const built = buildGameFromCode(code);
    cards = built.cards;
    firstTeam = built.first;
    redRemaining = cards.filter(c => c.type === TYPE_RED).length;
    blueRemaining = cards.filter(c => c.type === TYPE_BLUE).length;
    currentTurn = firstTeam;
    gameOver = false;
    spymasterMode = false;
    spymasterBtn.classList.remove('active');
    spymasterBtn.textContent = 'کلید محرمانه';
    gameoverModal.hidden = true;

    // Reflect code in URL (without page reload)
    const url = new URL(window.location.href);
    url.searchParams.set('game', code);
    window.history.replaceState({}, '', url.toString());

    // Update code display
    if (codeDisplayEl) codeDisplayEl.textContent = code;

    render();
    updateStatus();
  }

  function newGame() {
    startGame(generateCode());
  }

  // ----- Render -----
  function render() {
    boardEl.innerHTML = '';
    cards.forEach((card, idx) => {
      const el = document.createElement('button');
      el.className = 'card';
      el.type = 'button';
      el.dataset.idx = String(idx);
      el.textContent = card.word;

      if (card.revealed) {
        el.classList.add('revealed', card.type);
        el.disabled = true;
      } else if (spymasterMode) {
        el.classList.add('preview-' + card.type);
      }

      el.addEventListener('click', () => onCardClick(idx));
      boardEl.appendChild(el);
    });
  }

  function updateStatus() {
    redCountEl.textContent = String(redRemaining);
    blueCountEl.textContent = String(blueRemaining);
    redScoreEl.classList.toggle('active', currentTurn === TYPE_RED && !gameOver);
    blueScoreEl.classList.toggle('active', currentTurn === TYPE_BLUE && !gameOver);

    turnIndicatorEl.classList.remove('red', 'blue');
    if (!gameOver) {
      turnIndicatorEl.classList.add(currentTurn);
      turnTextEl.textContent = currentTurn === TYPE_RED ? 'نوبت تیم قرمز' : 'نوبت تیم آبی';
    } else {
      turnTextEl.textContent = 'بازی تمام شد';
    }
  }

  // ----- Click handling -----
  function onCardClick(idx) {
    if (gameOver) return;
    if (spymasterMode) return;
    const card = cards[idx];
    if (card.revealed) return;

    card.revealed = true;

    if (card.type === TYPE_ASSASSIN) {
      const winner = currentTurn === TYPE_RED ? TYPE_BLUE : TYPE_RED;
      endGame(winner, 'assassin');
      render();
      return;
    }

    if (card.type === TYPE_RED) {
      redRemaining--;
      if (redRemaining === 0) { endGame(TYPE_RED, 'cleared'); render(); return; }
      if (currentTurn !== TYPE_RED) endTurn();
    } else if (card.type === TYPE_BLUE) {
      blueRemaining--;
      if (blueRemaining === 0) { endGame(TYPE_BLUE, 'cleared'); render(); return; }
      if (currentTurn !== TYPE_BLUE) endTurn();
    } else {
      endTurn();
    }

    render();
    updateStatus();
  }

  function endTurn() {
    currentTurn = currentTurn === TYPE_RED ? TYPE_BLUE : TYPE_RED;
  }

  function endGame(winner, reason) {
    gameOver = true;
    const teamName = winner === TYPE_RED ? 'تیم قرمز' : 'تیم آبی';
    let message;
    if (reason === 'assassin') {
      message = `کارت قاتل انتخاب شد! ${teamName} برنده شد.`;
    } else {
      message = `${teamName} همهٔ مأمورهایش را پیدا کرد و برنده شد!`;
    }
    gameoverTitle.textContent = `${teamName} برنده است 🎉`;
    gameoverText.textContent = message;
    gameoverModal.hidden = false;
    updateStatus();
  }

  // ----- Spymaster toggle -----
  function toggleSpymaster() {
    spymasterMode = !spymasterMode;
    spymasterBtn.classList.toggle('active', spymasterMode);
    spymasterBtn.textContent = spymasterMode ? 'نمای بازیکن' : 'کلید محرمانه';
    render();
  }

  // ----- Toast -----
  let toastTimer = null;
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  // ----- Copy link -----
  async function copyShareLink() {
    const url = new URL(window.location.href);
    url.searchParams.set('game', currentCode);
    const link = url.toString();
    try {
      await navigator.clipboard.writeText(link);
      showToast('لینک بازی کپی شد.');
    } catch (_) {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast('لینک بازی کپی شد.'); }
      catch (_) { showToast('کپی لینک انجام نشد.'); }
      document.body.removeChild(ta);
    }
  }

  // ----- Join by code -----
  function joinByCode() {
    const raw = joinCodeInput ? joinCodeInput.value : '';
    const code = normalizeCode(raw);
    if (!isValidCode(code)) {
      showToast('یک کد شش‌کاراکتری معتبر وارد کن.');
      return;
    }
    startGame(code);
    if (joinCodeInput) joinCodeInput.value = '';
    showToast('وارد بازی شدی.');
  }

  // ----- Wire up -----
  newGameBtn.addEventListener('click', newGame);
  gameoverNewGameBtn.addEventListener('click', newGame);
  spymasterBtn.addEventListener('click', toggleSpymaster);
  helpBtn.addEventListener('click', () => { helpModal.hidden = false; });
  helpCloseBtn.addEventListener('click', () => { helpModal.hidden = true; });

  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.hidden = true;
  });

  if (copyLinkBtn) copyLinkBtn.addEventListener('click', copyShareLink);
  if (joinBtn) joinBtn.addEventListener('click', joinByCode);
  if (joinCodeInput) {
    joinCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinByCode();
    });
  }

  document.addEventListener('keydown', (e) => {
    const inField = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    if (e.key === 'Escape') {
      helpModal.hidden = true;
      return;
    }
    if (inField) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.toLowerCase() === 'n') newGame();
    else if (e.key.toLowerCase() === 's') toggleSpymaster();
  });

  // ============================================================
  // Bootstrap — read ?game=CODE from URL, otherwise new game
  // ============================================================
  function init() {
    const params = new URLSearchParams(window.location.search);
    const urlCode = normalizeCode(params.get('game'));
    if (isValidCode(urlCode)) {
      startGame(urlCode);
    } else {
      newGame();
    }
  }

  init();
})();
