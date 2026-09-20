/**
 * 题库导入脚本：把「第十届法治合规暨廉洁文化知识竞赛题库.txt」解析成 data/questions.json
 *
 * 源文件格式很脏，解析时按以下顺序处理：
 *   1. 按「一、单选题」等大题标题切分章节
 *   2. 以行首「数字+点」切分题目块（源文件里单选第 8 题漏了点号，单独兜底）
 *   3. 选择题：从题干括号里取出答案（单选 1 个字母、多选 2~5 个字母），
 *      把括号还原成「（  ）」避免把答案暴露给答题者；再按 A→E 顺序切出选项
 *   4. 判断题：取「答案：√/×」；简答题：取「答：/答案：/参考答案：」之后的内容
 *   5. 填空题：源文件没有空格和答案，挖空内容从 tools/fill-blanks.json 读取（人工编写）
 *   6. 跨行内容合并：句末标点或列表序号处补「；」，其余（被折断的词）直接拼接
 *
 * 同时会用旧的 data/questions.json 里已有的「解析」按题干文本回填。
 *
 * 用法：node tools/import-question-bank.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_TXT = join(ROOT, "第十届法治合规暨廉洁文化知识竞赛题库.txt");
const FILL_BLANKS = join(ROOT, "tools", "fill-blanks.json");
const LEGACY_ANALYSES = join(ROOT, "tools", "legacy-analyses.json");
const OUT_JSON = join(ROOT, "data", "questions.json");
const OUT_FALLBACK = join(ROOT, "api", "fallback-questions.js");
const REVIEW = join(ROOT, "tools", "import-review.md");

const warnings = [];
const warn = (msg) => warnings.push(msg);

// ---------- 文本工具 ----------

// 合并被折行的内容：句末标点或列表序号处补「；」，其余直接拼接（中文换行不产生空格）
// 下一行本身就是选项行时不补分隔符（选项边界由 parseChoice 单独切分）
function joinWrapped(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l !== "");
  let out = "";
  for (const line of lines) {
    if (!out) { out = line; continue; }
    const startsOption = /^[A-E]\s*[.．、]?\s*\S/.test(line);
    const startsItem = /^[（(]\s*\d+\s*[）)]/.test(line) || /^\d+\s*[.．、]/.test(line);
    const prevCloses = /[。！？；;.]$/.test(out);
    out += (startsItem || (prevCloses && !startsOption)) ? "；" + line : line;
  }
  return out.trim();
}

// 去掉合并行时插入的行尾分隔符
const stripJoinSeparator = (s) => s.replace(/[；;]\s*$/, "").trim();

const tidy = (s) => s.replace(/[ \t\u3000]+/g, " ").trim();

// 去掉开头的题号：1. / 8违反 / 23.\t
function stripLeadingNumber(line) {
  return line.replace(/^\s*\d+\s*[.．、]?\s*/, "");
}

// ---------- 章节切分 ----------

const SECTION_HEADERS = [
  { type: "single", title: "单选题" },
  { type: "multiple", title: "多选题" },
  { type: "fill", title: "填空题" },
  { type: "truefalse", title: "判断题" },
  { type: "short", title: "简答题" },
];

function splitSections(text) {
  const lines = text.split(/\r?\n/);
  const found = [];
  lines.forEach((line, i) => {
    const m = line.match(/^\s*[一二三四五六七八九十]+、\s*(单选题|多选题|填空题|判断题|简答题)\s*$/);
    if (m) found.push({ title: m[1], start: i });
  });
  const sections = {};
  found.forEach((f, idx) => {
    const end = idx + 1 < found.length ? found[idx + 1].start : lines.length;
    sections[f.title] = lines.slice(f.start + 1, end);
  });
  for (const s of SECTION_HEADERS) {
    if (!sections[s.title]) warn(`源文件里没找到「${s.title}」章节`);
  }
  return sections;
}

// 把一个章节切成题目块（按行首题号）
function splitBlocks(lines) {
  const blocks = [];
  let cur = null;
  for (const raw of lines) {
    if (raw.trim() === "") continue;
    const isNew = /^\s*\d+\s*[.．、]?\s*(?=\S)/.test(raw);
    if (isNew) {
      if (cur) blocks.push(cur);
      cur = { no: parseInt(raw.match(/^\s*(\d+)/)[1], 10), lines: [stripLeadingNumber(raw)] };
    } else if (cur) {
      cur.lines.push(raw.trim());
    } else {
      warn(`章节开头有孤立内容：${raw.slice(0, 40)}`);
    }
  }
  if (cur) blocks.push(cur);
  return blocks;
}

// ---------- 选择题 ----------

