// === Paint Interaction ===
let painting = false;

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

function colorExistsOnBoard(color) {
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      if (state.grid[r][c] === color) return true;
    }
  }
  return false;
}

function paintCell(row, col) {
  if (state.appState === 'solved') {
    state.solution = null;
    state.appState = 'editing';
    document.getElementById('btn-solve').disabled = true;
  }
  const newVal = state.isEraser ? -1 : state.activeColor;
  if (state.grid[row][col] === newVal) return;

  if (newVal !== -1 && !isAdjacentToColor(row, col, newVal) && colorExistsOnBoard(newVal)) {
    setMessage('此颜色在其他位置已有色块，无法在此创建不连通的新色块', 'err');
    return;
  }

  state.grid[row][col] = newVal;
  state.appState = 'editing';
  document.getElementById('btn-solve').disabled = true;
  playClick();
  let loopChanged = true;
  while (loopChanged) {
    loopChanged = false;
    if (enforceConnectivity()) loopChanged = true;
    if (autoFill()) loopChanged = true;
  }
  render();
}

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
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
canvas.addEventListener('mouseleave', () => { painting = false; });

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

// === Mouse wheel: cycle colors ===
canvas.addEventListener('wheel', (e) => {
  if (state.n === 0) return;
  e.preventDefault();
  if (e.deltaY > 0) {
    state.activeColor = (state.activeColor + 1) % state.n;
  } else {
    state.activeColor = (state.activeColor - 1 + state.n) % state.n;
  }
  state.isEraser = false;
  document.getElementById('btn-erase').classList.remove('active');
  updateSwatchUI();
}, { passive: false });
