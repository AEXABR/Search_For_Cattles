// 求解器：DFS 回溯 + Forward Checking + AC-3 预处理 + MAC + 动态 MRV + 动态 Degree + LCV，Web Worker 异步执行

let solverWorker = null;

// Web Worker 代码（字符串形式，通过 Blob URL 创建）
function getWorkerCode() {
  return `
	class Solver {
	  constructor(n, positionsByColor) {
	    this.n = n;
	    this.board = Array.from({ length: n }, () => Array(n).fill(0));

	    // 给每个位置分配唯一索引，预计算冲突矩阵
	    let idx = 0;
	    this.posR = [];
	    this.posC = [];
	    this.initialAvailable = positionsByColor.map(arr =>
	      arr.map(p => {
	        this.posR.push(p[0]);
	        this.posC.push(p[1]);
	        return idx++;
	      })
	    );

	    const total = idx;
	    this.conflict = new Array(total);
	    for (let i = 0; i < total; i++) {
	      const ri = this.posR[i], ci = this.posC[i];
	      const row = new Array(total).fill(false);
	      for (let j = 0; j < total; j++) {
	        if (i === j) continue;
	        const rj = this.posR[j], cj = this.posC[j];
	        if (ri === rj || ci === cj ||
	            (Math.abs(ri - rj) === 1 && Math.abs(ci - cj) === 1)) {
	          row[j] = true;
	        }
	      }
	      this.conflict[i] = row;
	    }

	    // 预计算每种颜色的度
	    this.degree = new Array(n).fill(0);
	    for (let c = 0; c < n; c++) {
	      let deg = 0;
	      const listC = this.initialAvailable[c];
	      for (let d = 0; d < n; d++) {
	        if (c === d) continue;
	        const listD = this.initialAvailable[d];
	        for (const p1 of listC) {
	          for (const p2 of listD) {
	            if (this.conflict[p1][p2]) deg++;
	          }
	        }
	      }
	      this.degree[c] = deg;
	    }
	  }

	  // 冲突查表 O(1)
	  #conflictsWith(p1, p2) {
	    return this.conflict[p1][p2];
	  }

	  #revise(xi, xj, available) {
	    let removed = false;
	    const listI = available[xi];
	    const listJ = available[xj];
	    const kept = [];
	    for (let i = 0; i < listI.length; i++) {
	      const p = listI[i];
	      let hasSupport = false;
	      for (let j = 0; j < listJ.length; j++) {
	        if (!this.conflict[p][listJ[j]]) {
	          hasSupport = true;
	          break;
	        }
	      }
	      if (hasSupport) {
	        kept.push(p);
	      } else {
	        removed = true;
	      }
	    }
	    if (removed) available[xi] = kept;
	    return removed;
	  }

	  #ac3(available) {
	    const queue = [];
	    for (let i = 0; i < this.n; i++) {
	      for (let j = 0; j < this.n; j++) {
	        if (i !== j) queue.push([i, j]);
	      }
	    }
	    while (queue.length > 0) {
	      const [xi, xj] = queue.pop();
	      if (this.#revise(xi, xj, available)) {
	        if (available[xi].length === 0) return false;
	        for (let xk = 0; xk < this.n; xk++) {
	          if (xk !== xi && xk !== xj) {
	            queue.push([xk, xi]);
	          }
	        }
	      }
	    }
	    return true;
	  }

	  #mac(available, placedMask) {
	    const queue = [];
	    for (let i = 0; i < this.n; i++) {
	      if (placedMask & (1 << i)) continue;
	      for (let j = 0; j < this.n; j++) {
	        if (i === j || (placedMask & (1 << j))) continue;
	        queue.push([i, j]);
	      }
	    }
	    while (queue.length > 0) {
	      const [xi, xj] = queue.pop();
	      if (this.#revise(xi, xj, available)) {
	        if (available[xi].length === 0) return false;
	        for (let xk = 0; xk < this.n; xk++) {
	          if (xk !== xi && xk !== xj && !(placedMask & (1 << xk))) {
	            queue.push([xk, xi]);
	          }
	        }
	      }
	    }
	    return true;
	  }

	  #dfs(depth, available, placedMask) {
	    if (depth === this.n) return true;

	    // ── 动态 MRV + 静态 Degree 平局打破 ──
	    let bestColor = -1;
	    let bestCount = Infinity;
	    for (let c = 0; c < this.n; c++) {
	      if (placedMask & (1 << c)) continue;
	      const cnt = available[c].length;
	      if (cnt === 0) return false;
	      if (cnt === 1) { bestColor = c; break; }
	      if (cnt < bestCount) {
	        bestCount = cnt;
	        bestColor = c;
	      } else if (cnt === bestCount) {
	        if (this.degree[c] > this.degree[bestColor]) {
	          bestColor = c;
	        }
	      }
	    }

	    const candidates = available[bestColor];

	    // ── LCV ──
	    if (candidates.length > 1) {
	      candidates.sort((a, b) => {
	        let countA = 0, countB = 0;
	        for (let c = 0; c < this.n; c++) {
	          if (c === bestColor || (placedMask & (1 << c))) continue;
	          const list = available[c];
	          for (let j = 0; j < list.length; j++) {
	            if (this.conflict[list[j]][a]) countA++;
	            if (this.conflict[list[j]][b]) countB++;
	          }
	        }
	        return countA - countB;
	      });
	    }

	    for (let i = 0; i < candidates.length; i++) {
	      const chosen = candidates[i];
	      const r = this.posR[chosen], c = this.posC[chosen];

	      // ── 前向检查 ──
	      const nextAvailable = new Array(this.n);
	      let deadEnd = false;
	      for (let col = 0; col < this.n && !deadEnd; col++) {
	        if (col === bestColor || (placedMask & (1 << col))) continue;
	        const oldList = available[col];
	        const newList = [];
	        for (let j = 0; j < oldList.length; j++) {
	          if (!this.conflict[oldList[j]][chosen]) {
	            newList.push(oldList[j]);
	          }
	        }
	        if (newList.length === 0) {
	          deadEnd = true;
	        }
	        nextAvailable[col] = newList;
	      }
	      if (deadEnd) continue;

	      // ── MAC：剩余颜色 > 3 时才跑，否则前向检查足够 ──
	      const macPlacedMask = placedMask | (1 << bestColor);
	      if (this.n - depth > 3) {
	        if (!this.#mac(nextAvailable, macPlacedMask)) continue;
	      }

	      // 放置
	      this.board[r][c] = 1;
	      if (this.#dfs(depth + 1, nextAvailable, macPlacedMask)) return true;
	      this.board[r][c] = 0;
	    }
	    return false;
	  }

	  solve() {
	    const preprocessed = this.initialAvailable.map(arr => arr.slice());
	    if (!this.#ac3(preprocessed)) return false;
	    return this.#dfs(0, preprocessed, 0);
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
let _workerBlobUrl = null;

function initWorker() {
  if (solverWorker) solverWorker.terminate();
  if (typeof Worker === 'undefined') {
    console.warn('Web Worker not supported');
    solverWorker = null;
    return;
  }
  if (!_workerBlobUrl) {
    const blob = new Blob([getWorkerCode()], { type: 'application/javascript' });
    _workerBlobUrl = URL.createObjectURL(blob);
  }
  solverWorker = new Worker(_workerBlobUrl);
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
  if (state.n === 0) return;
  if (!solverWorker) initWorker();
  if (!solverWorker) {
    setMessage('浏览器不支持 Web Worker', 'err');
    return;
  }

  // 客户端快速校验
  const regions = buildRegions();
  const usedColors = new Set();
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      if (state.grid[r][c] === -1) {
        setMessage('请先涂满所有格子', 'err');
        return;
      }
      usedColors.add(state.grid[r][c]);
    }
  }
  if (usedColors.size !== state.n) {
    setMessage(`需要使用恰好 ${state.n} 种颜色，当前 ${usedColors.size} 种`, 'err');
    return;
  }

  setMessage('求解中...', 'info');
  document.getElementById('btn-solve').disabled = true;

  solverWorker.onmessage = function(e) {
    const { type, board, timeMs } = e.data;
    if (type === 'solution') {
      state.solution = board;
      state.appState = 'solved';
      render();
      setMessage('✓ 已找到一特解！耗时 ' + timeMs + 'ms', 'ok');
    } else if (type === 'no-solution') {
      document.getElementById('btn-solve').disabled = false;
      setMessage('此拼图无解，请调整颜色布局', 'err');
    } else if (type === 'timeout') {
      document.getElementById('btn-solve').disabled = false;
      setMessage('求解超时（30秒），请尝试更小的 n 或调整布局', 'err');
    }
  };

  solverWorker.onerror = function(err) {
    document.getElementById('btn-solve').disabled = false;
    setMessage('求解器错误: ' + err.message, 'err');
  };

  solverWorker.postMessage({ type: 'solve', n: state.n, regions });
});
