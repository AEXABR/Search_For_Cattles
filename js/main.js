// === Generate Grid ===
document.getElementById('btn-generate').addEventListener('click', () => {
  const n = parseInt(document.getElementById('input-n').value, 10);
  if (isNaN(n) || n < 2 || n > 15) {
    setMessage('n 必须在 2~15 之间', 'err');
    return;
  }
  initGrid(n);
  generatePalette(n);
  buildSwatches();
  resizeCanvas();
  render();
  flashMessage(`${n}×${n} 棋盘已生成，请选择颜色涂色`);
  document.getElementById('btn-solve').disabled = true;
  document.getElementById('btn-erase').classList.remove('active');
  state.activeColor = 0;
  state.isEraser = false;
  updateSwatchUI();
});

// === Clear ===
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

// === Input validation ===
document.getElementById('input-n').addEventListener('change', function() {
  let val = parseInt(this.value, 10);
  if (isNaN(val) || val < 2) this.value = 2;
  else if (val > 15) this.value = 15;
});

// === Resize ===
window.addEventListener('resize', () => {
  if (state.n > 0) render();
});

// === Initialize ===
initWorker();
