// === Helpers ===
function setMessage(text, cls) {
  const el = document.getElementById('message');
  if (!el) { console.error('message element not found'); return; }
  el.textContent = text;
  el.className = 'message';
  if (cls) el.classList.add(cls);
}

let msgTimer = null;
function flashMessage(text, cls) {
  if (msgTimer) clearTimeout(msgTimer);
  setMessage(text, cls);
  msgTimer = setTimeout(() => {
    setMessage('选择颜色后在棋盘上拖拽涂色');
    msgTimer = null;
  }, 300);
}

// === Grid State ===
const state = {
  n: 0,
  grid: null,
  activeColor: 0,
  isEraser: false,
  solution: null,
  appState: 'idle',
};

function initGrid(n) {
  state.n = n;
  state.grid = Array.from({ length: n }, () => Array(n).fill(-1));
  state.solution = null;
  state.appState = 'editing';
}
