// ═══ 棋盘操作层：渲染 · 涂色 · 连通性 · 包围填充 · 音效 ═══

// ── 音效 ──
let audioCtx = null;
function playClick() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.value = 600;
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.08);
}

// ── 邻居检查 ──
function isAdjacentToColor(row, col, color) {
  for (const [dr, dc] of DIRS) {
    const nr = row + dr, nc = col + dc;
    if (nr >= 0 && nr < state.n && nc >= 0 && nc < state.n &&
        state.grid[nr][nc] === color) {
      return true;
    }
  }
  return false;
}

// ── 连通性强制 ──
function enforceConnectivity() {
  let changed = false;
  for (let color = 0; color < state.n; color++) {
    const visited = Array.from({ length: state.n }, () => Array(state.n).fill(false));
    const components = [];
    for (let rr = 0; rr < state.n; rr++) {
      for (let cc = 0; cc < state.n; cc++) {
        if (state.grid[rr][cc] !== color || visited[rr][cc]) continue;
        const comp = [];
        const queue = [[rr, cc]];
        visited[rr][cc] = true;
        while (queue.length > 0) {
          const [cr, cy] = queue.shift();
          comp.push([cr, cy]);
          for (const [dr, dc] of DIRS) {
            const nr = cr + dr, nc = cy + dc;
            if (nr >= 0 && nr < state.n && nc >= 0 && nc < state.n &&
                state.grid[nr][nc] === color && !visited[nr][nc]) {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            }
          }
        }
        components.push(comp);
      }
    }
    if (components.length <= 1) continue;
    components.sort((a, b) => b.length - a.length);
    for (let i = 1; i < components.length; i++) {
      for (const [rr, cc] of components[i]) {
        state.grid[rr][cc] = -1;
        changed = true;
      }
    }
  }
  return changed;
}

// ── 包围自动填充 ──
function autoFill() {
  let outerChanged = true, anyChanged = false;
  while (outerChanged) {
    outerChanged = false;
    const visited = Array.from({ length: state.n }, () => Array(state.n).fill(false));
    for (let r = 0; r < state.n; r++) {
      for (let c = 0; c < state.n; c++) {
        if (visited[r][c]) continue;
        const cellVal = state.grid[r][c];
        const component = [];
        const queue = [[r, c]];
        visited[r][c] = true;
        const borderColors = new Set();
        let touchesEdge = false;
        while (queue.length > 0) {
          const [cr, cc] = queue.shift();
          component.push([cr, cc]);
          for (const [dr, dc] of DIRS) {
            const nr = cr + dr, nc = cc + dc;
            if (nr < 0 || nr >= state.n || nc < 0 || nc >= state.n) {
              touchesEdge = true;
              continue;
            }
            if (state.grid[nr][nc] === cellVal) {
              if (!visited[nr][nc]) {
                visited[nr][nc] = true;
                queue.push([nr, nc]);
              }
            } else {
              borderColors.add(state.grid[nr][nc]);
            }
          }
        }
        if (!touchesEdge && borderColors.size === 1) {
          const fillColor = [...borderColors][0];
          if (fillColor !== -1 && fillColor !== cellVal) {
            for (const [cr, cc] of component) {
              state.grid[cr][cc] = fillColor;
            }
            outerChanged = true;
            anyChanged = true;
          }
        }
      }
    }
  }
  return anyChanged;
}

// ── 主渲染 ──
function render() {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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

  updateSwatchUI();
}

// ── 统一涂色入口 ──
// newVal: 颜色索引（涂色）或 -1（擦除）
function applyBoardEdit(row, col, newVal) {
  const hint = document.getElementById('canvas-hint');
  if (hint) hint.style.opacity = '0';

  if (state.appState === 'solved') return;  // 求解后锁定棋盘，需清空才能编辑

  if (state.grid[row][col] === newVal) return;

  if (newVal !== -1 && !isAdjacentToColor(row, col, newVal) && colorExistsOnBoard(newVal)) {
    setMessage('此颜色在其他位置已有色块，无法在此创建不连通的新色块', 'err');
    return;
  }

  state.grid[row][col] = newVal;
  state.appState = 'editing';
  playClick();

  let loopChanged = true;
  while (loopChanged) {
    loopChanged = false;
    if (enforceConnectivity()) loopChanged = true;
    if (autoFill()) loopChanged = true;
  }
  render();
}
