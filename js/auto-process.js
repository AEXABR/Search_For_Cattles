// 涂色声音：600Hz 正弦波，80ms，Web Audio API 合成
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

// 连通性强制：每种颜色若被分割成多个连通块，只保留最大块，小块清空
function enforceConnectivity() {
  const DIRS = [[0,1],[0,-1],[1,0],[-1,0]];
  let changed = false;

  for (let color = 0; color < state.n; color++) {
    const visited = Array.from({ length: state.n }, () => Array(state.n).fill(false));
    const components = [];

    // BFS 找出该颜色的所有连通分量
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

    if (components.length <= 1) continue; // 已连通，跳过

    // 按大小降序，保留最大块，其余清空
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

// 包围自动填充：被单一颜色完全包围且不碰边缘的区域，自动变成该颜色
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

        // BFS 找同值连通分量，同时收集边界颜色、判断是否碰边
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
              touchesEdge = true; // 触边，不能被包围
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

        // 仅被一种颜色包围，不碰边，且包围色不等于自身 → 全部吃掉
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
