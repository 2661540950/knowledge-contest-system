/**
 * 知识竞赛系统 - 主应用脚本
 *
 * 答题流程约定：
 *   - 单选题 / 判断题：点选即判分，界面只保留「跳过」按钮
 *   - 多选题 / 填空题 / 简答题：需要点「提交答案」，保留「跳过」按钮
 *   - 答对：展示反馈 1 秒后自动进入下一题（最后一题自动结算）
 *   - 答错 / 跳过：必须手动点「下一题」（最后一题显示「交卷」）
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
        this.wrongBook = [];
        this.isSubmitting = false;
        this.autoNextTimer = null;
        this.screens = {};
        this.elements = {};

        // 等待 DOM 加载
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
            startBtn: document.getElementById('startBtn'),
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
            wrongBookCount: document.getElementById('wrongBookCount')
        };
    }

    async init() {
        try {
            this.initDOMElements();
            this.loadWrongBook();
            await this.loadQuizData();
            this.setupEventListeners();
            this.updateStats();
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

    // 判断题/单选题点选即判分，其余题型需要手动提交
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    goHome() {
        this.clearAutoNext();
        this.isSubmitting = false;
        this.showScreen('start');
        if (this.elements.homeBtn) this.elements.homeBtn.style.display = 'none';
        this.selectedMode = null;
        this.isPracticeMode = false;
        this.isWrongBookMode = false;
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        if (this.elements.startBtn) this.elements.startBtn.disabled = true;
    }

    // ---------- 开局 ----------

    startQuiz() {
        if (!this.selectedMode) return alert('请选择模式');

        if (this.isWrongBookMode) {
            if (!this.wrongBook.length) return alert('错题本为空');
            return this.showWrongBook();
        }

        let pool = this.allQuestions;
        if (!pool.length) return alert('题库为空');

        if (this.isPracticeMode && this.wrongBook.length) {
            const useWrong = confirm('是否只练习错题？确定=只练错题，取消=全部题目');
            if (useWrong) pool = this.questionsFromWrongBook();
        }

        if (this.selectedMode === 'random') {
            pool = this.shuffle(pool).slice(0, Math.min(20, pool.length));
        }

        this.beginSession(pool);
    }

    practiceWrongQuestions() {
        if (!this.wrongBook.length) return alert('错题本为空');
        this.selectedMode = 'practice';
        this.isPracticeMode = true;
        this.isWrongBookMode = false;
        this.beginSession(this.questionsFromWrongBook());
    }

    shuffle(list) {
        const copy = [...list];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    beginSession(questions) {
        this.questions = [...questions];
        this.maxScore = window.questionsAPI.getMaxScore(this.questions);
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.selectedOptions = [];
        this.isSubmitting = false;
        this.clearAutoNext();
        this.showScreen('quiz');
        if (this.elements.homeBtn) this.elements.homeBtn.style.display = 'block';
        this.loadQuestion();
    }

    // ---------- 答题 ----------

    loadQuestion() {
        this.clearAutoNext();
        this.isSubmitting = false;

        const q = this.questions[this.currentQuestionIndex];
        const total = this.questions.length;

        this.elements.questionProgress.textContent = `第 ${this.currentQuestionIndex + 1} / ${total} 题`;
        this.updateScoreDisplay();
        this.elements.progressBar.style.width = `${((this.currentQuestionIndex + 1) / total) * 100}%`;
        this.elements.questionType.textContent = window.questionsAPI.getTypeName(q.type);
        this.elements.questionText.textContent = q.question;
        this.elements.optionsContainer.innerHTML = '';
        this.elements.feedback.style.display = 'none';
        this.elements.feedback.className = 'feedback';

        // 单选/判断：只留「跳过」；其余题型：保留「提交答案」
        this.elements.submitBtn.style.display = this.needsSubmitButton(q.type) ? 'inline-block' : 'none';
        this.elements.skipBtn.style.display = 'inline-block';
        this.elements.nextBtn.style.display = 'none';
        this.elements.finishBtn.style.display = 'none';
        this.selectedOptions = [];

        if (q.type === 'fill' || q.type === 'short') {
            this.elements.answerInput.style.display = 'block';
            this.elements.fillAnswer.value = '';
        } else {
            this.elements.answerInput.style.display = 'none';
            const opts = q.type === 'truefalse'
                ? [{ key: 'true', text: '正确 √', label: '√' }, { key: 'false', text: '错误 ×', label: '×' }]
                : Object.entries(q.options || {}).map(([k, v]) => ({ key: k, text: v, label: k }));
            this.renderOptions(opts, q.type === 'multiple');
        }
    }

    renderOptions(opts, isMultiple) {
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
                    // 单选/判断题：点选即提交
                    setTimeout(() => this.submitAnswer(), 150);
                }
            });

            this.elements.optionsContainer.appendChild(el);
        });
    }

    submitAnswer() {
        if (this.isSubmitting) return;

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
        if (this.isSubmitting) return;

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
        // 跳过按答错处理，需要手动进入下一题
        this.showAdvanceButton();
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
        if (this.elements.scoreDisplay) {
            this.elements.scoreDisplay.textContent = `得分：${this.score} / ${this.maxScore}`;
        }
    }

    // 前进一步：还有题就加载下一题，否则结算
    advance() {
        this.clearAutoNext();
        if (this.isLastQuestion()) return this.finishQuiz();
        this.currentQuestionIndex++;
        this.loadQuestion();
    }

    nextQuestion() {
        this.advance();
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

        const empty = document.querySelector('.wrong-book-actions-bottom');
        if (empty) empty.style.display = this.wrongBook.length ? 'block' : 'none';

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

            const actions = document.createElement('div');
            actions.style.cssText = 'margin-top:10px;display:flex;gap:10px;';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-small';
            removeBtn.textContent = '移除';
            removeBtn.addEventListener('click', () => this.removeWrongItem(item.question.id));

            const analysisBtn = document.createElement('button');
            analysisBtn.className = 'btn-small';
            analysisBtn.textContent = '解析';
            analysisBtn.addEventListener('click', () => this.showWrongAnalysis(item.question.id));

            actions.appendChild(removeBtn);
            actions.appendChild(analysisBtn);

            div.appendChild(meta);
            div.appendChild(question);
            div.appendChild(answer);
            div.appendChild(actions);
            this.elements.wrongBookList.appendChild(div);
        });
    }
}

// 全局实例
window.quizApp = new QuizApp();
