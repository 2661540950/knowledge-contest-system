# 知识竞赛刷题系统

第十届法治合规暨廉洁文化知识竞赛（航空工业复材）在线刷题页面。纯静态站点，无构建步骤、无依赖，可直接托管在 GitHub Pages。

在线地址：<https://hg.266nya.cn>

## 题库概况

| 题型 | 数量 | 单题分值 | 小计 |
| --- | --- | --- | --- |
| 单选题 | 31 | 2 | 62 |
| 多选题 | 27 | 3 | 81 |
| 填空题 | 25 | 2 | 50 |
| 判断题 | 12 | 1 | 12 |
| 简答题 | 30 | 5 | 150 |
| **合计** | **125** | | **355** |

题库来源：`第十届法治合规暨廉洁文化知识竞赛题库.txt`（原始文档，125 题，其中填空题原文没有挖空，见下文）。

## 目录结构

```
index.html                        页面结构（首页 / 答题 / 结果 / 解析 / 错题本）
src/app.js                        答题流程与状态管理
src/styles.css                    样式（含移动端适配）
api/questions-api.js              题库加载 + 判分逻辑
api/fallback-questions.js         离线回退题库（自动生成，勿手改）
data/questions.json               题库数据（改题目只需要改这里）
tools/import-question-bank.mjs    从原始 TXT 生成题库的导入脚本
tools/fill-blanks.json            填空题挖空与答案（人工维护）
tools/legacy-analyses.json        旧 30 题题库里的解析，用于回填
tools/import-review.md            导入核对表（逐题列出题干/选项/答案/解析）
CNAME                             GitHub Pages 自定义域名
```

## 本地运行

题库通过 `fetch` 读取 `data/questions.json`，**用 HTTP 打开才能改题库即生效**：

```bash
npx serve .
# 或任意静态服务器，例如
python -m http.server 8000
```

直接双击 `index.html`（`file://`）也能用，但浏览器会拦截 fetch，页面自动回退到 `api/fallback-questions.js` 里的离线副本 —— 此时改 `data/questions.json` 不会生效。两份数据由导入脚本一起生成，不会漂移。

## 答题流程

| 题型 | 操作 | 按钮 |
| --- | --- | --- |
| 单选题、判断题 | 点选选项即判分 | 仅「跳过」 |
| 多选题、填空题、简答题 | 选完/填完点提交 | 「提交答案」+「跳过」 |

- **答对**：显示反馈，**1 秒后自动进入下一题**；最后一题答对则自动结算成绩。
- **答错 / 跳过**：必须手动点「下一题」；最后一题显示「交卷」。
- 答错和跳过的题目自动进入错题本（存 `localStorage` 的 `wrongBook` 键）。

四种模式：练习模式（可只练错题）、考试模式、随机测试（抽 20 题）、错题本模式。

> 考试模式目前与练习模式行为一致，**没有倒计时**，也不会延迟判分。

## 判分规则

- **单选题 / 填空题**：忽略大小写、空格以及中英文标点差异（`主体；监督` = `主体;监督` = `主体 监督`），但不忽略字的顺序。
- **多选题**：与选项顺序无关（`CBA` = `ABC`），少选或多选都算错。
- **判断题**：`true` / `false`。
- **简答题**：把标准答案按「、；，」等拆成要点，**命中率 ≥ 60% 即算正确**，反馈里显示「命中要点 x/y，遗漏：…」。列表式答案（`（1）xxx；（2）yyy`）会先剥掉序号再比对。

分值定义在 `api/questions-api.js` 的 `getScoreWeight()`，计分和满分都取自这里。

## 修改题库

编辑 `data/questions.json`：

```json
{
  "id": 1,
  "type": "single",
  "question": "题干（  ）",
  "options": { "A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D" },
  "answer": "A",
  "analysis": "解析"
}
```

`type` 取值：`single` 单选、`multiple` 多选、`truefalse` 判断、`fill` 填空、`short` 简答。
判断题 `options` 留空 `{}`，`answer` 写 `"true"` / `"false"`；填空题题干用 `______` 表示挖空。

改完 `data/questions.json` 后执行 `node tools/import-question-bank.mjs` 之类的导入流程，或手动同步 `api/fallback-questions.js`（该文件由脚本生成，不要手改）。

## 重新生成题库

```bash
node tools/import-question-bank.mjs
```

脚本会解析原始 TXT、写入 `data/questions.json` 和 `api/fallback-questions.js`，并输出 `tools/import-review.md` 供逐题核对。

原始 TXT 的格式问题都在脚本里做了兜底：编号重复/跳号、题号后漏写点号（`8违反…`）、选项与题干同行、多个选项挤在一行、选项跨行折断、选项缺分隔符（`A无效`、`D 开除党籍`）。

**填空题是特例**：原文只有完整陈述句，没有空位也没有答案键，挖空内容和答案由人工写在 `tools/fill-blanks.json` 里，脚本会把挖空填回去跟原文比对，不一致就报警告。

## 已知限制

- 125 题里有 **73 题没有解析**（原始 TXT 没写，只有旧 30 题题库里的 52 条已回填），答错时只显示正确答案。
- 简答题 60% 要点阈值对「列举类」答案是偏严的：例如「国家安全与保密管理的一级负面行为」拆出 9 个要点，要答对 6 个才算过。
- 考试模式没有倒计时。