function optionMarkerRegex(letter) {
  // 源文件里选项写法很杂，按优先级依次尝试：
  //   1. 前面不是字母数字 + 有分隔符：A.xxx / A、xxx
  //   2. 有分隔符（前面可能是上一选项的结尾，如 A.3B.4 被合并成一行）
  //   3. 无分隔符，后面直接跟中文：A无效 / D 开除党籍
  return new RegExp(
    `(?<![A-Za-z0-9])${letter}\\s*[.．、]\\s*` +
    `|${letter}\\s*[.．、]\\s*` +
    `|(?<![A-Za-z0-9])${letter}\\s*(?=[\\u4e00-\\u9fff（(])`,
    "g"
  );
}

function parseChoice(block, type) {
  const text = joinWrapped(block.lines.join("\n"));

  // 单选括号里恰好 1 个字母，多选 2~5 个字母，以此区分题干里的其它括号
  const answerPattern = type === "single"
    ? /[（(]\s*([A-E])\s*[）)]/
    : /[（(]\s*([A-E]{2,5})\s*[）)]/;
  const answerMatch = text.match(answerPattern);
  if (!answerMatch) {
    warn(`[${type} ${block.no}] 找不到答案括号：${text.slice(0, 50)}`);
    return null;
  }
  if (type === "multiple" && !/^[A-E]+$/.test(answerMatch[1])) {
    warn(`[${type} ${block.no}] 答案格式可疑：${answerMatch[1]}`);
  }

  const answer = answerMatch[1];
  const stemText = text.replace(answerMatch[0], "（  ）");

  // 按 A→E 顺序找选项分界
  const bounds = [];
  let cursor = 0;
  for (const letter of ["A", "B", "C", "D", "E"]) {
    const re = optionMarkerRegex(letter);
    re.lastIndex = cursor;
    const m = re.exec(stemText);
    if (!m) break;
    bounds.push({ letter, start: m.index, end: m.index + m[0].length });
    cursor = m.index + m[0].length;
  }

  if (bounds.length < 2) {
    warn(`[${type} ${block.no}] 只解析出 ${bounds.length} 个选项：${text.slice(0, 50)}`);
    return null;
  }
  if (bounds[0].letter !== "A") warn(`[${type} ${block.no}] 选项不是从 A 开始`);

  const stem = stripJoinSeparator(tidy(stemText.slice(0, bounds[0].start)));
  const options = {};
  bounds.forEach((b, i) => {
    const to = i + 1 < bounds.length ? bounds[i + 1].start : stemText.length;
    const value = tidy(stemText.slice(b.end, to)).replace(/\s+/g, " ");
    options[b.letter] = value;
  });

  for (const [k, v] of Object.entries(options)) {
    if (!v) warn(`[${type} ${block.no}] 选项 ${k} 是空的`);
  }
  const answerLetters = answer.split("");
  for (const l of answerLetters) {
    if (!options[l]) warn(`[${type} ${block.no}] 答案 ${answer} 里的 ${l} 没有对应选项`);
  }
  if (type === "single" && answerLetters.length !== 1) {
    warn(`[${type} ${block.no}] 单选题答案不是 1 个字母：${answer}`);
  }
  if (type === "multiple" && answerLetters.length < 2) {
    warn(`[${type} ${block.no}] 多选题答案少于 2 个字母：${answer}`);
  }

  return { question: stem, options, answer: answerLetters.sort().join("") };
}

// ---------- 判断题 ----------

function parseTrueFalse(block) {
  const text = joinWrapped(block.lines.join("\n"));
  const m = text.match(/答\s*案\s*[：:]\s*([√×✓✗]|正确|错误)/);
  if (!m) {
    warn(`[truefalse ${block.no}] 找不到答案：${text.slice(0, 50)}`);
    return null;
  }
  const raw = m[1];
  const answer = (raw === "√" || raw === "✓" || raw === "正确") ? "true" : "false";
  const stem = stripJoinSeparator(tidy(text.replace(m[0], "").replace(/[（(]\s*[）)]\s*$/, "").replace(/[（(]\s*[）)]/g, "")));
  if (!stem) warn(`[truefalse ${block.no}] 题干为空`);
  return { question: stem, options: {}, answer };
}

// ---------- 简答题 ----------

