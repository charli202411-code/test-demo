/* ============================================================
 * 实习罗盘 · 模拟数据与规则配置（全部本地写死，无网络请求）
 * 岗位库 / 维度检测规则 / 行动模板 / 起步包 / 预置演示案例
 * 与 product-doc.md v1.0 保持一致
 * ============================================================ */

var EXP_TYPES = ['新媒体运营', '自媒体内容', '课程项目', '比赛竞赛', '社团组织', '学生工作', '调研分析', '开源项目', '实习经历', '其他'];
var SKILL_SUGGESTIONS = ['Excel', 'SQL', 'Python', 'SPSS', '微信排版工具', 'Photoshop', 'Figma', 'Axure', '墨刀', 'HTML', 'CSS', 'JavaScript', 'Git', 'GitHub', 'Tableau', 'PowerBI'];

/* ---------- 检测辅助 ---------- */
function lvIndex(lv) { return ['未填', '了解', '熟悉', '熟练', '精通'].indexOf(lv || '未填'); }
function skillEntry(p, name) { return (p.skills || []).find(function (s) { return s.name === name && lvIndex(s.level) > 0; }) || null; }
function skillAt(p, name, min) { var s = skillEntry(p, name); return !!(s && lvIndex(s.level) >= lvIndex(min)); }
function hitExp(e, kw) { var hay = (e.type + ' ' + e.name + ' ' + (e.desc || '')).toLowerCase(); return hay.indexOf(kw.toLowerCase()) >= 0; }
function matchExps(p, cfg) {
  var exps = p.exps || [];
  var strong = exps.filter(function (e) { return (cfg.st || []).indexOf(e.type) >= 0 || (cfg.sk || []).some(function (k) { return hitExp(e, k); }); });
  var partial = exps.filter(function (e) {
    return strong.indexOf(e) < 0 && ((cfg.pt || []).indexOf(e.type) >= 0 || (cfg.pk || []).some(function (k) { return hitExp(e, k); }));
  });
  return { strong: strong, partial: partial };
}
function expSummary(list) { return list.map(function (e) { return e.name + '（' + (e.desc || '无描述') + '）'; }).join('；'); }
function skillList(p, names) {
  return names.map(function (n) { return skillEntry(p, n); }).filter(Boolean).map(function (s) { return s.name + '（' + s.level + '）'; });
}
/* 依据标签构造：full/partialGap/missing 与 product-doc 5.3 依据规则对应 */
function full(tag, status) { return { level: 'full', tags: [tag], status: status }; }
function partialGap(tag, status, noteTag, note) { return { level: 'partial', tags: [tag, noteTag], status: status + '；' + note }; }
function missing(tag, status) { return { level: 'missing', tags: [tag], status: status }; }

