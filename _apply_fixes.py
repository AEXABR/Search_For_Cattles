import sys

with open('solver.cpp', 'r', encoding='utf-8') as f:
    c = f.read()

def apply(old, new, label):
    global c
    if old not in c:
        print(f'FAIL: {label}')
        return False
    c = c.replace(old, new, 1)
    print(f'  OK: {label}')
    return True

ok = 0

# ─── 1. version line ───
ok += apply(' *   v1.5  + MAC',
            ' *   v1.6  + 冲突矩阵预计算 + 算法门控 (AC-3/MAC/LCV 自适应开关)\n *   v1.5  + MAC',
            'version')

# ─── 2. include ───
ok += apply('#include <numeric>\n#include <vector>',
            '#include <numeric>\n#include <unordered_map>\n#include <vector>',
            'include')

# ─── 3. PosIdx ───
ok += apply('using Pos = pair<int, int>;\t\t\t  // (行, 列)\nusing Candidates = vector<Pos>;',
            'using Pos = pair<int, int>;\t\t\t  // (行, 列)\nusing PosIdx = int;\t\t\t\t  // 位置唯一索引（冲突矩阵下标）\nusing Candidates = vector<Pos>;',
            'PosIdx')

# ─── 4. Constructor: add conflict matrix precomputation AFTER degree loop ───
old_ctor_tail = ('\t\t\tdegree_[c] = deg;\n'
                 '\t\t}\n'
                 '\t}')
new_ctor_tail = ('\t\t\tdegree_[c] = deg;\n'
                 '\t\t}\n'
                 '\n'
                 '\t\t// ── 位置索引 + 冲突矩阵预计算 ──\n'
                 '\t\t// 给每个位置分配唯一索引，预计算 O(1) 冲突查表。\n'
                 '\t\t// JS 版用 BigInt 位集；C++ 用 vector<bool> 等价于 bitmap。\n'
                 '\t\ttotal_pos_ = 0;\n'
                 '\t\tfor (int c2 = 0; c2 < n; ++c2)\n'
                 '\t\t\ttotal_pos_ += (int)initial_available_[c2].size();\n'
                 '\n'
                 '\t\tpos_r_.resize(total_pos_);\n'
                 '\t\tpos_c_.resize(total_pos_);\n'
                 '\t\tint idx = 0;\n'
                 '\t\tfor (int c2 = 0; c2 < n; ++c2) {\n'
                 '\t\t\tfor (const auto &[r, col] : initial_available_[c2]) {\n'
                 '\t\t\t\tpos_r_[idx] = r;\n'
                 '\t\t\t\tpos_c_[idx] = col;\n'
                 '\t\t\t\tpos_to_idx_[Pos(r, col)] = idx;\n'
                 '\t\t\t\tidx++;\n'
                 '\t\t\t}\n'
                 '\t\t}\n'
                 '\n'
                 '\t\t// 预计算冲突矩阵: conflict_[i][j] = 位置 i 与 j 是否冲突\n'
                 '\t\tconflict_.assign(total_pos_, vector<bool>(total_pos_, false));\n'
                 '\t\tfor (int i = 0; i < total_pos_; ++i) {\n'
                 '\t\t\tint ri = pos_r_[i], ci = pos_c_[i];\n'
                 '\t\t\tfor (int j = 0; j < total_pos_; ++j) {\n'
                 '\t\t\t\tint rj = pos_r_[j], cj = pos_c_[j];\n'
                 '\t\t\t\tif (ri == rj || ci == cj ||\n'
                 '\t\t\t\t    (abs(ri - rj) == 1 && abs(ci - cj) == 1))\n'
                 '\t\t\t\t\tconflict_[i][j] = true;\n'
                 '\t\t\t}\n'
                 '\t\t}\n'
                 '\t}')
ok += apply(old_ctor_tail, new_ctor_tail, 'ctor: conflict matrix')

# ─── 5. Add conflictsByIdx after conflictsWith ───
ok += apply('return dx == 1 && dy == 1; // 四对角相邻\n\t}',
            'return dx == 1 && dy == 1; // 四对角相邻\n\t}\n\n'
            '\t\t// ── 基于预计算冲突矩阵的 O(1) 查询 ──\n'
            '\t\tbool conflictsByIdx(int i, int j) const {\n'
            '\t\t\treturn conflict_[i][j];\n'
            '\t\t}',
            'conflictsByIdx')

