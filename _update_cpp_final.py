import sys

with open('solver.cpp', 'r', encoding='utf-8') as f:
    c = f.read()

def replace(old, new, label):
    global c
    if old not in c:
        print(f'  FAIL: {label} — pattern not found')
        # show context
        idx = c.find(old[:30]) if len(old) >= 30 else c.find(old)
        if idx >= 0:
            print(f'    Found partial at {idx}:', repr(c[idx:idx+80]))
        return False
    c = c.replace(old, new, 1)
    print(f'  OK: {label}')
    return True

ok = 0
total = 0

# 1. 版本号
total += 1
if replace(' *   v1.5  + MAC 完整弧一致 (DFS 中传播) + 动态 Degree (当前域计算)',
           ' *   v1.5  + MAC 完整弧一致 (DFS 中传播) + 动态 Degree (当前域计算)\n'
           ' *   v1.6  + 冲突矩阵预计算 + 算法门控 (AC-3/MAC/LCV 自适应开关)',
           'version v1.5->v1.6'): ok += 1

# 2. include
total += 1
if replace('#include <cstdint>\n#include <iostream>\n#include <numeric>\n#include <vector>',
           '#include <cstdint>\n#include <iostream>\n#include <numeric>\n#include <unordered_map>\n#include <vector>',
           'add <unordered_map>'): ok += 1

# 3. PosIdx
total += 1
if replace('using Pos = pair<int, int>;\t\t\t  // (行, 列)\nusing Candidates = vector<Pos>;',
           'using Pos = pair<int, int>;\t\t\t  // (行, 列)\nusing PosIdx = int;\t\t\t\t  // 位置唯一索引（冲突矩阵下标）\nusing Candidates = vector<Pos>;',
           'add PosIdx'): ok += 1

# 4. 构造函数：插入冲突矩阵预计算
total += 1
if replace('degree_[c] = deg;\n\t\t\t}\n\t\t}',
           'degree_[c] = deg;\n\t\t\t}\n'
           '\n'
           '\t\t\t// ── 位置索引 + 冲突矩阵预计算 ──\n'
           '\t\t\t// 给每个位置分配唯一索引，预计算 O(1) 冲突查表。\n'
           '\t\t\t// JS 版用 BigInt 位集；C++ 用 vector<bool> 等价于 bitmap。\n'
           '\t\t\ttotal_pos_ = 0;\n'
           '\t\t\tfor (int c = 0; c < n; ++c)\n'
           '\t\t\t\ttotal_pos_ += (int)initial_available_[c].size();\n'
           '\n'
           '\t\t\tpos_r_.resize(total_pos_);\n'
           '\t\t\tpos_c_.resize(total_pos_);\n'
           '\t\t\tint idx = 0;\n'
           '\t\t\tfor (int c = 0; c < n; ++c) {\n'
           '\t\t\t\tfor (const auto &[r, col] : initial_available_[c]) {\n'
           '\t\t\t\t\tpos_r_[idx] = r;\n'
           '\t\t\t\t\tpos_c_[idx] = col;\n'
           '\t\t\t\t\tpos_to_idx_[Pos(r, col)] = idx;\n'
           '\t\t\t\t\tidx++;\n'
           '\t\t\t\t}\n'
           '\t\t\t}\n'
           '\n'
           '\t\t\t// 预计算冲突矩阵: conflict_[i][j] = 位置 i 与 j 是否冲突\n'
           '\t\t\tconflict_.assign(total_pos_, vector<bool>(total_pos_, false));\n'
           '\t\t\tfor (int i = 0; i < total_pos_; ++i) {\n'
           '\t\t\t\tint ri = pos_r_[i], ci = pos_c_[i];\n'
           '\t\t\t\tfor (int j = 0; j < total_pos_; ++j) {\n'
           '\t\t\t\t\tif (i == j) continue;\n'
           '\t\t\t\t\tint rj = pos_r_[j], cj = pos_c_[j];\n'
           '\t\t\t\t\tif (ri == rj || ci == cj ||\n'
           '\t\t\t\t\t    (abs(ri - rj) == 1 && abs(ci - cj) == 1))\n'
           '\t\t\t\t\t\tconflict_[i][j] = true;\n'
           '\t\t\t\t}\n'
           '\t\t\t}\n'
           '\t\t}',
           'ctor: conflict matrix precompute'): ok += 1

