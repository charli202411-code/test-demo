/* ============================================================
 * 实习罗盘 · 应用主逻辑（hash 路由 SPA）
 * 全部交互本地模拟：模拟 loading 延时 / 模拟 AI 成功 / 模拟失败 / 信息不足 / 用户纠正
 * 无任何网络请求。页面与状态编号对应 product-doc.md 第 3 节（P01-P08 / S01-S08）
 * ============================================================ */

/* ---------------- 工具 ---------------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function fmtTime(t) {
  var d = new Date(t); function z(n) { return n < 10 ? '0' + n : '' + n; }
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
}
function val(sel) { var el = document.querySelector(sel); return el ? el.value : ''; }
function parseHTML(html) { var t = document.createElement('template'); t.innerHTML = html; return t.content.firstChild; }
function deep(o) { return JSON.parse(JSON.stringify(o)); }

/* ---------------- 本地存储（演示无后端，数据存 localStorage / sessionStorage） ---------------- */
var LS = { records: 'compass_records', actions: 'compass_actions', draft: 'compass_draft' };
var SS = { pending: 'compass_pending', failOnce: 'compass_failonce', failHard: 'compass_failhard' };

function loadJSON(key, def) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function saveJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
function getRecords() { return loadJSON(LS.records, []); }
function setRecords(r) { saveJSON(LS.records, r); }
function findRecord(id) { return getRecords().find(function (r) { return r.id === id; }); }
function getActions() { return loadJSON(LS.actions, []); }
function setActions(a) { saveJSON(LS.actions, a); }
function getDraft() { return loadJSON(LS.draft, null); }
function setDraft(p) { saveJSON(LS.draft, p); }
function clearDraft() { localStorage.removeItem(LS.draft); }
function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
function ssSet(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }

var analysisTimer = null;
var stageTimers = [];

