// 求解器：DFS 回溯 + Forward Checking + AC-3 预处理 + MAC + 动态 MRV + 动态 Degree + LCV，Web Worker 异步执行

let solverWorker = null;

// Web Worker 代码（字符串形式，通过 Blob URL 创建）
function getWorkerCode() {
  return `
	class Solver {
	  constructor(n, positionsByColor) {
	    this.n = n;
	    this.board = Array.from({ length: n }, () => Array(n).fill(0));

	    // 每种颜色的初始可选位置列表（深拷贝，后续前向检查会动态缩减）
	    this.initialAvailable = positionsByColor.map(arr =>
	      arr.map(p => [p[0], p[1]])
	    );

	    // 预计算每种颜色的度（与其他颜色候选的总冲突数），用于 MRV 平局打破
	    this.degree = new Array(n).fill(0);
	    for (let c = 0; c < n; c++) {
	      let deg = 0;
	      const listC = this.initialAvailable[c];
	      for (let d = 0; d < n; d++) {
	        if (c === d) continue;
	        const listD = this.initialAvailable[d];
	        for (const p1 of listC) {
	          for (const p2 of listD) {
	            if (this.#conflictsWith(p1[0], p1[1], p2[0], p2[1])) {
	              deg++;
	            }
	          }
	        }
	      }
	    this.degree[c] = deg;
	    }
	  }

	  // 检查 (x,y) 是否与已放置的牛 (px,py) 冲突
	  // 冲突条件: 同行 / 同列 / 四对角相邻
	  #conflictsWith(x, y, px, py) {
	    if (x === px || y === py) return true;
	    const dx = x - px;
	    const dy = y - py;
	    return (dx === 1 || dx === -1) && (dy === 1 || dy === -1);
	  }

	  // ── AC-3 弧一致性预处理 ──
	  // 在 DFS 前迭代删除所有弧不一致的候选值，削减初始搜索空间
	  #revise(xi, xj, available) {
	    let removed = false;
	    const listI = available[xi];
	    const listJ = available[xj];
	    let i = 0;
	    while (i < listI.length) {
	      const [x, y] = listI[i];
	      let hasSupport = false;
	      for (let j = 0; j < listJ.length; j++) {
	        const [px, py] = listJ[j];
	        if (!this.#conflictsWith(x, y, px, py)) {
          hasSupport = true;
          break;
	        }
	      }
	      if (!hasSupport) {
	        listI.splice(i, 1);
	        removed = true;
	      } else {
	        i++;
	      }
	    }
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

	  // ── MAC：在已放置变量的剩余域上运行 AC-3（跳过 placedMask 中的颜色）──
	  // 与 solve() 中的 AC-3 预处理不同：此处仅操作未放置颜色，每次 DFS 都调用。
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

	  // DFS + 前向检查 + 动态 MRV
	  // available[color] = 当前层各颜色仍可用的位置列表
	  // placedMask         = 位掩码标记已放置的颜色 (bit c = 1 表示颜色 c 已放)
	  #dfs(depth, available, placedMask) {
	    if (depth === this.n) return true;

	    // ── 动态 MRV + 动态 Degree 平局打破 ──
	    let bestColor = -1;
	    let bestCount = Infinity;
	    for (let c = 0; c < this.n; c++) {
	      if (placedMask & (1 << c)) continue;   // 已放置，跳过
	      const cnt = available[c].length;
	      if (cnt === 0) return false;            // 某颜色无候选格，死胡同
	      if (cnt === 1) { bestColor = c; break; } // 1 个候选不可能更优
	      if (cnt < bestCount) {
	        bestCount = cnt;
	        bestColor = c;
	      } else if (cnt === bestCount) {
	        // 动态 Degree：用当前 available 计算平局颜色的度，比静态度更精准
	        let degC = 0, degBest = 0;
	        for (let d = 0; d < this.n; d++) {
          if (d === c || (placedMask & (1 << d))) continue;
          const listC = available[c], listD = available[d];
          for (const p1 of listC) {
            for (const p2 of listD) {
              if (this.#conflictsWith(p1[0], p1[1], p2[0], p2[1])) degC++;
            }
          }
	        }
	        for (let d = 0; d < this.n; d++) {
          if (d === bestColor || (placedMask & (1 << d))) continue;
          const listB = available[bestColor], listD = available[d];
          for (const p1 of listB) {
            for (const p2 of listD) {
              if (this.#conflictsWith(p1[0], p1[1], p2[0], p2[1])) degBest++;
            }
          }
	        }
	        if (degC > degBest) {
          bestColor = c;
	        }
	      }
	    }

	    const candidates = available[bestColor];

	    // ── LCV：按对其他颜色的约束数升序排列（约束少的优先尝试）──
	    if (candidates.length > 1) {
	      candidates.sort((a, b) => {
	        let countA = 0, countB = 0;
	        for (let c = 0; c < this.n; c++) {
	          if (c === bestColor || (placedMask & (1 << c))) continue;
	          const list = available[c];
	          for (let j = 0; j < list.length; j++) {
	            if (this.#conflictsWith(list[j][0], list[j][1], a[0], a[1])) countA++;
	            if (this.#conflictsWith(list[j][0], list[j][1], b[0], b[1])) countB++;
	          }
	        }
	        return countA - countB;
	      });
	    }

	    for (let i = 0; i < candidates.length; i++) {
	      const x = candidates[i][0];
	      const y = candidates[i][1];

	      // ── 前向检查：把当前选择传播到所有未放置的颜色 ──
	      const nextAvailable = available.slice();
	      let deadEnd = false;

	      for (let c = 0; c < this.n && !deadEnd; c++) {
	        if (c === bestColor || (placedMask & (1 << c))) continue;
	        const oldList = available[c];
	        const newList = [];
	        for (let j = 0; j < oldList.length; j++) {
	          const ox = oldList[j][0];
	          const oy = oldList[j][1];
	          if (!this.#conflictsWith(ox, oy, x, y)) {
	            newList.push(oldList[j]);
	          }
	        }
	        if (newList.length === 0) {
	          deadEnd = true; // 某颜色无可用格 → 该候选不可行
	        }
	        nextAvailable[c] = newList;
	      }

	      if (deadEnd) continue; // 提前剪枝，试下一个候选

	      // ── MAC：在剩余未放置颜色上运行 AC-3 ──
	      const macPlacedMask = placedMask | (1 << bestColor);
	      if (!this.#mac(nextAvailable, macPlacedMask)) continue;

	      // 放置
	      this.board[x][y] = 1;

	      if (this.#dfs(depth + 1, nextAvailable, placedMask | (1 << bestColor))) return true;

	      // 回溯：仅需回退 board，available / placedMask 由调用栈自动恢复
	      this.board[x][y] = 0;
	    }
	    return false;
	  }

	  solve() {
	    // AC-3 预处理：在 DFS 前消除所有弧不一致的候选
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
