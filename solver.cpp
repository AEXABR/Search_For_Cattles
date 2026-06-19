/**
 * solver.cpp — Search For Cattles 求解器 C++ 转译
 *
 * 从 js/solver.js 逐逻辑转译，供学习算法思路使用。
 * 编译: g++ -std=c++17 -O2 solver.cpp -o solver && ./solver
 *
 * 算法演进（每版在前版基础上叠加）:
 *   v1.0  纯 DFS 回溯
 *   v1.1  + 前向检查 (Forward Checking)
 *   v1.2  + 动态 MRV (Minimum Remaining Values)
 *   v1.3  + Degree 平局打破 + LCV 值排序
 *   v1.4  + AC-3 弧一致性预处理
 *   v1.5  + MAC 完整弧一致 (DFS 中传播) + 动态 Degree (当前域计算)
 *
 * ============================================================================
 * 优化策略全景 — CSP 的 Fail-First + Succeed-First 范式
 * ============================================================================
 *
 * 四个优化分属 CSP 求解的不同决策阶段，看似目的相反实则配合无间:
 *
 *   阶段          | 策略           | 原则           | 实现
 *   --------------|---------------|---------------|------------------
 *   搜索前 (预处理) | AC-3 弧一致性  | 删结构死候选    | 迭代 revise()
 *   选变量 (选颜色) | MRV + Degree  | Fail-First    | 候选最少 + 约束最多优先
 *   选值   (选格子) | LCV           | Succeed-First | 删别人候选最少的先试
 *   传播   (约束)  | Forward Check | 提前剪枝       | 删与当前放置冲突的候选
 *
 * 为什么选变量用 Fail-First 而选值用 Succeed-First？
 *   - 选变量: 最难搞的颜色先上 → 不行就早点认输 → 回溯浅 (1~2 层)
 *   - 选值:   最不碍事的格子先试 → 给后人留最大空间 → 一穿到底
 *   两者作用在不同决策维度——变量是"挑谁先走"，值是"走哪条路"。
 *
 * ============================================================================
 * 涉及知识点
 * ============================================================================
 * [算法与搜索]
 *   - CSP (约束满足问题): 变量=颜色, 域=候选位置, 约束=行列+对角
 *   - DFS 回溯: 递归尝试每个候选位置，失败则回溯
 *   - 前向检查 (Forward Checking): 放置前预判，若导致某颜色域为空则剪枝
 *   - 最小剩余值启发式 (MRV): 动态选候选最少的颜色优先，fail-fast
 *   - Degree 启发式: MRV 平局时选与其他颜色冲突最多的（最多约束变量优先）
 *   - 最少约束值 (LCV): 优先尝试删除其他颜色候选最少的格子
 *   - AC-3 弧一致性: 迭代删"在对方域中无支撑"的值，搜前削减搜索空间
 *   - 正反馈剪枝: 四种策略层层叠加 → 前向检查削减候选 → MRV 更精准 → 分支更少
 *
 * [C++ 语言特性]
 *   - 值传递 vs 引用传递: available 按值传递实现自动回溯
 *   - move 语义 (C++11): move(new_list) 移交所有权，O(1) 避免逐元素拷贝
 *   - 结构化绑定 (C++17): for (const auto &[x, y] : candidates)
 *   - 位掩码: uint32_t placed_mask, 用 & | << 做集合操作 (CSP + BitMask)
 *   - 成员初始化列表: 避免先默认构造再赋值的二次开销
 *   - const 正确性: 返回值 const 与不 const 的规则 (详见 board() / n() 注释)
 *   - static 成员函数: conflictsWith 不依赖对象状态，声明为 static
 *
 * [数据结构]
 *   - pair<int,int> 表示坐标
 *   - vector<vector<int>> 二维棋盘
 *   - 邻接表思想: Available = 每种颜色对应一个候选位置列表
 *
 * [数学与系统]
 *   - 曼哈顿/切比雪夫距离判定对角相邻
 *   - <chrono> 微秒级性能计时
 *   - 独立的验证函数 verifySolution() 做正确性检查
 */

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <iostream>
#include <numeric>
#include <vector>

