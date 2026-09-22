/**
 * 知识竞赛系统 - 主应用脚本
 *
 * 答题流程约定：
 *   - 单选题 / 判断题：点选即判分，界面只保留「跳过」按钮
 *   - 多选题 / 填空题 / 简答题：需要点「提交答案」，保留「跳过」按钮
 *   - 答对：展示反馈 1 秒后自动进入下一题（最后一题自动结算）
 *   - 答错 / 跳过：必须手动点「下一题」（最后一题显示「交卷」）
 *   - 背题模式：直接给出答案和解析，只用「上一题 / 下一题」浏览，不计分、不进错题本
 *
 * 进度记忆：
 *   练习 / 考试模式会把当前题目、得分、已答记录写入 localStorage。
 *   中途退出后再次选择同一模式时，询问「是否从上次退出的题目继续」。
 *   背题模式是浏览，不记录进度。
 */
class QuizApp {
    constructor() {
        this.allQuestions = [];   // 完整题库，不会被模式筛选破坏
        this.questions = [];      // 本轮实际作答的题目
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.maxScore = 0;
        this.userAnswers = [];
        this.selectedMode = null;
        this.selectedOptions = [];
        this.isPracticeMode = false;
        this.isWrongBookMode = false;
        this.isStudyMode = false;
        this.rememberProgress = false;
        this.wrongBook = [];
        this.isSubmitting = false;
        this.autoNextTimer = null;
        this.screens = {};
        this.elements = {};

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ---------- 初始化 ----------

    initDOMElements() {
        this.screens = {
            start: document.getElementById('startScreen'),
            quiz: document.getElementById('quizScreen'),
            result: document.getElementById('resultScreen'),
            review: document.getElementById('reviewScreen'),
            wrongBook: document.getElementById('wrongBookScreen')
        };
        this.elements = {
            topBar: document.getElementById('topBar'),
            startBtn: document.getElementById('startBtn'),
            prevBtn: document.getElementById('prevBtn'),
            submitBtn: document.getElementById('submitBtn'),
            skipBtn: document.getElementById('skipBtn'),
            nextBtn: document.getElementById('nextBtn'),
            finishBtn: document.getElementById('finishBtn'),
            reviewBtn: document.getElementById('reviewBtn'),
            restartBtn: document.getElementById('restartBtn'),
            homeBtn: document.getElementById('homeBtn'),
            clearWrongBookBtn: document.getElementById('clearWrongBookBtn'),
            backToHomeFromWrongBtn: document.getElementById('backToHomeFromWrongBtn'),
            practiceWrongBtn: document.getElementById('practiceWrongBtn'),
            questionProgress: document.getElementById('questionProgress'),
            scoreDisplay: document.getElementById('scoreDisplay'),
            progressBar: document.getElementById('progressBar'),
            questionType: document.getElementById('questionType'),
            questionText: document.getElementById('questionText'),
            optionsContainer: document.getElementById('optionsContainer'),
            answerInput: document.getElementById('answerInput'),
            fillAnswer: document.getElementById('fillAnswer'),
            feedback: document.getElementById('feedback'),
            feedbackIcon: document.getElementById('feedbackIcon'),
            feedbackTitle: document.getElementById('feedbackTitle'),
            feedbackAnalysis: document.getElementById('feedbackAnalysis'),
            reviewList: document.getElementById('reviewList'),
            wrongBookList: document.getElementById('wrongBookList'),
            wrongBookCount: document.getElementById('wrongBookCount'),
            resumeHint: document.getElementById('resumeHint')
        };
    }

    async init() {
        try {
            this.initDOMElements();
            this.loadWrongBook();
            await this.loadQuizData();
            this.setupEventListeners();
            this.updateStats();
            this.updateResumeHint();
        } catch (e) {
            console.error('❌ 初始化失败:', e);
        }
    }

    async loadQuizData() {
        this.allQuestions = await window.questionsAPI.getAllQuestions();
        this.questions = this.allQuestions;
        const meta = window.questionsAPI.metadata;
        console.log(`📚 题库「${meta.title}」共 ${this.allQuestions.length} 题，来源：${meta.source}`);
    }

    setupEventListeners() {
        this.resetStartButton();
        document.querySelectorAll('.mode-card').forEach(c => c.addEventListener('click', () => this.selectMode(c)));
        if (this.elements.startBtn) this.elements.startBtn.addEventListener('click', () => this.startQuiz());
        if (this.elements.prevBtn) this.elements.prevBtn.addEventListener('click', () => this.prevQuestion());
        if (this.elements.submitBtn) this.elements.submitBtn.addEventListener('click', () => this.submitAnswer());
        if (this.elements.skipBtn) this.elements.skipBtn.addEventListener('click', () => this.skipQuestion());
        if (this.elements.nextBtn) this.elements.nextBtn.addEventListener('click', () => this.nextQuestion());
        if (this.elements.finishBtn) this.elements.finishBtn.addEventListener('click', () => this.finishQuiz());
        if (this.elements.reviewBtn) this.elements.reviewBtn.addEventListener('click', () => this.showReview());
        if (this.elements.restartBtn) this.elements.restartBtn.addEventListener('click', () => location.reload());
        if (this.elements.homeBtn) this.elements.homeBtn.addEventListener('click', () => this.goHome());
        if (this.elements.clearWrongBookBtn) this.elements.clearWrongBookBtn.addEventListener('click', () => this.clearWrongBook());
        if (this.elements.backToHomeFromWrongBtn) this.elements.backToHomeFromWrongBtn.addEventListener('click', () => this.goHome());
        if (this.elements.practiceWrongBtn) this.elements.practiceWrongBtn.addEventListener('click', () => this.practiceWrongQuestions());
    }

    // 未选择模式时「开始答题」保持禁用
    resetStartButton() {
        if (this.elements.startBtn) this.elements.startBtn.disabled = true;
    }

    // ---------- 小工具 ----------

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
        return !!el;
    }

