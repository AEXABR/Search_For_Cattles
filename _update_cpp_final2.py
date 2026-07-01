with open('solver.cpp', 'r', encoding='utf-8') as f:
    c = f.read()

# 从文件中找出精确的行作为锚点
def exact_line(text):
    """在文件中找精确匹配的行，返回该行（含换行）"""
    idx = c.find(text)
    if idx < 0:
        # 去掉行首尾空白再试
        for line in c.split('\n'):
            if text.strip() == line.strip():
                return line + '\n'
        print(f'  NOT FOUND: {text[:60]}...')
        return None
    # 提取完整行
    line_start = c.rfind('\n', 0, idx) + 1
    line_end = c.find('\n', idx)
    return c[line_start:line_end+1]

ok = 0

# ── 1. 版本号 ──
old = ' *   v1.5  + MAC 完整弧一致 (DFS 中传播) + 动态 Degree (当前域计算)'
if old in c:
    c = c.replace(old, old + '\n *   v1.6  + 冲突矩阵预计算 + 算法门控 (AC-3/MAC/LCV 自适应开关)', 1)
    ok += 1; print('1. version OK')

# ── 2. include ──
old = '#include <numeric>\n#include <vector>'
if old in c:
    c = c.replace(old, '#include <numeric>\n#include <unordered_map>\n#include <vector>', 1)
    ok += 1; print('2. include OK')

# ── 3. PosIdx ──
old = 'using Pos = pair<int, int>;\t\t\t  // (行, 列)\nusing Candidates = vector<Pos>;'
if old in c:
    c = c.replace(old, 'using Pos = pair<int, int>;\t\t\t  // (行, 列)\nusing PosIdx = int;\t\t\t\t  // 位置唯一索引（冲突矩阵下标）\nusing Candidates = vector<Pos>;', 1)
    ok += 1; print('3. PosIdx OK')

# ── 4. 构造函数：插入冲突矩阵（用精确锚点） ──
# 找到 degree_[c] = deg; 这一行的精确文本
for line in c.split('\n'):
    if line.strip() == 'degree_[c] = deg;':
        old = line + '\n'
        # 找紧随的 } 闭合
        rest = c[c.find(old) + len(old):]
        # 下一行是 \t\t\t}，再下一行是 \t\t}
        lines_after = rest.split('\n')
        l1 = lines_after[0]  # \t\t\t}
        l2 = lines_after[1]  # \t\t}
        old_block = old + l1 + '\n' + l2 + '\n'

        new_block = (old +
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
            + l1 + '\n' + l2 + '\n')

        c = c.replace(old_block, new_block, 1)
        ok += 1; print('4. ctor OK')
        break
else:
    print('4. ctor FAIL')

# ── 5. conflictsByIdx ──
old = '\t\treturn dx == 1 && dy == 1; // 四对角相邻\n\t}'
if old in c:
    c = c.replace(old,
        '\t\treturn dx == 1 && dy == 1; // 四对角相邻\n\t}\n\n'
        '\t\t// ── 基于预计算冲突矩阵的 O(1) 查询 ──\n'
        '\t\tbool conflictsByIdx(int i, int j) const {\n'
        '\t\t\treturn conflict_[i][j];\n'
        '\t\t}', 1)
    ok += 1; print('5. conflictsByIdx OK')
else:
    print('5. conflictsByIdx FAIL')

# ── 6. revise: 替换内部循环 ──
old = ('auto [x, y] = *it;\n'
       '\t\t\t\tbool has_support = false;\n'
       '\t\t\t\tfor (const auto &[px, py] : listJ)\n'
       '\t\t\t\t{\n'
       '\t\t\t\t\tif (!conflictsWith(x, y, px, py))')
if old in c:
    c = c.replace(old,
        'auto [x, y] = *it;\n'
        '\t\t\t\tint idxI = pos_to_idx_.at(Pos(x, y));\n'
        '\t\t\t\tbool has_support = false;\n'
        '\t\t\t\tfor (const auto &[px, py] : listJ)\n'
        '\t\t\t\t{\n'
        '\t\t\t\t\tint idxJ = pos_to_idx_.at(Pos(px, py));\n'
        '\t\t\t\t\tif (!conflict_[idxI][idxJ])', 1)
    ok += 1; print('6. revise OK')