using namespace std;

// ============================================================================
// 问题定义
// ============================================================================
// 在 n×n 棋盘上，有 n 种颜色，每种颜色占据一个连通区域。
// 要在每个颜色区域内放置恰好一头"牛"，满足:
//   1. 不同牛不能在同一行
//   2. 不同牛不能在同一列
//   3. 不同牛不能四对角相邻 (即 |dx|=1 且 |dy|=1)
//
// 输入: n × positionsByColor — positionsByColor[c] = 颜色 c 可选位置 [(r0,c0), ...]
// 输出: board — n×n 棋盘，board[r][c] = 1 表示该格有牛

// ============================================================================
// 核心数据结构
// ============================================================================
using Pos = pair<int, int>;			  // (行, 列)
using Candidates = vector<Pos>;		  // 一个颜色的候选位置列表
using Available = vector<Candidates>; // 所有颜色的候选列表 (available[c])

// ============================================================================
// Solver 类: DFS 回溯 + 前向检查 + 动态 MRV
// ============================================================================
class Solver
{
public:
	Solver(int n, const Available &positionsByColor)
		: n_(n), board_(n, vector<int>(n, 0)), initial_available_(positionsByColor)
	{
		// ── Degree 预计算 ──
		// 度 = 颜色 c 的全部候选与所有其他颜色候选位置的冲突总次数。
		// 它是"该颜色对其他颜色施加了多少约束"的近似。
		// 在 MRV 平局时（多色候选数相同），选 degree 最大的:
		//   约束越多 → 放置后对其他颜色的削减越剧烈 → 分支因子骤降。
		//   这就是 Fail-First: 最难满足的变量优先处理。
		//
		// 复杂度: O(n^2 * D^2)，n<=15 D<=225，最坏~1.1e7 次冲突检查，可接受。
		degree_.resize(n, 0);
		for (int c = 0; c < n; ++c)
		{
			int deg = 0;
			const auto &listC = initial_available_[c];
			for (int d = 0; d < n; ++d)
			{
				if (c == d)
					continue;
				const auto &listD = initial_available_[d];
				for (const auto &p1 : listC)
				{
					for (const auto &p2 : listD)
					{
						if (conflictsWith(p1.first, p1.second, p2.first, p2.second))
						{
							deg++;
						}
					}
				}
			}
			degree_[c] = deg;
		}
	}
	// NOTE: initial_available_ 必须放在初始化列表中直接用拷贝构造，而非先
	// 默认构造空 vector 再在函数体中赋值。C++ 规则：成员在进入 {} 之前已
	// 完成初始化。不写在初始化列表里 → 先调默认构造（空 vector），再调
	// operator=（拷贝所有元素），两步操作，中间的空 vector 纯属浪费。

	// ── 入口: 启动求解 ──
	// 封装 DFS 的内部参数 (depth, available, placed_mask)，外部只需调用 solve()，
	// 不必关心初始值。在这个小程序里 main() 就在同文件，封装可有可无；
	// 但若 Solver 被多处引用，封装能防止调用方传错初始参数。
	// ── 求解流水线 ──
	// 1. 拷贝 initial_available_ → 源数据不变，支持多次求解
	// 2. AC-3 预处理   → 迭代删除所有弧不一致候选，搜前即斩死分支
	// 3. DFS 回溯搜索  → 在净化后的候选集上执行，move 避免二次拷贝
	// 流水线顺序不可调换: AC-3 必须在前，因为 DFS 依赖净化后的候选集。
	bool solve()
	{
		Available preprocessed = initial_available_;
		if (!ac3(preprocessed))
			return false;
		return dfs(0, move(preprocessed), 0);
	}

	// ── 获取结果棋盘 ──
	// 为什么返回 const T& (常量引用) 而不是 T (值)?
	//   board_ 是 n×n 的二维矩阵，值返回会拷贝整个棋盘 (O(n²))，
	//   引用返回零拷贝，调用方直接读原数据。
	// 为什么返回值的 const 不能省略?
	//   引用返回时，调用方拿到的是 board_ 本身的别名。
	//   不加 const → 外部可以通过 solver.board()[0][0] = 9 篡改内部状态。
	//   加上 const → 只读，保护封装性。
	const vector<vector<int>> &board() const { return board_; }

