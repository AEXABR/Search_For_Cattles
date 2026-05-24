// 在底部消息栏显示文字，cls 可选 'ok' / 'err'
function setMessage(text, cls) {
  const el = document.getElementById('message');
  if (!el) { console.error('message element not found'); return; }
  el.textContent = text;
  el.className = 'message';
  if (cls) el.classList.add(cls);
}

let msgTimer = null;
// 短暂显示消息，300ms 后自动恢复为默认提示
function flashMessage(text, cls) {
  if (msgTimer) clearTimeout(msgTimer);
  setMessage(text, cls);
  msgTimer = setTimeout(() => {
    setMessage('选择颜色后在棋盘上拖拽涂色');
    msgTimer = null;
  }, 300);
}

// 全局状态中心：棋盘数据、当前工具、求解结果、状态机
const state = {
  n: 0,            // 棋盘边长
  grid: null,      // n×n 二维数组，-1=空，0..n-1=颜色索引
  activeColor: 0,  // 当前选中颜色
  isEraser: false, // 是否橡皮擦模式
  solution: null,  // 求解结果，null 或 n×n 的 0/1 数组
  appState: 'idle',// 状态机: idle → editing → validated → solved
};

// 初始化/重置棋盘为空
function initGrid(n) {
  state.n = n;
  state.grid = Array.from({ length: n }, () => Array(n).fill(-1));
  state.solution = null;
  state.appState = 'editing';
}
