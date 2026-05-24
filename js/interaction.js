// 涂色交互：鼠标/触屏点击 + 拖拽 + 滚轮换色

let painting = false; // 拖拽状态

// 根据鼠标/触屏事件坐标反查命中的格子行列
function getCell(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;   // Canvas 像素与 CSS 显示的缩放比
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const col = Math.floor((mx - PADDING) / (CELL_SIZE + CELL_GAP));
  const row = Math.floor((my - PADDING) / (CELL_SIZE + CELL_GAP));
  if (row < 0 || row >= state.n || col < 0 || col >= state.n) return null;
  return { row, col };
}

// 检查 (row, col) 的四邻居中是否有颜色为 color 的格子
function isAdjacentToColor(row, col, color) {
  const DIRS = [[0,1],[0,-1],[1,0],[-1,0]];
  for (const [dr, dc] of DIRS) {
    const nr = row + dr, nc = col + dc;
    if (nr >= 0 && nr < state.n && nc >= 0 && nc < state.n &&
        state.grid[nr][nc] === color) {
      return true;
    }
  }
  return false;
}

// 检查 color 是否在棋盘上至少存在一个格子
function colorExistsOnBoard(color) {
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      if (state.grid[r][c] === color) return true;
    }
  }
  return false;
}

// 核心涂色逻辑：修改格子颜色 → 声音 → 连通检查 → 包围填充 → 重绘
function paintCell(row, col) {
  // 求解后再次编辑，先清除求解结果
  if (state.appState === 'solved') {
    state.solution = null;
    state.appState = 'editing';
    document.getElementById('btn-solve').disabled = true;
  }
  const newVal = state.isEraser ? -1 : state.activeColor;
  if (state.grid[row][col] === newVal) return; // 颜色没变，跳过

  // 禁止在某颜色已有色块的不相邻位置创建新色块
  if (newVal !== -1 && !isAdjacentToColor(row, col, newVal) && colorExistsOnBoard(newVal)) {
    setMessage('此颜色在其他位置已有色块，无法在此创建不连通的新色块', 'err');
    return;
  }

  state.grid[row][col] = newVal;
  state.appState = 'editing';
  document.getElementById('btn-solve').disabled = true;
  playClick();

  // 后处理循环：连通性 → 包围填充，直到棋盘稳定
  let loopChanged = true;
  while (loopChanged) {
    loopChanged = false;
    if (enforceConnectivity()) loopChanged = true;
    if (autoFill()) loopChanged = true;
  }
  render();
}

// ---- 鼠标事件 ----
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;   // 只响应左键
  if (state.n === 0) return;
  painting = true;
  const cell = getCell(e);
  if (cell) paintCell(cell.row, cell.col);
});

canvas.addEventListener('mousemove', (e) => {
  if (!painting || state.n === 0) return;
  const cell = getCell(e);
  if (cell) paintCell(cell.row, cell.col);
});

canvas.addEventListener('mouseup', () => { painting = false; });
canvas.addEventListener('mouseleave', () => { painting = false; }); // 鼠标移出 Canvas 停止拖拽

// ---- 触屏事件 ----
canvas.addEventListener('touchstart', (e) => {
  if (state.n === 0) return;
  e.preventDefault();
  painting = true;
  const cell = getCell(e.touches[0]);
  if (cell) paintCell(cell.row, cell.col);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (!painting || state.n === 0) return;
  e.preventDefault();
  const cell = getCell(e.touches[0]);
  if (cell) paintCell(cell.row, cell.col);
}, { passive: false });

canvas.addEventListener('touchend', () => { painting = false; });

// ---- 滚轮切换颜色 ----
canvas.addEventListener('wheel', (e) => {
  if (state.n === 0) return;
  e.preventDefault();
  if (e.deltaY > 0) {
    state.activeColor = (state.activeColor + 1) % state.n;      // 下滚 → 下一色
  } else {
    state.activeColor = (state.activeColor - 1 + state.n) % state.n; // 上滚 → 上一色
  }
  state.isEraser = false;
  document.getElementById('btn-erase').classList.remove('active');
  updateSwatchUI();
}, { passive: false });
