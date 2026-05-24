// 调色板 UI：颜色方块 + 橡皮擦按钮

const swatchesEl = document.getElementById('swatches');

// 根据当前 n 重建颜色方块列表
function buildSwatches() {
  swatchesEl.innerHTML = '';
  for (let i = 0; i < state.n; i++) {
    const div = document.createElement('div');
    div.className = 'swatch';
    div.style.background = paletteColors[i];
    div.dataset.colorIdx = i;
    div.addEventListener('click', () => {
      state.activeColor = i;
      state.isEraser = false;
      document.getElementById('btn-erase').classList.remove('active');
      updateSwatchUI();
    });
    swatchesEl.appendChild(div);
  }
  updateSwatchUI();
}

// 更新选中态：当前颜色方块加白边框，橡皮擦模式下取消选中
function updateSwatchUI() {
  const swatches = swatchesEl.querySelectorAll('.swatch');
  swatches.forEach(s => {
    const idx = parseInt(s.dataset.colorIdx);
    s.classList.toggle('active', idx === state.activeColor && !state.isEraser);
  });
}

// 橡皮擦按钮：切换擦除/涂色模式
document.getElementById('btn-erase').addEventListener('click', function() {
  state.isEraser = !state.isEraser;
  this.classList.toggle('active', state.isEraser);
  updateSwatchUI();
});

// 动态注入橡皮擦激活态的 CSS
const eraserStyle = document.createElement('style');
eraserStyle.textContent = '.btn-muted.active { background: #585b70; box-shadow: inset 0 0 0 2px #fff; }';
document.head.appendChild(eraserStyle);