function parseShort(block) {
  const text = joinWrapped(block.lines.join("\n"));
  const m = text.match(/(?:参考)?答\s*案?\s*[：:]/);
  if (!m) {
    // 源文件第 24、25 题没有「答：」前缀，题干只有一行，其余都是答案
    const first = tidy(block.lines[0]);
    const rest = joinWrapped(block.lines.slice(1).join("\n"));
    if (!rest) {
      warn(`[short ${block.no}] 找不到答案：${text.slice(0, 50)}`);
      return null;
    }
    warn(`[short ${block.no}] 没有「答：」前缀，按「首行题干、其余答案」处理`);
    return { question: stripJoinSeparator(stripLeadingNumber(first)), answer: rest };
  }
  const question = stripJoinSeparator(tidy(text.slice(0, m.index)));
  const answer = tidy(text.slice(m.index + m[0].length));
  if (!question) warn(`[short ${block.no}] 题干为空`);
  if (!answer) warn(`[short ${block.no}] 答案为空`);
  return { question, answer };
}

// ---------- 填空题（挖空来自人工维护的 fill-blanks.json） ----------

function parseFill(lines, blanks) {
  const blocks = splitBlocks(lines);
  const byNo = new Map(blanks.map((b) => [b.no, b]));
  const out = [];
  for (const b of blocks) {
    const authored = byNo.get(b.no);
    if (!authored) {
      warn(`[fill ${b.no}] fill-blanks.json 里没有对应的挖空内容`);
      continue;
    }
    const sourceText = joinWrapped(b.lines.join("\n"));
    // 校验：把挖空用答案填回去后，应与原文一致（忽略标点与空白），防止抄错或漏句
    const strip = (s) => s.replace(/[^\p{L}\p{N}]/gu, "");
    const answers = String(authored.answer).split("；");
    const blankCount = (authored.question.match(/[_＿]{2,}/g) || []).length;
    if (blankCount !== answers.length) {
      warn(`[fill ${b.no}] 挖空 ${blankCount} 处，但答案有 ${answers.length} 段，数量不一致`);
    }
    let filled = authored.question;
    for (const a of answers) filled = filled.replace(/[_＿]{2,}/, a);
    if (strip(filled) !== strip(sourceText)) {
      warn(`[fill ${b.no}] 挖空+答案回填后与原文不一致，请核对`);
    }
    out.push({ no: b.no, question: authored.question, options: {}, answer: authored.answer, analysis: authored.analysis });
  }
  if (blocks.length !== blanks.length) {
    warn(`[fill] 源文件 ${blocks.length} 题，fill-blanks.json ${blanks.length} 题，数量不一致`);
  }
  return out;
}

// ---------- 主流程 ----------

const rawText = readFileSync(SOURCE_TXT, "utf8");
const sections = splitSections(rawText);
const blanks = JSON.parse(readFileSync(FILL_BLANKS, "utf8"));

const parsed = { single: [], multiple: [], fill: [], truefalse: [], short: [] };

for (const block of splitBlocks(sections["单选题"] || [])) {
  const q = parseChoice(block, "single");
  if (q) parsed.single.push({ sourceNo: block.no, ...q });
}
for (const block of splitBlocks(sections["多选题"] || [])) {
  const q = parseChoice(block, "multiple");
  if (q) parsed.multiple.push({ sourceNo: block.no, ...q });
}
parsed.fill = parseFill(sections["填空题"] || [], blanks).map((q) => ({ sourceNo: q.no, ...q }));
for (const block of splitBlocks(sections["判断题"] || [])) {
  const q = parseTrueFalse(block);
  if (q) parsed.truefalse.push({ sourceNo: block.no, ...q });
}
for (const block of splitBlocks(sections["简答题"] || [])) {
  const q = parseShort(block);
  if (q) parsed.short.push({ sourceNo: block.no, ...q });
}

// 编号去重后重新编号（源文件单选 6 重复、简答 13 跳过 21 重复）
const questions = [];
const typeOrder = ["single", "multiple", "fill", "truefalse", "short"];
const typeTitles = { single: "单选题", multiple: "多选题", fill: "填空题", truefalse: "判断题", short: "简答题" };
for (const type of typeOrder) {
  parsed[type].forEach((q, i) => {
    questions.push({
      id: questions.length + 1,
      type,
      question: q.question,
      options: q.options || {},
      answer: q.answer,
      analysis: q.analysis || "",
      source: `${typeTitles[type]} 源题号 ${q.sourceNo}`,
    });
  });
}

// 用旧题库里的「解析」按题干回填（旧 30 题里有解析的那部分）
const LEGACY = JSON.parse(readFileSync(LEGACY_ANALYSES, "utf8"));
const norm = (s) => String(s).replace(/[^\p{L}\p{N}]/gu, "");
const oldAnalysis = new Map();
const oldPrefix = new Map();
const oldPrefixSource = new Map();
const prefixMatched = [];
const prefixOf = (s) => norm(s).slice(0, 10);
const prefixSeen = new Map();
for (const item of LEGACY.items) {
  oldAnalysis.set(norm(item.question), item.analysis);
  const p = prefixOf(item.question);
  prefixSeen.set(p, (prefixSeen.get(p) || 0) + 1);
  oldPrefix.set(p, item.analysis);
  oldPrefixSource.set(p, item.question);
}

