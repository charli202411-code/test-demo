/* ============================================================
 * 实习罗盘 · 模拟 AI 规则引擎（本地确定性计算，无网络请求）
 * 与 product-doc.md 5.1/5.3/5.4 业务规则一致：
 *  - 匹配度 = Σ(权重×满足度) ÷ Σ权重 × 100%（充足1.0/部分0.5/缺失0，待补充不计入）
 *  - 档位：≥70 有竞争力；40~69 起步线；<40 差距较大
 *  - 行动生成：维度差距→行动模板；优先级 排序 高>中>低，再按每周耗时降序
 *  - 纠正：仅重算被纠正维度及关联行动项；行动完成：对应维度升一级
 * ============================================================ */

var LEVEL_META = {
  full: { label: '充足', score: 1 },
  partial: { label: '部分满足', score: 0.5 },
  missing: { label: '缺失', score: 0 },
  todo: { label: '待补充', score: null }
};
var P_RANK = { '高': 0, '中': 1, '低': 2 };

function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
function findJob(id) { return JOBS.find(function (j) { return j.id === id; }) || JOBS[0]; }

/**
 * 计算某条分析记录的当前有效结果（确定性，可重复计算）
 * @param record {profile, corrections, id}
 * @param doneActions 全部行动列表（用于"行动完成→维度升级"）
 */
function buildResult(record, doneActions) {
  var profile = record.profile || {};
  var job = findJob(profile.jobId);
  var starter = !(profile.exps || []).length;

  /* 1) 维度判定（或起步模式全部待补充） */
  var dims = job.dims.map(function (d) {
    var base = starter
      ? { level: 'todo', tags: ['待补充'], status: '信息不足，待补充' }
      : d.detect(profile);
    return {
      key: d.key, name: d.name, weight: d.weight, req: d.req,
      level: base.level, tags: base.tags, status: base.status,
      hint: '补充「' + d.name + '」相关经历或技能后可评估', corrected: false
    };
  });

  /* 2) 应用用户纠正（product-doc 5.4：仅重算被纠正维度） */
  (record.corrections || []).forEach(function (c) {
    var dim = dims.find(function (x) { return x.key === c.dimKey; });
    if (dim && dim.level !== 'todo') {
      dim.level = 'full';
      dim.tags = ['已纠正'];
      dim.status = '已按你的纠正更新：' + trunc(c.note, 60);
      dim.corrected = true;
    }
  });

  /* 3) 应用已完成的行动（对应维度升一级） */
  (doneActions || []).forEach(function (a) {
    if (a.recordId !== record.id || a.status !== 'done' || !a.dimKey) return;
    var dim = dims.find(function (x) { return x.key === a.dimKey; });
    if (dim && !dim.corrected && dim.level !== 'todo') {
      var up = { missing: 'partial', partial: 'full' };
      if (up[dim.level]) {
        dim.level = up[dim.level];
        dim.status += '；已完成行动：「' + trunc(a.title, 30) + '」';
        if (dim.tags.indexOf('已提升') < 0) dim.tags = dim.tags.concat(['已提升']);
      }
    }
  });

  /* 4) 行动清单生成 */
  var actions = [];
  if (starter) {
    actions = (STARTER_PACKS[job.id] || []).map(function (t, i) {
      return { id: 's' + i, dimKey: null, priority: t.priority, title: t.title, benefit: t.benefit, hoursText: t.hoursText, weekly: t.weekly };
    });
  } else {
    dims.forEach(function (dim) {
      var d = job.dims.find(function (x) { return x.key === dim.key; });
      if (dim.corrected) {
        /* 纠正后：移除差距行动，给一个巩固行动（activity 维度用文档指定文案） */
        var ct = d.consolidation || { title: '把补充的「' + dim.name + '」经历整理成成果展示', benefit: '案例沉淀', hoursText: '1.5 小时', weekly: 0, priority: '低' };
        actions.push({ id: dim.key + '-c', dimKey: dim.key, priority: ct.priority, title: ct.title, benefit: ct.benefit, hoursText: ct.hoursText, weekly: ct.weekly });
        return;
      }
      if (dim.level === 'todo') return;
      (d.actions[dim.level] || []).forEach(function (t, i) {
        actions.push({ id: dim.key + '-' + i, dimKey: dim.key, priority: t.priority, title: t.title, benefit: t.benefit, hoursText: t.hoursText, weekly: t.weekly });
      });
    });
    actions.sort(function (a, b) {
      return (P_RANK[a.priority] - P_RANK[b.priority]) || ((b.weekly || 0) - (a.weekly || 0));
    });
  }

  /* 5) 匹配度与档位（起步模式不计算） */
  var match = null, tier = null;
  if (!starter) {
    var counted = dims.filter(function (d) { return d.level !== 'todo'; });
    var w = counted.reduce(function (s, d) { return s + d.weight; }, 0);
    var v = counted.reduce(function (s, d) { return s + d.weight * LEVEL_META[d.level].score; }, 0);
    match = Math.round(v / w * 100);
    tier = match >= 70 ? '有竞争力：重点补短板' : (match >= 40 ? '起步线：差距明确可补' : '差距较大：先聚焦基础');
  }

  /* 6) 时间可行性（高优先级每周合计 > 可投入时间×80% 则提示） */
  var highWeekly = actions.filter(function (a) { return a.priority === '高'; })
    .reduce(function (s, a) { return s + (a.weekly || 0); }, 0);
  var weekly = Number(profile.weekly) || 0;
  var timeCheck = { ok: highWeekly <= weekly * 0.8, highWeekly: highWeekly, weekly: weekly };

  return {
    mode: starter ? 'starter' : 'full',
    jobId: job.id, jobName: job.name,
    match: match, tier: tier,
    dims: dims, actions: actions, timeCheck: timeCheck
  };
}
