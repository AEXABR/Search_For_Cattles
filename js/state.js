// 消息栏：根据类型切换样式
function setMessage(text, type) {
  const el = document.getElementById('message');
  if (!el) return;
  el.textContent = text;
  el.className = 'message';
  // type: 'default' | 'ok' | 'err' | 'info'
  el.classList.add('message-' + (type || 'default'));
  // flash animation
  el.classList.remove('message-flash');
  void el.offsetWidth; // reflow trigger
  el.classList.add('message-flash');
}

let msgTimer = null;
// 短暂显示消息后恢复默认提示
function flashMessage(text, type) {
  if (msgTimer) clearTimeout(msgTimer);
  setMessage(text, type);
  msgTimer = setTimeout(() => {
    setMessage('选择颜色后在棋盘上拖拽涂色');
    msgTimer = null;
  }, 400);
}

// 全局状态
const state = {
  n: 0,
  grid: null,
  activeColor: 0,
  isEraser: false,
  solution: null,
  appState: 'idle', // idle → editing → validated → solved
};

function initGrid(n) {
  state.n = n;
  state.grid = Array.from({ length: n }, () => Array(n).fill(-1));
  state.solution = null;
  state.appState = 'editing';
  // 显示棋盘提示文字
  const hint = document.getElementById('canvas-hint');
  if (hint) hint.style.opacity = '0.6';
}
