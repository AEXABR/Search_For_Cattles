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

// ── 拼图验证 ──
function validate() {
  const { n, grid } = state;
  if (n === 0) return { ok: false, msg: '请先生成棋盘' };

  const usedColors = new Set();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] === -1) {
        return { ok: false, msg: `格子 (${r+1}, ${c+1}) 未涂色` };
      }
      usedColors.add(grid[r][c]);
    }
  }

  if (usedColors.size !== n) {
    return { ok: false, msg: `使用了 ${usedColors.size} 种颜色，需要恰好 ${n} 种` };
  }

  for (let color = 0; color < n; color++) {
    let startR = -1, startC = -1;
    let totalCount = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r][c] === color) {
          totalCount++;
          if (startR === -1) { startR = r; startC = c; }
        }
      }
    }
    if (totalCount === 0) {
      return { ok: false, msg: `颜色 ${color + 1} 未出现在棋盘上` };
    }

    const visited = Array.from({ length: n }, () => Array(n).fill(false));
    const queue = [[startR, startC]];
    visited[startR][startC] = true;
    let bfsCount = 0;
    while (queue.length > 0) {
      const [r, c] = queue.shift();
      bfsCount++;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n &&
            !visited[nr][nc] && grid[nr][nc] === color) {
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }

    if (bfsCount !== totalCount) {
      return { ok: false, msg: `颜色 ${color + 1} 的格子不连通（${bfsCount}/${totalCount} 格可到达）` };
    }
  }

  return { ok: true, msg: '✓ 验证通过！拼图合法，可以求解' };
}

// ── 画布事件：鼠标 ──
let painting = false;

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || state.n === 0) return;
  painting = true;
  const cell = getCell(e);
  if (cell) applyBoardEdit(cell.row, cell.col, state.isEraser ? -1 : state.activeColor);
});

canvas.addEventListener('mousemove', (e) => {
  if (!painting || state.n === 0) return;
  const cell = getCell(e);
  if (cell) applyBoardEdit(cell.row, cell.col, state.isEraser ? -1 : state.activeColor);
});

canvas.addEventListener('mouseup', () => { painting = false; });
canvas.addEventListener('mouseleave', () => { painting = false; });

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
  if (cell) applyBoardEdit(cell.row, cell.col, state.isEraser ? -1 : state.activeColor);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (!painting || state.n === 0) return;
  e.preventDefault();
  const cell = getCell(e.touches[0]);
  if (cell) applyBoardEdit(cell.row, cell.col, state.isEraser ? -1 : state.activeColor);
}, { passive: false });

canvas.addEventListener('touchend', () => { painting = false; });

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
  document.getElementById('btn-solve').disabled = true;
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
  document.getElementById('btn-solve').disabled = true;
  render();
  flashMessage('棋盘已清空');
});

// ── 按钮：验证 ──
document.getElementById('btn-validate').addEventListener('click', () => {
  const result = validate();
  if (result.ok) {
    state.appState = 'validated';
    document.getElementById('btn-solve').disabled = false;
    setMessage(result.msg, 'ok');
  } else {
    state.appState = 'editing';
    document.getElementById('btn-solve').disabled = true;
    setMessage(result.msg, 'err');
  }
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