# 5. conflictsByIdx
total += 1
if replace('return dx == 1 && dy == 1; // 四对角相邻\n\t}',
           'return dx == 1 && dy == 1; // 四对角相邻\n\t}\n\n'
           '\t\t// ── 基于预计算冲突矩阵的 O(1) 查询 ──\n'
           '\t\tbool conflictsByIdx(int i, int j) const {\n'
           '\t\t\treturn conflict_[i][j];\n'
           '\t\t}',
           'conflictsByIdx helper'): ok += 1

# 6. revise: 使用冲突矩阵
total += 1
if replace('auto [x, y] = *it;\n\t\t\t\tbool has_support = false;\n\t\t\t\tfor (const auto &[px, py] : listJ)\n\t\t\t\t{\n\t\t\t\t\tif (!conflictsWith(x, y, px, py))',
           'auto [x, y] = *it;\n'
           '\t\t\t\tint idxI = pos_to_idx_.at(Pos(x, y));\n'
           '\t\t\t\tbool has_support = false;\n'
           '\t\t\t\tfor (const auto &[px, py] : listJ)\n'
           '\t\t\t\t{\n'
           '\t\t\t\t\tint idxJ = pos_to_idx_.at(Pos(px, py));\n'
           '\t\t\t\t\tif (!conflict_[idxI][idxJ])',
           'revise: use conflict matrix'): ok += 1

# 7. solve: AC-3 gate
total += 1
if replace('bool solve()\n\t\t{\n\t\t\tAvailable preprocessed = initial_available_;\n\t\t\tif (!ac3(preprocessed))\n\t\t\t\treturn false;\n\t\t\treturn dfs(0, move(preprocessed), 0);\n\t\t}',
           '// AC-3 门控：n<10 或平均域>20 时跳过（小板开销比例高，大域收益薄）\n'
           '\tbool solve()\n'
           '\t\t{\n'
           '\t\t\tAvailable preprocessed = initial_available_;\n'
           '\t\t\tbool run_ac3 = (n_ >= 10);\n'
           '\t\t\tif (run_ac3) {\n'
           '\t\t\t\tint total_pos = 0;\n'
           '\t\t\t\tfor (int c = 0; c < n_; ++c)\n'
           '\t\t\t\t\ttotal_pos += (int)preprocessed[c].size();\n'
           '\t\t\t\tif ((double)total_pos / n_ > 20.0)\n'
           '\t\t\t\t\trun_ac3 = false;\n'
           '\t\t\t}\n'
           '\t\t\tif (run_ac3 && !ac3(preprocessed))\n'
           '\t\t\t\treturn false;\n'
           '\t\t\treturn dfs(0, move(preprocessed), 0);\n'
           '\t\t}',
           'solve: AC-3 gate'): ok += 1

# 8. mac: changedColors + smart queue
total += 1
old_mac = ('bool mac(Available &available, uint32_t placed_mask)\n'
           '\t\t{\n'
           '\t\t\tvector<pair<int, int>> queue;\n'
           '\t\t\tfor (int i = 0; i < n_; ++i)\n'
           '\t\t\t{\n'
           '\t\t\t\tif (placed_mask & (1u << i))\n'
           '\t\t\t\t\tcontinue;\n'
           '\t\t\t\tfor (int j = 0; j < n_; ++j)\n'
           '\t\t\t\t{\n'
           '\t\t\t\t\tif (i == j || (placed_mask & (1u << j)))\n'
           '\t\t\t\t\t\tcontinue;\n'
           '\t\t\t\t\tqueue.push_back({i, j});\n'
           '\t\t\t\t}\n'
           '\t\t\t}')
new_mac = ('// changedColors: 前向检查中域发生变化的颜色，仅从这些出发入队。\n'
           '\tbool mac(Available &available, uint32_t placed_mask,\n'
           '\t         const vector<int> &changed_colors)\n'
           '\t\t{\n'
           '\t\t\t// 只从域变更颜色出发入队弧，而非全部 O(k^2) 对\n'
           '\t\t\tvector<pair<int, int>> queue;\n'
           '\t\t\tfor (int xi : changed_colors) {\n'
           '\t\t\t\tif (placed_mask & (1u << xi)) continue;\n'
           '\t\t\t\tfor (int xk = 0; xk < n_; ++xk) {\n'
           '\t\t\t\t\tif (xk == xi || (placed_mask & (1u << xk)))\n'
           '\t\t\t\t\t\tcontinue;\n'
           '\t\t\t\t\tqueue.push_back({xk, xi});\n'
           '\t\t\t\t}\n'
           '\t\t\t}')
if replace(old_mac, new_mac, 'mac: changedColors + smart queue'): ok += 1

