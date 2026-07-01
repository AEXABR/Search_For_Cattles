# 🐮 Search For Cattles

基于八皇后问题变种的浏览器交互式谜题——涂色划分棋盘，求解器自动找到每色一头牛的摆放方案。

纯前端，零依赖。

---

## 🚀 使用

### 在线体验

🌐 **[aexabr.github.io/Search_For_Cattles](https://aexabr.github.io/Search_For_Cattles/)**

### 本地运行

1. 克隆或[下载](https://github.com/aexabr/Search_For_Cattles/archive/refs/heads/main.zip)本项目
2. 浏览器打开 `index.html`

> 项目通过 `<script>` 标签加载同目录下的 JS/CSS，需保持完整文件夹结构。

---

## 🎮 玩法

1. 设置棋盘边长 n（4~15），点击「生成棋盘」
2. 选择颜色，左键拖拽涂色，将棋盘划分成 n 个彩色区域
3. **规则**：
   - 每种颜色的格子必须四方向连通（同色被分割时小块自动清除）
   - 被一种颜色完全包围的区域自动填充为该颜色
   - 所有格子必须涂满，颜色种类恰好为 n
4. 涂满后点击「求解」，棋盘上显示每色一头牛的摆放方案

## 🖱️ 操作

| 操作 | 方式 |
|------|------|
| 涂色 | 左键拖拽 |
| 擦除 | 点击"擦除"后拖拽，或右键单击 |
| 切换颜色 | 点击调色板 / 滚轮 |
| 调节边长 | 输入框滚轮 / 手动输入 |
| 求解 | 点击"求解" |
| 清空 | 点击"清空" |

---

## 🛠️ 技术

Canvas 2D 渲染，Web Worker 异步求解（DFS 回溯 + AC-3 + MAC + MRV + LCV）。

---

## 📁 项目结构

```
├── index.html
├── css/
│   └── style.css
└── js/
    ├── core.js     ← 常量、状态、Canvas 工具、消息
    ├── board.js    ← 渲染、涂色、连通性、包围填充、音效
    ├── solver.js   ← Web Worker 求解器
    └── app.js      ← 事件绑定、调色板、按钮
```
