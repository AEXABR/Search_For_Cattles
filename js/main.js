// 主入口：按钮绑定、初始化

// "生成棋盘"按钮
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
  document.getElementById('btn-erase').classList.remove('is-active');
  state.activeColor = 0;
  state.isEraser = false;
  updateSwatchUI();
});

// "清空"按钮：重置所有格子为空格
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

// n 输入框：限制范围 2~15
document.getElementById('input-n').addEventListener('change', function() {
  let val = parseInt(this.value, 10);
  if (isNaN(val) || val < 2) this.value = 2;
  else if (val > 15) this.value = 15;
});

// 窗口缩放时重新渲染（保持棋盘居中适应）
window.addEventListener('resize', () => {
  if (state.n > 0) render();
});

// 启动时预热 Web Worker
initWorker();