/* ---------- 岗位库（4 个岗位 × 5 维度，权重 高=3/中=2/低=1） ---------- */
var JOBS = [
  {
    id: 'ops', name: '产品运营实习生',
    dims: [
      {
        key: 'content', name: '内容与新媒体运营', weight: 3, req: '具备内容策划与账号运营经验',
        detect: function (p) {
          var m = matchExps(p, { st: ['新媒体运营', '自媒体内容'], sk: ['公众号', '内容运营', '排版', '新媒体', '小红书', '抖音', 'B站', '视频'], pt: ['社团组织', '学生工作'], pk: ['宣传', '文案'] });
          if (m.strong.length) return full('事实', expSummary(m.strong));
          if (m.partial.length) return partialGap('事实', expSummary(m.partial), '推测', '有相关经历，但未见独立内容产出');
          return missing('推测', '未见内容运营相关经历');
        },
        actions: {
          full: [{ title: '把公众号经历量化改写成 3 条成果句（阅读增长/涨粉/互动率）', benefit: '面试表达素材', hoursText: '2 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '独立完成 3 篇内容策划并复盘数据', benefit: '补齐内容运营维度', hoursText: '每周 3 小时 × 2 周', weekly: 3, priority: '高' }],
          missing: [{ title: '系统学习内容运营入门并开号实践 3 篇', benefit: '建立内容运营基础', hoursText: '每周 4 小时 × 3 周', weekly: 4, priority: '高' }]
        }
      },
      {
        key: 'data', name: '数据分析与工具', weight: 3, req: '会用 Excel/SQL 做基础数据分析',
        detect: function (p) {
          if (skillAt(p, 'SQL', '熟悉') || skillAt(p, 'Python', '熟练')) {
            var sl = skillList(p, ['SQL', 'Python']).join('、'); return full('事实', '已具备 ' + sl);
          }
          var parts = [];
          var ps = skillList(p, ['Excel', 'Python', 'SPSS']); if (ps.length) parts.push(ps.join('、'));
          var de = matchExps(p, { st: [], sk: ['数据分析'], pt: [], pk: [] }); if (de.strong.length) parts.push(expSummary(de.strong));
          if (parts.length) return partialGap('事实', parts.join('；'), '推测', '未提供 SQL 相关经历，推测缺乏数据工具实操');
          return missing('推测', '未见数据分析相关技能或经历');
        },
        actions: {
          full: [{ title: '用 SQL 复盘一次账号数据并输出 1 页结论', benefit: '巩固数据能力', hoursText: '3 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '完成 SQL 基础课程，并用公众号后台数据做 1 次小分析练习', benefit: '补齐数据分析维度', hoursText: '每周 4 小时 × 3 周', weekly: 4, priority: '高' }],
          missing: [
            { title: '完成 Excel 与 SQL 基础课程', benefit: '补齐数据工具基础', hoursText: '每周 4 小时 × 3 周', weekly: 4, priority: '高' },
            { title: '用课程或社团数据做 1 次完整分析练习', benefit: '形成分析作品', hoursText: '2 小时', weekly: 0, priority: '中' }
          ]
        }
      },
      {
        key: 'activity', name: '用户与活动运营', weight: 2, req: '有用户增长或线上活动实践',
        detect: function (p) {
          var m = matchExps(p, { st: [], sk: ['活动策划', '线上活动', '增长', '拉新'], pt: ['社团组织', '学生工作'], pk: ['宣传', '社团', '学生会', '活动'] });
          if (m.strong.length) return full('事实', expSummary(m.strong));
          if (m.partial.length) return partialGap('事实', expSummary(m.partial), '推测', '未见完整线上活动案例');
          return missing('推测', '未见用户增长或活动运营相关经历');
        },
        consolidation: { title: '把联动活动写成完整案例复盘', benefit: '案例沉淀', hoursText: '1.5 小时', weekly: 0, priority: '低' },
        actions: {
          full: [{ title: '把活动经历整理成完整案例复盘', benefit: '案例沉淀', hoursText: '1.5 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '策划 1 次小型线上活动并写复盘', benefit: '活动运营案例', hoursText: '每周 3 小时 × 2 周', weekly: 3, priority: '中' }],
          missing: [{ title: '从 0 策划 1 次班级或社团线上活动并写复盘', benefit: '活动运营入门案例', hoursText: '每周 3 小时 × 2 周', weekly: 3, priority: '中' }]
        }
      },
      {
        key: 'business', name: '业务理解', weight: 2, req: '了解目标行业产品与业务模式',
        detect: function (p) {
          var m = matchExps(p, { st: ['实习经历'], sk: ['行业研究', '业务分析', '产品分析'], pt: [], pk: ['产品体验', '竞品'] });
          if (m.strong.length) return full('事实', expSummary(m.strong));
          if (m.partial.length) return partialGap('事实', expSummary(m.partial), '推测', '尚未形成系统的行业与业务认知');
          return missing('推测', '未见相关体现');
        },
        actions: {
          full: [{ title: '把业务理解整理成面试问答素材', benefit: '巩固表达', hoursText: '1 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '深度体验 1 个目标产品并写 1 页分析', benefit: '加深业务理解', hoursText: '2 小时', weekly: 0, priority: '中' }],
          missing: [{ title: '研究 3 个目标公司产品，输出 1 页业务理解笔记', benefit: '补齐业务认知', hoursText: '每周 2 小时 × 2 周', weekly: 2, priority: '中' }]
        }
      },
      {
        key: 'comm', name: '沟通与执行力', weight: 1, req: '跨部门沟通与推进能力',
        detect: function (p) {
          var m = matchExps(p, { st: ['社团组织', '学生工作', '比赛竞赛'], sk: ['组织', '负责', '主导', '队长'], pt: [], pk: ['协作', '团队'] });
          if (m.strong.length) return full('推测', '社团、比赛等经历可体现沟通与执行力：' + expSummary(m.strong));
          if (m.partial.length) return partialGap('事实', expSummary(m.partial), '推测', '协作与推进的证据较少');
          return missing('推测', '未见可体现沟通协作的经历');
        },
        actions: {
          full: [{ title: '整理比赛/学生会经历的可迁移能力清单', benefit: '巩固表达', hoursText: '1.5 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '在社团或小组中主动负责 1 次跨部门协作事项', benefit: '补齐协作案例', hoursText: '每周 1 小时 × 2 周', weekly: 1, priority: '低' }],
          missing: [{ title: '参与 1 次社团/班级组织工作并沉淀协作案例', benefit: '补齐协作案例', hoursText: '每周 1 小时 × 2 周', weekly: 1, priority: '低' }]
        }
      }
    ]
  },
  {
    id: 'pm', name: '产品经理实习生',
    dims: [
      {
        key: 'thinking', name: '需求分析与产品思维', weight: 3, req: '能做基础的需求分析与竞品分析',
        detect: function (p) {
          var m = matchExps(p, { st: [], sk: ['产品分析', '需求分析', '竞品', 'PRD', '产品体验'], pt: ['课程项目', '调研分析'], pk: ['用户', '调研'] });
          if (m.strong.length) return full('事实', expSummary(m.strong));
          if (m.partial.length) return partialGap('事实', expSummary(m.partial), '推测', '尚未见完整的需求分析或产品分析产出');
          return missing('推测', '未见产品思维相关经历');
        },
        actions: {
          full: [{ title: '把一份产品分析改写成作品集页面', benefit: '作品沉淀', hoursText: '2 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '完整写 1 份竞品分析报告（结构化模板）', benefit: '补齐产品思维证据', hoursText: '每周 3 小时 × 2 周', weekly: 3, priority: '高' }],
          missing: [{ title: '系统学习需求分析与竞品分析方法并完成 1 份报告', benefit: '建立产品思维基础', hoursText: '每周 4 小时 × 3 周', weekly: 4, priority: '高' }]
        }
      },
      {
        key: 'practice', name: '项目/实践经历', weight: 3, req: '有可讲的项目或实践案例',
        detect: function (p) {
          var n = (p.exps || []).length;
          if (n >= 2) return full('事实', '已有 ' + n + ' 段实践经历：' + expSummary(p.exps));
          if (n === 1) return partialGap('事实', expSummary(p.exps), '推测', '实践经历数量偏少，案例厚度不足');
          return missing('推测', '未见实践经历');
        },
        actions: {
          full: [{ title: '把最有代表性的 1 段经历整理成 STAR 故事', benefit: '面试表达素材', hoursText: '2 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '再完成 1 个小型实践项目（课程/社团均可）', benefit: '增加案例厚度', hoursText: '每周 3 小时 × 3 周', weekly: 3, priority: '高' }],
          missing: [{ title: '从 0 完成 1 个小型产品实践项目', benefit: '补齐项目经历', hoursText: '每周 4 小时 × 4 周', weekly: 4, priority: '高' }]
        }
      },
      {
        key: 'dataSense', name: '数据意识', weight: 2, req: '能看懂基础指标并用数据说话',
        detect: function (p) {
          var sk = ['Excel', 'SQL', 'Python', 'SPSS'].map(function (n) { return skillEntry(p, n); }).filter(Boolean);
          var de = matchExps(p, { st: ['调研分析'], sk: [], pt: [], pk: ['数据', '调研', '调查'] });
          if (sk.some(function (s) { return ['熟练', '精通'].indexOf(s.level) >= 0; })) return full('事实', '已具备 ' + sk.map(function (s) { return s.name + '（' + s.level + '）'; }).join('、'));
          var parts = [];
          if (sk.length) parts.push(sk.map(function (s) { return s.name + '（' + s.level + '）'; }).join('、'));
          if (de.strong.length) parts.push(expSummary(de.strong));
          if (parts.length) return partialGap('事实', parts.join('；'), '推测', '数据工具实操与指标分析证据不足');
          return missing('推测', '未见数据意识相关体现');
        },
        actions: {
          full: [{ title: '用数据重构 1 段经历的表达（每个成果配指标）', benefit: '巩固表达', hoursText: '1.5 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '学完基础指标体系并复盘 1 个产品数据案例', benefit: '补齐数据意识', hoursText: '每周 2 小时 × 2 周', weekly: 2, priority: '中' }],
          missing: [{ title: '学习常用产品指标（DAU/留存/转化）并做笔记', benefit: '建立数据意识', hoursText: '每周 2 小时 × 2 周', weekly: 2, priority: '中' }]
        }
      },
      {
        key: 'collab', name: '沟通协作', weight: 2, req: '跨角色沟通与推进能力',
        detect: function (p) {
          var m = matchExps(p, { st: ['社团组织', '学生工作', '比赛竞赛'], sk: ['组织', '负责', '主导', '队长'], pt: [], pk: ['协作', '团队'] });
          if (m.strong.length) return full('推测', '社团、比赛等经历可体现沟通协作：' + expSummary(m.strong));
          if (m.partial.length) return partialGap('事实', expSummary(m.partial), '推测', '协作证据较少');
          return missing('推测', '未见沟通协作相关经历');
        },
        actions: {
          full: [{ title: '整理协作经历中的冲突解决案例', benefit: '巩固表达', hoursText: '1 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '在团队中主动牵头 1 项跨角色任务', benefit: '补齐协作案例', hoursText: '每周 1 小时 × 2 周', weekly: 1, priority: '中' }],
          missing: [{ title: '加入 1 个跨专业团队项目并承担协调角色', benefit: '补齐协作案例', hoursText: '每周 2 小时 × 3 周', weekly: 2, priority: '中' }]
        }
      },
      {
        key: 'tools', name: '工具使用', weight: 1, req: '会用原型/文档类基础工具',
        detect: function (p) {
          var names = ['Axure', 'Figma', '墨刀', 'Photoshop', 'XMind'];
          var sk = names.map(function (n) { return skillEntry(p, n); }).filter(Boolean);
          if (sk.some(function (s) { return ['熟练', '精通'].indexOf(s.level) >= 0; })) return full('事实', '已具备 ' + sk.map(function (s) { return s.name + '（' + s.level + '）'; }).join('、'));
          if (sk.length) return partialGap('事实', '已了解 ' + sk.map(function (s) { return s.name; }).join('、'), '推测', '尚未见原型或文档产出');
          return missing('推测', '未填写原型或文档工具');
        },
        actions: {
          full: [{ title: '用原型工具复刻 1 个页面流程', benefit: '巩固工具能力', hoursText: '2 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '跟完墨刀/Figma 入门教程并出 3 页原型', benefit: '补齐工具技能', hoursText: '每周 2 小时 × 1 周', weekly: 2, priority: '低' }],
          missing: [{ title: '学习 1 款原型工具入门', benefit: '补齐工具基础', hoursText: '2 小时', weekly: 0, priority: '低' }]
        }
      }
    ]
  },
  {
    id: 'fe', name: '前端开发实习生',
    dims: [
      {
        key: 'basis', name: 'HTML/CSS/JS 基础', weight: 3, req: '掌握前端三件套基础语法',
        detect: function (p) {
          var names = ['JavaScript', 'HTML', 'CSS', 'Python', 'Java', 'C++'];
          var sk = names.map(function (n) { return skillEntry(p, n); }).filter(Boolean);
          if (sk.some(function (s) { return lvIndex(s.level) >= lvIndex('熟悉'); })) return full('事实', '已具备 ' + sk.map(function (s) { return s.name + '（' + s.level + '）'; }).join('、'));
          if (sk.length) return partialGap('事实', '已了解 ' + sk.map(function (s) { return s.name; }).join('、'), '推测', '尚未见编程实践产出');
          return missing('推测', '未提供编程语言基础信息');
        },
        actions: {
          full: [{ title: '用原生 JS 复刻 1 个小组件', benefit: '巩固基础', hoursText: '3 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '跟完 JavaScript 核心语法并做 20 道练习', benefit: '补齐语言基础', hoursText: '每周 4 小时 × 2 周', weekly: 4, priority: '高' }],
          missing: [{ title: '系统学习 HTML/CSS/JS 基础（跟完一套入门课程）', benefit: '补齐前端基础', hoursText: '每周 5 小时 × 4 周', weekly: 5, priority: '高' }]
        }
      },
      {
        key: 'project', name: '项目实践', weight: 3, req: '有可运行的网页作品',
        detect: function (p) {
          var m = matchExps(p, { st: ['课程项目', '开源项目'], sk: ['项目', '作品', '主页', '网站', '小程序'], pt: ['课程项目'], pk: ['课程', '作业'] });
          if (m.strong.length) return full('事实', expSummary(m.strong));
          if (m.partial.length) return partialGap('事实', expSummary(m.partial), '推测', '独立完成的项目作品不足');
          return missing('推测', '未见编程项目实践');
        },
        actions: {
          full: [{ title: '把项目部署上线并写 README', benefit: '作品可展示', hoursText: '2 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '独立完成 1 个小项目（如个人主页）', benefit: '补齐作品', hoursText: '每周 3 小时 × 2 周', weekly: 3, priority: '高' }],
          missing: [{ title: '跟教程做出第一个个人主页并部署', benefit: '第一个作品', hoursText: '每周 3 小时 × 2 周', weekly: 3, priority: '高' }]
        }
      },
      {
        key: 'eng', name: '工程化与协作', weight: 2, req: '了解 Git 与基本协作流程',
        detect: function (p) {
          if (skillAt(p, 'Git', '熟悉') || skillAt(p, 'GitHub', '熟悉')) return full('事实', '已具备 ' + skillList(p, ['Git', 'GitHub']).join('、'));
          var ge = matchExps(p, { st: ['开源项目'], sk: ['git', 'github'], pt: [], pk: [] });
          if (skillEntry(p, 'Git') || skillEntry(p, 'GitHub') || ge.strong.length) return partialGap('事实', '已接触 Git/GitHub', '推测', '协作流程实操不足');
          return missing('推测', '未见协作与版本管理相关经历');
        },
        actions: {
          full: [{ title: '参与 1 次开源小修（文档/小 bug）', benefit: '协作经验', hoursText: '2 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '完成 Git 分支与协作流程练习', benefit: '补齐工程化', hoursText: '2 小时', weekly: 0, priority: '中' }],
          missing: [{ title: '注册 GitHub，学会提交与管理代码', benefit: '补齐协作基础', hoursText: '2 小时', weekly: 0, priority: '中' }]
        }
      },
      {
        key: 'cs', name: '计算机基础', weight: 2, req: '具备数据结构/网络等基础知识',
        detect: function (p) {
          var ce = matchExps(p, { st: ['课程项目', '开源项目'], sk: ['计算机', '算法', '数据结构'], pt: [], pk: [] });
          var majorHit = ['计算机', '软件', '信息'].some(function (k) { return (p.major || '').indexOf(k) >= 0; });
          if (ce.strong.length && majorHit) return full('事实', '专业：' + p.major + '；' + expSummary(ce.strong));
          if (majorHit) return partialGap('事实', '专业：' + p.major, '推测', '已修课程未见项目佐证');
          return missing('推测', '专业与课程信息未见计算机基础');
        },
        actions: {
          full: [{ title: '刷 20 道基础算法题保持手感', benefit: '巩固基础', hoursText: '每周 2 小时 × 2 周', weekly: 2, priority: '低' }],
          partial: [{ title: '补数据结构基础（数组/链表/树）', benefit: '补齐计算机基础', hoursText: '每周 2 小时 × 3 周', weekly: 2, priority: '中' }],
          missing: [{ title: '学习计算机导论与数据结构入门', benefit: '建立基础', hoursText: '每周 3 小时 × 4 周', weekly: 3, priority: '中' }]
        }
      },
      {
        key: 'learn', name: '学习能力', weight: 1, req: '能快速学习新技术并落地',
        detect: function (p) {
          var n = (p.exps || []).length;
          if (n > 0) return full('推测', '有持续学习与实践的迹象：' + expSummary((p.exps || []).slice(0, 2)));
          return missing('推测', '暂无信息');
        },
        actions: {
          full: [{ title: '输出 1 篇学习笔记（博客/文档）', benefit: '巩固表达', hoursText: '1.5 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '制定 4 周学习计划并公开打卡', benefit: '建立学习习惯', hoursText: '每周 1 小时', weekly: 1, priority: '低' }],
          missing: [{ title: '制定 4 周学习计划并执行第 1 周', benefit: '建立学习习惯', hoursText: '每周 1 小时', weekly: 1, priority: '低' }]
        }
      }
    ]
  },
  {
    id: 'da', name: '数据分析实习生',
    dims: [
      {
        key: 'sql', name: 'SQL 与数据处理', weight: 3, req: '会用 SQL 做查询与清洗',
        detect: function (p) {
          var s = skillEntry(p, 'SQL');
          if (s && lvIndex(s.level) >= lvIndex('熟悉')) return full('事实', 'SQL（' + s.level + '）');
          var parts = [];
          if (s) parts.push('SQL（' + s.level + '）');
          var others = skillList(p, ['Excel', 'Python', 'SPSS']); if (others.length) parts.push(others.join('、'));
          if (parts.length) return partialGap('事实', parts.join('；'), '推测', '未提供 SQL 相关经历，推测缺乏 SQL 实操');
          return missing('推测', '未见 SQL 或数据处理相关技能');
        },
        actions: {
          full: [{ title: '用 SQL 完成 1 次多表查询综合练习', benefit: '巩固 SQL', hoursText: '3 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '完成 SQL 基础课程并刷 30 道查询题', benefit: '补齐 SQL 实操', hoursText: '每周 4 小时 × 3 周', weekly: 4, priority: '高' }],
          missing: [{ title: '系统学习 SQL 基础（跟完一套入门课程）', benefit: '补齐 SQL 基础', hoursText: '每周 4 小时 × 4 周', weekly: 4, priority: '高' }]
        }
      },
      {
        key: 'stats', name: '统计基础', weight: 3, req: '掌握描述统计与基础检验方法',
        detect: function (p) {
          if (skillAt(p, 'SPSS', '熟悉') || skillAt(p, 'Python', '熟练')) return full('事实', '已具备 ' + skillList(p, ['SPSS', 'Python']).join('、'));
          var m = matchExps(p, { st: ['调研分析'], sk: ['统计', '市场调查', '调查'], pt: ['比赛竞赛'], pk: ['调查', '统计'] });
          if (m.strong.length) return full('事实', expSummary(m.strong));
          if (m.partial.length) return partialGap('事实', expSummary(m.partial), '推测', '统计方法应用深度待验证');
          return missing('推测', '未见统计相关经历');
        },
        actions: {
          full: [{ title: '用统计方法复盘 1 个真实数据集', benefit: '巩固统计', hoursText: '3 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '复习描述统计与假设检验并做练习', benefit: '补齐统计基础', hoursText: '每周 2 小时 × 2 周', weekly: 2, priority: '高' }],
          missing: [{ title: '学习统计学基础（描述统计+假设检验）', benefit: '建立统计基础', hoursText: '每周 3 小时 × 3 周', weekly: 3, priority: '高' }]
        }
      },
      {
        key: 'viz', name: '可视化与报表', weight: 2, req: '能制作图表与基础报表',
        detect: function (p) {
          if (skillAt(p, 'Tableau', '熟悉') || skillAt(p, 'PowerBI', '熟悉')) return full('事实', '已具备 ' + skillList(p, ['Tableau', 'PowerBI']).join('、'));
          var parts = [];
          var e = skillEntry(p, 'Excel'); if (e && ['熟练', '精通'].indexOf(e.level) >= 0) parts.push('Excel（' + e.level + '）');
          var ve = matchExps(p, { st: [], sk: ['可视化', '图表'], pt: [], pk: [] }); if (ve.strong.length) parts.push(expSummary(ve.strong));
          if (parts.length) return partialGap('事实', parts.join('；'), '推测', '尚未见完整的图表/报表作品');
          return missing('推测', '未见图表或报表产出');
        },
        actions: {
          full: [{ title: '把一次分析做成 1 页可视化看板', benefit: '作品沉淀', hoursText: '3 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '用 Excel/BI 工具做 1 份含 5 图的分析报告', benefit: '补齐可视化', hoursText: '每周 2 小时 × 2 周', weekly: 2, priority: '中' }],
          missing: [{ title: '学习图表类型选择与 Excel 图表进阶', benefit: '补齐可视化基础', hoursText: '每周 2 小时 × 2 周', weekly: 2, priority: '中' }]
        }
      },
      {
        key: 'bizMind', name: '业务思维', weight: 2, req: '能把数据与业务问题关联',
        detect: function (p) {
          var m = matchExps(p, { st: ['实习经历'], sk: ['商业分析', '行业研究'], pt: ['新媒体运营', '自媒体内容', '调研分析', '比赛竞赛'], pk: ['运营', '市场', '调研'] });
          if (m.strong.length) return full('事实', expSummary(m.strong));
          if (m.partial.length) return partialGap('事实', expSummary(m.partial), '推测', '有用户侧经验，但未见商业分析产出');
          return missing('推测', '未见业务分析相关经历');
        },
        actions: {
          full: [{ title: '输出 1 篇业务分析小文章', benefit: '巩固业务思维', hoursText: '2 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '选 1 个业务问题做完整拆解（指标树）', benefit: '补齐业务思维', hoursText: '每周 2 小时 × 1 周', weekly: 2, priority: '中' }],
          missing: [{ title: '学习指标拆解方法并练习 2 个案例', benefit: '建立业务思维', hoursText: '每周 2 小时 × 2 周', weekly: 2, priority: '中' }]
        }
      },
      {
        key: 'commDa', name: '沟通表达', weight: 1, req: '能清晰呈现分析结论',
        detect: function (p) {
          var m = matchExps(p, { st: ['社团组织', '学生工作', '比赛竞赛'], sk: ['组织', '负责', '主导', '队长'], pt: [], pk: ['协作', '团队'] });
          if (m.strong.length) return full('推测', '社团、比赛等经历可体现沟通表达：' + expSummary(m.strong));
          if (m.partial.length) return partialGap('事实', expSummary(m.partial), '推测', '表达与汇报的证据较少');
          return missing('推测', '未见沟通表达相关经历');
        },
        actions: {
          full: [{ title: '把一次分析结论写成 3 分钟讲稿', benefit: '巩固表达', hoursText: '1 小时', weekly: 0, priority: '低' }],
          partial: [{ title: '做 1 次分析结论的模拟汇报', benefit: '补齐表达', hoursText: '1.5 小时', weekly: 0, priority: '低' }],
          missing: [{ title: '参加 1 次课堂/社团汇报并复盘', benefit: '补齐表达', hoursText: '1.5 小时', weekly: 0, priority: '低' }]
        }
      }
    ]
  }
];

/* ---------- 零经历起步包（与 product-doc 7.2 B1 一致，fe 为文档原文） ---------- */
var STARTER_PACKS = {
  fe: [
    { title: '系统学习 HTML/CSS/JS 基础（跟完一套入门课程）', benefit: '补齐前端基础', hoursText: '每周 5 小时 × 4 周', weekly: 5, priority: '高' },
    { title: '跟教程做出第一个个人主页并部署', benefit: '第一个作品', hoursText: '每周 3 小时 × 2 周', weekly: 3, priority: '高' },
    { title: '注册 GitHub，学会提交与管理代码', benefit: '补齐协作基础', hoursText: '2 小时', weekly: 0, priority: '中' },
    { title: '收集 5 条前端实习 JD，建立目标感', benefit: '明确方向', hoursText: '1 小时', weekly: 0, priority: '低' }
  ],
  ops: [
    { title: '系统学习运营入门（内容/活动/用户三大模块）', benefit: '建立运营基础', hoursText: '每周 4 小时 × 3 周', weekly: 4, priority: '高' },
    { title: '开一个小红书/公众号账号，发布 3 篇内容并复盘数据', benefit: '第一份运营作品', hoursText: '每周 3 小时 × 2 周', weekly: 3, priority: '高' },
    { title: '用 Excel 整理一次活动或课程数据', benefit: '数据工具入门', hoursText: '2 小时', weekly: 0, priority: '中' },
    { title: '收集 5 条运营实习 JD，建立目标感', benefit: '明确方向', hoursText: '1 小时', weekly: 0, priority: '低' }
  ],
  pm: [
    { title: '系统学习产品入门（需求分析/竞品分析/PRD）', benefit: '建立产品基础', hoursText: '每周 4 小时 × 3 周', weekly: 4, priority: '高' },
    { title: '完整体验 1 个产品并写 1 份产品分析报告', benefit: '第一份产品作品', hoursText: '每周 3 小时 × 2 周', weekly: 3, priority: '高' },
    { title: '学习 Axure/墨刀原型工具基础', benefit: '工具入门', hoursText: '2 小时', weekly: 0, priority: '中' },
    { title: '收集 5 条产品实习 JD，建立目标感', benefit: '明确方向', hoursText: '1 小时', weekly: 0, priority: '低' }
  ],
  da: [
    { title: '系统学习 SQL 基础（跟完一套入门课程）', benefit: '补齐 SQL 基础', hoursText: '每周 5 小时 × 3 周', weekly: 5, priority: '高' },
    { title: '用公开数据集完成 1 次完整分析并出图表', benefit: '第一份分析作品', hoursText: '每周 3 小时 × 2 周', weekly: 3, priority: '高' },
    { title: '复习统计学基础（描述统计+假设检验）', benefit: '补齐统计基础', hoursText: '每周 2 小时 × 2 周', weekly: 2, priority: '中' },
    { title: '收集 5 条数据实习 JD，建立目标感', benefit: '明确方向', hoursText: '1 小时', weekly: 0, priority: '低' }
  ]
};

/* ---------- 预置演示案例（虚构模拟数据，界面标注"模拟"） ---------- */
var PRESETS = {
  xiaoyu: {
    jobId: 'ops', grade: '大三', major: '市场营销', weekly: 10, expect: '3个月内',
    exps: [
      { type: '新媒体运营', name: '公众号运营', desc: '运营 1 年，粉丝 3000+，周更 2 篇' },
      { type: '比赛竞赛', name: '全国大学生市场调查与分析大赛', desc: '省赛二等奖，负责问卷设计与数据分析' },
      { type: '学生工作', name: '院学生会宣传部', desc: '干事半年，参与多场院级活动宣传' }
    ],
    skills: [
      { name: '微信排版工具', level: '熟练' },
      { name: 'Excel', level: '熟悉' }
    ]
  },
  liming: {
    jobId: 'fe', grade: '大二', major: '计算机科学与技术', weekly: 8, expect: '3个月内',
    exps: [],
    skills: []
  }
};
