// ===========================
// データ読み込み
// ===========================
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load: ${path}`);
  return res.json();
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

  const allWeak = Object.values(ss.units).reduce((a, u) => a + (u.weak?.length || 0), 0);
  document.getElementById('weak-btn').style.display = allWeak > 0 ? '' : 'none';

  const el = document.getElementById('unit-list');
  el.innerHTML = currentData.units.map(u => {
    const us = getUnitStats(sid, u.unit);
    const rate = us.total > 0 ? Math.round(us.ok / us.total * 100) : null;
    const barW = rate ?? 0;
    const barColor = rate === null
      ? 'var(--color-border-tertiary)'
      : rate >= 80 ? 'var(--color-text-success)'
      : rate >= 50 ? 'var(--color-text-warning)'
      : 'var(--color-text-danger)';
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
  showScreen('s-quiz');
  nextCard();
}

// ===========================
// カード画面
// ===========================
function nextCard() {
  if (!queue.length) { showResult(); return; }
  currentCard = queue.shift();
  document.getElementById('q-unit-tag').textContent = currentCard.unit;
  document.getElementById('q-text').textContent = currentCard.q;
  document.getElementById('ans-area').style.display = 'none';
  document.getElementById('quiz-btns').innerHTML = `
    <button class="btn btn-primary btn-full" onclick="revealAnswer()">答えを見る</button>`;
  document.getElementById('hint-text').textContent = 'スペース / Enter で答えを見る';
  const done = sessionTotal;
  const total = done + queue.length + 1;
  document.getElementById('q-prog').style.width = (done / total * 100) + '%';
  document.getElementById('q-cnt').textContent = `${done + 1} / ${total}枚`;
}

function revealAnswer() {
  document.getElementById('ans-text').textContent = currentCard.a;
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

// ===========================
// 結果画面
// ===========================
function showResult() {
  showScreen('s-result');
  const rate = sessionTotal > 0 ? Math.round(sessionOk / sessionTotal * 100) : 0;
  let badge = '⭐', title = '', msg = '';
  if (rate === 100) { badge = '🏆'; title = 'パーフェクト！'; msg = '全問わかった！すばらしい！'; }
  else if (rate >= 80) { badge = '😊'; title = 'よくできました！'; msg = `正答率${rate}%！あと少し！`; }
  else if (rate >= 50) { badge = '📖'; title = 'もう少し！'; msg = `正答率${rate}%。苦手を練習しよう。`; }
  else { badge = '💪'; title = 'がんばろう！'; msg = `正答率${rate}%。くり返すのが大事！`; }
  document.getElementById('r-badge').textContent = badge;
  document.getElementById('r-title').textContent = title;
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
function goHome() { showScreen('s-dash'); renderDashboard(); }
function goSubjects() { showScreen('s-subjects'); renderSubjectScreen(); }
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