else:
    print('6. revise FAIL')

# ── 7. solve: AC-3 gate ──
# 找到 solve() 精确行
sl = c.find('\tbool solve()\n')
sol_body_start = c.find('\t{\n', sl)  # opening brace
# 找整个函数体
sol_open = c.find('\t{\n', sl)
sol_close = c.find('\n\t}', sol_open)  # closing brace of solve
old_solve = c[sl:sol_close+4]  # include \n\t}

new_solve = ('\t// AC-3 门控：n<10 或平均域>20 时跳过（小板开销比例高，大域收益薄）\n'
             '\tbool solve()\n'
             '\t{\n'
             '\t\tAvailable preprocessed = initial_available_;\n'
             '\t\tbool run_ac3 = (n_ >= 10);\n'
             '\t\tif (run_ac3) {\n'
             '\t\t\tint total_pos = 0;\n'
             '\t\t\tfor (int c = 0; c < n_; ++c)\n'
             '\t\t\t\ttotal_pos += (int)preprocessed[c].size();\n'
             '\t\t\tif ((double)total_pos / n_ > 20.0)\n'
             '\t\t\t\trun_ac3 = false;\n'
             '\t\t}\n'
             '\t\tif (run_ac3 && !ac3(preprocessed))\n'
             '\t\t\treturn false;\n'
             '\t\treturn dfs(0, move(preprocessed), 0);\n'
             '\t}')
c = c.replace(old_solve, new_solve, 1)
ok += 1; print('7. solve OK')

# ── 8. mac: changedColors + smart queue ──
ml = c.find('\tbool mac(Available &available, uint32_t placed_mask)')
mac_close = c.find('\n\t}', ml)  # closing of mac
old_mac = c[ml:mac_close+4]

new_mac = ('\t// changedColors: 前向检查中域发生变化的颜色，仅从这些出发入队。\n'
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
           '\t\t}\n'
           '\t\twhile (!queue.empty())\n'
           '\t\t{\n'
           '\t\t\tauto [xi, xj] = queue.back();\n'
           '\t\t\tqueue.pop_back();\n'
           '\t\t\tif (revise(xi, xj, available))\n'
           '\t\t\t{\n'
           '\t\t\t\tif (available[xi].empty())\n'
           '\t\t\t\t\treturn false;\n'
           '\t\t\t\tfor (int xk = 0; xk < n_; ++xk)\n'
           '\t\t\t\t{\n'
           '\t\t\t\t\tif (xk != xi && xk != xj && !(placed_mask & (1u << xk)))\n'
           '\t\t\t\t\t\tqueue.push_back({xk, xi});\n'
           '\t\t\t\t}\n'
           '\t\t\t}\n'
           '\t\t}\n'
           '\t\treturn true;\n'
           '\t}')
c = c.replace(old_mac, new_mac, 1)
ok += 1; print('8. mac OK')

# ── 9. LCV gate ──
# 找到 "if (candidates.size() > 1)" 在 LCV 上下文中的位置
# 找注释 "两者作用在不同决策维度"
anchor = '两者作用在不同决策维度'
al = c.find(anchor)
if al > 0:
    # 从 anchor 后面的 "if (candidates.size() > 1)" 开始
    lcv_if = c.find('if (candidates.size() > 1)', al)
    old_lcv = c[lcv_if:lcv_if+30]  # 'if (candidates.size() > 1)'
    new_lcv = 'if (candidates.size() > 1 && (int)candidates.size() <= n_ * 3)'
    c = c.replace(old_lcv, new_lcv, 1)
    ok += 1; print('9. LCV gate OK')
else:
    print('9. LCV gate FAIL')