# ─── 6. solve(): add AC-3 gate ───
old_solve = ('bool solve()\n'
             '\t{\n'
             '\t\tAvailable preprocessed = initial_available_;\n'
             '\t\tif (!ac3(preprocessed))\n'
             '\t\t\treturn false;\n'
             '\t\treturn dfs(0, move(preprocessed), 0);\n'
             '\t}')
new_solve = ('// AC-3 门控：n<10 或平均域>20 时跳过\n'
             '\tbool solve()\n'
             '\t{\n'
             '\t\tAvailable preprocessed = initial_available_;\n'
             '\t\tbool run_ac3 = (n_ >= 10);\n'
             '\t\tif (run_ac3) {\n'
             '\t\t\tint total_pos = 0;\n'
             '\t\t\tfor (int c2 = 0; c2 < n_; ++c2)\n'
             '\t\t\t\ttotal_pos += (int)preprocessed[c2].size();\n'
             '\t\t\tif ((double)total_pos / n_ > 20.0)\n'
             '\t\t\t\trun_ac3 = false;\n'
             '\t\t}\n'
             '\t\tif (run_ac3 && !ac3(preprocessed))\n'
             '\t\t\treturn false;\n'
             '\t\treturn dfs(0, move(preprocessed), 0);\n'
             '\t}')
ok += apply(old_solve, new_solve, 'solve: AC-3 gate')

# ─── 7. mac(): add changed_colors param and smart queue ───
old_mac = ('bool mac(Available &available, uint32_t placed_mask)\n'
           '\t{\n'
           '\t\tvector<pair<int, int>> queue;\n'
           '\t\tfor (int i = 0; i < n_; ++i)\n'
           '\t\t{\n'
           '\t\t\tif (placed_mask & (1u << i))\n'
           '\t\t\t\tcontinue;\n'
           '\t\t\tfor (int j = 0; j < n_; ++j)\n'
           '\t\t\t{\n'
           '\t\t\t\tif (i == j || (placed_mask & (1u << j)))\n'
           '\t\t\t\t\tcontinue;\n'
           '\t\t\t\tqueue.push_back({i, j});\n'
           '\t\t\t}\n'
           '\t\t}')
new_mac = ('// changedColors: 前向检查中域发生变化的颜色，仅从这些出发入队\n'
           '\tbool mac(Available &available, uint32_t placed_mask,\n'
           '\t         const vector<int> &changed_colors)\n'
           '\t{\n'
           '\t\t// 只从域变更颜色出发入队弧，而非全部 O(k^2) 对\n'
           '\t\tvector<pair<int, int>> queue;\n'
           '\t\tfor (int xi : changed_colors) {\n'
           '\t\t\tif (placed_mask & (1u << xi)) continue;\n'
           '\t\t\tfor (int xk = 0; xk < n_; ++xk) {\n'
           '\t\t\t\tif (xk == xi || (placed_mask & (1u << xk)))\n'
           '\t\t\t\t\tcontinue;\n'
           '\t\t\t\tqueue.push_back({xk, xi});\n'
           '\t\t\t}\n'
           '\t\t}')
ok += apply(old_mac, new_mac, 'mac: changed_colors')

# ─── 8. dfs: static degree MRV tie-breaking ───
old_mrv = ('else if (cnt == best_count)\n'
           '\t\t\t{\n'
           '\t\t\t\t// 动态 Degree：用当前 available 计算平局颜色的度\n'
           '\t\t\t\tint deg_c = 0, deg_best = 0;\n'
           '\t\t\t\tfor (int d = 0; d < n_; ++d)\n'
           '\t\t\t\t{\n'
           '\t\t\t\t\tif (d == c || (placed_mask & (1u << d)))\n'
           '\t\t\t\t\t\tcontinue;\n'
           '\t\t\t\t\tconst auto &lc = available[c], &ld = available[d];\n'
           '\t\t\t\t\tfor (const auto &p1 : lc)\n'
           '\t\t\t\t\t\tfor (const auto &p2 : ld)\n'
           '\t\t\t\t\t\t\tif (conflictsWith(p1.first, p1.second, p2.first, p2.second))\n'
           '\t\t\t\t\t\t\t\tdeg_c++;\n'
           '\t\t\t\t}\n'
           '\t\t\t\tfor (int d = 0; d < n_; ++d)\n'
           '\t\t\t\t{\n'
           '\t\t\t\t\tif (d == best_color || (placed_mask & (1u << d)))\n'
           '\t\t\t\t\t\tcontinue;\n'
           '\t\t\t\t\tconst auto &lb = available[best_color], &ld = available[d];\n'
           '\t\t\t\t\tfor (const auto &p1 : lb)\n'
           '\t\t\t\t\t\tfor (const auto &p2 : ld)\n'
           '\t\t\t\t\t\t\tif (conflictsWith(p1.first, p1.second, p2.first, p2.second))\n'
           '\t\t\t\t\t\t\t\tdeg_best++;\n'
           '\t\t\t\t}\n'
           '\t\t\t\tif (deg_c > deg_best)\n'
           '\t\t\t\t{\n'
           '\t\t\t\t\tbest_color = c;\n'
           '\t\t\t\t}\n'
           '\t\t\t}')