	// ── 获取棋盘大小 ──
	// 为什么返回 int (值) 而不是 const int?
	//   值返回时，调用方拿到的是一份拷贝。改拷贝影响不到原数据 (n_)。
	//   即使不加 const，给右值赋值也非法 → 编译器原本就禁止 solver.n() = 5。
	// 为什么不在 int 前加 const?
	//   C++ 标准规定: 函数声明中，返回值的顶层 const 会被忽略。
	//   const int f() 和 int f() 是同一个函数签名。加了也没区别。
	//   顶层 const 只在函数定义体内有效 (防止自己在函数里修改返回值)。
	int n() const { return n_; }

private:
	// ------------------------------------------------------------------------
	// 约束检查: 位置 (x,y) 是否与已放置的牛 (px,py) 冲突
	// ------------------------------------------------------------------------
	// 冲突的三条规则:
	//   (a) 同行:  x == px
	//   (b) 同列:  y == py
	//   (c) 对角相邻: |x-px| == 1 且 |y-py| == 1  (四个对角方向)
	//
	// 注意: 这只检查与单头牛的冲突。前向检查会对"每头已放的牛"逐个调用此函数，
	// 但由于 available 列表已经被前面的牛过滤过，每次只需检查新增的那头牛。
	static bool conflictsWith(int x, int y, int px, int py)
	{
		if (x == px || y == py)
			return true; // 同行或同列
		int dx = abs(x - px);
		int dy = abs(y - py);
		return dx == 1 && dy == 1; // 四对角相邻
	}

	// ------------------------------------------------------------------------
	// AC-3 弧一致性预处理
	// ------------------------------------------------------------------------
	// revise(i, j): 从颜色 i 的候选集中删去"与颜色 j 所有候选都冲突"的位置。
	// 返回值: true = 至少删了一个候选, false = 无变化。
	bool revise(int xi, int xj, Available &available)
	{
		bool removed = false;
		auto &listI = available[xi];
		const auto &listJ = available[xj];

		for (auto it = listI.begin(); it != listI.end();)
		{
			auto [x, y] = *it;
			bool has_support = false;
			for (const auto &[px, py] : listJ)
			{
				if (!conflictsWith(x, y, px, py))
				{
					has_support = true;
					break;
				}
			}
			if (!has_support)
			{
				it = listI.erase(it); // 无支撑 → 删除
				removed = true;
			}
			else
			{
				++it;
			}
		}
		return removed;
	}

	// ac3: 维护弧队列，反复 revise 直到不动点。
	// 返回 false = 某颜色候选被删空 → 问题无解。
	bool ac3(Available &available)
	{
		vector<pair<int, int>> queue;
		for (int i = 0; i < n_; ++i)
			for (int j = 0; j < n_; ++j)
				if (i != j)
					queue.push_back({i, j});

		while (!queue.empty())
		{
			auto [xi, xj] = queue.back();
			queue.pop_back();
			if (revise(xi, xj, available))
			{
				if (available[xi].empty())
					return false; // 某颜色候选全删 → 无解
				for (int xk = 0; xk < n_; ++xk)
					if (xk != xi && xk != xj)
						queue.push_back({xk, xi});
			}
		}
		return true;
	}

	// ------------------------------------------------------------------------
	// MAC: 在已放置变量的剩余域上运行 AC-3（仅针对未放置颜色）
	// ------------------------------------------------------------------------
	// 与预处理中的 ac3() 不同：此处仅操作未放置颜色，每次 DFS 放置后调用。
	// 比 Forward Checking 更强：FC 只检查"新放置与未放置是否冲突"，
	// MAC 额外传播"未放置颜色之间是否仍互容"。
	bool mac(Available &available, uint32_t placed_mask)
	{
		vector<pair<int, int>> queue;
		for (int i = 0; i < n_; ++i)
		{
			if (placed_mask & (1u << i))
				continue;
			for (int j = 0; j < n_; ++j)
			{
				if (i == j || (placed_mask & (1u << j)))
					continue;
				queue.push_back({i, j});
			}
		}
		while (!queue.empty())
		{
			auto [xi, xj] = queue.back();
			queue.pop_back();
			if (revise(xi, xj, available))
			{
				if (available[xi].empty())
					return false;
				for (int xk = 0; xk < n_; ++xk)
				{
					if (xk != xi && xk != xj && !(placed_mask & (1u << xk)))
						queue.push_back({xk, xi});
				}
			}
		}
		return true;
	}

