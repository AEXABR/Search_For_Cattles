// 求解器：DFS 回溯 + Forward Checking + AC-3 预处理 + MAC + 动态 MRV + 动态 Degree + LCV，Web Worker 异步执行

let solverWorker = null;

// Web Worker 代码（字符串形式，通过 Blob URL 创建）
function getWorkerCode() {
  return `
	class Solver {
	  constructor(n, positionsByColor) {
	    this.n = n;
	    this.board = Array.from({ length: n }, () => Array(n).fill(0));

	    // 给每个位置分配唯一索引
	    let idx = 0;
	    this.posR = [];
	    this.posC = [];
	    const initialAvailable = positionsByColor.map(arr =>
	      arr.map(p => {
	        this.posR.push(p[0]);
	        this.posC.push(p[1]);
	        return idx++;
	      })
	    );

	    const total = idx;

	    // 位→索引映射（O(1)）
	    const bitPos = new Map();
	    for (let i = 0; i < total; i++) {
	      bitPos.set(1n << BigInt(i), i);
	    }
	    this.bitPos = bitPos;

	    // 预计算冲突位集
	    this.conflictMask = new Array(total);
	    for (let i = 0; i < total; i++) {
	      const ri = this.posR[i], ci = this.posC[i];
	      let mask = 0n;
	      for (let j = 0; j < total; j++) {
	        if (i === j) continue;
	        const rj = this.posR[j], cj = this.posC[j];
	        if (ri === rj || ci === cj ||
	            (Math.abs(ri - rj) === 1 && Math.abs(ci - cj) === 1)) {
	          mask |= (1n << BigInt(j));
	        }
	      }
	      this.conflictMask[i] = mask;
	    }

	    // 非冲突位集（前向检查 O(1) 过滤）
	    this.nonConflictMask = new Array(total);
	    for (let i = 0; i < total; i++) {
	      this.nonConflictMask[i] = ~this.conflictMask[i];
	    }

	    // 初始域位集
	    this.initialMask = initialAvailable.map(arr => {
	      let mask = 0n;
	      for (const p of arr) mask |= (1n << BigInt(p));
	      return mask;
	    });

	    // 预计算每种颜色的度
	    this.degree = new Array(n).fill(0);
	    for (let c = 0; c < n; c++) {
	      let deg = 0;
	      const maskC = this.initialMask[c];
	      let m = maskC;
	      while (m) {
	        const lowBit = m & -m;
	        const p = bitPos.get(lowBit);
	        for (let d = 0; d < n; d++) {
	          if (c === d) continue;
	          let cross = this.conflictMask[p] & this.initialMask[d];
	          while (cross) { deg++; cross &= cross - 1n; }
	        }
	        m ^= lowBit;
	      }
	      this.degree[c] = deg;
	    }
	  }

	  #maskToArray(mask) {
	    const result = [];
	    while (mask) {
	      const lowBit = mask & -mask;
	      result.push(this.bitPos.get(lowBit));
	      mask ^= lowBit;
	    }
	    return result;
	  }

	  #popcount(mask) {
	    let count = 0;
	    while (mask) { mask &= mask - 1n; count++; }
	    return count;
	  }

	  #revise(xi, xj, available) {
	    const maskI = available[xi];
	    const maskJ = available[xj];
	    let newMask = maskI;
	    let m = maskI;
	    while (m) {
	      const lowBit = m & -m;
	      const p = this.bitPos.get(lowBit);
	      if ((this.conflictMask[p] & maskJ) === maskJ) {
	        newMask &= ~lowBit;
	      }
	      m ^= lowBit;
	    }
	    if (newMask !== maskI) {
	      available[xi] = newMask;
	      return true;
	    }
	    return false;
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
	        if (available[xi] === 0n) return false;
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
	        if (available[xi] === 0n) return false;
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
	      const cnt = this.#popcount(available[c]);
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

	    const candidates = this.#maskToArray(available[bestColor]);

	    // ── LCV ──
	    if (candidates.length > 1) {
	      candidates.sort((a, b) => {
	        let countA = 0, countB = 0;
	        for (let c = 0; c < this.n; c++) {
	          if (c === bestColor || (placedMask & (1 << c))) continue;
	          const maskC = available[c];
	          let cross = this.conflictMask[a] & maskC;
	          while (cross) { countA++; cross &= cross - 1n; }
	          cross = this.conflictMask[b] & maskC;
	          while (cross) { countB++; cross &= cross - 1n; }
	        }
	        return countA - countB;
	      });
	    }

	    for (let i = 0; i < candidates.length; i++) {
	      const chosen = candidates[i];
	      const r = this.posR[chosen], c = this.posC[chosen];

	      // ── 前向检查（位集 O(1) 过滤）──
	      const nextAvailable = new Array(this.n);
	      let deadEnd = false;
	      for (let col = 0; col < this.n && !deadEnd; col++) {
	        if (col === bestColor || (placedMask & (1 << col))) continue;
	        const newMask = available[col] & this.nonConflictMask[chosen];
	        if (newMask === 0n) {
	          deadEnd = true;
	        }
	        nextAvailable[col] = newMask;
	      }
	      if (deadEnd) continue;

	      // ── MAC：剩余颜色 > 3 时才跑 ──
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
	    const preprocessed = this.initialMask.slice();
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