new_mrv = ('else if (cnt == best_count)\n'
           '\t\t\t{\n'
           '\t\t\t\tif (degree_[c] > degree_[best_color])\n'
           '\t\t\t\t\tbest_color = c;\n'
           '\t\t\t}')
ok += apply(old_mrv, new_mrv, 'dfs: static degree MRV')

# ─── 9. dfs: LCV gate ───
ok += apply('if (candidates.size() > 1)',
            'if (candidates.size() > 1 && (int)candidates.size() <= n_ * 3)',
            'dfs: LCV gate')

# ─── 10. dfs: changed_colors declaration ───
ok += apply('Available next_available = available;\n\t\t\tbool dead_end = false;',
            'Available next_available = available;\n'
            '\t\t\tbool dead_end = false;\n'
            '\t\t\tvector<int> changed_colors; // MAC 智能队列用',
            'dfs: changed_colors decl')

# ─── 11. dfs: forward checking with conflict matrix ───
ok += apply('if (!conflictsWith(ox, oy, x, y))\n'
            '\t\t\t\t\t{\n'
            '\t\t\t\t\t\tnew_list.push_back({ox, oy}); // 不冲突，保留\n'
            '\t\t\t\t\t}',
            'int idx_o = pos_to_idx_.at(Pos(ox, oy));\n'
            '\t\t\t\t\tint idx_new = pos_to_idx_.at(Pos(x, y));\n'
            '\t\t\t\t\tif (!conflict_[idx_o][idx_new])\n'
            '\t\t\t\t\t{\n'
            '\t\t\t\t\t\tnew_list.push_back({ox, oy}); // 不冲突，保留\n'
            '\t\t\t\t\t}',
            'dfs: FC conflict matrix')

# ─── 12. dfs: record changed colors ───
ok += apply('next_available[c] = move(new_list);\n\t\t\t}',
            'if ((int)new_list.size() < (int)old_list.size())\n'
            '\t\t\t\tchanged_colors.push_back(c);\n'
            '\t\t\tnext_available[c] = move(new_list);\n'
            '\t\t\t}',
            'dfs: record changed colors')

# ─── 13. dfs: MAC gate (n>=9, remaining<=4) ───
old_mac_call = ('uint32_t mac_mask = placed_mask | (1u << best_color);\n'
                '\t\t\tif (!mac(next_available, mac_mask))\n'
                '\t\t\t\tcontinue; // 某未放置颜色候选清空 → 剪枝')
new_mac_call = ('uint32_t mac_mask = placed_mask | (1u << best_color);\n'
                '\t\t\tbool run_mac = (n_ >= 9 && n_ - depth <= 4);\n'
                '\t\t\tif (run_mac && !mac(next_available, mac_mask, changed_colors))\n'
                '\t\t\t\tcontinue; // 某未放置颜色候选清空 → 剪枝')
ok += apply(old_mac_call, new_mac_call, 'dfs: MAC gate')

# ─── 14. Member variables ───
old_members = ('int n_;\n'
               '\tvector<vector<int>> board_;\t  // board_[r][c] = 1 表示有牛\n'
               '\tAvailable initial_available_; // 初始候选列表 (不变)\n'
               '\tvector<int> degree_;')
new_members = ('// ── 冲突矩阵预计算（JS 位集优化的 C++ 等价）──\n'
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
ok += apply(old_members, new_members, 'member vars')

with open('solver.cpp', 'w', encoding='utf-8', newline='') as f:
    f.write(c)

print(f'\n{ok}/14 changes applied')
