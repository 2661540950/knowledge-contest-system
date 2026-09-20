/**
 * 题库 API 层
 *
 * 题库优先从 data/questions.json 运行时加载（改题目只需改 JSON）；
 * 若通过 file:// 直接双击打开页面，fetch 会被浏览器拦截，
 * 此时自动回退到 api/fallback-questions.js 里的离线副本，功能不受影响。
 */

const QUIZ_DATA_URL = 'data/questions.json';

// 离线回退题库：由 tools/import-question-bank.mjs 生成到 api/fallback-questions.js
// （file:// 直接打开页面时 fetch 会被浏览器拦截，用这份数据兜底）
const QUIZ_DATA = window.QUIZ_FALLBACK_DATA || { questions: [] };

class QuestionsAPI {
  constructor() {
    this.questions = [];
    this.loaded = false;
    this.metadata = {};
  }

  // 加载题库数据：先尝试 data/questions.json，失败则用内置副本
  async loadQuestions(force = false) {
    if (this.loaded && !force) {
      return this.questions;
    }

    let data = null;
    let source = '离线回退题库（api/fallback-questions.js）';

    try {
      const res = await fetch(QUIZ_DATA_URL, { cache: 'no-cache' });
      if (res.ok) {
        const parsed = await res.json();
        if (this.isValidData(parsed)) {
          data = parsed;
          source = QUIZ_DATA_URL;
        } else {
          console.warn(`⚠️ ${QUIZ_DATA_URL} 结构不合法（缺少 questions 数组），改用离线回退题库`);
        }
      } else {
        console.warn(`⚠️ 读取 ${QUIZ_DATA_URL} 失败（HTTP ${res.status}），改用离线回退题库`);
      }
    } catch (error) {
      console.warn(`⚠️ 无法读取 ${QUIZ_DATA_URL}（${error.message}），改用离线回退题库`);
    }

    if (!this.isValidData(data)) {
      data = QUIZ_DATA;
    }
    if (!this.isValidData(data)) {
      throw new Error('题库不可用：data/questions.json 读取失败，且 api/fallback-questions.js 没有加载（请检查 index.html 的 script 标签顺序）');
    }

    this.questions = data.questions;
    this.metadata = {
      title: data.title,
      company: data.company,
      generatedAt: data.generatedAt,
      totalQuestions: this.questions.length,
      source
    };
    this.loaded = true;
    console.log(`✅ 题库加载成功: ${this.questions.length} 道题（来源：${source}）`);
    return this.questions;
  }

  isValidData(data) {
    return !!data && Array.isArray(data.questions) && data.questions.length > 0;
  }

  // 获取所有题目
  async getAllQuestions() {
    await this.loadQuestions();
    return this.questions;
  }

  // 获取指定类型的题目
  async getQuestionsByType(type) {
    await this.loadQuestions();
    return this.questions.filter(q => q.type === type);
  }

