// ═══ 交互胶水层：事件绑定 · 调色板 · 验证 · 按钮 · 入口 ═══

// ── 调色板 UI ──
const swatchesEl = document.getElementById('swatches');

function buildSwatches() {
  swatchesEl.innerHTML = '';
  for (let i = 0; i < state.n; i++) {
    const div = document.createElement('div');
    div.className = 'swatch';
    div.style.background = paletteColors[i];
    div.dataset.colorIdx = i;
    div.title = '颜色 ' + (i + 1);
    div.addEventListener('click', () => {
      state.activeColor = i;
      state.isEraser = false;
      document.getElementById('btn-erase').classList.remove('is-active');
      updateSwatchUI();
    });
    swatchesEl.appendChild(div);
  }
  updateSwatchUI();
}

function updateSwatchUI() {
  const swatches = swatchesEl.querySelectorAll('.swatch');
  swatches.forEach(s => {
    const idx = parseInt(s.dataset.colorIdx);
    s.classList.toggle('active', idx === state.activeColor && !state.isEraser);
    s.classList.toggle('on-board', colorExistsOnBoard(idx));
  });
}

// ── 两点之间线段穿过的格子（超采样去重）──
function cellsOnLine(r1, c1, r2, c2) {
  const dist = Math.hypot(r2 - r1, c2 - c1);
  const steps = Math.max(1, Math.ceil(dist * 2));
  const seen = new Set();
  const result = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const r = Math.round(r1 + (r2 - r1) * t);
    const c = Math.round(c1 + (c2 - c1) * t);
    const key = r + ',' + c;
    if (!seen.has(key)) {
      seen.add(key);
      if (r >= 0 && r < state.n && c >= 0 && c < state.n)
        result.push([r, c]);
    }
  }
  return result;
}

// ── 画布事件：鼠标 ──
let painting = false;
let lastCell = null;

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || state.n === 0) return;
  painting = true;
  const cell = getCell(e);
  if (cell) {
    lastCell = cell;
    applyBoardEdit(cell.row, cell.col, state.isEraser ? -1 : state.activeColor);
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!painting || state.n === 0) return;
  const cell = getCell(e);
  if (!cell || !lastCell) return;
  const newVal = state.isEraser ? -1 : state.activeColor;
  let changed = false;
  for (const [r, c] of cellsOnLine(lastCell.row, lastCell.col, cell.row, cell.col)) {
    if (paintCellSilent(r, c, newVal)) changed = true;
  }
  if (changed) finalizeEdit();
  lastCell = cell;
});

canvas.addEventListener('mouseup', () => { painting = false; lastCell = null; });
canvas.addEventListener('mouseleave', () => { painting = false; lastCell = null; });

// ── 画布事件：右键擦除 ──
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (state.n === 0) return;
  const cell = getCell(e);
  if (cell && state.grid[cell.row][cell.col] !== -1) {
    applyBoardEdit(cell.row, cell.col, -1);
  }
});

// ── 画布事件：触屏 ──
canvas.addEventListener('touchstart', (e) => {
  if (state.n === 0) return;
  e.preventDefault();
  painting = true;
  const cell = getCell(e.touches[0]);
  if (cell) {
    lastCell = cell;
    applyBoardEdit(cell.row, cell.col, state.isEraser ? -1 : state.activeColor);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (!painting || state.n === 0) return;
  e.preventDefault();
  const cell = getCell(e.touches[0]);
  if (!cell || !lastCell) return;
  const newVal = state.isEraser ? -1 : state.activeColor;
  let changed = false;
  for (const [r, c] of cellsOnLine(lastCell.row, lastCell.col, cell.row, cell.col)) {
    if (paintCellSilent(r, c, newVal)) changed = true;
  }
  if (changed) finalizeEdit();
  lastCell = cell;
}, { passive: false });

canvas.addEventListener('touchend', () => { painting = false; lastCell = null; });

// ── 画布事件：滚轮换色 ──
canvas.addEventListener('wheel', (e) => {
  if (state.n === 0) return;
  e.preventDefault();
  state.activeColor = e.deltaY > 0
    ? (state.activeColor + 1) % state.n
    : (state.activeColor - 1 + state.n) % state.n;
  state.isEraser = false;
  document.getElementById('btn-erase').classList.remove('is-active');
  updateSwatchUI();
}, { passive: false });

// ── 按钮：生成棋盘 ──
document.getElementById('btn-generate').addEventListener('click', () => {
  const n = parseInt(document.getElementById('input-n').value, 10);
  if (isNaN(n) || n < 4 || n > 15) {
    setMessage('n 必须在 4~15 之间', 'err');
    return;
  }
  initGrid(n);
  generatePalette(n);
  buildSwatches();
  resizeCanvas();
  render();
  flashMessage(`${n}×${n} 棋盘已生成，请选择颜色涂色`);
  document.getElementById('btn-solve').disabled = false;
  document.getElementById('btn-erase').classList.remove('is-active');
  state.activeColor = 0;
  state.isEraser = false;
  updateSwatchUI();
});

// ── 按钮：清空 ──
document.getElementById('btn-clear').addEventListener('click', () => {
  if (state.n === 0) return;
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      state.grid[r][c] = -1;
    }
  }
  state.solution = null;
  state.appState = 'editing';
  document.getElementById('btn-solve').disabled = false;
  render();
  flashMessage('棋盘已清空');
});

// ── 按钮：擦除 ──
document.getElementById('btn-erase').addEventListener('click', function() {
  state.isEraser = !state.isEraser;
  this.classList.toggle('is-active', state.isEraser);
  updateSwatchUI();
});

// ── 输入框 n ──
const inputN = document.getElementById('input-n');
inputN.addEventListener('change', function() {
  let val = parseInt(this.value, 10);
  if (isNaN(val) || val < 4) this.value = 4;
  else if (val > 15) this.value = 15;
});
inputN.addEventListener('wheel', function(e) {
  if (document.activeElement !== this) return;
  e.preventDefault();
  let val = parseInt(this.value, 10) || 5;
  val += e.deltaY > 0 ? -1 : 1;
  this.value = Math.max(4, Math.min(15, val));
});

// ── 窗口缩放 ──
window.addEventListener('resize', () => {
  if (state.n > 0) render();
});

// ── 启动：预热 Worker ──
initWorker();
