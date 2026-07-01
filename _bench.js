// 求解器算法收益基准测试
const fs = require('fs');
const code = fs.readFileSync('js/solver.js', 'utf-8');
const start = code.indexOf('return `') + 9;
const end = code.indexOf('`;', start);
const base = code.slice(start, end);

function makeVariant(name) {
  let w = base;
  switch (name) {
    case 'noAC3':
      // 跳过 AC-3 预处理
      w = w.replace(
        /const preprocessed = this\.initialMask\.slice\(\);\n\s*if \(!this\.#ac3\(preprocessed\)\) return false;\n\s*const trail = \[\];\n\s*return this\.#dfs\(0, preprocessed, 0, trail\);/,
        'const preprocessed = this.initialMask.slice();\n\t    const trail = [];\n\t    return this.#dfs(0, preprocessed, 0, trail);'
      );
      break;
    case 'noMAC':
      // 永远跳过 MAC
      w = w.replace(
        'if (this.n - depth <= 3 || this.#mac(available, macPlacedMask, trail, changedColors)) {',
        'if (true) {'
      );
      break;
    case 'noLCV':
      // 跳过 LCV 排序
      w = w.replace(
        'if (candidates.length > 1) {',
        'if (false && candidates.length > 1) {'
      );
      break;
    case 'noDegree':
      // 去掉 degree 平局打破：把 else-if 分支整个删掉
      w = w.replace(
        "} else if (cnt === bestCount) {\n\t        if (this.degree[c] > this.degree[bestColor]) {\n\t          bestColor = c;\n\t        }\n\t      }",
        "}"
      );
      break;
    case 'macAlways':
      // MAC 始终运行
      w = w.replace(
        'if (this.n - depth <= 3 || this.#mac(available, macPlacedMask, trail, changedColors)) {',
        'if (this.#mac(available, macPlacedMask, trail, changedColors)) {'
      );
      break;
    default: break; // 'full' — no changes
  }
  // 转为可 eval 的代码
  w = w.replace('self.onmessage = function(e) {', 'function __run(e) {')
       .replace(/self\.postMessage/g, 'postMessage');
  return w;
}

const variantNames = ['full', 'noAC3', 'noMAC', 'noLCV', 'noDegree', 'macAlways'];
const variants = {};

for (const v of variantNames) {
  try {
    const w = makeVariant(v);
    new Function(w); // 语法检查
    eval(w + `\n;variants["${v}"] = Solver;`);
  } catch(e) {
    console.log(`${v}: COMPILE ERROR — ${e.message}`);
  }
}

// 测试用例生成
function rowPerColor(n) {
  return Array.from({length: n}, (_, i) =>
    Array.from({length: n}, (_, j) => [i, j])
  );
}
function colPerColor(n) {
  return Array.from({length: n}, (_, i) =>
    Array.from({length: n}, (_, j) => [j, i])
  );
}
function maxDomain(n) {
  const all = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      all.push([r, c]);
  return Array.from({length: n}, () => all.slice());
}

function bench(SolverFn, n, pbc, trials) {
  let total = 0, solved = 0;
  for (let t = 0; t < trials; t++) {
    const s = new SolverFn(n, pbc);
    const t0 = process.hrtime.bigint();
    if (s.solve()) solved++;
    total += Number(process.hrtime.bigint() - t0) / 1e6; // ms
  }
  return { ms: total / trials, solved };
}

const cases = [
  ['row', rowPerColor],
  ['col', colPerColor],
  ['max', maxDomain],
];

console.log('=== 各算法开关对比（avg ms，+X% = 比 full 慢，-X% = 比 full 快）===\n');

for (let n = 3; n <= 12; n++) {
  for (const [caseName, genFn] of cases) {
    // 跳过无意义组合
    if (n === 12 && caseName === 'max') continue; // 太慢

    const pbc = genFn(n);
    const trials = n <= 5 ? 100 : (n <= 8 ? 30 : 10);

    const results = {};
    for (const v of variantNames) {
      if (!variants[v]) { results[v] = null; continue; }
      results[v] = bench(variants[v], n, pbc, trials);
    }

    const fullMs = results.full ? results.full.ms : 1;
    const parts = [`${n}x${n} ${caseName}`.padEnd(11)];
    for (const v of variantNames) {
      if (!results[v]) { parts.push('  ERR  '); continue; }
      const ms = results[v].ms;
      const diff = v === 'full' ? 0 : ((ms - fullMs) / fullMs * 100);
      let mark;
      if (v === 'full') mark = ' ';
      else if (diff > 20) mark = '!';      // 明显变慢
      else if (diff > 5) mark = '+';       // 略微变慢
      else if (diff < -20) mark = '*';     // 明显变快（关闭后反而快）
      else if (diff < -5) mark = '-';      // 略微变快
      else mark = '~';                      // 基本持平
      parts.push((ms.toFixed(1)+'ms').padStart(7) + mark);
    }
    console.log(parts.join(' '));
  }
  console.log('');
}
