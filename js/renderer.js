// Canvas 2D 棋盘渲染

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const CELL_SIZE = 48;
const CELL_GAP = 4;
const CELL_RADIUS = 5;
const PADDING = 6;

const BG_COLOR = '#1e1e30';       // 棋盘背景（深色）
const EMPTY_COLOR = '#2a2a42';     // 空格子颜色
const EMPTY_STROKE = '#3a3a58';    // 空格子边框

let paletteColors = [];  // HSL 颜色字符串数组

// 用 HSL 生成 n 种高饱和、中等亮度颜色（适配暗色背景）
function generatePalette(n) {
  paletteColors = [];
  for (let i = 0; i < n; i++) {
    const hue = (i * 360 / n) % 360;
    paletteColors.push(`hsl(${hue}, 78%, 58%)`);
  }
}

// 计算 Canvas 总像素尺寸
function canvasTotal() {
  if (state.n === 0) return 0;
  return CELL_SIZE * state.n + CELL_GAP * (state.n - 1) + PADDING * 2;
}

// 设置 Canvas 的实际像素和 CSS 显示尺寸
function resizeCanvas() {
  if (state.n === 0) return;
  const total = canvasTotal();
  canvas.width = total;
  canvas.height = total;
  canvas.style.width = total + 'px';
  canvas.style.height = total + 'px';
}

// 给定行列，返回该格子在 Canvas 上的坐标和尺寸
function cellRect(row, col) {
  const x = PADDING + col * (CELL_SIZE + CELL_GAP);
  const y = PADDING + row * (CELL_SIZE + CELL_GAP);
  return { x, y, w: CELL_SIZE, h: CELL_SIZE };
}

// 主渲染：画所有格子 + 解标记（🐮 图标 + 白边框）
function render() {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 棋盘底色
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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
        ctx.fillStyle = EMPTY_COLOR;
        ctx.fill();
        ctx.strokeStyle = EMPTY_STROKE;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = paletteColors[colorIdx];
        ctx.fill();
      }

      if (isCattle) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }

  // 叠加 🐮 图标（在格子填充之后，保证置顶）
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