  // 获取随机题目
  async getRandomQuestions(count, type = null) {
    await this.loadQuestions();
    let pool = type ? this.questions.filter(q => q.type === type) : this.questions;
    
    // 洗牌算法
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, pool.length));
  }

  // 获取单个题目
  async getQuestionById(id) {
    await this.loadQuestions();
    return this.questions.find(q => q.id === parseInt(id));
  }

  // 获取题型统计
  async getTypeStatistics() {
    await this.loadQuestions();
    const stats = {};
    this.questions.forEach(q => {
      stats[q.type] = (stats[q.type] || 0) + 1;
    });
    return stats;
  }

  // 验证答案
  verifyAnswer(questionId, userAnswer) {
    const question = this.questions.find(q => q.id === parseInt(questionId));
    if (!question) {
      return { correct: false, error: '题目不存在' };
    }

    const isCorrect = this.checkAnswer(question.answer, userAnswer, question.type);
    const result = {
      correct: isCorrect,
      correctAnswer: question.answer,
      analysis: question.analysis,
      type: question.type
    };

    // 简答题：把要点命中情况补充到解析里，方便用户知道差在哪
    if (question.type === 'short') {
      const detail = this.matchShortAnswer(question.answer, userAnswer);
      const hit = `命中要点 ${detail.matched.length}/${detail.total}`;
      const miss = detail.missing.length ? `，遗漏：${detail.missing.join('、')}` : '';
      result.analysis = `${hit}${miss}。${question.analysis || ''}`;
    }

    return result;
  }

  /**
   * 检查答案是否正确
   * @param {string} correctAnswer 标准答案
   * @param {string} userAnswer    用户答案
   * @param {string} type          题型（multiple/short 需要特殊规则）
   *
   * 修正了旧逻辑按「答案字符串长度」猜测题型的 bug：
   * 旧代码把长度 2~4 的填空题当成多选题排序比较，
   * 导致「长治久安」输入乱序的「安久治长」也被判对。
   */
  checkAnswer(correctAnswer, userAnswer, type) {
    if (correctAnswer === undefined || correctAnswer === null) return false;
    if (userAnswer === undefined || userAnswer === null) return false;

    const correct = String(correctAnswer).trim();
    const user = String(userAnswer).trim();
    if (!correct || !user) return false;

    // 判断题
    if (correct === 'true' || correct === 'false') {
      return this.normalizeText(user) === this.normalizeText(correct);
    }

    // 多选题：与选项顺序无关
    if (type === 'multiple') {
      const norm = value => this.normalizeText(value).split('').sort().join('');
      return norm(correct) === norm(user);
    }

    // 简答题：按要点命中率判分
    if (type === 'short') {
      return this.matchShortAnswer(correct, user).passed;
    }

    // 单选题 / 填空题：忽略大小写、空白以及中英文标点差异
    return this.normalizeText(correct) === this.normalizeText(user);
  }

  // 去掉所有空白与标点后再比较（「主体；监督」等价于「主体;监督」「主体 监督」）
  normalizeText(text) {
    return String(text).replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
  }

  /**
   * 简答题判分：把标准答案按「、；，」等拆成要点，命中比例达到 passRatio 即算正确。
   *
   * 旧逻辑用全等字符串比较，用户把「、」写成「,」就判错，实际上等于答不对。
   * 需要注意题库里有两种答案写法：
   *   - 「科学立法、严格执法、公正司法」这类并列要点
   *   - 「（1）xxx；（2）yyy」这类列表式答案
   * 后者要先剥掉「（1）」这种序号，否则用户不可能输入「1xxx」而永远判错。
   */
  matchShortAnswer(correctAnswer, userAnswer, passRatio = 0.6) {
    const segments = String(correctAnswer)
      .split(/[、，,；;。.！!？?\s]+/)
      .map(s => this.normalizeText(s.replace(/^[（(]?\s*\d+\s*[）)]?\s*[.．、]?\s*/, '')))
      // 纯序号（如列表编号「1」）和过短的片段不作为要点
      .filter(s => s.length >= 2 && /\p{L}/u.test(s));
    const user = this.normalizeText(userAnswer);

    if (!segments.length) {
      const same = this.normalizeText(correctAnswer) === user;
      return { passed: same, ratio: same ? 1 : 0, matched: [], missing: [], total: 0 };
    }

    const matched = [];
    const missing = [];
    segments.forEach(seg => (user.includes(seg) ? matched : missing).push(seg));

    const ratio = matched.length / segments.length;
    return { passed: ratio >= passRatio, ratio, matched, missing, total: segments.length };
  }

  // 各题型分值（app.js 的计分与满分都以此为准）
  getScoreWeight(type) {
    return ({ single: 2, multiple: 3, truefalse: 1, fill: 2, short: 5 })[type] || 1;
  }

  // 一组题目的满分
  getMaxScore(questions) {
    const list = questions || this.questions;
    return list.reduce((sum, q) => sum + this.getScoreWeight(q.type), 0);
  }

  // 获取题型名称
  getTypeName(type) {
    const typeNames = {
      'single': '单选题',
      'multiple': '多选题',
      'fill': '填空题',
      'truefalse': '判断题',
      'short': '简答题'
    };
    return typeNames[type] || type;
  }
}

// 创建全局 API 实例
window.questionsAPI = new QuestionsAPI();
