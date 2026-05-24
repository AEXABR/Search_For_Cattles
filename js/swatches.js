// === Color Swatches ===
const swatchesEl = document.getElementById('swatches');

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

function updateSwatchUI() {
  const swatches = swatchesEl.querySelectorAll('.swatch');
  swatches.forEach(s => {
    const idx = parseInt(s.dataset.colorIdx);
    s.classList.toggle('active', idx === state.activeColor && !state.isEraser);
  });
}

// Eraser button
document.getElementById('btn-erase').addEventListener('click', function() {
  state.isEraser = !state.isEraser;
  this.classList.toggle('active', state.isEraser);
  updateSwatchUI();
});
const eraserStyle = document.createElement('style');
eraserStyle.textContent = '.btn-muted.active { background: #585b70; box-shadow: inset 0 0 0 2px #fff; }';
document.head.appendChild(eraserStyle);
