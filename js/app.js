// ===========================
// データ読み込み
// ===========================
async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load: ${path}`);
  return res.json();
}

// 強制リロード: サーバーに直接問い合わせてからページをリロードします。
async function forceReload() {
  const btn = document.getElementById('force-update');
  if (btn) { btn.disabled = true; btn.textContent = '更新中...'; }
  try {
    // 主要ファイルにキャッシュ無効でアクセスして最新を取得させる
    await Promise.all([
      fetch(window.location.href, { cache: 'no-store', credentials: 'same-origin' }),
      fetch('index.html', { cache: 'no-store' }),
      fetch('js/app.js', { cache: 'no-store' })
    ]);
  } catch (e) {
    // ignore
  }
  location.reload();
}

// ===========================
// 状態管理
// ===========================
let subjects = [];
let currentSubject = null;
let currentData = null;
let queue = [];
let sessionMissed = [];
let sessionTotal = 0;
let sessionOk = 0;
let currentCard = null;
let quizHistory = [];
let stats = {};

function loadStats() {
  try {
    const s = localStorage.getItem('quiz_stats');
    if (s) stats = JSON.parse(s);
  } catch (e) {}
}

function saveStats() {
  try {
    localStorage.setItem('quiz_stats', JSON.stringify(stats));
  } catch (e) {}
}

const PROGRESS_KEY = 'quiz_progress';
const LAST_RESULT_KEY = 'quiz_last_result';

function getSavedQuizProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY));
  } catch (e) {
    return null;
  }
}

function saveQuizProgress() {
  if (!currentSubject || !currentCard) return;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      subjectId: currentSubject.id,
      queue,
      currentCard,
      sessionMissed,
      sessionTotal,
      sessionOk,
      quizHistory,
    }));
  } catch (e) {}
}

function clearQuizProgress() {
  localStorage.removeItem(PROGRESS_KEY);
}

function getSavedLastResult() {
  try {
    return JSON.parse(localStorage.getItem(LAST_RESULT_KEY));
  } catch (e) {
    return null;
  }
}

function saveLastResult(result) {
  try {
    localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result));
  } catch (e) {}
}

function clearLastResult() {
  localStorage.removeItem(LAST_RESULT_KEY);
}

function getResumeSubjectName(progress) {
  if (!progress) return '';
  const subject = subjects.find(s => s.id === progress.subjectId);
  return subject ? `${subject.icon} ${subject.name}` : progress.subjectId;
}

function updateResumeArea() {
  const area = document.getElementById('resume-area');
  const progress = getSavedQuizProgress();
  if (!area) return;
  if (!progress) {
    area.innerHTML = '';
    return;
  }
  const subjectName = getResumeSubjectName(progress);
  area.innerHTML = `
    <div class="section-label">途中で中断したクイズがあります</div>
    <div style="margin:0.75rem 0 1rem;font-size:13px;color:var(--text2)">科目: ${subjectName}</div>
    <button class="btn btn-primary btn-full" onclick="resumeQuiz()">続きから再開</button>`;
}

function saveProgressIfActive() {
  const quizScreen = document.getElementById('s-quiz');
  if (quizScreen.classList.contains('active') && currentCard) {
    saveQuizProgress();
  }
}

function saveCurrentResult() {
  const lastResult = {
    subjectId: currentSubject?.id,
    subjectName: currentSubject ? `${currentSubject.icon} ${currentSubject.name}` : '',
    total: sessionTotal,
    ok: sessionOk,
    rate: sessionTotal > 0 ? Math.round(sessionOk / sessionTotal * 100) : 0,
    missed: sessionMissed,
    timestamp: new Date().toISOString(),
  };
  saveLastResult(lastResult);
}

function showSavedResult() {
  const saved = getSavedLastResult();
  if (!saved) { alert('前回の結果が見つかりません。'); return; }
  document.getElementById('r-subject').textContent = saved.subjectName ? `科目: ${saved.subjectName}` : '';
  document.getElementById('r-badge').textContent = saved.rate === 100 ? '🏆' : saved.rate >= 80 ? '😊' : saved.rate >= 50 ? '📖' : '💪';
  document.getElementById('r-title').textContent = saved.rate === 100 ? 'パーフェクト！' : saved.rate >= 80 ? 'よくできました！' : saved.rate >= 50 ? 'もう少し！' : 'がんばろう！';
  document.getElementById('r-msg').textContent = `${saved.ok}/${saved.total}枚 · 正答率${saved.rate}%`;
  document.getElementById('r-total').textContent = saved.total;
  document.getElementById('r-ok').textContent = saved.ok;
  document.getElementById('r-rate').textContent = saved.rate + '%';
  sessionMissed = saved.missed || [];
  document.getElementById('r-retry').style.display = sessionMissed.length > 0 ? '' : 'none';
  const ml = document.getElementById('r-missed');
  ml.innerHTML = saved.missed?.length > 0
    ? '<div class="section-label" style="margin-bottom:8px">わからなかった問題</div>' +
      saved.missed.map(q => `
        <div class="missed-item">
          <div class="missed-q">${q.q}</div>
          <div class="missed-a">→ ${q.a}</div>
        </div>`).join('')
    : '';
  showScreen('s-result');
}

function resetSavedProgress() {
  clearQuizProgress();
  updateResumeArea();
}

function clearResultIfNeeded() {
  const saved = getSavedLastResult();
  if (!saved) return;
  saveLastResult(saved);
}

function getLastResultForSubject(subjectId) {
  const saved = getSavedLastResult();
  return saved && saved.subjectId === subjectId ? saved : null;
}

function hasSavedProgressForSubject(subjectId) {
  const progress = getSavedQuizProgress();
  return progress && progress.subjectId === subjectId;
}

function resumeQuiz() {
  const progress = getSavedQuizProgress();
  if (!progress) { alert('保存されたクイズの進行状況が見つかりません。'); return; }
  const targetSubject = subjects.find(s => s.id === progress.subjectId);
  if (!targetSubject) { alert('保存されたクイズの科目が見つかりません。'); return; }
  currentSubject = targetSubject;
  loadJSON(currentSubject.file)
    .then(data => {
      currentData = data;
      queue = progress.queue;
      currentCard = progress.currentCard;
      sessionMissed = progress.sessionMissed;
      sessionTotal = progress.sessionTotal;
      sessionOk = progress.sessionOk;
      quizHistory = progress.quizHistory;
      showScreen('s-quiz');
      renderCurrentCard();
    })
    .catch(() => alert('データの読み込みに失敗しました'));
}

function showLastResultButton(subjectId) {
  const btn = document.getElementById('last-result-btn');
  if (!btn) return;
  btn.style.display = getLastResultForSubject(subjectId) ? '' : 'none';
}

function renderDashboardControls(subjectId) {
  const continueBtn = document.getElementById('continue-quiz-btn');
  const lastResultBtn = document.getElementById('last-result-btn');
  if (continueBtn) continueBtn.style.display = hasSavedProgressForSubject(subjectId) ? '' : 'none';
  if (lastResultBtn) lastResultBtn.style.display = getLastResultForSubject(subjectId) ? '' : 'none';
}

function getProgressSummary() {
  const progress = getSavedQuizProgress();
  if (!progress) return null;
  return progress;
}

function showSavedResumeInfo() {
  updateResumeArea();
}

function getSavedResult() {
  return getSavedLastResult();
}

function saveProgressAfterStateChange() {
  saveQuizProgress();
}

function discardProgress() {
  clearQuizProgress();
}

function clearReviewState() {
  clearQuizProgress();
}

function willResumeCurrentSubject(subjectId) {
  return hasSavedProgressForSubject(subjectId);
}

function getSavedSubjectName() {
  const progress = getSavedQuizProgress();
  return progress ? getResumeSubjectName(progress) : '';
}

function getSavedQuizCheckpoint() {
  return getSavedQuizProgress();
}

function getSavedQuizState() {
  return getSavedQuizProgress();
}

function getSavedQuizProgressCount() {
  const progress = getSavedQuizProgress();
  return progress ? progress.queue?.length + 1 : 0;
}

function getSavedResultSummary() {
  return getSavedLastResult();
}

function getSavedProgressInfo() {
  const progress = getSavedQuizProgress();
  if (!progress) return null;
  return {
    subjectId: progress.subjectId,
    currentCount: progress.sessionTotal + 1,
    remaining: progress.queue.length,
  };
}

function refreshResumeButtons() {
  if (currentSubject) renderDashboardControls(currentSubject.id);
}

function clearSavedProgressWithConfirm() {
  if (confirm('保存された進行状況を破棄しますか？')) {
    clearQuizProgress();
    updateResumeArea();
    if (currentSubject) renderDashboardControls(currentSubject.id);
  }
}

function initSavedUi() {
  updateResumeArea();
}

function getSubjectStats(subjectId) {
  if (!stats[subjectId]) stats[subjectId] = { total: 0, ok: 0, units: {} };
  return stats[subjectId];
}

function getUnitStats(subjectId, unitName) {
  const ss = getSubjectStats(subjectId);
  if (!ss.units[unitName]) ss.units[unitName] = { total: 0, ok: 0, weak: [] };
  return ss.units[unitName];
}

// ===========================
// 画面切り替え
// ===========================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===========================
// 教科選択画面
// ===========================
async function initApp() {
  loadStats();
  try {
    subjects = await loadJSON('data/subjects.json');
    renderSubjectScreen();
    showScreen('s-subjects');
  } catch (e) {
    document.getElementById('s-subjects').innerHTML =
      '<p style="color:var(--color-text-danger);padding:1rem">データの読み込みに失敗しました。Live Serverで起動してください。</p>';
  }
}

function renderSubjectScreen() {
  const el = document.getElementById('subject-list');
  el.innerHTML = subjects.map(sub => {
    const ss = getSubjectStats(sub.id);
    const rate = ss.total > 0 ? Math.round(ss.ok / ss.total * 100) : null;
    const allWeak = Object.values(ss.units).reduce((a, u) => a + (u.weak?.length || 0), 0);
    return `
      <div class="subject-card" onclick="selectSubject('${sub.id}')">
        <div class="subject-icon">${sub.icon}</div>
        <div class="subject-info">
          <div class="subject-name">${sub.name}</div>
          <div class="subject-meta">${rate !== null ? rate + '% · ' : '未挑戦 · '}${allWeak > 0 ? '苦手' + allWeak + '問' : ''}</div>
        </div>
        <div class="subject-arrow">›</div>
      </div>`;
  }).join('');
  updateResumeArea();
}

async function selectSubject(subjectId) {
  currentSubject = subjects.find(s => s.id === subjectId);
  try {
    currentData = await loadJSON(currentSubject.file);
    renderDashboard();
    showScreen('s-dash');
  } catch (e) {
    alert('データの読み込みに失敗しました');
  }
}

// ===========================
// ダッシュボード
// ===========================
function renderDashboard() {
  const sid = currentSubject.id;
  const ss = getSubjectStats(sid);
  document.getElementById('dash-subject-name').textContent = currentSubject.icon + ' ' + currentSubject.name;
  document.getElementById('d-total').textContent = ss.total;
  document.getElementById('d-ok').textContent = ss.ok;
  document.getElementById('d-rate').textContent = ss.total > 0 ? Math.round(ss.ok / ss.total * 100) + '%' : '-%';

  renderDashboardControls(sid);
  const allWeak = Object.values(ss.units).reduce((a, u) => a + (u.weak?.length || 0), 0);
  document.getElementById('weak-btn').style.display = allWeak > 0 ? '' : 'none';

  const el = document.getElementById('unit-list');
  el.innerHTML = currentData.units.map(u => {
    const us = getUnitStats(sid, u.unit);
    const rate = us.total > 0 ? Math.round(us.ok / us.total * 100) : null;
    const barW = rate ?? 0;
    const barColor = rate === null
      ? 'var(--text3)'
      : rate >= 80 ? 'var(--ok-text)'
      : rate >= 50 ? 'var(--warn-text)'
      : 'var(--ng-text)';
    const wc = us.weak?.length || 0;
    return `
      <div class="unit-card" onclick="startUnit('${u.unit.replace(/'/g, "\\'")}')">
        <div class="uc-top">
          <span class="uc-name">${u.unit}${wc > 0 ? `<span class="weak-badge">苦手 ${wc}</span>` : ''}</span>
          <span class="uc-meta">${rate !== null ? rate + '%' : '未挑戦'} · ${u.questions.length}問</span>
        </div>
        <div class="uc-bar-bg"><div class="uc-bar" style="width:${barW}%;background:${barColor}"></div></div>
      </div>`;
  }).join('');
}

// ===========================
// クイズ開始
// ===========================
function shuffle(arr) {
  let a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startUnit(unitName) {
  const unit = currentData.units.find(u => u.unit === unitName);
  queue = shuffle(unit.questions.map(q => ({ ...q, unit: unitName })));
  beginQuiz();
}

function startAll() {
  const all = currentData.units.flatMap(u => u.questions.map(q => ({ ...q, unit: u.unit })));
  queue = shuffle(all);
  beginQuiz();
}

function startWeak() {
  const sid = currentSubject.id;
  const weakIds = Object.entries(getSubjectStats(sid).units)
    .flatMap(([unitName, us]) => (us.weak || []).map(id => ({ id, unit: unitName })));
  const weakQs = currentData.units.flatMap(u =>
    u.questions
      .filter(q => weakIds.some(w => w.id === q.id && w.unit === u.unit))
      .map(q => ({ ...q, unit: u.unit }))
  );
  if (!weakQs.length) { alert('苦手問題がありません'); return; }
  queue = shuffle(weakQs);
  beginQuiz();
}

function beginQuiz() {
  sessionMissed = [];
  sessionTotal = 0;
  sessionOk = 0;
  quizHistory = [];
  clearQuizProgress();
  showScreen('s-quiz');
  nextCard();
}

// ===========================
// カード画面
// ===========================
function getQuestionType(card) {
  return card.type || 'simple';
}

function renderCurrentCard() {
  document.getElementById('q-unit-tag').textContent = `${currentSubject.icon} ${currentSubject.name} · ${currentCard.unit}`;
  document.getElementById('ans-area').style.display = 'none';
  document.getElementById('quiz-btns').innerHTML = '';
  document.getElementById('hint-text').textContent = '';
  
  const qtype = getQuestionType(currentCard);
  
  if (qtype === 'simple' || !qtype) {
    document.getElementById('q-text').textContent = currentCard.q;
    renderSimpleCard();
  } else if (qtype === 'fill_in_blank') {
    document.getElementById('q-text').textContent = currentCard.q;
    renderFillInBlankCard();
  } else if (qtype === 'circle_correct') {
    renderCircleCorrectCard();
  } else if (qtype === 'matching') {
    renderMatchingCard();
  } else if (qtype === 'rearrange') {
    renderRearrangeCard();
  } else {
    document.getElementById('q-text').textContent = currentCard.q;
    renderSimpleCard();
  }
  
  const done = sessionTotal;
  const total = done + queue.length + 1;
  document.getElementById('q-prog').style.width = (done / total * 100) + '%';
  document.getElementById('q-cnt').textContent = `${done + 1} / ${total}枚`;
  document.getElementById('prev-btn').style.display = quizHistory.length > 0 ? '' : 'none';
  saveQuizProgress();
}

function renderSimpleCard() {
  document.getElementById('quiz-btns').innerHTML = `
    <button class="btn btn-primary btn-full" onclick="revealAnswer()">答えを見る</button>`;
  document.getElementById('hint-text').textContent = 'スペース / Enter で答えを見る';
}

function renderFillInBlankCard() {
  document.getElementById('quiz-btns').innerHTML = `
    <button class="btn btn-primary btn-full" onclick="revealAnswer()">答えを見る</button>`;
  document.getElementById('hint-text').textContent = 'スペース / Enter で答えを見る';
}

function renderMatchingCard() {
  const items = currentCard.items || [];
  const rightShuffled = items.map(i => i.right).sort(() => Math.random() - 0.5);
  
  let html = `<div style="white-space:pre-wrap">${currentCard.q}\n</div>`;
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1rem 0">';
  html += '<div>';
  items.forEach((item, i) => {
    html += `<div style="padding:8px;background:var(--bg2);border-radius:var(--radius);margin-bottom:6px">${item.left}</div>`;
  });
  html += '</div><div>';
  rightShuffled.forEach((right) => {
    html += `<div style="padding:8px;background:var(--bg2);border-radius:var(--radius);margin-bottom:6px">${right}</div>`;
  });
  html += '</div></div>';
  
  document.getElementById('q-text').innerHTML = html;
  document.getElementById('quiz-btns').innerHTML = `
    <button class="btn btn-primary btn-full" onclick="revealAnswer()">答えを見る</button>`;
  document.getElementById('hint-text').textContent = 'スペース / Enter で答えを見る';
}

function renderRearrangeCard() {
  const words = currentCard.words || [];
  
  let html = `<div style="white-space:pre-wrap">${currentCard.q}\n</div>`;
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:1rem 0">';
  words.forEach((word, i) => {
    html += `<div style="padding:10px 12px;background:var(--info-bg);color:var(--info-text);border-radius:var(--radius);font-weight:500">${word}</div>`;
  });
  html += '</div>';
  
  document.getElementById('q-text').innerHTML = html;
  document.getElementById('quiz-btns').innerHTML = `
    <button class="btn btn-primary btn-full" onclick="revealAnswer()">答えを見る</button>`;
  document.getElementById('hint-text').textContent = 'スペース / Enter で答えを見る';
}

function renderCircleCorrectCard() {
  const choices = currentCard.choices || [];
  const circleNums = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  
  let html = `<div style="white-space:pre-wrap">${currentCard.q}\n\n`;
  choices.forEach((choice, i) => {
    html += `${circleNums[i]} ${choice}\n`;
  });
  html += '</div>';
  
  document.getElementById('q-text').innerHTML = html;
  document.getElementById('quiz-btns').innerHTML = `
    <button class="btn btn-primary btn-full" onclick="revealAnswer()">答えを見る</button>`;
  document.getElementById('hint-text').textContent = 'スペース / Enter で答えを見る';
}

function revealAnswer() {
  const qtype = getQuestionType(currentCard);
  
  if (qtype === 'fill_in_blank') {
    document.getElementById('ans-text').textContent = `${currentCard.expectedAnswers?.join(' / ') || currentCard.a}`;
  } else if (qtype === 'circle_correct') {
    const correctIndex = currentCard.correctIndex !== undefined ? currentCard.correctIndex : 0;
    const circleNums = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
    const correctChoice = currentCard.choices?.[correctIndex] || currentCard.a;
    document.getElementById('ans-text').textContent = `${circleNums[correctIndex]} ${correctChoice}`;
  } else if (qtype === 'matching') {
    const items = currentCard.items || [];
    const pairs = items.map(item => `${item.left} → ${item.right}`).join('\n');
    document.getElementById('ans-text').textContent = pairs;
  } else if (qtype === 'rearrange') {
    const words = currentCard.words || [];
    const correctOrder = currentCard.correctOrder || [];
    const correctSentence = correctOrder.map(idx => words[idx]).join(' ');
    document.getElementById('ans-text').textContent = correctSentence;
  } else {
    document.getElementById('ans-text').textContent = currentCard.a;
  }
  
  document.getElementById('ans-area').style.display = 'block';
  document.getElementById('quiz-btns').innerHTML = `
    <div class="judge-row">
      <button class="btn btn-success" onclick="judge(true)">わかった ○</button>
      <button class="btn btn-ng" onclick="judge(false)">わからなかった ×</button>
    </div>`;
  document.getElementById('hint-text').textContent = '← × ／ ○ →';
}

function judge(ok) {
  const sid = currentSubject.id;
  const us = getUnitStats(sid, currentCard.unit);
  const ss = getSubjectStats(sid);
  const prevWeak = [...us.weak];
  quizHistory.push({ card: currentCard, ok, unit: currentCard.unit, prevWeak });
  sessionTotal++; ss.total++; us.total++;
  if (ok) {
    sessionOk++; ss.ok++; us.ok++;
    us.weak = us.weak.filter(id => id !== currentCard.id);
  } else {
    sessionMissed.push(currentCard);
    if (!us.weak.includes(currentCard.id)) us.weak.push(currentCard.id);
  }
  saveStats();
  nextCard();
}

function nextCard() {
  if (!queue.length) { showResult(); return; }
  currentCard = queue.shift();
  renderCurrentCard();
}

function prevCard() {
  if (!quizHistory.length) return;
  const last = quizHistory.pop();
  const previousCard = last.card;
  const sid = currentSubject.id;
  const ss = getSubjectStats(sid);
  const us = getUnitStats(sid, previousCard.unit);
  ss.total--;
  us.total--;
  sessionTotal--;
  if (last.ok) {
    ss.ok--;
    us.ok--;
    sessionOk--;
  } else {
    const missedIndex = sessionMissed.findIndex(q => q.id === previousCard.id && q.unit === previousCard.unit);
    if (missedIndex >= 0) sessionMissed.splice(missedIndex, 1);
  }
  us.weak = last.prevWeak;
  if (currentCard) queue.unshift(currentCard);
  currentCard = previousCard;
  saveStats();
  renderCurrentCard();
}

// ===========================
// 結果画面
// ===========================
function showResult() {
  saveCurrentResult();
  clearQuizProgress();
  showScreen('s-result');
  const rate = sessionTotal > 0 ? Math.round(sessionOk / sessionTotal * 100) : 0;
  let badge = '⭐', title = '', msg = '';
  if (rate === 100) { badge = '🏆'; title = 'パーフェクト！'; msg = '全問わかった！すばらしい！'; }
  else if (rate >= 80) { badge = '😊'; title = 'よくできました！'; msg = `正答率${rate}%！あと少し！`; }
  else if (rate >= 50) { badge = '📖'; title = 'もう少し！'; msg = `正答率${rate}%。苦手を練習しよう。`; }
  else { badge = '💪'; title = 'がんばろう！'; msg = `正答率${rate}%。くり返すのが大事！`; }
  document.getElementById('r-badge').textContent = badge;
  document.getElementById('r-title').textContent = title;
  document.getElementById('r-subject').textContent = currentSubject ? `科目: ${currentSubject.icon} ${currentSubject.name}` : '';
  document.getElementById('r-msg').textContent = `${sessionOk}/${sessionTotal}枚 · ${msg}`;
  document.getElementById('r-total').textContent = sessionTotal;
  document.getElementById('r-ok').textContent = sessionOk;
  document.getElementById('r-rate').textContent = rate + '%';
  document.getElementById('r-retry').style.display = sessionMissed.length > 0 ? '' : 'none';
  const ml = document.getElementById('r-missed');
  ml.innerHTML = sessionMissed.length > 0
    ? '<div class="section-label" style="margin-bottom:8px">わからなかった問題</div>' +
      sessionMissed.map(q => `
        <div class="missed-item">
          <div class="missed-q">${q.q}</div>
          <div class="missed-a">→ ${q.a}</div>
        </div>`).join('')
    : '';
}

function retryMissed() { queue = [...sessionMissed]; beginQuiz(); }
function saveAndQuit() {
  if (!confirm('クイズを中断して戻りますか？途中から再開できます。')) return;
  saveProgressIfActive();
  showScreen('s-dash'); renderDashboard();
}
function confirmLeaveQuiz() {
  if (document.getElementById('s-quiz').classList.contains('active') && (currentCard || queue.length)) {
    return confirm('クイズを中断して戻りますか？途中から再開できます。');
  }
  return true;
}
function goHome() {
  if (!confirmLeaveQuiz()) return;
  saveProgressIfActive();
  showScreen('s-dash'); renderDashboard();
}
function goSubjects() {
  if (!confirmLeaveQuiz()) return;
  saveProgressIfActive();
  showScreen('s-subjects'); renderSubjectScreen();
}
function resetStats() {
  if (!confirm('この教科の記録をリセットしますか？')) return;
  if (currentSubject) delete stats[currentSubject.id];
  saveStats();
  renderDashboard();
}

// ===========================
// キーボード操作
// ===========================
document.addEventListener('keydown', e => {
  const qs = document.getElementById('s-quiz');
  if (!qs.classList.contains('active')) return;
  const btns = document.getElementById('quiz-btns');
  if ((e.key === ' ' || e.key === 'Enter') && btns.querySelector('.btn-primary')) {
    e.preventDefault(); revealAnswer();
  }
  if ((e.key === 'ArrowRight' || e.key === 'o') && btns.querySelector('.btn-success')) {
    e.preventDefault(); judge(true);
  }
  if ((e.key === 'ArrowLeft' || e.key === 'x') && btns.querySelector('.btn-ng')) {
    e.preventDefault(); judge(false);
  }
});

// ===========================
// 起動
// ===========================
initApp();
