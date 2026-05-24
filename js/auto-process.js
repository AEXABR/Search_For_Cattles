// === Sound ===
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

// === Enforce same-color cells stay connected ===
function enforceConnectivity() {
  const DIRS = [[0,1],[0,-1],[1,0],[-1,0]];
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

// === Auto-fill Surrounded Regions ===
function autoFill() {
  const DIRS = [[0,1],[0,-1],[1,0],[-1,0]];
  let changed = true;
  while (changed) {
    changed = false;
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
            changed = true;
          }
        }
      }
    }
  }
  return changed;
}