# 9. LCV gate
total += 1
if replace('//   两者作用在不同决策维度，恰是 CSP 搜索的黄金组合。\n\t\t\tif (candidates.size() > 1)',
           '//   两者作用在不同决策维度，恰是 CSP 搜索的黄金组合。\n'
           '\t\t\t// LCV 门控：候选数 > n*3 时跳过（排序开销超过收益）\n'
           '\t\t\tif (candidates.size() > 1 && (int)candidates.size() <= n_ * 3)',
           'LCV gate'): ok += 1

# 10. FC: changed_colors declaration
total += 1
if replace('Available next_available = available;\n\t\t\t\tbool dead_end = false;',
           'Available next_available = available;\n'
           '\t\t\t\tbool dead_end = false;\n'
           '\t\t\t\tvector<int> changed_colors; // MAC 智能队列用',
           'FC: changed_colors decl'): ok += 1

# 11. FC: use conflict matrix
total += 1
if replace('if (!conflictsWith(ox, oy, x, y))\n\t\t\t\t\t\t{\n\t\t\t\t\t\t\tnew_list.push_back({ox, oy}); // 不冲突，保留\n\t\t\t\t\t\t}',
           'int idx_o = pos_to_idx_.at(Pos(ox, oy));\n'
           '\t\t\t\t\tint idx_new = pos_to_idx_.at(Pos(x, y));\n'
           '\t\t\t\t\tif (!conflict_[idx_o][idx_new])\n'
           '\t\t\t\t\t\t{\n'
           '\t\t\t\t\t\t\tnew_list.push_back({ox, oy}); // 不冲突，保留\n'
           '\t\t\t\t\t\t}',
           'FC: conflict matrix'): ok += 1

# 12. FC: record changed colors
total += 1
if replace('next_available[c] = move(new_list);\n\t\t\t\t}',
           'if ((int)new_list.size() < (int)old_list.size())\n'
           '\t\t\t\t\tchanged_colors.push_back(c);\n'
           '\t\t\t\tnext_available[c] = move(new_list);\n'
           '\t\t\t\t}',
           'FC: record changed colors'): ok += 1

# 13. MAC gate
total += 1
if replace('// ── MAC：在剩余未放置颜色上运行 AC-3 ──\n\t\t\t\tuint32_t mac_mask = placed_mask | (1u << best_color);\n\t\t\t\tif (!mac(next_available, mac_mask))\n\t\t\t\t\tcontinue; // 某未放置颜色候选清空 → 剪枝',
           '// ── MAC：仅 n>=9 且剩余<=4 色时才跑（否则前向检查足够）──\n'
           '\t\t\t\tuint32_t mac_mask = placed_mask | (1u << best_color);\n'
           '\t\t\t\tbool run_mac = (n_ >= 9 && n_ - depth <= 4);\n'
           '\t\t\t\tif (run_mac && !mac(next_available, mac_mask, changed_colors))\n'
           '\t\t\t\t\tcontinue; // 某未放置颜色候选清空 → 剪枝',
           'MAC gate'): ok += 1

# 14. 新成员变量
total += 1
old_mem = ('int n_;\n'
           '\tvector<vector<int>> board_;\t  // board_[r][c] = 1 表示有牛\n'
           '\tAvailable initial_available_; // 初始候选列表 (不变)\n'
           '\tvector<int> degree_;')
new_mem = ('// ── 冲突矩阵预计算（JS 位集优化的 C++ 等价）──\n'
           '\tint total_pos_ = 0;\t\t\t  // 所有颜色的候选位置总数\n'
           '\tvector<int> pos_r_, pos_c_;\t\t  // pos_r_[i] = 位置 i 的行/列\n'
           '\tvector<vector<bool>> conflict_;\t  // conflict_[i][j] = i 与 j 是否冲突\n'
           '\n'
           '\t// pair<int,int> 的哈希（unordered_map 需要）\n'
           '\tstruct pair_hash {\n'
           '\t\tsize_t operator()(const Pos &p) const {\n'
           '\t\treturn hash<int>()(p.first) ^ (hash<int>()(p.second) << 16);\n'
           '\t}\n'
           '\t};\n'
           '\tunordered_map<Pos, int, pair_hash> pos_to_idx_; // (r,c) -> 位置索引\n'
           '\n'
           '\tint n_;\n'
           '\tvector<vector<int>> board_;\t  // board_[r][c] = 1 表示有牛\n'
           '\tAvailable initial_available_; // 初始候选列表 (不变)\n'
           '\tvector<int> degree_;')
if replace(old_mem, new_mem, 'new member vars'): ok += 1

with open('solver.cpp', 'w', encoding='utf-8', newline='') as f:
    f.write(c)

print(f'\nResult: {ok}/{total} replacements applied')
