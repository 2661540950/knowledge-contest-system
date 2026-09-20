/**
 * 题库 API 层
 *
 * 题库优先从 data/questions.json 运行时加载（改题目只需改 JSON）；
 * 若通过 file:// 直接双击打开页面，fetch 会被浏览器拦截，
 * 此时自动回退到文件末尾内置的题库副本，功能不受影响。
 */

const QUIZ_DATA_URL = 'data/questions.json';

// 内置题库（data/questions.json 的副本，仅作为离线回退）
const QUIZ_DATA = {
  "title": "第十届法治合规暨廉洁文化知识竞赛题库",
  "company": "航空工业复材",
  "generatedAt": "2026-08-31",
  "totalQuestions": 30,
  "questions": [
    {
      "id": 1,
      "type": "single",
      "question": "中央全面依法治国工作会议明确，习近平法治思想是全面依法治国的（ ）",
      "options": {
        "A": "指导思想",
        "B": "基本原则",
        "C": "根本遵循",
        "D": "行动指南"
      },
      "answer": "A",
      "analysis": "习近平法治思想是全面依法治国的指导思想。"
    },
    {
      "id": 2,
      "type": "single",
      "question": "推进全面依法治国的根本目的是（ ）",
      "options": {
        "A": "维护社会稳定",
        "B": "依法保障人民权益",
        "C": "促进经济发展",
        "D": "巩固党的执政地位"
      },
      "answer": "B",
      "analysis": "推进全面依法治国的根本目的是依法保障人民权益。"
    },
    {
      "id": 3,
      "type": "single",
      "question": "要把全面依法治国放在（ ）战略布局中来把握",
      "options": {
        "A": "五位一体",
        "B": "四个全面",
        "C": "四个自信",
        "D": "两个维护"
      },
      "answer": "B",
      "analysis": "要把全面依法治国放在'四个全面'战略布局中来把握。"
    },
    {
      "id": 4,
      "type": "single",
      "question": "要把严的标准、严的措施贯穿于管党治党全过程和各方面。坚持依规治党、标本兼治，坚持把 ( ) 挺在前面，加强组织性纪律性。",
      "options": {
        "A": "规矩",
        "B": "党章",
        "C": "条例",
        "D": "纪律"
      },
      "answer": "D",
      "analysis": "坚持把纪律挺在前面。"
    },
    {
      "id": 5,
      "type": "single",
      "question": "党必须保证国家的立法、司法、行政、( ) 机关，经济、文化组织和人民团体积极主动地、独立负责地、协调一致地工作。",
      "options": {
        "A": "逮捕",
        "B": "审判",
        "C": "检察",
        "D": "监察"
      },
      "answer": "D",
      "analysis": "党必须保证国家的立法、司法、行政、监察机关协调一致地工作。"
    },
    {
      "id": 6,
      "type": "single",
      "question": "干扰巡视巡察工作或者不落实巡视巡察整改要求，情节严重的，给予（ ）处分。",
      "options": {
        "A": "警告或者严重警告",
        "B": "严重警告或者撤销党内职务",
        "C": "撤销党内职务或者留党察看",
        "D": "开除党籍"
      },
      "answer": "D",
      "analysis": "干扰巡视巡察工作情节严重的，给予开除党籍处分。"
    },
    {
      "id": 7,
      "type": "single",
      "question": "生活奢靡、铺张浪费、贪图享乐、追求低级趣味，造成不良影响的，情节严重的，给予（ ）处分。",
      "options": {
        "A": "警告",
        "B": "严重警告",
        "C": "撤销党内职务",
        "D": "开除党籍"
      },
      "answer": "C",
      "analysis": "生活奢靡造成不良影响情节严重的，给予撤销党内职务处分。"
    },
    {
      "id": 8,
      "type": "single",
      "question": "违反接待管理规定，超标准、超范围接待或者借机大吃大喝，对直接责任者和领导责任者，情节严重的，给予（ ）处分。",
      "options": {
        "A": "留党察看",
        "B": "撤销党内职务",
        "C": "严重警告",
        "D": "警告"
      },
      "answer": "B",
      "analysis": "超标准接待情节严重的，给予撤销党内职务处分。"
    },
    {
      "id": 9,
      "type": "single",
      "question": "利用职权或者职务上的影响，违反有关规定占用公物归个人使用，时间超过（ ），情节较重的，给予警告或者严重警告处分。",
      "options": {
        "A": "一个月",
        "B": "三个月",
        "C": "六个月",
        "D": "一年"
      },
      "answer": "C",
      "analysis": "占用公物归个人使用超过六个月，情节较重的给予处分。"
    },
    {
      "id": 10,
      "type": "single",
      "question": "新修订的《中国共产党廉洁自律准则》，以（ ）作为根本遵循。",
      "options": {
        "A": "政治纪律",
        "B": "纲领",
        "C": "党章",
        "D": "党纪"
      },
      "answer": "C",
      "analysis": "《中国共产党廉洁自律准则》以党章为根本遵循。"
    },
    {
      "id": 11,
      "type": "single",
      "question": "下列哪种情形不属于重大法律纠纷案件？（ ）",
      "options": {
        "A": "涉案金额超过 5000 万元人民币的案件",
        "B": "涉嫌单位犯罪的案件",
        "C": "涉案金额超过本单位上一年度经审计净利润 5%，且金额超过 1000 万元的案件",
        "D": "可能产生较大影响的群体性案件"
      },
      "answer": "C",
      "analysis": "选项 C 不属于重大法律纠纷案件的认定标准。"
    },
    {
      "id": 12,
      "type": "single",
      "question": "合规及内部控制日常自查责任主体是（ ）",
      "options": {
        "A": "审计法务部",
        "B": "各业务部门",
        "C": "纪检部",
        "D": "风控管理岗"
      },
      "answer": "B",
      "analysis": "各业务部门是合规及内部控制日常自查的责任主体。"
    },
    {
      "id": 13,
      "type": "single",
      "question": "下列哪项不属于招标人未依法履行招标程序的风险？（ ）",
      "options": {
        "A": "依法应当公开招标而采用邀请招标",
        "B": "将依法必须进行招标的项目化整为零规避招标",
        "C": "招标文件时限不符合法律规定",
        "D": "招投标监督机构行使职权侵犯其合法权益"
      },
      "answer": "D",
      "analysis": "选项 D 不属于招标人未依法履行招标程序的风险。"
    },
    {
      "id": 14,
      "type": "single",
      "question": "有关建立合规管理的'三道防线'表述正确的是（ ）。",
      "options": {
        "A": "设计企业合规组织及其职责中，需明确职能管理部门和执行部门的合规管理职责",
        "B": "内部审计部门和纪检部门作为第一道防线",
        "C": "第二道防线主要负责合规管理体系的建设",
        "D": "第三道防线多由法律事务、风险控制、内控等作为合规管理的专责部门"
      },
      "answer": "C",
      "analysis": "第二道防线主要负责合规管理体系的建设。"
    },
    {
      "id": 15,
      "type": "single",
      "question": "法治是国家治理体系和治理能力的（ ）",
      "options": {
        "A": "核心内容",
        "B": "重要依托",
        "C": "根本保障",
        "D": "关键支撑"
      },
      "answer": "B",
      "analysis": "法治是国家治理体系和治理能力的重要依托。"
    },
    {
      "id": 16,
      "type": "multiple",
      "question": "根据《中国共产党纪律处分条例》的规定，党员受留党察看处分期间，没有（ ）权利。",
      "options": {
        "A": "表决权",
        "B": "选举权",
        "C": "被选举权",
        "D": "发言权"
      },
      "answer": "ABC",
      "analysis": "党员受留党察看处分期间，没有表决权、选举权和被选举权。"
    },
    {
      "id": 17,
      "type": "multiple",
      "question": "'三重一大'制度是指（ ）必须经过集体讨论做出决定。",
      "options": {
        "A": "重大决策",
        "B": "领导干部个人参加重要考察活动",
        "C": "重要项目安排",
        "D": "大额度资金使用"
      },
      "answer": "ACD",
      "analysis": "'三重一大'指重大决策、重要人事任免、重要项目安排、大额度资金使用。"
    },
    {
      "id": 18,
      "type": "multiple",
      "question": "反腐倡廉必须常抓不懈，做到（ ）。",
      "options": {
        "A": "有腐必反",
        "B": "有贪必肃",
        "C": "有令必行",
        "D": "有禁必止"
      },
      "answer": "AB",
      "analysis": "反腐倡廉要做到有腐必反、有贪必肃。"
    },
    {
      "id": 19,
      "type": "multiple",
      "question": "严明政治纪律就要从遵守和维护党章入手。决不允许（ ）。",
      "options": {
        "A": "脱离实际、弄虚作假",
        "B": "有令不行、有禁不止",
        "C": "有法不依、有令不从",
        "D": "上有政策、下有对策"
      },
      "answer": "BD",
      "analysis": "决不允许有令不行、有禁不止，上有政策、下有对策。"
    },
    {
      "id": 20,
      "type": "multiple",
      "question": "习近平强调，反腐倡廉建设，必须反对（ ）。",
      "options": {
        "A": "特权思想",
        "B": "特权现象",
        "C": "个人利益",
        "D": "享乐主义"
      },
      "answer": "AB",
      "analysis": "反腐倡廉建设必须反对特权思想和特权现象。"
    },
    {
      "id": 21,
      "type": "truefalse",
      "question": "政治纪律是打头、管总的纪律。",
      "options": {},
      "answer": "true",
      "analysis": "政治纪律是打头、管总的纪律，是最重要、最根本、最关键的纪律。"
    },
    {
      "id": 22,
      "type": "truefalse",
      "question": "党员受到警告处分一年内，不得在党内提升职务。",
      "options": {},
      "answer": "true",
      "analysis": "党员受到警告处分一年内，不得在党内提升职务。"
    },
    {
      "id": 23,
      "type": "truefalse",
      "question": "超标准公务接待属于违反群众纪律。",
      "options": {},
      "answer": "false",
      "analysis": "超标准公务接待属于违反廉洁纪律，不是群众纪律。"
    },
    {
      "id": 24,
      "type": "truefalse",
      "question": "贯彻上级决策部署只表态不落实，属于违反工作纪律。",
      "options": {},
      "answer": "true",
      "analysis": "只表态不落实属于典型的形式主义，违反工作纪律。"
    },
    {
      "id": 25,
      "type": "truefalse",
      "question": "强迫、唆使他人违纪的，应当从重或加重处分。",
      "options": {},
      "answer": "true",
      "analysis": "强迫、唆使他人违纪的，应当从重或者加重处分。"
    },
    {
      "id": 26,
      "type": "fill",
      "question": "落实党风廉政建设责任制，党委负______责任，纪委负______责任。",
      "options": {},
      "answer": "主体；监督",
      "analysis": "党委负主体责任，纪委负监督责任。"
    },
    {
      "id": 27,
      "type": "fill",
      "question": "全面依法治国是国家治理的一场深刻革命，关系党执政兴国，关系人民幸福安康，关系党和国家______。",
      "options": {},
      "answer": "长治久安",
      "analysis": "全面依法治国关系党和国家长治久安。"
    },
    {
      "id": 28,
      "type": "fill",
      "question": "我们必须增强忧患意识，坚持底线思维，做到居安思危、______，准备经受风高浪急甚至惊涛骇浪的重大考验。",
      "options": {},
      "answer": "未雨绸缪",
      "analysis": "要做到居安思危、未雨绸缪。"
    },
    {
      "id": 29,
      "type": "short",
      "question": "全面实现依法治国的十六字方针是什么？",
      "options": {},
      "answer": "科学立法、严格执法、公正司法、全民守法",
      "analysis": "这是全面依法治国的基本方针。"
    },
    {
      "id": 30,
      "type": "short",
      "question": "对党员的五种纪律处分是什么？",
      "options": {},
      "answer": "警告、严重警告、撤销党内职务、留党察看、开除党籍",
      "analysis": "这是《中国共产党纪律处分条例》规定的五种纪律处分。"
    }
  ]
};

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
    let source = '内置题库（离线回退）';

    try {
      const res = await fetch(QUIZ_DATA_URL, { cache: 'no-cache' });
      if (res.ok) {
        const parsed = await res.json();
        if (this.isValidData(parsed)) {
          data = parsed;
          source = QUIZ_DATA_URL;
        } else {
          console.warn(`⚠️ ${QUIZ_DATA_URL} 结构不合法（缺少 questions 数组），改用内置题库`);
        }
      } else {
        console.warn(`⚠️ 读取 ${QUIZ_DATA_URL} 失败（HTTP ${res.status}），改用内置题库`);
      }
    } catch (error) {
      console.warn(`⚠️ 无法读取 ${QUIZ_DATA_URL}（${error.message}），改用内置题库`);
    }

    if (!data) {
      data = QUIZ_DATA;
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
   * 简答题判分：把标准答案按「、；，」等拆成要点，
   * 命中比例达到 passRatio 即算正确。
   * 旧逻辑用全等字符串比较，用户把「、」写成「,」就判错，实际上等于答不对。
   */
  matchShortAnswer(correctAnswer, userAnswer, passRatio = 0.6) {
    const segments = String(correctAnswer)
      .split(/[、，,；;。.！!？?\s]+/)
      .map(s => this.normalizeText(s))
      .filter(Boolean);
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