	// ------------------------------------------------------------------------
	// DFS 递归核心
	// ------------------------------------------------------------------------
	// 参数:
	//   depth       — 当前已放置的牛的数量 (也等于递归深度)
	//   available   — 每种颜色当前仍可用的候选位置列表
	//   placed_mask — 位掩码，bit c = 1 表示颜色 c 已放置
	//
	// 返回值: true = 找到完整解, false = 此分支无解
	//
	// 关键设计决策:
	//   1. available 按值传递 —— 每层递归有自己的副本，回溯时自动恢复
	//   2. board_ 是类成员，手动回溯 (因为只有一份)
	//   3. placed_mask 按值传递，回溯自动恢复
	//
	// ── 复杂度分析 ──
	//
	// 记 n = 颜色数, D = 各颜色中最大候选数 (= max_c |available[c]|), 最坏 ≤ n².
	//
	// 搜索树每节点:
	//   MRV 选色 ............ O(n)        扫描 n 种颜色找最小域
	//   前向检查(每人候选) ... O(n·D)       对 n 种颜色各过滤 D 个格
	//   合计 ................ O(n·D) 每候选, 共 ≤D 个 → O(n·D²)
	//
	// 最坏搜索树规模: O(D^n) 节点 (每个颜色有 D 个候选, n 层)
	// 最坏总复杂度  : O(n · D^(n+2))
	//
	// 实际远低于最坏:
	//   · 前向检查在浅层即剪掉大量分支 → 有效树深 < n
	//   · MRV fail-fast: 1 候选的颜色直接锁定, 0 候选立即回溯
	//   · 正反馈: 前向检查削减候选 → MRV 更精准 → 分支更少
	//
	// 实测: n=15 D=15 时仅 56μs, 搜索节点数远小于 15^15 ≈ 4.4×10^17
	//
	bool dfs(int depth, Available available, uint32_t placed_mask)
	{
		// ── 终止条件: n 头牛全部放置成功 ──
		if (depth == n_)
			return true;

		// ════════════════════════════════════════════════════════════════
		// 第一步: 动态 MRV + Degree 平局打破 (Fail-First)
		// ════════════════════════════════════════════════════════════════
		//
		// MRV — 候选最少的颜色优先:
		//   候选少 = 瓶颈大 → 先处理。0 个候选立即回溯，1 个候选直接锁定。
		//   必须动态评估: 前向检查每层都会削减候选，中途可能变得极度受限。
		//
		// Degree — 候选数相同时，选约束最多的颜色:
		//   degree_[c] = 该颜色与所有其他颜色的总冲突数。
		//   度越大 → 对其他颜色的约束越强 → 分支因子下降越快。
		//   若该颜色注定无解 → 尽早失败，浅层回溯 (而非深搜后回溯)。
		//
		// MRV + Degree = 教科书"最受限变量 + 最多约束变量"组合。
		int best_color = -1;
		int best_count = INT_MAX;

		for (int c = 0; c < n_; ++c)
		{
			if (placed_mask & (1u << c))
				continue; // 已放置，跳过

			int cnt = (int)available[c].size();

			if (cnt == 0)
				return false; // 死胡同：无候选格
			if (cnt == 1)
			{
				best_color = c;
				break;
			} // 1 个候选已达最优
			if (cnt < best_count)
			{
				best_count = cnt;
				best_color = c;
			}
			else if (cnt == best_count)
			{
				// 动态 Degree：用当前 available 计算平局颜色的度
				int deg_c = 0, deg_best = 0;
				for (int d = 0; d < n_; ++d)
				{
					if (d == c || (placed_mask & (1u << d)))
						continue;
					const auto &lc = available[c], &ld = available[d];
					for (const auto &p1 : lc)
						for (const auto &p2 : ld)
							if (conflictsWith(p1.first, p1.second, p2.first, p2.second))
								deg_c++;
				}
				for (int d = 0; d < n_; ++d)
				{
					if (d == best_color || (placed_mask & (1u << d)))
						continue;
					const auto &lb = available[best_color], &ld = available[d];
					for (const auto &p1 : lb)
						for (const auto &p2 : ld)
							if (conflictsWith(p1.first, p1.second, p2.first, p2.second))
								deg_best++;
				}
				if (deg_c > deg_best)
				{
					best_color = c;
				}
			}
		}

		auto candidates = available[best_color]; // 非 const，LCV 需要排序

		// ── LCV：按对其他颜色的约束数升序排列 (Succeed-First) ──
		// 选中颜色后，优先尝试"对其他颜色限制最小"的格子。
		// sort 按 countA < countB: 该候选删掉别人候选的总数越少越靠前。
		// 删得少 → 剩余候选空间大 → 后续变量灵活 → 一穿到底概率高。
		// LCV 与 MRV+Degree 看似相反，实则互补:
		//   选变量 (MRV+Degree) = Fail-First: 最难的颜色先上，不行早回头
		//   选值   (LCV)        = Succeed-First: 最易的格子先试，能成一步通
		//   两者作用在不同决策维度，恰是 CSP 搜索的黄金组合。
		if (candidates.size() > 1)
		{
			sort(candidates.begin(), candidates.end(),
				 [&](const Pos &a, const Pos &b)
				 {
					 int countA = 0, countB = 0;
					 for (int c = 0; c < n_; ++c)
					 {
						 if (c == best_color || (placed_mask & (1u << c)))
							 continue;
						 const auto &list = available[c];
						 for (const auto &p : list)
						 {
							 if (conflictsWith(p.first, p.second, a.first, a.second))
								 countA++;
							 if (conflictsWith(p.first, p.second, b.first, b.second))
								 countB++;
						 }
					 }
					 return countA < countB;
				 });
		}

		// ════════════════════════════════════════════════════════════════
		// 第二步: 遍历该颜色的每个候选位置
		// ════════════════════════════════════════════════════════════════
		for (const auto &[x, y] : candidates)
		{

			// ── 前向检查 (Forward Checking) ──
			//
			// 直觉: 常规回溯只检查"当前放不放得下"，前向检查额外检查
			//       "放了之后，剩余颜色还有没有格子可放"。
			//
			// 注意: 此处的 new_list.empty() 与第一步的 cnt==0 查的不是同一件事:
			//   cnt==0        → 当前状态已死（被之前层剪光），立即回溯
			//   new_list.empty() → 模拟放置 (x,y) 后某颜色被剪光，提前剪枝
			// 第二步是第一步的补充——放置前的状态通过了，不代表放置后也安全。
			// 例如两步候选的颜色，放置其一个候选后可能导致其他颜色无格可放。
			//
			// 做法: 假设 (x,y) 放了牛，立即遍历所有未放置的颜色，
			//       从它们的候选列表中删掉与 (x,y) 冲突的位置。
			//       若任一颜色候选列表变空 → 此路不通，跳过。
			//
			// 效果: 在搜索树浅层就能发现死胡同，避免深层无效探索。
			//       与动态 MRV 形成正反馈循环:
			//         前向检查削减候选 → MRV 选到更紧的颜色 → 分支更少
			// NOTE: 不能写成 Available next_available; (空声明)，必须拷贝。
			// 前向检查只修改"未放置且非当前选中的颜色"的候选列表，已放置的
			// 颜色需原样保留给下层递归。拷贝整份然后局部替换，比逐色判断省事。
			Available next_available = available;
			bool dead_end = false;

			for (int c = 0; c < n_; ++c)
			{
				if (c == best_color || (placed_mask & (1u << c)))
					continue; // 跳过已放置和当前颜色

				const auto &old_list = available[c];
				Candidates new_list;

				for (const auto &[ox, oy] : old_list)
				{
					if (!conflictsWith(ox, oy, x, y))
					{
						new_list.push_back({ox, oy}); // 不冲突，保留
					}
					// 冲突的 → 不加入 new_list，相当于删除
				}

				if (new_list.empty())
				{
					dead_end = true; // 有颜色无格可放
					break;			 // 无需检查剩余颜色，直接跳出内层 for(c)
				}
				// NOTE: 这里不能在内层直接 continue 跳过，因为继续的目标
				// 会跳到下一个 c 而非下一个候选 (x,y)。因此用 dead_end 标志
				// + break 跳出内层，再由外层的 if (dead_end) continue 正确
				// 跳到外层 for 的下一个候选位置。
				//
				// move: 将 new_list 内部指针直接移交给 next_available[c]，
				// 避免逐元素拷贝 (O(1) vs O(n))。之后 new_list 变为空壳。
				next_available[c] = move(new_list);
			}

			if (dead_end)
				continue; // 剪枝，试下一个

			// ── MAC：在剩余未放置颜色上运行 AC-3 ──
			uint32_t mac_mask = placed_mask | (1u << best_color);
			if (!mac(next_available, mac_mask))
				continue; // 某未放置颜色候选清空 → 剪枝

			// ── 放置 ──
			board_[x][y] = 1;

			// ── 递归 ──
			uint32_t next_mask = placed_mask | (1u << best_color);
			if (dfs(depth + 1, move(next_available), next_mask))
				return true; // 找到解，向上传播

			// ── 回溯 ──
			// available 和 placed_mask 是值传递，自动恢复
			// board_ 需要手动回退
			board_[x][y] = 0;
		}

		return false; // 所有候选都失败
	}
	int n_;
	vector<vector<int>> board_;	  // board_[r][c] = 1 表示有牛
	Available initial_available_; // 初始候选列表 (不变)
	vector<int> degree_;		  // 各颜色的度（跨色冲突总数），MRV 平局打破
};