    modeName(mode) {
        return ({
            practice: '练习模式',
            exam: '考试模式',
            study: '背题模式',
            wrong: '错题本模式',
            wrongPractice: '错题练习'
        })[mode] || '答题';
    }

    formatTime(iso) {
        try {
            return new Date(iso).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
            });
        } catch (e) {
            return '';
        }
    }

    // 判断题 / 单选题点选即判分，其余题型需要手动提交
    needsSubmitButton(type) {
        return type === 'multiple' || type === 'fill' || type === 'short';
    }

    isLastQuestion() {
        return this.currentQuestionIndex >= this.questions.length - 1;
    }

    clearAutoNext() {
        if (this.autoNextTimer) {
            clearTimeout(this.autoNextTimer);
            this.autoNextTimer = null;
        }
    }

    // ---------- 进度记忆 ----------

    // 只有练习 / 考试模式记进度（背题是浏览，错题练习是临时集合）
    canRememberProgress() {
        return this.rememberProgress && !this.isStudyMode &&
            (this.selectedMode === 'practice' || this.selectedMode === 'exam');
    }

    saveProgress() {
        if (!this.canRememberProgress() || !this.questions.length) return;
        const payload = {
            mode: this.selectedMode,
            questionIds: this.questions.map(q => q.id),
            index: this.currentQuestionIndex,
            score: this.score,
            userAnswers: this.userAnswers,
            savedAt: new Date().toISOString()
        };
        try {
            localStorage.setItem('quizProgress', JSON.stringify(payload));
        } catch (e) { /* 隐私模式 / 配额不足，忽略即可 */ }
        this.updateResumeHint();
    }

    // 读回进度，并把题目 id 还原成题目对象（题库更新过也能对上）
    readProgress() {
        let data;
        try {
            const raw = localStorage.getItem('quizProgress');
            if (!raw) return null;
            data = JSON.parse(raw);
        } catch (e) {
            return null;
        }
        if (!data || !Array.isArray(data.questionIds) || !data.questionIds.length) return null;

        const byId = new Map(this.allQuestions.map(q => [q.id, q]));
        const questions = data.questionIds.map(id => byId.get(id)).filter(Boolean);
        if (!questions.length) return null;

        return {
            mode: data.mode,
            questions,
            index: Math.min(Math.max(data.index || 0, 0), questions.length - 1),
            score: data.score || 0,
            userAnswers: Array.isArray(data.userAnswers) ? data.userAnswers : [],
            savedAt: data.savedAt
        };
    }

    clearProgress() {
        try {
            localStorage.removeItem('quizProgress');
        } catch (e) { /* 忽略 */ }
        this.updateResumeHint();
    }

    updateResumeHint() {
        const el = this.elements.resumeHint;
        if (!el) return;
        const saved = this.readProgress();
        if (!saved || (saved.mode !== 'practice' && saved.mode !== 'exam')) {
            el.style.display = 'none';
            el.textContent = '';
            return;
        }
        el.textContent = `📌 上次${this.modeName(saved.mode)}进度：第 ${saved.index + 1} / ${saved.questions.length} 题，得分 ${saved.score}（${this.formatTime(saved.savedAt)}）。选择同一模式开始时会询问是否继续。`;
        el.style.display = 'block';
    }

    // ---------- 错题本 ----------

    loadWrongBook() {
        try {
            const saved = localStorage.getItem('wrongBook');
            this.wrongBook = saved ? JSON.parse(saved) : [];
        } catch (e) { this.wrongBook = []; }
    }

    saveWrongBook() {
        try { localStorage.setItem('wrongBook', JSON.stringify(this.wrongBook)); } catch (e) {}
        this.updateWrongBookStats();
    }

    updateWrongBookStats() {
        this.setText('wrongBookCount', this.wrongBook.length);
        this.setText('wrongCount', this.wrongBook.length);
    }

    addToWrongBookSilent(q, ans) {
        if (!this.wrongBook.find(i => i.question.id === q.id)) {
            this.wrongBook.push({
                question: q,
                userAnswer: ans || '未作答',
                reason: ans === '跳过' ? '跳过' : '答错',
                addedAt: new Date().toISOString()
            });
            this.saveWrongBook();
        }
    }

    removeFromWrongBook(id) {
        this.wrongBook = this.wrongBook.filter(i => i.question.id !== id);
        this.saveWrongBook();
    }

    removeWrongItem(id) {
        this.removeFromWrongBook(id);
        this.showWrongBook();
    }

    showWrongAnalysis(id) {
        const item = this.wrongBook.find(i => i.question.id === id);
        if (item) alert(`题目：${item.question.question}\n\n答案：${item.question.answer}\n\n解析：${item.question.analysis || '无'}`);
    }

    clearWrongBook() {
        if (confirm('确定清空错题本？')) {
            this.wrongBook = [];
            this.saveWrongBook();
            this.showWrongBook();
        }
    }

    questionsFromWrongBook() {
        return this.wrongBook.map(i => i.question);
    }

    // ---------- 首页 ----------

    selectMode(card) {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedMode = card.dataset.mode;
        this.isPracticeMode = this.selectedMode === 'practice';
        this.isWrongBookMode = this.selectedMode === 'wrong';
        this.isStudyMode = this.selectedMode === 'study';
        if (this.elements.startBtn) this.elements.startBtn.disabled = false;
    }

    updateStats() {
        const s = { single: 0, multiple: 0, truefalse: 0, fill: 0, short: 0 };
        this.allQuestions.forEach(q => { if (s[q.type] !== undefined) s[q.type]++; });

        this.setText('totalQuestions', this.allQuestions.length);
        this.setText('singleCount', s.single);
        this.setText('multipleCount', s.multiple);
        this.setText('judgeCount', s.truefalse + s.fill + s.short);
        this.setText('maxScoreStat', window.questionsAPI.getMaxScore(this.allQuestions));
        this.updateWrongBookStats();
    }

    showScreen(name) {
        Object.values(this.screens).forEach(s => { if (s) s.classList.remove('active'); });
        if (this.screens[name]) this.screens[name].classList.add('active');
        // 顶部进度条只在答题 / 背题时出现
        if (this.elements.topBar) {
            this.elements.topBar.style.display = name === 'quiz' ? 'block' : 'none';
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    goHome() {
        this.clearAutoNext();
        this.isSubmitting = false;
        this.isStudyMode = false;
        this.rememberProgress = false;
        this.showScreen('start');
        this.selectedMode = null;
        this.isPracticeMode = false;
        this.isWrongBookMode = false;
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        this.resetStartButton();
        this.updateWrongBookStats();
        this.updateResumeHint();
    }

    // ---------- 开局 ----------

    startQuiz() {
        if (!this.selectedMode) return alert('请选择模式');

        if (this.isWrongBookMode) {
            if (!this.wrongBook.length) return alert('错题本为空');
            return this.showWrongBook();
        }
        if (!this.allQuestions.length) return alert('题库为空');

        // 背题模式：从头开始逐题浏览，不记进度
        if (this.isStudyMode) {
            return this.beginSession(this.allQuestions, { study: true });
        }

        // 练习 / 考试：先问是否接着上次退出时的题目继续
        const saved = this.readProgress();
        if (saved && saved.mode === this.selectedMode) {
            const keep = confirm(
                `上次${this.modeName(saved.mode)}做到第 ${saved.index + 1} / ${saved.questions.length} 题，得分 ${saved.score}（${this.formatTime(saved.savedAt)}）。\n\n是否从上次退出的题目继续？\n「确定」＝继续，「取消」＝重新开始`
            );
            if (keep) return this.resumeSession(saved);
            this.clearProgress();
        }

        this.beginSession(this.allQuestions, { remember: true });
    }

    practiceWrongQuestions() {
        if (!this.wrongBook.length) return alert('错题本为空');
        this.selectedMode = 'wrongPractice';
        this.isPracticeMode = true;
        this.isWrongBookMode = false;
        this.isStudyMode = false;
        this.beginSession(this.questionsFromWrongBook(), { remember: false });
    }

    beginSession(questions, options = {}) {
        const study = !!options.study;
        const remember = options.remember !== undefined ? !!options.remember : !study;

        this.questions = [...questions];
        this.maxScore = window.questionsAPI.getMaxScore(this.questions);
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.selectedOptions = [];
        this.isSubmitting = false;
        this.isStudyMode = study;
        this.rememberProgress = remember;
        this.clearAutoNext();

        this.showScreen('quiz');
        this.loadQuestion();
        if (remember && !study) this.saveProgress();
    }

    // 恢复上次进度（已作答的题自动跳过，从未作答的题接着答）
    resumeSession(saved) {
        this.questions = saved.questions;
        this.maxScore = window.questionsAPI.getMaxScore(this.questions);
        this.score = saved.score;
        this.userAnswers = saved.userAnswers;
        this.currentQuestionIndex = saved.index;

        const answered = new Set(this.userAnswers.map(a => a.questionId));
        while (this.currentQuestionIndex < this.questions.length - 1 &&
               answered.has(this.questions[this.currentQuestionIndex].id)) {
            this.currentQuestionIndex++;
        }

        this.selectedOptions = [];
        this.isSubmitting = false;
        this.isStudyMode = false;
        this.rememberProgress = true;
        this.clearAutoNext();

        this.showScreen('quiz');
        this.loadQuestion();
        this.saveProgress();
    }

    // ---------- 答题 ----------

    loadQuestion() {
        this.clearAutoNext();
        this.isSubmitting = false;

        const q = this.questions[this.currentQuestionIndex];
        const total = this.questions.length;

        this.elements.questionProgress.textContent = `第 ${this.currentQuestionIndex + 1} / ${total} 题`;
        this.elements.progressBar.style.width = `${((this.currentQuestionIndex + 1) / total) * 100}%`;
        this.elements.questionType.textContent = window.questionsAPI.getTypeName(q.type);
        this.elements.questionText.textContent = q.question;
        this.elements.optionsContainer.innerHTML = '';
        this.elements.feedback.style.display = 'none';
        this.elements.feedback.className = 'feedback';
        this.selectedOptions = [];

        if (this.isStudyMode) {
            this.renderStudyQuestion(q);
            this.updateScoreDisplay();
            return;
        }

        this.elements.prevBtn.style.display = 'none';
        this.elements.prevBtn.disabled = true;
        this.elements.answerInput.style.display = 'none';
        // 单选/判断：只留「跳过」；其余题型：保留「提交答案」
        this.elements.submitBtn.style.display = this.needsSubmitButton(q.type) ? 'inline-block' : 'none';
        this.elements.skipBtn.style.display = 'inline-block';
        this.elements.nextBtn.style.display = 'none';
        this.elements.finishBtn.style.display = 'none';

        if (q.type === 'fill' || q.type === 'short') {
            this.elements.answerInput.style.display = 'block';
            this.elements.fillAnswer.value = '';
        } else {
            const opts = q.type === 'truefalse'
                ? [{ key: 'true', text: '正确 √', label: '√' }, { key: 'false', text: '错误 ×', label: '×' }]
                : Object.entries(q.options || {}).map(([k, v]) => ({ key: k, text: v, label: k }));
            this.renderOptions(opts, q.type === 'multiple', false);
        }

        this.updateScoreDisplay();
        if (this.canRememberProgress()) this.saveProgress();
    }

    // 背题模式：直接给答案，不给作答按钮
    renderStudyQuestion(q) {
        this.elements.submitBtn.style.display = 'none';
        this.elements.skipBtn.style.display = 'none';
        this.elements.finishBtn.style.display = 'none';
        this.elements.answerInput.style.display = 'none';

        this.elements.prevBtn.style.display = 'inline-block';
        this.elements.prevBtn.disabled = this.currentQuestionIndex === 0;
        this.elements.nextBtn.style.display = 'inline-block';
        this.elements.nextBtn.disabled = this.isLastQuestion();

        if (q.type === 'fill' || q.type === 'short') {
            this.elements.optionsContainer.innerHTML = '';
        } else {
            const opts = q.type === 'truefalse'
                ? [{ key: 'true', text: '正确 √', label: '√' }, { key: 'false', text: '错误 ×', label: '×' }]
                : Object.entries(q.options || {}).map(([k, v]) => ({ key: k, text: v, label: k }));
            this.renderOptions(opts, false, true);
        }

        this.elements.feedback.style.display = 'flex';
        this.elements.feedback.className = 'feedback correct';
        this.elements.feedbackIcon.textContent = '✅';
        this.elements.feedbackTitle.textContent = `正确答案：${q.answer}`;
        this.elements.feedbackAnalysis.textContent = q.analysis || '（本题暂无解析）';
    }

    // 选项是否属于正确答案（背题模式用来标绿）
    isCorrectOption(key) {
        const q = this.questions[this.currentQuestionIndex];
        if (!q) return false;
        if (q.type === 'truefalse') return String(q.answer) === String(key);
        return String(q.answer).split('').includes(String(key));
    }

    renderOptions(opts, isMultiple, readOnly) {
        this.elements.optionsContainer.innerHTML = '';
        opts.forEach(opt => {
            const el = document.createElement('div');
            el.className = 'option-item';
            el.dataset.key = opt.key;

            const label = document.createElement('span');
            label.className = 'option-label';
            label.textContent = opt.label !== undefined ? opt.label : opt.key;

            const text = document.createElement('span');
            text.className = 'option-text';
            text.textContent = opt.text;

            el.appendChild(label);
            el.appendChild(text);

            if (readOnly) {
                if (this.isCorrectOption(opt.key)) el.classList.add('correct');
            } else {
                el.addEventListener('click', () => {
                    if (this.isSubmitting) return;
                    if (isMultiple) {
                        if (this.selectedOptions.includes(opt.key)) {
                            this.selectedOptions = this.selectedOptions.filter(k => k !== opt.key);
                            el.classList.remove('selected');
                        } else {
                            this.selectedOptions.push(opt.key);
                            el.classList.add('selected');
                        }
                    } else {
                        this.selectedOptions = [opt.key];
                        this.elements.optionsContainer.querySelectorAll('.option-item')
                            .forEach(i => i.classList.remove('selected'));
                        el.classList.add('selected');
                        // 单选 / 判断题：点选即提交
                        setTimeout(() => this.submitAnswer(), 150);
                    }
                });
            }

            this.elements.optionsContainer.appendChild(el);
        });
    }

    submitAnswer() {
        if (this.isSubmitting || this.isStudyMode) return;

        const q = this.questions[this.currentQuestionIndex];
        let userAnswer;

        if (q.type === 'fill' || q.type === 'short') {
            userAnswer = this.elements.fillAnswer.value.trim();
            if (!userAnswer) return alert('请输入答案');
        } else {
            if (!this.selectedOptions.length) return alert('请选择答案');
            userAnswer = this.selectedOptions.join('');
        }

        this.isSubmitting = true;
        this.userAnswers.push({
            questionId: q.id,
            question: q.question,
            type: q.type,
            userAnswer,
            correctAnswer: q.answer,
            analysis: q.analysis
        });

        const result = window.questionsAPI.verifyAnswer(q.id, userAnswer);
        if (result.correct) {
            this.score += window.questionsAPI.getScoreWeight(q.type);
        } else {
            this.addToWrongBookSilent(q, userAnswer);
        }

        this.updateScoreDisplay();
        this.showFeedback(result, q);
        this.lockQuestion();
        this.saveProgress();

        if (result.correct) {
            // 答对：1 秒后自动进入下一题（最后一题自动结算）
            this.autoNextTimer = setTimeout(() => {
                this.autoNextTimer = null;
                this.advance();
            }, 1000);
        } else {
            // 答错：必须手动点「下一题」
            this.showAdvanceButton();
        }
    }

    skipQuestion() {
        if (this.isSubmitting || this.isStudyMode) return;

        const q = this.questions[this.currentQuestionIndex];
        this.isSubmitting = true;
        this.addToWrongBookSilent(q, '跳过');
        this.userAnswers.push({
            questionId: q.id,
            question: q.question,
            type: q.type,
            userAnswer: '跳过',
            correctAnswer: q.answer,
            analysis: q.analysis,
            skipped: true
        });

        this.elements.feedback.style.display = 'flex';
        this.elements.feedback.className = 'feedback wrong';
        this.elements.feedbackIcon.textContent = '⏭️';
        this.elements.feedbackTitle.textContent = '已跳过';
        this.elements.feedbackAnalysis.textContent = `已加入错题本。正确答案：${q.answer}`;

        this.lockQuestion();
        this.showAdvanceButton();
        this.saveProgress();
    }

    // 提交/跳过后隐藏作答按钮，防止重复判分
    lockQuestion() {
        this.elements.submitBtn.style.display = 'none';
        this.elements.skipBtn.style.display = 'none';
    }

    // 答错/跳过时显示前进按钮：最后一题是「交卷」
    showAdvanceButton() {
        const last = this.isLastQuestion();
        this.elements.nextBtn.style.display = last ? 'none' : 'inline-block';
        this.elements.finishBtn.style.display = last ? 'inline-block' : 'none';
    }

    showFeedback(result, q) {
        this.elements.feedback.style.display = 'flex';
        this.elements.feedback.className = 'feedback ' + (result.correct ? 'correct' : 'wrong');
        this.elements.feedbackIcon.textContent = result.correct ? '✅' : '❌';
        this.elements.feedbackTitle.textContent = result.correct ? '回答正确！' : '回答错误';
        this.elements.feedbackAnalysis.textContent = result.analysis || `正确答案：${result.correctAnswer}`;

        if (q.type === 'fill' || q.type === 'short') return;

        const correctKeys = String(result.correctAnswer).split('');
        this.elements.optionsContainer.querySelectorAll('.option-item').forEach(item => {
            if (correctKeys.includes(item.dataset.key)) item.classList.add('correct');
            else if (item.classList.contains('selected')) item.classList.add('wrong');
        });
    }

    updateScoreDisplay() {
        if (!this.elements.scoreDisplay) return;
        this.elements.scoreDisplay.textContent = this.isStudyMode
            ? '背题模式'
            : `得分：${this.score} / ${this.maxScore}`;
    }

    // 前进一步：还有题就加载下一题，否则结算
    advance() {
        this.clearAutoNext();
        if (this.isLastQuestion()) {
            if (this.isStudyMode) return;
            return this.finishQuiz();
        }
        this.currentQuestionIndex++;
        this.loadQuestion();
    }

    nextQuestion() {
        this.advance();
    }

    prevQuestion() {
        if (this.currentQuestionIndex <= 0) return;
        this.clearAutoNext();
        this.currentQuestionIndex--;
        this.loadQuestion();
    }

    // ---------- 结算 ----------

    finishQuiz() {
        this.clearAutoNext();
        const total = this.questions.length;
        const correct = this.userAnswers.filter(
            a => window.questionsAPI.checkAnswer(a.correctAnswer, a.userAnswer, a.type)
        ).length;
        const accuracy = total ? Math.round((correct / total) * 100) : 0;

        this.setText('finalScore', this.score);
        this.setText('finalMaxScore', this.maxScore);
        this.setText('resultTotal', total);
        this.setText('resultCorrect', correct);
        this.setText('resultWrong', total - correct);
        this.setText('resultAccuracy', accuracy + '%');

        const icon = document.getElementById('resultIcon');
        const title = document.getElementById('resultTitle');
        if (icon) icon.textContent = accuracy >= 90 ? '🏆' : accuracy >= 70 ? '🎉' : accuracy >= 60 ? '👍' : '📚';
        if (title) title.textContent = accuracy >= 90 ? '太棒了！' : accuracy >= 70 ? '成绩不错！' : accuracy >= 60 ? '继续加油！' : '再接再厉！';

        // 一轮做完，清掉可续做的进度
        this.rememberProgress = false;
        this.clearProgress();
        this.showScreen('result');
    }

    showReview() {
        this.elements.reviewList.innerHTML = '';
        this.userAnswers.forEach((a, i) => {
            const isCorrect = window.questionsAPI.checkAnswer(a.correctAnswer, a.userAnswer, a.type);
            const div = document.createElement('div');
            div.className = 'review-item ' + (isCorrect ? 'correct' : 'wrong');

            const head = document.createElement('div');
            head.className = 'review-question';
            head.textContent = `${i + 1}. ${a.question}`;

            const mine = document.createElement('div');
            mine.className = 'review-answer user';
            mine.textContent = `你的答案：${a.userAnswer} ${isCorrect ? '✅' : a.skipped ? '⏭️' : '❌'}`;

            const analysis = document.createElement('div');
            analysis.className = 'review-analysis';
            analysis.textContent = `📝 ${a.analysis || '无解析'}`;

            div.appendChild(head);
            div.appendChild(mine);

            if (!isCorrect) {
                const right = document.createElement('div');
                right.className = 'review-answer correct-answer';
                right.textContent = `正确答案：${a.correctAnswer}`;
                div.appendChild(right);
            }
            div.appendChild(analysis);
            this.elements.reviewList.appendChild(div);
        });
        this.showScreen('review');
    }

    // ---------- 错题本界面 ----------

    showWrongBook() {
        this.showScreen('wrongBook');
        this.setText('wrongBookCount', this.wrongBook.length);

        const actions = document.querySelector('.wrong-book-actions-bottom');
        if (actions) actions.style.display = this.wrongBook.length ? 'block' : 'none';

        if (!this.wrongBook.length) {
            this.elements.wrongBookList.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">错题本是空的</div>';
            return;
        }

        this.elements.wrongBookList.innerHTML = '';
        this.wrongBook.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'wrong-book-item';

            const meta = document.createElement('div');
            meta.className = 'wrong-book-meta';
            meta.textContent = `#${i + 1} | ${window.questionsAPI.getTypeName(item.question.type)} | ${item.reason}`;

            const question = document.createElement('div');
            question.className = 'wrong-book-question';
            question.textContent = item.question.question;

            const answer = document.createElement('div');
            answer.style.cssText = 'color:#4caf50;margin:8px 0;';
            answer.textContent = `答案：${item.question.answer}`;

            const actionsRow = document.createElement('div');
            actionsRow.style.cssText = 'margin-top:10px;display:flex;gap:10px;';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-small';
            removeBtn.textContent = '移除';
            removeBtn.addEventListener('click', () => this.removeWrongItem(item.question.id));

            const analysisBtn = document.createElement('button');
            analysisBtn.className = 'btn-small';
            analysisBtn.textContent = '解析';
            analysisBtn.addEventListener('click', () => this.showWrongAnalysis(item.question.id));

            actionsRow.appendChild(removeBtn);
            actionsRow.appendChild(analysisBtn);

            div.appendChild(meta);
            div.appendChild(question);
            div.appendChild(answer);
            div.appendChild(actionsRow);
            this.elements.wrongBookList.appendChild(div);
        });
    }
}

// 全局实例
window.quizApp = new QuizApp();
