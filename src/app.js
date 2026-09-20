/**
 * 知识竞赛系统 - 主应用脚本 (完整修复版)
 */
class QuizApp {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.selectedMode = null;
        this.selectedOptions = [];
        this.isPracticeMode = false;
        this.isWrongBookMode = false;
        this.practiceOnlyWrong = false;
        this.wrongBook = [];
        this.isSubmitting = false;
        this.screens = {};
        this.elements = {};
        
        // 等待 DOM 加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
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
            addToWrongBtn: document.getElementById('addToWrongBtn'),
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
            console.log('🚀 初始化...');
            this.initDOMElements();
            this.loadWrongBook();
            await this.loadQuizData();
            this.setupEventListeners();
            this.updateStats();
            console.log('✅ 完成');
        } catch (e) {
            console.error('❌ 错误:', e);
        }
    }
    
    async loadQuizData() {
        this.questions = await window.questionsAPI.getAllQuestions();
        console.log('📚 题库:', this.questions.length, '题');
    }
    
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
        if (this.elements.wrongBookCount) this.elements.wrongBookCount.textContent = this.wrongBook.length;
        const el = document.getElementById('wrongCount');
        if (el) el.textContent = this.wrongBook.length;
    }
    
    setupEventListeners() {
        document.querySelectorAll('.mode-card').forEach(c => c.addEventListener('click', () => this.selectMode(c)));
        if (this.elements.startBtn) this.elements.startBtn.addEventListener('click', () => this.startQuiz());
        if (this.elements.submitBtn) this.elements.submitBtn.addEventListener('click', () => this.submitAnswer());
        if (this.elements.skipBtn) this.elements.skipBtn.addEventListener('click', () => this.skipQuestion());
        if (this.elements.nextBtn) this.elements.nextBtn.addEventListener('click', () => this.nextQuestion());
        if (this.elements.addToWrongBtn) this.elements.addToWrongBtn.addEventListener('click', () => this.addCurrentToWrong());
        if (this.elements.reviewBtn) this.elements.reviewBtn.addEventListener('click', () => this.showReview());
        if (this.elements.restartBtn) this.elements.restartBtn.addEventListener('click', () => location.reload());
        if (this.elements.homeBtn) this.elements.homeBtn.addEventListener('click', () => this.goHome());
        if (this.elements.clearWrongBookBtn) this.elements.clearWrongBookBtn.addEventListener('click', () => this.clearWrongBook());
        if (this.elements.backToHomeFromWrongBtn) this.elements.backToHomeFromWrongBtn.addEventListener('click', () => this.goHome());
        if (this.elements.practiceWrongBtn) this.elements.practiceWrongBtn.addEventListener('click', () => this.practiceWrongQuestions());
    }
    
    selectMode(card) {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedMode = card.dataset.mode;
        this.elements.startBtn.disabled = false;
        this.isPracticeMode = this.selectedMode === 'practice';
        this.isWrongBookMode = this.selectedMode === 'wrong';
    }
    
    updateStats() {
        const s = {single:0,multiple:0,truefalse:0,fill:0,short:0};
        this.questions.forEach(q => { if(s[q.type]!==undefined) s[q.type]++; });
        document.getElementById('totalQuestions').textContent = this.questions.length;
        document.getElementById('singleCount').textContent = s.single;
        document.getElementById('multipleCount').textContent = s.multiple;
        document.getElementById('judgeCount').textContent = s.truefalse+s.fill+s.short;
        this.updateWrongBookStats();
    }
    
    async startQuiz() {
        if (!this.selectedMode) return alert('请选择模式');
        if (this.isWrongBookMode) {
            if (!this.wrongBook.length) return alert('错题本为空');
            return this.showWrongBook();
        }
        if (this.isPracticeMode && this.wrongBook.length) {
            const useWrong = confirm('是否只练习错题？确定=只练错题，取消=全部题目');
            if (useWrong) this.questions = this.wrongBook.map(i => i.question);
        }
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.selectedOptions = [];
        this.isSubmitting = false;
        if (this.selectedMode === 'random') this.questions = [...this.questions].sort(() => Math.random()-0.5).slice(0,20);
        this.showScreen('quiz');
        if (this.elements.homeBtn) this.elements.homeBtn.style.display = 'block';
        this.loadQuestion();
    }
    
    goHome() {
        this.showScreen('start');
        if (this.elements.homeBtn) this.elements.homeBtn.style.display = 'none';
        this.selectedMode = null;
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        if (this.elements.startBtn) this.elements.startBtn.disabled = true;
    }
    
    showScreen(name) {
        Object.values(this.screens).forEach(s => { if(s) s.classList.remove('active'); });
        if (this.screens[name]) this.screens[name].classList.add('active');
    }
    
    loadQuestion() {
        const q = this.questions[this.currentQuestionIndex];
        const total = this.questions.length;
        this.elements.questionProgress.textContent = `第 ${this.currentQuestionIndex+1} / ${total} 题`;
        this.elements.scoreDisplay.textContent = `得分：${this.score}`;
        this.elements.progressBar.style.width = `${(this.currentQuestionIndex/total)*100}%`;
        this.elements.questionType.textContent = window.questionsAPI.getTypeName(q.type);
        this.elements.questionText.textContent = q.question;
        this.elements.optionsContainer.innerHTML = '';
        this.elements.feedback.style.display = 'none';
        this.elements.submitBtn.style.display = 'inline-block';
        this.elements.skipBtn.style.display = 'inline-block';
        this.elements.nextBtn.style.display = 'none';
        this.elements.addToWrongBtn.style.display = this.isPracticeMode ? 'inline-block' : 'none';
        this.selectedOptions = [];
        
        if (q.type === 'fill' || q.type === 'short') {
            this.elements.fillAnswer.parentElement.style.display = 'block';
            this.elements.fillAnswer.value = '';
        } else {
            this.elements.fillAnswer.parentElement.style.display = 'none';
            const opts = q.type === 'truefalse' ? [{key:'true',text:'正确 √'},{key:'false',text:'错误 ×'}] : Object.entries(q.options).map(([k,v])=>({key:k,text:v}));
            this.renderOptions(opts, q.type === 'multiple');
        }
    }
    
    renderOptions(opts, isMultiple) {
        this.elements.optionsContainer.innerHTML = '';
        opts.forEach(opt => {
            const el = document.createElement('div');
            el.className = 'option-item';
            el.dataset.key = opt.key;
            el.innerHTML = `<span class="option-label">${opt.key}</span><span class="option-text">${opt.text}</span>`;
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
                    document.querySelectorAll('.option-item').forEach(i => i.classList.remove('selected'));
                    el.classList.add('selected');
                    // 单选题自动提交
                    setTimeout(() => this.submitAnswer(), 150);
                }
            });
            this.elements.optionsContainer.appendChild(el);
        });
    }
    
    submitAnswer() {
        if (this.isSubmitting) return;
        this.isSubmitting = true;
        
        const q = this.questions[this.currentQuestionIndex];
        let userAnswer;
        
        if (q.type === 'fill' || q.type === 'short') {
            userAnswer = this.elements.fillAnswer.value.trim();
            if (!userAnswer) { this.isSubmitting = false; return alert('请输入答案'); }
        } else {
            if (!this.selectedOptions.length) { this.isSubmitting = false; return alert('请选择答案'); }
            userAnswer = this.selectedOptions.join('');
        }
        
        this.userAnswers.push({ questionId: q.id, question: q.question, type: q.type, userAnswer, correctAnswer: q.answer, analysis: q.analysis });
        
        const result = window.questionsAPI.verifyAnswer(q.id, userAnswer);
        if (result.correct) {
            this.score += ({single:2,multiple:3,truefalse:1,fill:2,short:5}[q.type]||1);
        } else {
            this.addToWrongBookSilent(q, userAnswer);
        }
        
        this.showFeedback(result, q);
        this.elements.submitBtn.style.display = 'none';
        this.elements.skipBtn.style.display = 'none';
        
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.elements.nextBtn.style.display = 'inline-block';
        } else {
            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.textContent = '交卷';
            btn.addEventListener('click', () => this.finishQuiz());
            this.elements.nextBtn.parentNode.appendChild(btn);
        }
    }
    
    skipQuestion() {
        const q = this.questions[this.currentQuestionIndex];
        this.addToWrongBookSilent(q, '跳过');
        this.userAnswers.push({ questionId: q.id, question: q.question, type: q.type, userAnswer: '跳过', correctAnswer: q.answer, analysis: q.analysis, skipped: true });
        
        this.elements.feedback.style.display = 'flex';
        this.elements.feedback.className = 'feedback wrong';
        this.elements.feedbackIcon.textContent = '⏭️';
        this.elements.feedbackTitle.textContent = '已跳过';
        this.elements.feedbackAnalysis.textContent = '该题已加入错题本';
        
        this.elements.submitBtn.style.display = 'none';
        this.elements.skipBtn.style.display = 'none';
        
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.elements.nextBtn.style.display = 'inline-block';
        } else {
            setTimeout(() => this.finishQuiz(), 1000);
        }
    }
    
    addCurrentToWrong() {
        const q = this.questions[this.currentQuestionIndex];
        this.addToWrongBook(q, '手动添加');
    }
    
    addToWrongBookSilent(q, ans) {
        if (!this.wrongBook.find(i => i.question.id === q.id)) {
            this.wrongBook.push({ question: q, userAnswer: ans||'未作答', reason: '答错', addedAt: new Date().toISOString() });
            this.saveWrongBook();
        }
    }
    
    addToWrongBook(q, reason) {
        if (!this.wrongBook.find(i => i.question.id === q.id)) {
            this.wrongBook.push({ question: q, userAnswer: '手动添加', reason, addedAt: new Date().toISOString() });
            this.saveWrongBook();
            alert('已加入错题本！📕');
        } else {
            alert('已在错题本中');
        }
    }
    
    showFeedback(result, q) {
        this.elements.feedback.style.display = 'flex';
        this.elements.feedback.className = 'feedback ' + (result.correct ? 'correct' : 'wrong');
        this.elements.feedbackIcon.textContent = result.correct ? '✅' : '❌';
        this.elements.feedbackTitle.textContent = result.correct ? '回答正确！' : '回答错误';
        this.elements.feedbackAnalysis.textContent = result.analysis || `正确答案：${result.correctAnswer}`;
        
        if (q.type !== 'fill' && q.type !== 'short') {
            document.querySelectorAll('.option-item').forEach(item => {
                if (item.dataset.key === result.correctAnswer) item.classList.add('correct');
                else if (item.classList.contains('selected') && !result.correct) item.classList.add('wrong');
            });
        }
    }
    
    nextQuestion() {
        this.currentQuestionIndex++;
        this.isSubmitting = false;
        // 移除交卷按钮（如果有）
        const finishBtn = this.elements.nextBtn.parentNode.querySelector('button:not(#nextBtn):not(#submitBtn):not(#skipBtn):not(#addToWrongBtn)');
        if (finishBtn) finishBtn.remove();
        this.loadQuestion();
    }
    
    finishQuiz() {
        const total = this.questions.length;
        const correct = this.userAnswers.filter(a => window.questionsAPI.checkAnswer(a.correctAnswer, a.userAnswer)).length;
        const accuracy = Math.round((correct/total)*100);
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('resultTotal').textContent = total;
        document.getElementById('resultCorrect').textContent = correct;
        document.getElementById('resultWrong').textContent = total - correct;
        document.getElementById('resultAccuracy').textContent = accuracy + '%';
        
        const icon = document.getElementById('resultIcon');
        const title = document.getElementById('resultTitle');
        icon.textContent = accuracy >= 90 ? '🏆' : accuracy >= 70 ? '🎉' : accuracy >= 60 ? '👍' : '📚';
        title.textContent = accuracy >= 90 ? '太棒了！' : accuracy >= 70 ? '成绩不错！' : accuracy >= 60 ? '继续加油！' : '再接再厉！';
        
        this.showScreen('result');
    }
    
    showReview() {
        this.elements.reviewList.innerHTML = '';
        this.userAnswers.forEach((a, i) => {
            const isCorrect = window.questionsAPI.checkAnswer(a.correctAnswer, a.userAnswer);
            const div = document.createElement('div');
            div.className = 'review-item ' + (isCorrect ? 'correct' : 'wrong');
            div.innerHTML = `<div class="review-question">${i+1}. ${a.question}</div><div class="review-answer user">你的答案：${a.userAnswer} ${isCorrect?'✅':a.skipped?'⏭️':'❌'}</div>${!isCorrect?`<div class="review-answer correct-answer">正确答案：${a.correctAnswer}</div>`:''}<div class="review-analysis">📝 ${a.analysis||'无解析'}</div>`;
            this.elements.reviewList.appendChild(div);
        });
        this.showScreen('review');
    }
    
    showWrongBook() {
        this.showScreen('wrongBook');
        this.elements.wrongBookCount.textContent = this.wrongBook.length;
        if (!this.wrongBook.length) {
            this.elements.wrongBookList.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">错题本是空的</div>';
            return;
        }
        this.elements.wrongBookList.innerHTML = '';
        this.wrongBook.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'wrong-book-item';
            div.innerHTML = `<div class="wrong-book-meta">#${i+1} | ${window.questionsAPI.getTypeName(item.question.type)}</div><div class="wrong-book-question">${item.question.question}</div><div style="color:#4caf50;margin:8px 0;">答案：${item.question.answer}</div><div style="margin-top:10px;display:flex;gap:10px;"><button class="btn-small" onclick="quizApp.removeWrongItem(${item.question.id})">移除</button><button class="btn-small" onclick="quizApp.showWrongAnalysis(${item.question.id})">解析</button></div>`;
            this.elements.wrongBookList.appendChild(div);
        });
    }
    
    removeWrongItem(id) {
        this.removeFromWrongBook(id);
        this.showWrongBook();
    }
    
    showWrongAnalysis(id) {
        const item = this.wrongBook.find(i => i.question.id === id);
        if (item) alert(`题目：${item.question.question}\n\n答案：${item.question.answer}\n\n解析：${item.question.analysis||'无'}`);
    }
    
    removeFromWrongBook(id) {
        this.wrongBook = this.wrongBook.filter(i => i.question.id !== id);
        this.saveWrongBook();
    }
    
    clearWrongBook() {
        if (confirm('确定清空错题本？')) {
            this.wrongBook = [];
            this.saveWrongBook();
            this.showWrongBook();
        }
    }
    
    practiceWrongQuestions() {
        if (!this.wrongBook.length) return alert('错题本为空');
        this.selectedMode = 'practice';
        this.isPracticeMode = true;
        this.questions = this.wrongBook.map(i => i.question);
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.selectedOptions = [];
        this.isSubmitting = false;
        this.showScreen('quiz');
        if (this.elements.homeBtn) this.elements.homeBtn.style.display = 'block';
        this.loadQuestion();
    }
}

// 全局实例
window.quizApp = new QuizApp();
