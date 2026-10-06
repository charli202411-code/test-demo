/* 三方一致性校验（交付件）：node check.js
 * 验证模拟引擎输出与 product-doc.md v1.0.1 案例数字逐条一致（100 项断言） */
const fs = require('fs');
const path = require('path');
const base = __dirname;
eval(fs.readFileSync(path.join(base, 'js/data.js'), 'utf8'));
eval(fs.readFileSync(path.join(base, 'js/engine.js'), 'utf8'));

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' -> ' + extra : '')); }
}

console.log('== 案例 A：张小雨（产品运营实习生）==');
let recA = { id: 't1', profile: PRESETS.xiaoyu, corrections: [] };
let resA = buildResult(recA, []);
ok(resA.match === 59, '匹配度 = 59%（文档 7.1）', resA.match);
ok(resA.tier === '起步线：差距明确可补', '档位文案', resA.tier);
ok(resA.actions.length === 5, '行动清单 5 项（文档 7.1）', resA.actions.length);
const docOrder = [
  ['高', '完成 SQL 基础课程，并用公众号后台数据做 1 次小分析练习'],
  ['中', '策划 1 次小型线上活动并写复盘'],
  ['中', '研究 3 个目标公司产品，输出 1 页业务理解笔记'],
  ['低', '把公众号经历量化改写成 3 条成果句（阅读增长/涨粉/互动率）'],
  ['低', '整理比赛/学生会经历的可迁移能力清单']
];
resA.actions.forEach((a, i) => {
  ok(a.priority === docOrder[i][0] && a.title === docOrder[i][1],
    '行动 ' + (i + 1) + ' 顺序/优先级/标题一致', a.priority + ' | ' + a.title);
});
ok(resA.timeCheck.ok === true && resA.timeCheck.highWeekly === 4, '时间检查通过（高优先级每周 4h ≤ 8h）', JSON.stringify(resA.timeCheck));
const dimsA = {};
resA.dims.forEach(d => dimsA[d.name] = d.level);
ok(dimsA['内容与新媒体运营'] === 'full', '内容运营=充足', dimsA['内容与新媒体运营']);
ok(dimsA['数据分析与工具'] === 'partial', '数据分析=部分满足', dimsA['数据分析与工具']);
ok(dimsA['用户与活动运营'] === 'partial', '活动运营=部分满足', dimsA['用户与活动运营']);
ok(dimsA['业务理解'] === 'missing', '业务理解=缺失', dimsA['业务理解']);
ok(dimsA['沟通与执行力'] === 'full', '沟通执行=充足', dimsA['沟通与执行力']);

console.log('== 案例 A 纠正后（用户纠正活动推测）==');
recA.corrections.push({ dimKey: 'activity', dimName: '用户与活动运营', reason: '信息有误', note: '曾独立策划 300 人参与的公众号抽奖联动活动' });
resA = buildResult(recA, []);
ok(resA.match === 68, '纠正后匹配度 = 68%（文档 7.1/5.4）', resA.match);
ok(resA.actions.some(a => a.title === '把联动活动写成完整案例复盘' && a.priority === '低'), '新增低优先级「联动活动复盘」');
ok(!resA.actions.some(a => a.title === '策划 1 次小型线上活动并写复盘'), '原「策划线上活动」行动已移除');
const fixedDim = resA.dims.find(d => d.key === 'activity');
ok(fixedDim.level === 'full' && fixedDim.tags[0] === '已纠正', '活动维度=充足·已纠正', JSON.stringify(fixedDim.tags));

console.log('== 案例 A 行动完成后（SQL 课程 done → 数据维度升级）==');
resA = buildResult(recA, [{ recordId: 't1', status: 'done', dimKey: 'data', title: 'SQL 课程' }]);
ok(resA.match === 82, '完成 SQL 后匹配度 = 82%（数据维度 partial→full：9/11）', resA.match);
const dataDim = resA.dims.find(d => d.key === 'data');
ok(dataDim.level === 'full' && dataDim.tags.indexOf('已提升') >= 0, '数据维度标记「已提升」', JSON.stringify(dataDim.tags));

console.log('== 案例 B1：李明（前端开发实习生 · 零经历）==');
const recB = { id: 't2', profile: PRESETS.liming, corrections: [] };
const resB = buildResult(recB, []);
ok(resB.mode === 'starter', '起步模式', resB.mode);
ok(resB.match === null, '不计算匹配度', resB.match);
ok(resB.actions.length === 4, '起步行动包 4 项（文档 7.2 B1）', resB.actions.length);
const docB = [
  ['高', '系统学习 HTML/CSS/JS 基础（跟完一套入门课程）'],
  ['高', '跟教程做出第一个个人主页并部署'],
  ['中', '注册 GitHub，学会提交与管理代码'],
  ['低', '收集 5 条前端实习 JD，建立目标感']
];
resB.actions.forEach((a, i) => {
  ok(a.priority === docB[i][0] && a.title === docB[i][1], '起步行动 ' + (i + 1) + ' 一致', a.priority + ' | ' + a.title);
});
ok(resB.timeCheck.ok === false && resB.timeCheck.highWeekly === 8 && resB.timeCheck.weekly === 8,
  '时间偏紧提示（8h > 8h×80%）', JSON.stringify(resB.timeCheck));
ok(resB.dims.every(d => d.level === 'todo'), '全部维度待补充', resB.dims.map(d => d.level).join(','));

console.log('== 通用校验 ==');
ok(JOBS.length === 4, '岗位库 4 个岗位');
JOBS.forEach(j => {
  ok(j.dims.length === 5, j.name + ' 含 5 个维度');
  const wSum = j.dims.reduce((s, d) => s + d.weight, 0);
  ok(wSum === 11, j.name + ' 权重合计 11（高3×2+中2×2+低1）', wSum);
  j.dims.forEach(d => {
    ['full', 'partial', 'missing'].forEach(lv => {
      ok(d.actions[lv] && d.actions[lv].length >= 1, j.name + '/' + d.name + '/' + lv + ' 有行动模板');
    });
  });
});
/* 换岗位场景（走查脚本②）：张小雨改投数据分析实习生 */
const recC = { id: 't3', profile: Object.assign({}, PRESETS.xiaoyu, { jobId: 'da' }), corrections: [] };
const resC = buildResult(recC, []);
ok(resC.jobName === '数据分析实习生' && resC.dims[0].name === 'SQL 与数据处理', '改岗位后差距表整体切换（走查脚本②）', resC.jobName + '/' + resC.dims[0].name);
ok(Number.isInteger(resC.match) && resC.match >= 0 && resC.match <= 100, '改岗位后匹配度可计算', resC.match);

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
process.exit(fail ? 1 : 0);
