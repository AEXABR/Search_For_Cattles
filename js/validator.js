// 拼图验证：检查三条件 —— 无空格、恰好 n 色、每种颜色连通

function validate() {
  const { n, grid } = state;
  if (n === 0) return { ok: false, msg: '请先生成棋盘' };

  // 条件 1：所有格子已涂色
  const usedColors = new Set();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] === -1) {
        return { ok: false, msg: `格子 (${r+1}, ${c+1}) 未涂色` };
      }
      usedColors.add(grid[r][c]);
    }
  }

  // 条件 2：恰好使用 n 种颜色
  if (usedColors.size !== n) {
    return { ok: false, msg: `使用了 ${usedColors.size} 种颜色，需要恰好 ${n} 种` };
  }

  // 条件 3：每种颜色四方向连通（BFS）
  const DIRS = [[0,1],[0,-1],[1,0],[-1,0]];
  for (let color = 0; color < n; color++) {
    let startR = -1, startC = -1;
    let totalCount = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r][c] === color) {
          totalCount++;
          if (startR === -1) { startR = r; startC = c; }
        }
      }
    }
    if (totalCount === 0) {
      return { ok: false, msg: `颜色 ${color + 1} 未出现在棋盘上` };
    }

    // BFS 从第一个该颜色的格子出发
    const visited = Array.from({ length: n }, () => Array(n).fill(false));
    const queue = [[startR, startC]];
    visited[startR][startC] = true;
    let bfsCount = 0;
    while (queue.length > 0) {
      const [r, c] = queue.shift();
      bfsCount++;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n &&
            !visited[nr][nc] && grid[nr][nc] === color) {
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }

    if (bfsCount !== totalCount) {
      return { ok: false, msg: `颜色 ${color + 1} 的格子不连通（${bfsCount}/${totalCount} 格可到达）` };
    }
  }

  return { ok: true, msg: '✓ 验证通过！拼图合法，可以求解' };
}

// 验证按钮：通过后解锁求解按钮
document.getElementById('btn-validate').addEventListener('click', () => {
  const result = validate();
  if (result.ok) {
    state.appState = 'validated';
    document.getElementById('btn-solve').disabled = false;
    setMessage(result.msg, 'ok');
  } else {
    state.appState = 'editing';
    document.getElementById('btn-solve').disabled = true;
    setMessage(result.msg, 'err');
  }
});