let reusedExact = 0;
let reusedPrefix = 0;
for (const q of questions) {
  if (q.analysis) continue;
  const key = norm(q.question);
  if (oldAnalysis.has(key)) {
    q.analysis = oldAnalysis.get(key);
    reusedExact++;
    continue;
  }
  // 源文件与旧题库措辞略有差异（旧题库删过句尾从句），用前 10 字前缀兜底，
  // 但只在该前缀唯一时采用，避免张冠李戴
  const p = prefixOf(q.question);
  if (prefixSeen.get(p) === 1) {
    q.analysis = oldPrefix.get(p);
    reusedPrefix++;
    prefixMatched.push(`${q.source} ← 「${oldPrefixSource.get(p)}」`);
  }
}
const reused = reusedExact + reusedPrefix;

const payload = {
  title: LEGACY.title,
  company: LEGACY.company,
  generatedAt: new Date().toISOString().slice(0, 10),
  sourceFile: "第十届法治合规暨廉洁文化知识竞赛题库.txt",
  totalQuestions: questions.length,
  questions,
};

writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n", "utf8");
writeFileSync(
  OUT_FALLBACK,
  `/**\n * file:// 离线回退题库（由 tools/import-question-bank.mjs 从 data/questions.json 生成，请勿手改）\n */\nwindow.QUIZ_FALLBACK_DATA = ${JSON.stringify(payload, null, 2)};\n`,
  "utf8"
);

// ---------- 校验报告 ----------

const weight = { single: 2, multiple: 3, truefalse: 1, fill: 2, short: 5 };
const maxScore = questions.reduce((s, q) => s + (weight[q.type] || 1), 0);
const counts = {};
for (const q of questions) counts[q.type] = (counts[q.type] || 0) + 1;

const lines = [];
lines.push("# 题库导入核对表", "");
lines.push(`源文件：\`${payload.sourceFile}\``);
lines.push(`生成时间：${payload.generatedAt}`);
lines.push(`题目总数：**${questions.length}**，理论满分：**${maxScore}**`);
lines.push("");
lines.push("## 各题型数量", "");
lines.push("| 题型 | 数量 | 单题分值 | 小计 |");
lines.push("| --- | --- | --- | --- |");
for (const t of typeOrder) {
  lines.push(`| ${typeTitles[t]} | ${counts[t] || 0} | ${weight[t]} | ${(counts[t] || 0) * weight[t]} |`);
}
lines.push(`| **合计** | **${questions.length}** | | **${maxScore}** |`);
lines.push("");
lines.push(`旧题库解析回填：${reused} 条（精确匹配 ${reusedExact} 条、前缀匹配 ${reusedPrefix} 条）`);
if (prefixMatched.length) {
  lines.push("");
  lines.push("前缀匹配的对应关系（人工确认过，题干措辞与旧题库略有差异）：");
  prefixMatched.forEach((m) => lines.push(`- ${m}`));
}
lines.push(`其余 ${questions.length - questions.filter((q) => q.analysis).length} 题源文件里没有解析，字段为空`);
lines.push("");
if (warnings.length) {
  lines.push("## ⚠️ 解析警告", "");
  warnings.forEach((w) => lines.push(`- ${w}`));
  lines.push("");
} else {
  lines.push("## 解析警告", "", "无。", "");
}
lines.push("## 逐题核对", "");
for (const q of questions) {
  lines.push(`### ${q.id}. [${q.type}] ${q.source}`);
  lines.push(`**题干**：${q.question}`);
  if (Object.keys(q.options).length) {
    lines.push("");
    for (const [k, v] of Object.entries(q.options)) lines.push(`- ${k}. ${v}`);
  }
  lines.push("");
  lines.push(`**答案**：${q.answer}`);
  lines.push(`**解析**：${q.analysis || "（无）"}`);
  lines.push("");
}
writeFileSync(REVIEW, lines.join("\n"), "utf8");

console.log(`题目总数: ${questions.length}  满分: ${maxScore}`);
console.log(`题型分布: ${JSON.stringify(counts)}`);
console.log(`解析回填: ${reused} 条`);
console.log(`警告: ${warnings.length} 条`);
warnings.forEach((w) => console.log(`  ! ${w}`));
console.log(`已写入: data/questions.json, api/fallback-questions.js, tools/import-review.md`);
