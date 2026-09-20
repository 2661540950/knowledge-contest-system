# 知识竞赛刷题系统

第十届法治合规暨廉洁文化知识竞赛（航空工业复材）在线刷题页面。纯静态站点，无构建步骤、无依赖，可直接托管在 GitHub Pages。

在线地址：<https://hg.266nya.cn>

## 目录结构

```
index.html              页面结构（首页 / 答题 / 结果 / 解析 / 错题本 五个界面）
src/app.js              答题流程与状态管理
src/styles.css          样式（含移动端适配）
api/questions-api.js    题库加载 + 判分逻辑
data/questions.json     题库数据（改题目只需要改这里）
CNAME                   GitHub Pages 自定义域名
```

## 本地运行

因为题库是通过 `fetch` 读取 `data/questions.json` 的，**用 HTTP 打开才能改题库即生效**：

```bash
npx serve .
# 或任意静态服务器，例如
python -m http.server 8000
```

直接双击 `index.html`（`file://`）也能用，但浏览器会拦截 fetch，页面会自动回退到 `api/questions-api.js` 里内置的题库副本 —— 此时改 `data/questions.json` 不会生效。

## 答题流程

| 题型 | 操作 | 按钮 |
| --- | --- | --- |
| 单选题、判断题 | 点选选项即判分 | 仅「跳过」 |
| 多选题、填空题、简答题 | 选完/填完点提交 | 「提交答案」+「跳过」 |

- **答对**：显示反馈，**1 秒后自动进入下一题**；最后一题答对则自动结算成绩。
- **答错 / 跳过**：必须手动点「下一题」；最后一题显示「交卷」。
- 答错和跳过的题目都会自动进入错题本（存 `localStorage` 的 `wrongBook` 键）。

四种模式：练习模式（可只练错题）、考试模式、随机测试（抽 20 题）、错题本模式。

> 说明：考试模式目前与练习模式行为一致，**没有倒计时**，也不会延迟判分。首页文案已按实际行为调整。

## 评分规则

| 题型 | 单题分值 |
| --- | --- |
| 判断题 | 1 |
| 单选题、填空题 | 2 |
| 多选题 | 3 |
| 简答题 | 5 |

当前题库满分 **66 分**（15×2 + 5×3 + 5×1 + 3×2 + 2×5）。分值定义在 `api/questions-api.js` 的 `getScoreWeight()`，计分和满分都取自这里，改一处即可。

判分细节：

- **单选题 / 填空题**：忽略大小写、空格以及中英文标点差异（`主体；监督` = `主体;监督` = `主体 监督`），但不忽略字的顺序。
- **多选题**：与选项顺序无关（`CBA` = `ABC`），少选或多选都算错。
- **判断题**：`true` / `false`。
- **简答题**：把标准答案按「、；，」等拆成要点，**命中率 ≥ 60% 即算正确**，反馈里会显示「命中要点 x/y，遗漏：…」。

## 修改题库

编辑 `data/questions.json`：

```json
{
  "title": "题库标题",
  "company": "单位名称",
  "generatedAt": "2026-08-31",
  "totalQuestions": 30,
  "questions": [
    {
      "id": 1,
      "type": "single",
      "question": "题干",
      "options": { "A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D" },
      "answer": "A",
      "analysis": "解析"
    }
  ]
}
```

`type` 取值：`single` 单选、`multiple` 多选、`truefalse` 判断、`fill` 填空、`short` 简答。
判断题 `options` 留空 `{}`，`answer` 写 `"true"` / `"false"`。

> ⚠️ `api/questions-api.js` 里的 `QUIZ_DATA` 是给 `file://` 场景用的离线副本。如果主要在 GitHub Pages 上用，改 `data/questions.json` 就够了；想让双击打开也同步，需要同时更新 `QUIZ_DATA`。
