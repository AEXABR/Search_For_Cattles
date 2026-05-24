// === Canvas Renderer ===
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const CELL_SIZE = 48;
const CELL_GAP = 3;
const CELL_RADIUS = 4;
const PADDING = 4;

let paletteColors = [];

function generatePalette(n) {
  paletteColors = [];
  for (let i = 0; i < n; i++) {
    const hue = (i * 360 / n) % 360;
    paletteColors.push(`hsl(${hue}, 70%, 60%)`);
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

function render() {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      const { x, y, w, h } = cellRect(r, c);
      const colorIdx = state.grid[r][c];
      const isCattle = state.solution && state.solution[r][c] === 1;

      ctx.beginPath();
      const rad = CELL_RADIUS;
      ctx.moveTo(x + rad, y);
      ctx.lineTo(x + w - rad, y);
      ctx.arcTo(x + w, y, x + w, y + rad, rad);
      ctx.lineTo(x + w, y + h - rad);
      ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
      ctx.lineTo(x + rad, y + h);
      ctx.arcTo(x, y + h, x, y + h - rad, rad);
      ctx.lineTo(x, y + rad);
      ctx.arcTo(x, y, x + rad, y, rad);
      ctx.closePath();
      if (colorIdx === -1) {
        ctx.fillStyle = '#cdd6f4';
      } else {
        ctx.fillStyle = paletteColors[colorIdx];
      }
      ctx.fill();

      if (isCattle) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }

  if (state.solution) {
    for (let r = 0; r < state.n; r++) {
      for (let c = 0; c < state.n; c++) {
        if (state.solution[r][c] === 1) {
          const { x, y, w, h } = cellRect(r, c);
          const fontSize = Math.max(16, w * 0.55);
          ctx.font = `${fontSize}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🐮', x + w / 2, y + h / 2);
        }
      }
    }
  }
}
