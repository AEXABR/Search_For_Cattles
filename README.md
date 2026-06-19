# 🐮 Search For Cattles

一个基于抖音**佛系消消消**玩法的，在浏览器中创建和求解 "Cattles" 谜题的交互式网页应用。

纯前端，零依赖。

---

## 🚀 如何使用

### 方式一：在线体验（推荐）

直接打开 GitHub Pages 链接即可使用：

🌐 **[aexabr.github.io/Search_For_Cattles](https://aexabr.github.io/Search_For_Cattles/)**

无需安装任何东西，浏览器打开即玩。

### 方式二：本地 .html 文件

1. 克隆或[下载](https://github.com/aexabr/Search_For_Cattles/archive/refs/heads/main.zip)本项目
2. 解压后用浏览器直接打开 `index.html`

```
├── index.html          ← 双击这个文件即可
├── css/
│   └── style.css
└── js/
    ├── state.js
    ├── renderer.js
    ├── swatches.js
    ├── auto-process.js
    ├── interaction.js
    ├── validator.js
    ├── solver.js
    └── main.js
```

> 注意：项目通过 `<script>` 标签加载同目录下的 JS/CSS 文件，因此需要保持整个文件夹结构完整，不能只拷贝 `index.html`。

---

## 🎮 玩法

1. 📐 设置棋盘边长 n（4~15），点击「生成棋盘」生成 n×n 空白棋盘
2. 🎨 选择颜色，在棋盘上左键拖拽涂色，将棋盘划分成 n 个彩色区域
3. 📏 规则：
   - 每种颜色的格子必须四方向连通
   - 所有格子必须涂满
   - 颜色种类恰好为 n
   - 同色被分割时，小块自动清除；被完全包围的区域自动填充
4. ✅ 涂满后点击「验证拼图」检查合法性
5. 🔍 验证通过后点击「求解」，棋盘上显示每色一头牛的摆放方案

## 🖱️ 操作

| 操作        | 方式                        |
| ----------- | --------------------------- |
| 🎨 涂色     | 左键点击/拖拽               |
| 🧹 擦除     | 点击"擦除"按钮后拖拽        |
| 🔄 切换颜色 | 点击调色板 / 滚轮滚动       |
| 🔢 调节边长 | 点击输入框后滚轮 / 手动输入 |
| ✅ 验证拼图 | 点击"验证拼图"              |
| 🔍 求解     | 验证通过后点击"求解"        |
| 🗑️ 清空     | 点击"清空"                  |

## 🛠️ 技术

纯前端，零依赖。Canvas 2D 渲染，Web Worker 异步求解。

## 📁 项目结构

```
├── index.html          ← 入口页面
├── css/
│   └── style.css       ← 暗色主题样式
└── js/
    ├── state.js        ← 状态管理
    ├── renderer.js     ← Canvas 棋盘渲染
    ├── swatches.js     ← 调色板
    ├── auto-process.js ← 连通性检查 & 包围填充
    ├── interaction.js  ← 鼠标/触屏交互
    ├── validator.js    ← 拼图验证
    ├── solver.js       ← 求解器 (Web Worker)
    └── main.js         ← 初始化 & 按钮绑定
```
