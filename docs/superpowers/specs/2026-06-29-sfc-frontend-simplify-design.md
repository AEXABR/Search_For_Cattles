# #SFC 前端代码简化设计

## 目标

将当前 8 个 JS 文件重组为 4 个，消除重复代码，统一后处理逻辑。

## 当前问题

1. `DIRS` 常量在 3 个文件中重复定义 4 次
2. `paintCell()` 与右键擦除各自实现相同的"连通性→包围填充"后处理循环
3. `auto-process.js` 命名不准确（混入了音效函数 `playClick()`）
4. `colorExistsOnBoard()` 在 `interaction.js` 定义却被 `swatches.js` 调用，形成隐式跨文件依赖
5. `interaction.js` 职责过重：事件绑定 + 坐标转换 + 涂色逻辑 + 邻居检查

## 新文件结构

```
js/
  core.js      ← 常量 + 状态 + Canvas 工具 + 消息 + 坐标转换（共享基础层）
  board.js     ← 渲染 + 涂色 + 连通性/包围 + 音效 + 邻居检查（棋盘操作层）
  app.js       ← 事件绑定 + 调色板 + 验证 + 按钮 + 入口初始化（交互胶水层）
  solver.js    ← 不变
```

加载顺序：`core.js` → `board.js` → `app.js` → `solver.js`

## 各文件内容

### core.js — 共享基础层

| 类别 | 内容 |
|------|------|
| 常量 | `DIRS`, `CELL_SIZE`, `CELL_GAP`, `CELL_RADIUS`, `PADDING`, `BG_COLOR`, `EMPTY_COLOR`, `EMPTY_STROKE` |
| Canvas 引用 | `canvas`, `ctx`, `paletteColors`, `generatePalette()`, `canvasTotal()`, `resizeCanvas()`, `cellRect()` |
| 状态 | `state` 对象, `initGrid(n)` |
| 消息 | `setMessage()`, `flashMessage()`, `msgTimer` |
| 工具函数 | `getCell(e)`, `colorExistsOnBoard(color)` |

### board.js — 棋盘操作层

| 类别 | 内容 |
|------|------|
| 渲染 | `render()` |
| 涂色核心 | `applyBoardEdit(row, col, newVal)` — 统一涂色和擦除的后处理逻辑 |
| 连通性 | `enforceConnectivity()` |
| 包围填充 | `autoFill()` |
| 邻居检查 | `isAdjacentToColor()` |
| 音效 | `playClick()` |

### app.js — 交互胶水层

| 类别 | 内容 |
|------|------|
| 调色板 | `buildSwatches()`, `updateSwatchUI()` |
| 验证 | `validate()` |
| 事件 | 鼠标/触屏/滚轮/右键 |
| 按钮 | generate, clear, validate, solve, erase |
| 初始化 | `initWorker()` 预热 |

### solver.js — 不变

## 关键简化点

### 1. `applyBoardEdit()` 统一后处理

```
左键涂色     → applyBoardEdit(row, col, state.isEraser ? -1 : state.activeColor)
右键擦除     → applyBoardEdit(row, col, -1)
擦除按钮涂色  → applyBoardEdit(row, col, -1)   [如果未来需要]
```

内部流程：
1. 清除求解结果（如处于 solved 状态）
2. 检查相邻约束（仅对新涂色，非擦除）
3. 更新 grid
4. 播放音效
5. 循环执行连通性强制 + 包围填充直到稳定
6. 触发渲染

### 2. DIRS 统一定义

从 `core.js` 导出/全局声明，`board.js` 和 `app.js` 直接引用。

### 3. 消除隐式依赖

`colorExistsOnBoard()` 移至 `core.js`，`render()` 不再调用 `updateSwatchUI()`，由调用方（app.js 中的事件处理器）自行调用。

## 不变项

- HTML 结构不变
- CSS 不变
- solver.js worker 代码不变
- 外部 API（函数签名）保持兼容
- 用户可见行为完全一致
