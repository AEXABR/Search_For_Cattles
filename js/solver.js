// 求解器：DFS 回溯 + Forward Checking，BigInt 位掩码，Web Worker 异步执行

let solverWorker = null;

// Web Worker 代码（字符串形式，通过 Blob URL 创建）
function getWorkerCode() {
  return `
	class Solver {
	  constructor(n, positionsByColor) {
	    this.n = n;
	    this.board = Array.from({ length: n }, () => Array(n).fill(0));

	    // 每种颜色的初始可选位置列表（深拷贝，后续前向检查会动态缩减）
	    const initialAvailable = positionsByColor.map(arr =>
	      arr.map(p => [p[0], p[1]])
	    );

	    // MRV 启发式：按可选位置数升序排列颜色（小区域优先）
	    this.colorOrder = Array.from({ length: n }, (_, i) => i);
	    this.colorOrder.sort((a, b) =>
	      initialAvailable[a].length - initialAvailable[b].length
	    );

	    this.initialAvailable = initialAvailable;
	  }

	  // 检查 (x,y) 是否与已放置的牛 (px,py) 冲突
	  // 冲突条件: 同行 / 同列 / 四对角相邻
	  conflictsWith(x, y, px, py) {
	    if (x === px || y === py) return true;
	    const dx = x - px;
	    const dy = y - py;
	    return (dx === 1 || dx === -1) && (dy === 1 || dy === -1);
	  }

	  // DFS + 前向检查
	  // available[color] = 递归到当前层时该颜色仍可用的位置列表
	  dfs(depth, available) {
	    if (depth === this.n) return true;

	    const color = this.colorOrder[depth];
	    const candidates = available[color];

	    for (let i = 0; i < candidates.length; i++) {
	      const x = candidates[i][0];
	      const y = candidates[i][1];

	      // ── 前向检查：把当前选择传播到所有未放置的颜色 ──
	      const nextAvailable = available.slice();
	      let deadEnd = false;

	      for (let d = depth + 1; d < this.n && !deadEnd; d++) {
	        const otherColor = this.colorOrder[d];
	        const oldList = available[otherColor];
	        const newList = [];
	        for (let j = 0; j < oldList.length; j++) {
	          const ox = oldList[j][0];
	          const oy = oldList[j][1];
	          if (!this.conflictsWith(ox, oy, x, y)) {
	            newList.push(oldList[j]);
	          }
	        }
	        if (newList.length === 0) {
	          deadEnd = true; // 某颜色无可用格 → 该候选不可行
	        }
	        nextAvailable[otherColor] = newList;
	      }

	      if (deadEnd) continue; // 提前剪枝，试下一个候选

	      // 放置
	      this.board[x][y] = 1;

	      if (this.dfs(depth + 1, nextAvailable)) return true;

	      // 回溯：仅需回退 board，available 由调用栈自动恢复
	      this.board[x][y] = 0;
	    }
	    return false;
	  }

	  solve() {
	    return this.dfs(0, this.initialAvailable);
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

	  if (solver.solve()) {
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
