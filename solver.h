#ifndef SOLVER_H
#define SOLVER_H

#include <vector>
#include <algorithm>
#include <numeric>
#include <utility>
using std::vector;
using std::pair;
using std::move;

struct Solver {
    int n;
    vector<vector<pair<int, int>>> positionsByColor;
    vector<int> colorOrder;
    int usedRow;
    int usedCol;
    vector<vector<int>> board;

    explicit Solver(int initialn, vector<vector<pair<int, int>>> initialPositionsByColor) :
        n(initialn),
        positionsByColor(move(initialPositionsByColor)),
        usedRow(0),
        usedCol(0),
        board(n, vector<int>(n, 0))
    {
        colorOrder.resize(n);
        iota(colorOrder.begin(), colorOrder.end(), 0);
        sort(colorOrder.begin(), colorOrder.end(), [this](int a, int b) {
            return positionsByColor[a].size() < positionsByColor[b].size();
            });
    }

    const int dx[4] = { -1 , -1, 1, 1 };
    const int dy[4] = { -1 , 1, -1, 1 };

    bool CanPlace(int x, int y) const
    {
        if ((usedRow >> x) & 1 || (usedCol >> y) & 1) return false;
        for (int k = 0; k < 4; ++k) {
            int nx = x + dx[k];
            int ny = y + dy[k];
            if (nx >= 0 && nx < n && ny >= 0 && ny < n && board[nx][ny] == 1) {
                return false;
            }
        }
        return true;
    }

    bool Dfs(int depth)
    {
        if (depth == n)
            return true;

        int color = colorOrder[depth];
        for (const auto& pos : positionsByColor[color]) {
            int x = pos.first;
            int y = pos.second;
            if (!CanPlace(x, y)) continue;

            usedRow |= (1 << x);
            usedCol |= (1 << y);
            board[x][y] = 1;

            if (Dfs(depth + 1))
                return true;

            board[x][y] = 0;
            usedRow &= ~(1 << x);
            usedCol &= ~(1 << y);
        }
        return false;
    }
};

#endif // SOLVER_H