/* ---------------- 弹窗与 Toast ---------------- */
function openModal(opts) {
  var root = document.getElementById('modal-root');
  var html = '<div class="modal-mask"><div class="modal"><h3>' + opts.title + '</h3>'
    + '<div class="m-body">' + opts.bodyHTML + '</div><div class="m-actions">'
    + (opts.actions || []).map(function (a, i) { return '<button class="btn ' + (a.cls || '') + '" data-mi="' + i + '">' + a.label + '</button>'; }).join('')
    + '</div></div></div>';
  root.innerHTML = html;
  var mask = root.firstChild;
  if (!opts.lock) mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
  (opts.actions || []).forEach(function (a, i) {
    mask.querySelector('[data-mi="' + i + '"]').addEventListener('click', function () {
      if (!a.keep) closeModal();
      if (a.fn) a.fn();
    });
  });
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
function toast(msg, type) {
  var root = document.getElementById('toast-root');
  var t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(function () { t.remove(); }, 3400);
}

/* ---------------- 路由 ---------------- */
function parseHash() {
  var h = location.hash.replace(/^#/, '') || '/home';
  var q = h.indexOf('?');
  var path = q >= 0 ? h.slice(0, q) : h;
  var query = {};
  if (q >= 0) h.slice(q + 1).split('&').forEach(function (kv) {
    if (!kv) return; var p = kv.split('=');
    query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
  });
  return { path: path, query: query };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function setNav(key) {
  document.querySelectorAll('#nav a').forEach(function (a) {
    a.classList.toggle('active', a.getAttribute('data-nav') === key);
  });
}

function render() {
  if (analysisTimer) { clearTimeout(analysisTimer); analysisTimer = null; }
  stageTimers.forEach(clearTimeout); stageTimers = [];
  closeModal();
  var r = parseHash();
  var seg = r.path.split('/').filter(Boolean);
  var app = document.getElementById('app');
  if (seg.length === 0 || seg[0] === 'home') { setNav('home'); renderHome(app); }
  else if (seg[0] === 'form') { setNav('home'); renderForm(app, r.query); }
  else if (seg[0] === 'analyzing') { setNav('home'); renderAnalyzing(app); }
  else if (seg[0] === 'result') { setNav('history'); renderResult(app, seg[1]); }
  else if (seg[0] === 'history' && seg[1]) { setNav('history'); renderHistoryDetail(app, seg[1]); }
  else if (seg[0] === 'history') { setNav('history'); renderHistory(app); }
  else if (seg[0] === 'actions') { setNav('actions'); renderActions(app); }
  else location.hash = '#/home';
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

/* ---------------- 通用空态 ---------------- */
function emptyHTML(title, sub, href, cta) {
  return '<div class="card empty">'
    + '<svg width="56" height="56" viewBox="0 0 56 56" fill="none" style="margin:0 auto 14px;display:block">'
    + '<circle cx="28" cy="28" r="22" stroke="#c9d2e3" stroke-width="3" stroke-dasharray="6 6"/>'
    + '<circle cx="28" cy="28" r="6" fill="#3b5bfd"/></svg>'
    + '<h3 style="margin-bottom:6px">' + title + '</h3>'
    + '<p class="muted" style="margin-bottom:16px">' + sub + '</p>'
    + (href ? '<a class="btn btn-primary" href="' + href + '">' + cta + '</a>' : '')
    + '</div>';
}

/* ================= P01 首页（空态 / 回访态） ================= */
function renderHome(app) {
  var records = getRecords();
  if (!records.length) {
    app.innerHTML = ''
      + '<div class="card hero">'
      + '<svg width="64" height="64" viewBox="0 0 56 56" fill="none" style="margin:0 auto 16px;display:block">'
      + '<circle cx="28" cy="28" r="22" stroke="#3b5bfd" stroke-width="3" stroke-dasharray="8 6"/>'
      + '<path d="M28 14 L32 28 L28 42 L24 28 Z" fill="#3b5bfd" opacity=".85"/></svg>'
      + '<h1>看清你与目标岗位的差距</h1>'
      + '<p>第一次准备实习，不知道先准备什么、自己差在哪？选择目标岗位、填下你的经历，AI 逐项对照岗位要求，生成一份按优先级排好的行动清单。</p>'
      + '<div class="hero-cta">'
      + '<a class="btn btn-primary" href="#/form">开始第一次差距分析</a>'
      + '<a class="btn btn-ghost" href="#/history">我的记录</a>'
      + '</div>'
      + '<p class="muted" style="margin-top:18px;font-size:12.5px">演示原型：全部数据为本地模拟，无网络请求、无真实 AI 调用</p>'
      + '</div>'
      + '<div class="steps">'
      + '<div class="step"><b>1</b><h3>选岗位 · 填经历</h3><p class="muted">从预置岗位库选择目标岗位，结构化填写你的课程、社团、比赛与技能。</p></div>'
      + '<div class="step"><b>2</b><h3>AI 逐维对照</h3><p class="muted">模拟引擎按维度对照岗位要求与你的经历，标注差距与依据（事实 / 推测 / 待补充）。</p></div>'
      + '<div class="step"><b>3</b><h3>拿到行动清单</h3><p class="muted">按优先级排序的补差行动，含预期收益与耗时；完成后回来看建议更新。</p></div>'
      + '</div>';
    return;
  }
  /* 回访态 */
  var latest = records[0];
  var allActs = getActions();
  var la = allActs.filter(function (a) { return a.rid === latest.id; });
  var res = buildResult(latest, la);
  var doneAll = allActs.filter(function (a) { return a.status === 'done'; }).length;
  var matchText = res.mode === 'full' ? res.match + '%' : '起步模式';
  app.innerHTML = ''
    + '<div class="page-head"><h1>欢迎回来</h1><span class="badge badge-demo">模拟数据</span></div>'
    + '<div class="grid-3">'
    + '<div class="stat-cube"><b>' + records.length + '</b><span>累计分析次数</span></div>'
    + '<div class="stat-cube"><b>' + matchText + '</b><span>最新匹配度（' + esc(res.jobName) + '）</span></div>'
    + '<div class="stat-cube"><b>' + doneAll + '/' + allActs.length + '</b><span>行动完成进度</span></div>'
    + '</div>'
    + '<div class="card home-latest">'
    + '<div class="match-mini"><b>' + matchText + '</b><span class="muted">' + esc(res.jobName) + ' · ' + fmtTime(latest.createdAt) + '</span></div>'
    + (res.mode === 'starter' ? '<span class="badge badge-starter">起步模式 · 补充经历后可获得完整分析</span>' : '<span class="badge badge-count">' + esc(res.tier) + '</span>')
    + '</div>'
    + '<div class="card" style="display:flex;gap:10px;flex-wrap:wrap">'
    + '<a class="btn btn-primary" href="#/actions">继续上次行动</a>'
    + '<a class="btn" href="#/result/' + latest.id + '">查看最新建议</a>'
    + '<a class="btn" href="#/form?fresh=1">新建分析</a>'
    + '<a class="btn btn-ghost" href="#/history">我的记录</a>'
    + '</div>';
}

/* ================= P02 / P05 信息填写页（新建 / 编辑） ================= */
function blankProfile() {
  return { jobId: '', grade: '', major: '', weekly: '', expect: '', exps: [], skills: [] };
}
function expGroupHTML(e) {
  e = e || { type: EXP_TYPES[0], name: '', desc: '' };
  return '<div class="entry-group">'
    + '<div class="entry-row">'
    + '<select class="e-type">' + EXP_TYPES.map(function (t) { return '<option' + (e.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>'
    + '<input class="e-name" placeholder="经历名称，如：校园公众号运营" value="' + esc(e.name) + '">'
    + '<button class="btn btn-ghost btn-sm e-del" type="button">删除</button>'
    + '</div>'
    + '<div class="entry-row two"><textarea class="e-desc" placeholder="做了什么、时长、成果数据（选填），如：运营 1 年，粉丝 3000+，周更 2 篇">' + esc(e.desc) + '</textarea></div>'
    + '</div>';
}
function skillRowHTML(s) {
  s = s || { name: '', level: '了解' };
  return '<div class="entry-row two">'
    + '<input class="s-name" list="skill-suggest" placeholder="技能名，如 Excel" value="' + esc(s.name) + '">'
    + '<select class="s-level">' + ['了解', '熟悉', '熟练', '精通'].map(function (l) { return '<option' + (s.level === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select>'
    + '<button class="btn btn-ghost btn-sm s-del" type="button">删除</button>'
    + '</div>';
}

function renderForm(app, query) {
  var isEdit = query.edit === '1';
  var records = getRecords();
  var rid = query.rid || (records[0] && records[0].id);
  var editRec = isEdit ? findRecord(rid) : null;
  if (isEdit && !editRec) { toast('未找到要修改的记录', 'warn'); location.hash = '#/history'; return; }

  /* 一次性 URL 参数（用后即清，避免重复渲染时再次生效） */
  if (query.fresh === '1') { clearDraft(); }
  if (query.demo === 'fail') { ssSet(SS.failOnce, '1'); }
  if (query.demo === 'fail-hard') { ssSet(SS.failHard, '1'); }
  if (query.fresh || query.demo) {
    try { history.replaceState(null, '', location.pathname + location.search + '#/form' + (isEdit ? '?edit=1&rid=' + rid : '')); } catch (e) {}
  }

  var hadDraft = false;
  var p;
  if (editRec) p = deep(editRec.profile);
  else if (query.fresh === '1') p = blankProfile();
  else {
    var d = getDraft();
    if (d && (d.exps || []).length + (d.skills || []).length + (d.major ? 1 : 0) > 0) { p = d; hadDraft = true; }
    else p = blankProfile();
  }

  app.innerHTML = ''
    + '<div class="page-head"><h1>' + (isEdit ? '修改信息并重新分析' : '信息填写') + '</h1>'
    + (isEdit ? '<span class="badge badge-demo">重新提交将生成新记录，历史保留</span>' : '') + '</div>'
    + '<div class="card">'
    + '<div class="preset-bar"><span>演示提示：可一键载入预置模拟案例（覆盖当前表单）</span>'
    + '<button class="btn btn-sm" type="button" id="btn-preset-a">载入案例 A · 张小雨（产品运营）</button>'
    + '<button class="btn btn-sm" type="button" id="btn-preset-b">载入案例 B · 李明（前端 · 零经历）</button>'
    + '</div>'
    + '<div class="form-grid">'
    + '<div class="field" id="fw-job"><label>目标岗位 <span class="req">*</span></label>'
    + '<select id="f-job"><option value="">请选择</option>' + JOBS.map(function (j) { return '<option value="' + j.id + '"' + (p.jobId === j.id ? ' selected' : '') + '>' + esc(j.name) + '</option>'; }).join('') + '</select>'
    + '<div class="err-msg">请选择目标岗位</div></div>'
    + '<div class="field" id="fw-grade"><label>年级 <span class="req">*</span></label>'
    + '<select id="f-grade"><option value="">请选择</option>' + ['大一', '大二', '大三', '大四', '研究生'].map(function (g) { return '<option' + (p.grade === g ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select>'
    + '<div class="err-msg">请选择年级</div></div>'
    + '<div class="field" id="fw-major"><label>专业 <span class="req">*</span></label>'
    + '<input id="f-major" placeholder="如：市场营销" value="' + esc(p.major) + '">'
    + '<div class="err-msg">请填写专业</div></div>'
    + '<div class="field" id="fw-weekly"><label>每周可投入时间 <span class="req">*</span></label>'
    + '<select id="f-weekly"><option value="">请选择</option>' + [5, 8, 10, 15, 20].map(function (h) { return '<option value="' + h + '"' + (String(p.weekly) === String(h) ? ' selected' : '') + '>' + h + ' 小时/周</option>'; }).join('') + '</select>'
    + '<div class="err-msg">请选择每周可投入时间</div></div>'
    + '<div class="field span2"><label>期望开始实习时间</label>'
    + '<select id="f-expect"><option value="">请选择</option>' + ['1 个月内', '3 个月内', '6 个月内', '不确定'].map(function (e) { return '<option' + (p.expect === e ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></div>'
    + '</div></div>'
    + '<div class="card"><h3>我的经历（可添加多段）</h3>'
    + '<div id="exp-list">' + (p.exps || []).map(expGroupHTML).join('') + '</div>'
    + '<button class="btn btn-sm" type="button" id="btn-add-exp">+ 添加一段经历</button>'
    + '<p class="hint">经历为空也可以提交：将进入「起步模式」，先拿到该岗位的起步建议（对应异常案例 B1）</p></div>'
    + '<div class="card"><h3>技能自评</h3>'
    + '<div id="skill-list">' + (p.skills || []).map(skillRowHTML).join('') + '</div>'
    + '<button class="btn btn-sm" type="button" id="btn-add-skill">+ 添加技能</button>'
    + '<datalist id="skill-suggest">' + SKILL_SUGGESTIONS.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist></div>'
    + '<div class="card">'
    + '<button class="btn btn-primary btn-block" type="button" id="btn-submit">提交并生成差距分析</button>'
    + (isEdit ? '<a class="btn btn-ghost btn-block" style="margin-top:10px" href="#/result/' + editRec.id + '">放弃修改，返回结果页</a>' : '')
    + '<div class="demo-ctl"><label><input type="checkbox" id="demo-fail"' + (ssGet(SS.failOnce) === '1' ? ' checked' : '') + '> 演示控制：模拟下一次分析失败（评审用）</label>'
    + (ssGet(SS.failHard) === '1' ? '<p style="margin-top:6px">注意：已启用持续失败模式（URL 加 ?demo=fail-hard），重试也会失败；弹窗始终保留「返回修改信息」出口，不会死锁</p>' : '')
    + '</div></div>';

  /* 事件绑定 */
  document.getElementById('btn-add-exp').onclick = function () { document.getElementById('exp-list').appendChild(parseHTML(expGroupHTML())); };
  document.getElementById('btn-add-skill').onclick = function () { document.getElementById('skill-list').appendChild(parseHTML(skillRowHTML())); };
  document.getElementById('exp-list').addEventListener('click', function (e) {
    if (e.target.classList.contains('e-del')) e.target.closest('.entry-group').remove();
  });
  document.getElementById('skill-list').addEventListener('click', function (e) {
    if (e.target.classList.contains('s-del')) e.target.closest('.entry-row').remove();
  });
  document.getElementById('btn-preset-a').onclick = function () { loadPreset('xiaoyu'); };
  document.getElementById('btn-preset-b').onclick = function () { loadPreset('liming'); };
  document.getElementById('demo-fail').onchange = function () { ssSet(SS.failOnce, this.checked ? '1' : null); };
  document.getElementById('btn-submit').onclick = function () { onSubmit(isEdit, editRec); };
  if (hadDraft) toast('已恢复上次未提交的信息', 'warn');
}

function loadPreset(key) {
  setDraft(deep(PRESETS[key]));
  toast('已载入预置案例（模拟数据）', 'ok');
  render();
}

function collectProfile() {
  var exps = [];
  document.querySelectorAll('#exp-list .entry-group').forEach(function (g) {
    var name = g.querySelector('.e-name').value.trim();
    if (!name) return;
    exps.push({ type: g.querySelector('.e-type').value, name: name, desc: g.querySelector('.e-desc').value.trim() });
  });
  var skills = [];
  document.querySelectorAll('#skill-list .entry-row').forEach(function (g) {
    var name = g.querySelector('.s-name').value.trim();
    if (!name) return;
    skills.push({ name: name, level: g.querySelector('.s-level').value });
  });
  return {
    jobId: val('#f-job'), grade: val('#f-grade'), major: val('#f-major').trim(),
    weekly: val('#f-weekly'), expect: val('#f-expect'), exps: exps, skills: skills
  };
}
function validateProfile(p) {
  var m = [];
  if (!p.jobId) m.push({ key: 'job', label: '目标岗位' });
  if (!p.grade) m.push({ key: 'grade', label: '年级' });
  if (!p.major) m.push({ key: 'major', label: '专业' });
  if (!p.weekly) m.push({ key: 'weekly', label: '每周可投入时间' });
  return m;
}

function onSubmit(isEdit, editRec) {
  var p = collectProfile();
  var missing = validateProfile(p);
  document.querySelectorAll('.field.error').forEach(function (f) { f.classList.remove('error'); });
  if (missing.length) {
    /* S01 必填信息不足提示 */
    missing.forEach(function (m) { document.getElementById('fw-' + m.key).classList.add('error'); });
    openModal({
      title: '必填信息不足（S01）',
      bodyHTML: '<p>以下必填项还未填写，补充后再提交：</p><ul>' + missing.map(function (m) { return '<li>' + m.label + '</li>'; }).join('') + '</ul>',
      actions: [
        { label: '取消', cls: 'btn-ghost' },
        {
          label: '去补充', cls: 'btn-primary', fn: function () {
            var el = document.getElementById('f-' + missing[0].key);
            el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      ]
    });
    return;
  }
  if (!p.exps.length) {
    /* S02 经历为空询问弹窗 */
    openModal({
      title: '你还没有任何经历吗？（S02）',
      bodyHTML: '<p>没有经历也可以继续：可以先看该岗位的「起步建议」（进入起步模式），或回去补充经历以获得完整差距分析。</p>',
      actions: [
        { label: '我去补充', cls: 'btn-ghost' },
        { label: '确实还没有，看起步建议', cls: 'btn-primary', fn: function () { startAnalysis(p); } }
      ]
    });
    return;
  }
  startAnalysis(p);
}

function startAnalysis(profile) {
  setDraft(profile);
  ssSet(SS.pending, JSON.stringify({ profile: profile, attempt: 0 }));
  go('#/analyzing');
}

/* ================= P03 分析中页（loading / 模拟失败） ================= */
function shouldFail(attempt) {
  if (ssGet(SS.failHard) === '1') return true;
  return attempt === 0 && ssGet(SS.failOnce) === '1';
}

function renderAnalyzing(app) {
  var raw = ssGet(SS.pending);
  if (!raw) { location.hash = '#/form'; return; }
  var pending = JSON.parse(raw);

  app.innerHTML = ''
    + '<div class="card analyzing" id="an-box">'
    + '<h2 style="font-size:20px">AI 正在分析（模拟）</h2>'
    + '<p class="muted" style="margin-top:4px">目标岗位：' + esc(findJob(pending.profile.jobId).name) + ' · 本地模拟引擎，无网络请求</p>'
    + '<div class="progress"><div class="progress-bar" id="an-bar"></div></div>'
    + '<div class="stage-dots" id="an-dots"><span class="stage-dot on">读取信息</span><span class="stage-dot">对照岗位</span><span class="stage-dot">生成建议</span></div>'
    + '<p id="stage-txt">正在读取你的信息…</p>'
    + '<div style="margin-top:22px"><button class="btn btn-ghost" type="button" id="an-cancel">取消分析</button></div>'
    + '<p class="muted" style="font-size:12px;margin-top:14px">模拟延时约 3 秒；loading 中可取消，已填信息会保留</p>'
    + '</div>';

  var dots = document.querySelectorAll('#an-dots .stage-dot');
  var txt = document.getElementById('stage-txt');
  stageTimers.push(setTimeout(function () { dots[0].classList.remove('on'); dots[1].classList.add('on'); txt.textContent = '正在对照岗位要求，逐维度分析…'; }, 1100));
  stageTimers.push(setTimeout(function () { dots[1].classList.remove('on'); dots[2].classList.add('on'); txt.textContent = '正在生成行动建议…'; }, 2200));

  document.getElementById('an-cancel').onclick = function () {
    setDraft(pending.profile);
    ssSet(SS.pending, null);
    toast('已取消分析，已填信息已保留', 'warn');
    location.hash = '#/form';
  };

  analysisTimer = setTimeout(function () {
    if (shouldFail(pending.attempt)) {
      pending.attempt++;
      ssSet(SS.pending, JSON.stringify(pending));
      document.getElementById('an-box').classList.add('is-failed');
      txt.textContent = '分析生成失败（模拟）';
      openS03(pending);
    } else {
      finishAnalysis(pending.profile);
    }
  }, 3200);
}

/* S03 AI 生成失败重试弹窗 */
function openS03(pending) {
  openModal({
    title: '分析生成失败（S03 · 模拟）',
    bodyHTML: '<p>本地分析引擎未返回结果（这是演示用的模拟失败，默认路径永不失败）。</p>'
      + '<p>你填写的信息<b>不会丢失</b>：可以重试分析，或返回修改信息。</p>',
    actions: [
      {
        label: '返回修改信息', cls: 'btn-ghost', fn: function () {
          setDraft(pending.profile);
          ssSet(SS.pending, null);
          location.hash = '#/form';
        }
      },
      { label: '重试分析', cls: 'btn-primary', fn: function () { render(); } }
    ]
  });
}

function finishAnalysis(profile) {
  var records = getRecords();
  var rec = { id: uid('r'), createdAt: Date.now(), profile: profile, corrections: [] };
  records.unshift(rec);
  setRecords(records);
  ssSet(SS.pending, null);
  ssSet(SS.failOnce, null);
  clearDraft();
  location.hash = '#/result/' + rec.id;
}

/* ================= P04 结果页 / P07 历史详情共用的结果渲染 ================= */
var LEVEL_CHIP = { full: ['chip-full', '充足'], partial: ['chip-partial', '部分满足'], missing: ['chip-missing', '缺失'], todo: ['chip-todo', '待补充'] };
var TAG_CLS = { '事实': 'tag-fact', '推测': 'tag-guess', '待补充': 'tag-todo', '已纠正': 'tag-fixed', '已提升': 'tag-up' };
var P_CHIP = { '高': 'p-high', '中': 'p-mid', '低': 'p-low' };

function resultHTML(rec, res, opts) {
  opts = opts || {};
  var acts = opts.interactive ? getActions().filter(function (a) { return a.rid === rec.id; }) : [];
  function actState(id) { var a = acts.find(function (x) { return x.key === id; }); return a ? a.status : null; }

  var h = '<div class="page-head"><h1>' + (res.mode === 'starter' ? '起步建议' : '差距分析结果') + '</h1>'
    + '<span class="badge badge-demo">模拟数据 · 本地引擎</span>'
    + (res.mode === 'starter' ? '<span class="badge badge-starter">起步模式</span>' : '') + '</div>';

  /* 匹配度卡 */
  h += '<div class="card"><div class="match-wrap">';
  if (res.mode === 'full') {
    h += '<div class="match-circle" style="--pct:' + res.match + '"><div class="inner"><div class="num">' + res.match + '<small>%</small></div></div></div>'
      + '<div><h2 style="margin-bottom:4px">' + esc(res.jobName) + '</h2>'
      + '<p class="muted">' + esc(res.tier) + '</p>'
      + '<p class="muted" style="font-size:12px;margin-top:6px">分析时间：' + fmtTime(rec.createdAt) + ' · 匹配度 = Σ(维度权重×满足度) ÷ Σ权重</p></div>';
  } else {
    h += '<div class="match-none">信息不足<br>未计算匹配度</div>'
      + '<div><h2 style="margin-bottom:4px">' + esc(res.jobName) + ' · 起步建议</h2>'
      + '<p class="muted">经历区为空，无法做差距对照；先按起步行动建立第一批经历。</p>'
      + (opts.interactive ? '<p style="margin-top:8px"><a class="btn btn-sm" href="#/form?edit=1&rid=' + rec.id + '">补充经历后重新分析</a></p>' : '')
      + '</div>';
  }
  h += '</div>';
  if (res.timeCheck && !res.timeCheck.ok) {
    h += '<div class="warn-banner" style="margin-top:14px;margin-bottom:0">时间偏紧：高优先级行动每周合计约 ' + res.timeCheck.highWeekly + ' 小时，超过你可投入时间（' + res.timeCheck.weekly + ' 小时/周）的 80%，建议先聚焦前 2 项，其余项顺延。</div>';
  }
  h += '</div>';

  /* 维度差距表 */
  h += '<div class="card"><h2>维度差距对照</h2><div class="table-wrap"><table><thead><tr>'
    + '<th>维度（权重）</th><th>岗位要求</th><th>你的情况</th><th>差距等级</th><th>依据</th>'
    + (opts.interactive ? '<th>操作</th>' : '') + '</tr></thead><tbody>';
  res.dims.forEach(function (d) {
    var lvl = LEVEL_CHIP[d.level];
    h += '<tr>'
      + '<td class="dim-name">' + esc(d.name) + '<br><small>权重 ' + d.weight + ' · ' + ({ 3: '高', 2: '中', 1: '低' })[d.weight] + '</small></td>'
      + '<td>' + esc(d.req) + '</td>'
      + '<td>' + esc(d.status) + (d.level === 'todo' ? '<div class="hint">' + esc(d.hint) + '</div>' : '') + '</td>'
      + '<td><span class="chip ' + lvl[0] + '">' + lvl[1] + '</span></td>'
      + '<td>' + d.tags.map(function (t) { return '<span class="tag ' + (TAG_CLS[t] || 'tag-todo') + '">' + t + '</span>'; }).join('') + '</td>';
    if (opts.interactive) {
      var canFix = d.tags.indexOf('推测') >= 0 && !d.corrected && d.level !== 'todo';
      h += '<td>' + (canFix
        ? '<button class="btn btn-ghost btn-sm" data-correct="' + d.key + '">这不准</button>'
        : (d.corrected ? '<span class="muted" style="font-size:12px">已纠正</span>' : '')) + '</td>';
    }
    h += '</tr>';
  });
  h += '</tbody></table></div>'
    + '<p class="hint">[事实] = 来自你的填写；[推测] = AI 由缺失信息推断，可点「这不准」纠正；[待补充] 不计入匹配度。</p></div>';

  /* 行动清单 */
  h += '<div class="card"><h2>行动清单' + (res.mode === 'full' ? '（按优先级排序）' : '（起步行动包）') + '</h2>';
  if (!res.actions.length) h += '<p class="muted">暂无行动建议。</p>';
  res.actions.forEach(function (a) {
    var st = opts.interactive ? actState(a.id) : null;
    h += '<div class="action-item"><div class="a-body">'
      + '<div class="a-title"><span class="chip ' + P_CHIP[a.priority] + '">' + a.priority + '</span> ' + esc(a.title) + '</div>'
      + '<div class="a-meta">预期收益：' + esc(a.benefit) + ' · 预计耗时：' + esc(a.hoursText) + '</div></div>';
    if (opts.interactive) {
      if (!st) h += '<button class="btn btn-primary btn-sm" data-addact="' + a.id + '">加入我的行动</button>';
      else h += '<span class="status-chip ' + (st === 'done' ? 'st-done' : st === 'abandon' ? 'st-abandon' : 'st-pending') + '">' + ({ pending: '已加入', done: '已完成', abandon: '已放弃' })[st] + '</span>';
    }
    h += '</div>';
  });
  h += '</div>';

  /* 纠正记录 */
  if (rec.corrections && rec.corrections.length) {
    h += '<div class="card"><h2>纠正记录</h2>';
    rec.corrections.forEach(function (c) {
      h += '<div class="record-row"><div class="r-main">'
        + '<div class="r-title">' + esc(c.dimName) + ' <span class="tag tag-fixed">已纠正</span></div>'
        + '<div class="r-sub">原因：' + esc(c.reason) + ' · 修正：' + esc(c.note) + ' · ' + fmtTime(c.at) + '</div>'
        + '</div></div>';
    });
    h += '</div>';
  }

  if (opts.interactive) {
    h += '<div class="card" style="display:flex;gap:10px;flex-wrap:wrap">'
      + '<a class="btn" href="#/form?edit=1&rid=' + rec.id + '">修改信息，重新分析</a>'
      + '<a class="btn btn-primary" href="#/actions">查看我的行动</a>'
      + '<a class="btn btn-ghost" href="#/history">返回我的记录</a></div>';
  }
  return h;
}

function renderResult(app, rid) {
  var rec = findRecord(rid);
  if (!rec) { toast('记录不存在或已删除', 'warn'); location.hash = '#/history'; return; }
  var res = buildResult(rec, getActions().filter(function (a) { return a.rid === rid; }));
  app.innerHTML = resultHTML(rec, res, { interactive: true });
  app.querySelectorAll('[data-addact]').forEach(function (b) {
    b.onclick = function () { addAction(rec.id, b.getAttribute('data-addact')); };
  });
  app.querySelectorAll('[data-correct]').forEach(function (b) {
    b.onclick = function () { openCorrect(rec.id, b.getAttribute('data-correct')); };
  });
}

function addAction(rid, actId) {
  var rec = findRecord(rid);
  var res = buildResult(rec, getActions().filter(function (a) { return a.rid === rid; }));
  var a = res.actions.find(function (x) { return x.id === actId; });
  if (!a) return;
  var acts = getActions();
  if (acts.some(function (x) { return x.rid === rid && x.key === a.id; })) { toast('该行动已在你的清单中'); return; }
  acts.push({
    rid: rid, key: a.id, dimKey: a.dimKey, title: a.title, benefit: a.benefit,
    hoursText: a.hoursText, weekly: a.weekly, priority: a.priority,
    recordId: rid, status: 'pending', addedAt: Date.now()
  });
  setActions(acts);
  toast('已加入「我的行动」', 'ok');
  render();
}

/* S04 纠正 AI 推测弹窗 */
function openCorrect(rid, dimKey) {
  var rec = findRecord(rid);
  var res = buildResult(rec, getActions().filter(function (a) { return a.rid === rid; }));
  var dim = res.dims.find(function (d) { return d.key === dimKey; });
  if (!dim) return;
  if (dim.corrected) { toast('该结论已纠正过', 'warn'); return; }
  openModal({
    title: '纠正 AI 推测（S04）',
    bodyHTML: '<p class="muted">AI 的推测如下（点「这不准」的结论）：</p>'
      + '<p style="background:var(--gray-chip);border-radius:8px;padding:10px 12px;margin:6px 0 14px"><b>' + esc(dim.name) + '</b>：' + esc(dim.status) + '</p>'
      + '<div class="field"><label>纠正原因</label><div class="radio-line">'
      + ['信息有误', '情况已更新', '不适用'].map(function (r) { return '<label><input type="radio" name="cr" value="' + r + '"> ' + r + '</label>'; }).join('')
      + '</div></div>'
      + '<div class="field"><label>修正说明（必填）</label>'
      + '<textarea id="cr-note" rows="3" style="width:100%" placeholder="补充真实情况，例如：曾独立策划 300 人参与的公众号抽奖联动活动"></textarea></div>',
    actions: [
      { label: '取消', cls: 'btn-ghost' },
      {
        label: '提交纠正', cls: 'btn-primary', keep: true, fn: function () {
          var radio = document.querySelector('input[name="cr"]:checked');
          var note = document.getElementById('cr-note').value.trim();
          if (!radio) { toast('请选择纠正原因', 'warn'); return; }
          if (!note) { toast('请填写修正说明', 'warn'); return; }
          var records = getRecords();
          var rec2 = records.find(function (r) { return r.id === rid; });
          rec2.corrections.push({ dimKey: dimKey, dimName: dim.name, conclusion: dim.status, reason: radio.value, note: note, at: Date.now() });
          setRecords(records);
          closeModal();
          toast('已根据你的纠正更新建议（1 条修正）', 'ok');  /* S05 */
          render();
        }
      }
    ]
  });
}

/* ================= P06 历史记录列表 ================= */
function renderHistory(app) {
  var records = getRecords();
  var h = '<div class="page-head"><h1>我的记录</h1><span class="badge badge-count">' + records.length + ' 次分析</span></div>';
  if (!records.length) {
    app.innerHTML = h + emptyHTML('还没有分析记录', '完成第一次差距分析后，每次分析会以快照形式保存在这里', '#/form', '开始第一次分析');
    return;
  }
  h += '<div class="card">';
  records.forEach(function (r) {
    var res = buildResult(r, []);
    h += '<div class="record-row">'
      + '<div class="r-main"><div class="r-title">' + esc(res.jobName)
      + (res.mode === 'starter' ? ' <span class="badge badge-starter">起步模式</span>' : ' <span class="badge badge-count">匹配度 ' + res.match + '%</span>')
      + (r.corrections.length ? ' <span class="tag tag-fixed">含 ' + r.corrections.length + ' 条纠正</span>' : '')
      + '</div>'
      + '<div class="r-sub">' + fmtTime(r.createdAt) + ' · ' + esc(r.profile.grade) + ' ' + esc(r.profile.major) + ' · 每周 ' + esc(r.profile.weekly) + ' 小时</div></div>'
      + '<a class="btn btn-sm" href="#/history/' + r.id + '">查看详情</a>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-del="' + r.id + '">删除</button>'
      + '</div>';
  });
  h += '</div><div class="card" style="display:flex;gap:10px;flex-wrap:wrap">'
    + '<a class="btn btn-primary" href="#/form?fresh=1">新建分析</a><a class="btn btn-ghost" href="#/actions">我的行动</a></div>';
  app.innerHTML = h;
  app.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { confirmDelete(b.getAttribute('data-del')); }; });
}

/* S06 删除确认弹窗 */
function confirmDelete(rid) {
  openModal({
    title: '删除这条分析记录？（S06）',
    bodyHTML: '<p>删除后不可恢复；该记录关联的行动也会一并移除，其他记录不受影响。</p>',
    actions: [
      { label: '取消', cls: 'btn-ghost' },
      {
        label: '确认删除', cls: 'btn-danger', fn: function () {
          setRecords(getRecords().filter(function (r) { return r.id !== rid; }));
          setActions(getActions().filter(function (a) { return a.rid !== rid; }));
          toast('已删除该记录', 'ok');
          render();
        }
      }
    ]
  });
}

/* ================= P07 历史详情页（当时快照） ================= */
function renderHistoryDetail(app, rid) {
  var rec = findRecord(rid);
  if (!rec) { toast('记录不存在或已删除', 'warn'); location.hash = '#/history'; return; }
  var res = buildResult(rec, []); /* 快照：不包含之后的行动进度更新 */
  app.innerHTML = ''
    + '<div class="page-head"><h1>历史详情</h1><span class="badge badge-count">' + fmtTime(rec.createdAt) + '</span></div>'
    + '<div class="info-banner">以下为该次分析完成时的快照（含当时提交的纠正），不包含之后「我的行动」的进度更新。</div>'
    + resultHTML(rec, res, { interactive: false })
    + '<div class="card" style="display:flex;gap:10px;flex-wrap:wrap">'
    + '<button class="btn btn-primary" type="button" id="btn-continue">继续这些行动</button>'
    + '<a class="btn" href="#/result/' + rid + '">查看实时建议</a>'
    + '<a class="btn btn-ghost" href="#/history">返回列表</a>'
    + '</div>';
  document.getElementById('btn-continue').onclick = function () { continueActions(rid); };
}

function continueActions(rid) {
  var rec = findRecord(rid);
  if (!rec) return;
  var res = buildResult(rec, getActions().filter(function (a) { return a.rid === rid; }));
  var acts = getActions();
  var n = 0;
  res.actions.forEach(function (a) {
    if (!acts.some(function (x) { return x.rid === rid && x.key === a.id; })) {
      acts.push({
        rid: rid, key: a.id, dimKey: a.dimKey, title: a.title, benefit: a.benefit,
        hoursText: a.hoursText, weekly: a.weekly, priority: a.priority,
        recordId: rid, status: 'pending', addedAt: Date.now()
      });
      n++;
    }
  });
  setActions(acts);
  toast(n ? '已将 ' + n + ' 条行动加入「我的行动」' : '该记录的行动已全部在你的清单中', 'ok');
  location.hash = '#/actions';
}

/* ================= P08 行动进度页 ================= */
function renderActions(app) {
  var acts = getActions();
  var records = getRecords();
  var h = '<div class="page-head"><h1>我的行动</h1>'
    + (acts.length ? '<span class="badge badge-count">已完成 ' + acts.filter(function (a) { return a.status === 'done'; }).length + ' / ' + acts.length + '</span>' : '') + '</div>';
  if (!acts.length) {
    app.innerHTML = h + emptyHTML('还没有行动', '在分析结果页点「加入我的行动」，或从历史详情页「继续这些行动」', '#/history', '查看我的记录');
    return;
  }
  var done = acts.filter(function (a) { return a.status === 'done'; }).length;
  h += '<div class="grid-3">'
    + '<div class="stat-cube"><b>' + acts.length + '</b><span>行动总数</span></div>'
    + '<div class="stat-cube"><b>' + done + '</b><span>已完成</span></div>'
    + '<div class="stat-cube"><b>' + (acts.length - done) + '</b><span>待处理</span></div>'
    + '</div>';
  var rids = [];
  acts.forEach(function (a) { if (rids.indexOf(a.rid) < 0) rids.push(a.rid); });
  rids.forEach(function (rid) {
    var rec = findRecord(rid);
    var list = acts.filter(function (a) { return a.rid === rid; });
    var dn = list.filter(function (a) { return a.status === 'done'; }).length;
    h += '<div class="card"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
      + '<h2 style="margin:0">' + (rec ? esc(findJob(rec.profile.jobId).name) : '已删除的分析记录') + '</h2>'
      + '<span class="badge badge-count">' + dn + '/' + list.length + ' 完成</span>'
      + (rec ? '<a class="btn btn-ghost btn-sm" style="margin-left:auto" href="#/result/' + rid + '">查看最新建议</a>' : '')
      + '</div>';
    list.forEach(function (a) {
      var stc = { pending: ['st-pending', '待开始'], done: ['st-done', '已完成'], abandon: ['st-abandon', '已放弃'] }[a.status];
      h += '<div class="action-item"><div class="a-body">'
        + '<div class="a-title"><span class="chip ' + P_CHIP[a.priority] + '">' + a.priority + '</span> ' + esc(a.title) + '</div>'
        + '<div class="a-meta">' + esc(a.benefit) + ' · ' + esc(a.hoursText) + '</div></div>'
        + '<span class="status-chip ' + stc[0] + '">' + stc[1] + '</span>';
      if (a.status === 'pending') {
        h += '<button class="btn btn-sm" type="button" data-mark="' + rid + '|' + a.key + '|done">完成</button>'
          + '<button class="btn btn-ghost btn-sm" type="button" data-mark="' + rid + '|' + a.key + '|abandon">放弃</button>';
      } else {
        h += '<button class="btn btn-ghost btn-sm" type="button" data-mark="' + rid + '|' + a.key + '|pending">恢复待办</button>';
      }
      h += '</div>';
    });
    h += '</div>';
  });
  h += '<p class="muted" style="text-align:center;font-size:12.5px">标记「完成」后，对应维度的差距等级会在「查看最新建议」中提升，匹配度随之更新。</p>';
  app.innerHTML = h;
  app.querySelectorAll('[data-mark]').forEach(function (b) {
    b.onclick = function () {
      var p = b.getAttribute('data-mark').split('|');
      markAction(p[0], p[1], p[2]);
    };
  });
}

function markAction(rid, key, status) {
  var acts = getActions();
  var a = acts.find(function (x) { return x.rid === rid && x.key === key; });
  if (!a) return;
  a.status = status;
  a.markedAt = Date.now();
  setActions(acts);
  if (status === 'done') toast('行动完成，建议已更新（对应维度差距已提升）', 'ok');  /* S05 */
  else if (status === 'abandon') toast('已标记为放弃，可随时恢复待办', 'warn');
  render();
}

/* ================= S07 重置演示 ================= */
function confirmReset() {
  openModal({
    title: '清空全部本地演示数据？（S07）',
    bodyHTML: '<p>将删除全部分析记录、行动清单与表单草稿，回到首次打开的空白状态。</p>',
    actions: [
      { label: '取消', cls: 'btn-ghost' },
      {
        label: '确认清空', cls: 'btn-danger', fn: function () {
          [LS.records, LS.actions, LS.draft].forEach(function (k) { localStorage.removeItem(k); });
          [SS.pending, SS.failOnce, SS.failHard].forEach(function (k) { ssSet(k, null); });
          toast('已恢复初始状态', 'ok');
          location.hash = '#/home';
        }
      }
    ]
  });
}

/* ================= 启动 ================= */
(function init() {
  document.getElementById('btn-reset').addEventListener('click', confirmReset);
  /* 支持 URL 参数（index.html?demo=fail / ?demo=fail-hard / ?reset=1） */
  var q = {};
  location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
    if (!kv) return; var p = kv.split('=');
    q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
  });
  if (q.demo === 'fail') ssSet(SS.failOnce, '1');
  if (q.demo === 'fail-hard') ssSet(SS.failHard, '1');
  if (q.reset === '1') setTimeout(confirmReset, 60);
  render();
})();
