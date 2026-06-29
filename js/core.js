// ═══ 共享基础层：常量 · 状态 · Canvas 工具 · 消息 · 坐标转换 ═══

// ── 常量 ──
const DIRS = [[0,1],[0,-1],[1,0],[-1,0]];
const CELL_SIZE = 48;
const CELL_GAP = 4;
const CELL_RADIUS = 5;
const PADDING = 6;
const BG_COLOR = '#1e1e30';
const EMPTY_COLOR = '#2a2a42';
const EMPTY_STROKE = '#3a3a58';

// ── Canvas 引用 ──
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
let paletteColors = [];

function generatePalette(n) {
  paletteColors = [];
  for (let i = 0; i < n; i++) {
    const hue = (i * 360 / n) % 360;
    paletteColors.push(`hsl(${hue}, 78%, 58%)`);
  }
}

function canvasTotal() {
  if (state.n === 0) return 0;
  return CELL_SIZE * state.n + CELL_GAP * (state.n - 1) + PADDING * 2;
}

function resizeCanvas() {
  if (state.n === 0) return;
  const total = canvasTotal();
  canvas.width = total;
  canvas.height = total;
  canvas.style.width = total + 'px';
  canvas.style.height = total + 'px';
}

function cellRect(row, col) {
  const x = PADDING + col * (CELL_SIZE + CELL_GAP);
  const y = PADDING + row * (CELL_SIZE + CELL_GAP);
  return { x, y, w: CELL_SIZE, h: CELL_SIZE };
}

// ── 全局状态 ──
const state = {
  n: 0,
  grid: null,
  activeColor: 0,
  isEraser: false,
  solution: null,
  appState: 'idle',  // idle → editing → solved
};

function initGrid(n) {
  state.n = n;
  state.grid = Array.from({ length: n }, () => Array(n).fill(-1));
  state.solution = null;
  state.appState = 'editing';
  const hint = document.getElementById('canvas-hint');
  if (hint) hint.style.opacity = '0.6';
}

// ── 消息栏 ──
function setMessage(text, type) {
  const el = document.getElementById('message');
  if (!el) return;
  el.textContent = text;
  el.className = 'message';
  el.classList.add('message-' + (type || 'default'));
  el.classList.remove('message-flash');
  void el.offsetWidth;
  el.classList.add('message-flash');
}

let msgTimer = null;
function flashMessage(text, type) {
  if (msgTimer) clearTimeout(msgTimer);
  setMessage(text, type);
  msgTimer = setTimeout(() => {
    setMessage('选择颜色后在棋盘上拖拽涂色');
    msgTimer = null;
  }, 400);
}

// ── 坐标转换 ──
function getCell(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const col = Math.floor((mx - PADDING) / (CELL_SIZE + CELL_GAP));
  const row = Math.floor((my - PADDING) / (CELL_SIZE + CELL_GAP));
  if (row < 0 || row >= state.n || col < 0 || col >= state.n) return null;
  return { row, col };
}

// ── 棋盘查询 ──
function colorExistsOnBoard(color) {
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      if (state.grid[r][c] === color) return true;
    }
  }
  return false;
}