# ── 10. FC: changed_colors 声明 ──
old = 'Available next_available = available;\n\t\t\t\tbool dead_end = false;'
if old in c:
    c = c.replace(old,
        'Available next_available = available;\n'
        '\t\t\t\tbool dead_end = false;\n'
        '\t\t\t\tvector<int> changed_colors; // MAC 智能队列用', 1)
    ok += 1; print('10. changed_colors OK')
else:
    print('10. changed_colors FAIL')

# ── 11. FC: conflict matrix ──
old = ('if (!conflictsWith(ox, oy, x, y))\n'
       '\t\t\t\t\t{\n'
       '\t\t\t\t\t\tnew_list.push_back({ox, oy}); // 不冲突，保留\n'
       '\t\t\t\t\t}')
if old in c:
    c = c.replace(old,
        'int idx_o = pos_to_idx_.at(Pos(ox, oy));\n'
        '\t\t\t\t\tint idx_new = pos_to_idx_.at(Pos(x, y));\n'
        '\t\t\t\t\tif (!conflict_[idx_o][idx_new])\n'
        '\t\t\t\t\t{\n'
        '\t\t\t\t\t\tnew_list.push_back({ox, oy}); // 不冲突，保留\n'
        '\t\t\t\t\t}', 1)
    ok += 1; print('11. FC matrix OK')
else:
    print('11. FC matrix FAIL')

# ── 12. FC: record changed colors ──
old = 'next_available[c] = move(new_list);'
if old in c:
    c = c.replace(old,
        'if ((int)new_list.size() < (int)old_list.size())\n'
        '\t\t\t\t\tchanged_colors.push_back(c);\n'
        '\t\t\t\tnext_available[c] = move(new_list);', 1)
    ok += 1; print('12. changedColors record OK')
else:
    print('12. changedColors record FAIL')

# ── 13. MAC gate ──
anchor = 'MAC：在剩余未放置颜色上运行 AC-3'
al = c.find(anchor)
if al > 0:
    # 找这段：从注释到 continue
    mac_call_start = c.rfind('\n', 0, al) + 1  # 注释行开始
    # 注释行 + mac_mask 行 + if 行 + continue 行
    rest = c[mac_call_start:]
    lines = rest.split('\n')
    old_block = '\n'.join(lines[:4]) + '\n'  # 4 lines: comment, mac_mask, if(!mac), continue

    new_block = ('\t\t\t// ── MAC：仅 n>=9 且剩余<=4 色时才跑（否则前向检查足够）──\n'
                 '\t\t\t\tuint32_t mac_mask = placed_mask | (1u << best_color);\n'
                 '\t\t\t\tbool run_mac = (n_ >= 9 && n_ - depth <= 4);\n'
                 '\t\t\t\tif (run_mac && !mac(next_available, mac_mask, changed_colors))\n'
                 '\t\t\t\t\tcontinue; // 某未放置颜色候选清空 → 剪枝\n')
    c = c.replace(old_block, new_block, 1)
    ok += 1; print('13. MAC gate OK')
else:
    print('13. MAC gate FAIL')

# ── 14. 新成员变量 ──
ml = c.find('\tint n_;\n')
# 往前找到 private: 或类成员开始
mem_start = c.rfind('\n', 0, ml)
old_mem_line = c[mem_start+1:ml] + 'int n_;\n'
# 找后面几行
rest = c[ml+len('int n_;\n'):]
lines = rest.split('\n')
# 找 board_, initial_available_, degree_ 的原始行
board_line = lines[0] + '\n'
avail_line = lines[1] + '\n'
degree_line = lines[2] + '\n'

old_members = '\tint n_;\n' + board_line + avail_line + degree_line
new_members = ('\t// ── 冲突矩阵预计算（JS 位集优化的 C++ 等价）──\n'
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
               '\tint n_;\n' + board_line + avail_line + degree_line)

c = c.replace(old_members, new_members, 1)
ok += 1; print('14. members OK')

with open('solver.cpp', 'w', encoding='utf-8', newline='') as f:
    f.write(c)

print(f'\n{ok}/14 applied')
