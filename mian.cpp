#include <iostream>
#include <vector>
#include <map>
#include <utility>
#include "solver.h"
using std::cin;
using std::cout;
using std::endl;
using std::vector;
using std::map;
using std::pair;

int main()
{
    int n = 0;
    if (!(cin >> n) || n <= 0) {
        cout << "No solution" << endl;
        return 0;
    }

    vector<vector<pair<int, int>>> cattles(n);
    map<char, int> colornum;
    int colorcnt = 0;

    char colorch;
    for (int i = 0; i < n; ++i) {
        for (int j = 0; j < n; ++j) {
            if (!(cin >> colorch)) {
                cout << "No solution" << endl;
                return 0;
            }
            if (colornum.find(colorch) == colornum.end()) {
                if (colorcnt >= n) {
                    cout << "No solution" << endl;
                    return 0;
                }
                colornum[colorch] = colorcnt;
                ++colorcnt;
            }
            cattles[colornum[colorch]].push_back({ i,j });
        }
    }

    if (colorcnt != n) {
        cout << "No solution" << endl;
        return 0;
    }

    Solver solver(n, cattles);
    if (!solver.Dfs(0)) {
        cout << "No solution" << endl;
        return 0;
    }

    for (int i = 0; i < n; ++i) {
        for (int j = 0; j < n; ++j)
            cout << solver.board[i][j] << ' ';
        cout << endl;
    }

    return 0;
}