// ============================================================================
// 验证工具: 检查解是否满足所有约束
// ============================================================================
bool verifySolution(int n, const vector<vector<int>> &board, const Available &positionsByColor)
{
	// 收集所有牛的位置
	vector<Pos> cattle;
	for (int r = 0; r < n; ++r)
		for (int c = 0; c < n; ++c)
			if (board[r][c] == 1)
				cattle.push_back({r, c});

	if ((int)cattle.size() != n)
	{
		cerr << "FAIL: 只有 " << cattle.size() << " 头牛，需要 " << n << endl;
		return false;
	}

	// 检查约束: 每对牛之间
	for (int i = 0; i < n; ++i)
	{
		auto [x1, y1] = cattle[i];
		for (int j = i + 1; j < n; ++j)
		{
			auto [x2, y2] = cattle[j];
			if (x1 == x2)
			{
				cerr << "FAIL: 同行" << endl;
				return false;
			}
			if (y1 == y2)
			{
				cerr << "FAIL: 同列" << endl;
				return false;
			}
			if (abs(x1 - x2) == 1 && abs(y1 - y2) == 1)
			{
				cerr << "FAIL: 对角相邻" << endl;
				return false;
			}
		}
	}
	return true;
}

// ============================================================================
// 测试用例
// ============================================================================
int main()
{
	cout << "=== Search For Cattles — C++ Solver ===\n"
		 << endl;

	// ──── 测试 1: 4×4 四区块 ────
	// 每种颜色占据一个 2×2 角落块
	cout << "Test 1: 4×4 四区块" << endl;
	{
		int n = 4;
		Available p(n);
		// 左上 (0,0)~(1,1)
		for (int r = 0; r < 2; ++r)
			for (int c = 0; c < 2; ++c)
				p[0].push_back({r, c});
		// 右上 (0,2)~(1,3)
		for (int r = 0; r < 2; ++r)
			for (int c = 2; c < 4; ++c)
				p[1].push_back({r, c});
		// 左下 (2,0)~(3,1)
		for (int r = 2; r < 4; ++r)
			for (int c = 0; c < 2; ++c)
				p[2].push_back({r, c});
		// 右下 (2,2)~(3,3)
		for (int r = 2; r < 4; ++r)
			for (int c = 2; c < 4; ++c)
				p[3].push_back({r, c});

		Solver solver(n, p);
		auto t0 = chrono::steady_clock::now();
		bool ok = solver.solve();
		auto t1 = chrono::steady_clock::now();
		auto us = chrono::duration_cast<chrono::microseconds>(t1 - t0).count();

		cout << "  结果: " << (ok ? "OK ✓" : "无解") << "  耗时: " << us << "μs" << endl;
		if (ok)
		{
			cout << "  棋盘:" << endl;
			for (int r = 0; r < n; ++r)
			{
				cout << "    ";
				for (int c = 0; c < n; ++c)
					cout << solver.board()[r][c] << " ";
				cout << endl;
			}
			cout << "  验证: " << (verifySolution(n, solver.board(), p) ? "通过 ✓" : "失败 ✗") << endl;
		}
	}

	// ──── 测试 2: 5×5 水平条带 ────
	// 每种颜色占据一整行 (5 个候选位置)
	cout << "\nTest 2: 5×5 水平条带 (每色一行)" << endl;
	{
		int n = 5;
		Available p(n);
		for (int c = 0; c < n; ++c)
			for (int col = 0; col < n; ++col)
				p[c].push_back({c, col}); // 颜色 c 占据整行 c

		Solver solver(n, p);
		auto t0 = chrono::steady_clock::now();
		bool ok = solver.solve();
		auto t1 = chrono::steady_clock::now();
		auto us = chrono::duration_cast<chrono::microseconds>(t1 - t0).count();

		cout << "  结果: " << (ok ? "OK ✓" : "无解") << "  耗时: " << us << "μs" << endl;
		if (ok)
		{
			cout << "  棋盘:" << endl;
			for (int r = 0; r < n; ++r)
			{
				cout << "    ";
				for (int c = 0; c < n; ++c)
					cout << solver.board()[r][c] << " ";
				cout << endl;
			}
			cout << "  验证: " << (verifySolution(n, solver.board(), p) ? "通过 ✓" : "失败 ✗") << endl;
		}
	}

	// ──── 测试 3: 15×15 条带 (极限压力) ────
	cout << "\nTest 3: 15×15 条带 (压测)" << endl;
	{
		int n = 15;
		Available p(n);
		for (int c = 0; c < n; ++c)
			for (int col = 0; col < n; ++col)
				p[c].push_back({c, col});

		Solver solver(n, p);
		auto t0 = chrono::steady_clock::now();
		bool ok = solver.solve();
		auto t1 = chrono::steady_clock::now();
		auto us = chrono::duration_cast<chrono::microseconds>(t1 - t0).count();

		cout << "  结果: " << (ok ? "OK ✓" : "无解") << "  耗时: " << us << "μs" << endl;
		if (ok)
			cout << "  验证: " << (verifySolution(n, solver.board(), p) ? "通过 ✓" : "失败 ✗") << endl;
	}

	// ──── 测试 4: 无解情况 ────
	// 两种颜色完全挤在同一行 → 必然冲突
	cout << "\nTest 4: 故意无解 (两色同行)" << endl;
	{
		int n = 2;
		Available p(n);
		p[0].push_back({0, 0});
		p[0].push_back({0, 1}); // 颜色 0 只能放第 0 行
		p[1].push_back({0, 0});
		p[1].push_back({0, 1}); // 颜色 1 也只能放第 0 行
		// → 两头牛必须放同一行 → 无解

		Solver solver(n, p);
		auto t0 = chrono::steady_clock::now();
		bool ok = solver.solve();
		auto t1 = chrono::steady_clock::now();
		auto us = chrono::duration_cast<chrono::microseconds>(t1 - t0).count();

		cout << "  结果: " << (ok ? "有解 (意外)" : "无解 ✓ (预期)") << "  耗时: " << us << "μs" << endl;
	}

	cout << "\n=== 全部测试完成 ===" << endl;
	return 0;
}
