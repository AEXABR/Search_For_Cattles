// === Solver Worker ===
let solverWorker = null;

function getWorkerCode() {
  return `
const dx = [-1, -1, 1, 1];
const dy = [-1, 1, -1, 1];

class Solver {
  constructor(n, positionsByColor) {
    this.n = n;
    this.positionsByColor = positionsByColor;
    this.usedRow = 0n;
    this.usedCol = 0n;
    this.board = Array.from({ length: n }, () => Array(n).fill(0));

    this.colorOrder = Array.from({ length: n }, (_, i) => i);
    this.colorOrder.sort((a, b) =>
      positionsByColor[a].length - positionsByColor[b].length
    );
  }

  canPlace(x, y) {
    if ((this.usedRow >> BigInt(x)) & 1n) return false;
    if ((this.usedCol >> BigInt(y)) & 1n) return false;
    for (let k = 0; k < 4; k++) {
      const nx = x + dx[k];
      const ny = y + dy[k];
      if (nx >= 0 && nx < this.n && ny >= 0 && ny < this.n && this.board[nx][ny] === 1) {
        return false;
      }
    }
    return true;
  }

  dfs(depth) {
    if (depth === this.n) return true;

    const color = this.colorOrder[depth];
    const positions = this.positionsByColor[color];

    for (let i = 0; i < positions.length; i++) {
      const x = positions[i][0];
      const y = positions[i][1];

      if (!this.canPlace(x, y)) continue;

      const rowBit = 1n << BigInt(x);
      const colBit = 1n << BigInt(y);

      this.usedRow |= rowBit;
      this.usedCol |= colBit;
      this.board[x][y] = 1;

      if (this.dfs(depth + 1)) return true;

      this.board[x][y] = 0;
      this.usedRow &= ~rowBit;
      this.usedCol &= ~colBit;
    }
    return false;
  }
}

self.onmessage = function(e) {
  const { n, regions } = e.data;
  const positionsByColor = regions.map(reg =>
    reg.map(pos => [pos.x, pos.y])
  );

  const solver = new Solver(n, positionsByColor);
  const start = performance.now();

  const timeout = setTimeout(() => {
    self.postMessage({ type: 'timeout' });
  }, 30000);

  if (solver.dfs(0)) {
    clearTimeout(timeout);
    const elapsed = (performance.now() - start).toFixed(1);
    self.postMessage({ type: 'solution', board: solver.board, timeMs: parseFloat(elapsed) });
  } else {
    clearTimeout(timeout);
    self.postMessage({ type: 'no-solution' });
  }
};
`;
}

function initWorker() {
  if (solverWorker) solverWorker.terminate();
  if (typeof Worker === 'undefined') {
    console.warn('Web Worker not supported');
    solverWorker = null;
    return;
  }
  const blob = new Blob([getWorkerCode()], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  solverWorker = new Worker(url);
  URL.revokeObjectURL(url);
}

function buildRegions() {
  const regions = Array.from({ length: state.n }, () => []);
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      const color = state.grid[r][c];
      if (color >= 0 && color < state.n) {
        regions[color].push({ x: r, y: c });
      }
    }
  }
  return regions;
}

// === Solve ===
document.getElementById('btn-solve').addEventListener('click', () => {
  if (state.appState !== 'validated') return;
  if (!solverWorker) initWorker();
  if (!solverWorker) {
    setMessage('浏览器不支持 Web Worker', 'err');
    return;
  }

  setMessage('求解中...', '');
  document.getElementById('btn-solve').disabled = true;

  const regions = buildRegions();

  solverWorker.onmessage = function(e) {
    const { type, board, timeMs } = e.data;
    if (type === 'solution') {
      state.solution = board;
      state.appState = 'solved';
      render();
      setMessage('✓ 已找到唯一解！耗时 ' + timeMs + 'ms', 'ok');
    } else if (type === 'no-solution') {
      state.appState = 'validated';
      document.getElementById('btn-solve').disabled = false;
      setMessage('此拼图无解，请调整颜色布局', 'err');
    } else if (type === 'timeout') {
      state.appState = 'validated';
      document.getElementById('btn-solve').disabled = false;
      setMessage('求解超时（30秒），请尝试更小的 n 或调整布局', 'err');
    }
  };

  solverWorker.onerror = function(err) {
    state.appState = 'validated';
    document.getElementById('btn-solve').disabled = false;
    setMessage('求解器错误: ' + err.message, 'err');
  };

  solverWorker.postMessage({ type: 'solve', n: state.n, regions });
});
