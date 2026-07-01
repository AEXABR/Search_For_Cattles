// ═══ 棋盘操作层：渲染 · 涂色 · 连通性 · 包围填充 · 音效 ═══

// ── 音效 ──
let audioCtx = null;
let _dirtyColors = new Set();
let _editHadPaint = false;
let _rafId = null;

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
function enforceConnectivity(dirtySet) {
  let changed = false;
  const colors = dirtySet && dirtySet.size > 0
    ? [...dirtySet]
    : Array.from({length: state.n}, (_, i) => i);
  for (const color of colors) {
    const visited = Array.from({ length: state.n }, () => Array(state.n).fill(false));
    const components = [];
    for (let rr = 0; rr < state.n; rr++) {
      for (let cc = 0; cc < state.n; cc++) {
        if (state.grid[rr][cc] !== color || visited[rr][cc]) continue;
        const comp = [];
        const queue = [[rr, cc]];
        visited[rr][cc] = true;
        let head = 0;
        while (head < queue.length) {
          const [cr, cy] = queue[head++];
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

// ── 包围自动填充：每种颜色当围墙，从边缘 BFS 穿不过去的就是被它包围的 ──
function autoFill() {
  let changed = false;
  for (let color = 0; color < state.n; color++) {
    const visited = Array.from({ length: state.n }, () => Array(state.n).fill(false));
    const queue = [];

    // 从边缘非该颜色的格子出发
    for (let r = 0; r < state.n; r++) {
      for (let c = 0; c < state.n; c++) {
        if ((r === 0 || r === state.n - 1 || c === 0 || c === state.n - 1) &&
            state.grid[r][c] !== color && !visited[r][c]) {
          visited[r][c] = true;
          queue.push([r, c]);
        }
      }
    }

    // BFS：color 当墙，只能穿过非 color 的格子
    let head = 0;
    while (head < queue.length) {
      const [cr, cc] = queue[head++];
      for (const [dr, dc] of DIRS) {
        const nr = cr + dr, nc = cc + dc;
        if (nr >= 0 && nr < state.n && nc >= 0 && nc < state.n &&
            !visited[nr][nc] && state.grid[nr][nc] !== color) {
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }

    // 没被访问到的 = 被 color 包围，整块填掉
    for (let r = 0; r < state.n; r++) {
      for (let c = 0; c < state.n; c++) {
        if (!visited[r][c] && state.grid[r][c] !== color) {
          state.grid[r][c] = color;
          changed = true;
        }
      }
    }
  }
  return changed;
}

// ── 画布绘制（不含 updateSwatchUI）──
function drawBoard() {
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
}

// ── 完整渲染：画布 + 调色板 ──
function render() {
  drawBoard();
  updateSwatchUI();
}
// ── 涂色：轻量版（仅写 grid，返回 true 表示成功）──
// 用于拖拽画线时批量涂色，音效/闪烁/BFS/渲染在 finalizeEdit 统一执行
function paintCellSilent(row, col, newVal) {
  if (state.appState === 'solved') return false;
  if (state.grid[row][col] === newVal) return false;
  if (newVal !== -1 && !isAdjacentToColor(row, col, newVal) && colorExistsOnBoard(newVal)) return false;
  const oldVal = state.grid[row][col];
  state.grid[row][col] = newVal;
  if (oldVal !== -1) _dirtyColors.add(oldVal);
  if (newVal !== -1) { state.colorsOnBoard.add(newVal); _dirtyColors.add(newVal); _editHadPaint = true; }
  state.appState = 'editing';
  return true;
}

// ── rAF 批处理：拖拽中只积累变更，帧回调一次性收尾 ──
function scheduleFinalize() {
  if (_rafId === null) {
    _rafId = requestAnimationFrame(doFinalize);
  }
}

function doFinalize() {
  _rafId = null;
  const hint = document.getElementById('canvas-hint');
  if (hint) hint.style.opacity = '0';
  playClick();
  let loopChanged = true;
  let firstPass = true;
  while (loopChanged) {
    loopChanged = false;
    const scope = firstPass ? _dirtyColors : null;
    if (enforceConnectivity(scope)) { loopChanged = true; firstPass = false; }
    if (_editHadPaint && autoFill()) { loopChanged = true; firstPass = false; }
  }
  rebuildColorsOnBoard();
  render();
  _dirtyColors.clear();
  _editHadPaint = false;
}

function flushFinalize() {
  if (_rafId !== null) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
  if (_dirtyColors.size > 0) {
    doFinalize();
  }
}

// 单格涂色用（右键擦除等）—— 直接调两个
function applyBoardEdit(row, col, newVal) {
  if (paintCellSilent(row, col, newVal)) {
    scheduleFinalize();
  } else if (state.grid[row][col] !== newVal &&
             state.appState !== 'solved' &&
             newVal !== -1 && colorExistsOnBoard(newVal) &&
             !isAdjacentToColor(row, col, newVal)) {
    playClick();
    setMessage('此颜色在其他位置已有色块，无法在此创建不连通的新色块', 'err');
  }
}
