// 求解器：JS 移植自 Solver.h，BigInt 位掩码，Web Worker 异步执行

let solverWorker = null;

// Web Worker 代码（字符串形式，通过 Blob URL 创建）
function getWorkerCode() {
  return `
const dx = [-1, -1, 1, 1];  // 四个对角方向
const dy = [-1, 1, -1, 1];

class Solver {
  constructor(n, positionsByColor) {
    this.n = n;
    this.positionsByColor = positionsByColor; // 每种颜色的可选位置列表
    this.usedRow = 0n;  // BigInt 位掩码：已占用的行
    this.usedCol = 0n;  // BigInt 位掩码：已占用的列
    this.board = Array.from({ length: n }, () => Array(n).fill(0));

    // 按可选位置数升序排列颜色（小区域优先，剪枝效果好）
    this.colorOrder = Array.from({ length: n }, (_, i) => i);
    this.colorOrder.sort((a, b) =>
      positionsByColor[a].length - positionsByColor[b].length
    );
  }

  // 检查 (x,y) 能否放牛：行未用、列未用、四对角无牛
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

  // DFS 回溯：逐颜色尝试每个可选位置
  dfs(depth) {
    if (depth === this.n) return true; // 全部颜色各放了一头牛

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

      // 回溯
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

  // 30 秒超时保护
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

// 创建/重建 Web Worker
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
  URL.revokeObjectURL(url); // 创建后立即释放 Blob URL
}

// 从当前棋盘状态构建每种颜色的位置列表
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

// 求解按钮
document.getElementById('btn-solve').addEventListener('click', () => {
  if (state.appState !== 'validated') return;
  if (!solverWorker) initWorker();
  if (!solverWorker) {
    setMessage('浏览器不支持 Web Worker', 'err');
    return;
  }

  setMessage('求解中...', 'info');
  document.getElementById('btn-solve').disabled = true;

  const regions = buildRegions();

  solverWorker.onmessage = function(e) {
    const { type, board, timeMs } = e.data;
    if (type === 'solution') {
      state.solution = board;
      state.appState = 'solved';
      render();
      setMessage('✓ 已找到一特解！耗时 ' + timeMs + 'ms', 'ok');
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
