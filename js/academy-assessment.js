/* ============================================================
 * 梦工场 · 家族传承健康度测评（传承学院 · Customer Onboarding）
 * 数据源：家族传承健康度打分表（客户初诊问卷 V1.0，54 题）
 * 评分：每题 1–5 分；维度得分 =（维度平均分 ÷ 5）× 100；
 *       总分 = Σ（维度得分 × 维度权重），满分 100。
 * ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'mgc_academy_assessment_v1';

  var SCALE = [
    { score: 1, label: '完全没有', hint: '完全没有 / 从未考虑' },
    { score: 2, label: '初步意识', hint: '有初步意识但无行动' },
    { score: 3, label: '部分安排', hint: '有部分安排但不系统' },
    { score: 4, label: '制度到位', hint: '已有制度化安排、执行基本到位' },
    { score: 5, label: '体系完善', hint: '体系完善、定期检视并持续优化' }
  ];

  var DIMENSIONS = [
    {
      key: 'wealth', name: '家族财富管理', short: '财富管理', weight: 0.25,
      desc: '财富是家族传承的根基。评估资产透明度、配置结构、传承工具运用与专业管理水平。',
      service: {
        title: '身家诊断 + 狠值投资',
        text: '先通过 AI 身家诊断看清真实财富全貌与隐形损耗，再以"狠值"投资框架重构跨资产、跨地域、跨币种的配置，并用家族信托等工具完成法律层面的代际安排。',
        page: 'wealth', btn: '进入身家诊断'
      },
      questions: [
        '家族是否建立了覆盖全部资产（金融资产、企业股权、不动产、海外资产、另类资产等）的完整资产清单，并定期盘点更新？',
        '家族财富是否进行了多元化配置（跨资产类别、跨地域、跨币种），避免过度集中于家族企业或单一行业？',
        '是否制定了书面的财富管理目标与投资政策（明确风险偏好、收益目标、流动性需求与投资禁区）？',
        '家族资产与企业经营资产之间是否已实现有效的风险隔离（如信托架构、独立持股平台、大额保单等）？',
        '是否已运用专业传承工具（家族信托、保险金信托、遗嘱、赠与安排等）对财富的代际转移作出法律安排？',
        '家族是否保有充足的流动性储备，足以应对企业危机、大额税费、代际交接等重大资金需求？',
        '是否有专业团队（家族办公室、私人银行、外部投资顾问）负责财富管理，并有清晰的授权、报告与问责机制？',
        '财富管理绩效是否定期回顾（年度评估、与基准比较），并据此动态调整资产配置？',
        '是否已系统评估传承过程中的税务成本与合规要求（遗产税/赠与税风险预判、跨境税务、CRS 申报等）？',
        '二代及主要家族成员是否了解家族财富全貌，并具备基本的财富管理认知与参与度？'
      ]
    },
    {
      key: 'governance', name: '家族治理结构', short: '治理结构', weight: 0.20,
      desc: '治理是传承的制度保障。评估家族宪章、治理机构、决策规则与冲突解决机制。',
      service: {
        title: '家族信托 + 治理架构',
        text: '以家族宪章明确愿景与规则，以家族理事会实现制度化决策，并以信托架构把治理规则嵌入法律文件，让传承从"人治"走向"法治"。',
        page: 'trust', btn: '了解家族信托'
      },
      questions: [
        '家族是否制定了成文的家族宪章/家族宪法，明确家族愿景、价值观与核心行为规则？',
        '是否建立了正式的家族治理机构（家族大会、家族委员会/理事会等），并保持定期、实质性运作？',
        '家族事务与企业事务的决策边界是否清晰，避免“家事企业化、企业家事化”？',
        '对股权变动、婚姻财产、家族成员进入/退出企业等重大事项，是否有事先明文约定的规则？',
        '是否建立了家族内部冲突预防与解决机制（调解程序、独立顾问、仲裁条款等）？',
        '家族成员之间是否有制度化的定期沟通机制（家族会议、家族日、跨代恳谈等）？',
        '治理规则是否覆盖姻亲成员的权利义务边界（婚前协议指引、配偶参与企业/财产的规则）？',
        '家族治理文件是否与法律工具（公司章程、股东协议、信托文件）有效衔接，具备强制执行力？',
        '治理机制是否随家族规模扩大与代际更替而定期审视、修订升级？'
      ]
    },
    {
      key: 'enterprise', name: '家族企业', short: '家族企业', weight: 0.18,
      desc: '企业是财富的主要来源与载体。评估公司治理、控制权安排、接班计划与经营可持续性。',
      service: {
        title: '企业经营增值',
        text: '从现代公司治理、控制权安排到接班计划与"关键人"预案，系统提升家族企业的可持续经营价值，摆脱对创始人个人的过度依赖。',
        page: 'strategy', btn: '查看战略与实践'
      },
      questions: [
        '家族企业是否建立了现代公司治理结构（规范运作的董事会、外部/独立董事、职业经理人体系）？',
        '企业股权结构是否清晰稳定，家族控制权是否有制度化保障（表决权安排、有限合伙、信托持股等）？',
        '企业是否有清晰的中长期战略，并具备应对行业变革（数字化转型、产业升级）的能力？',
        '家族成员在企业任职是否有明确的准入条件、绩效考核与退出标准，而非默认血缘安排？',
        '是否已制定书面的企业接班计划，包含接班人选、时间表与过渡期治理安排？',
        '是否有“关键人”应急预案（掌门人突发失能/离世情形下的临时领导、授权与信息交接安排）？',
        '企业的经营决策与关键资源（客户、银行、政府关系）是否已摆脱对创始人个人的过度依赖？',
        '企业分红政策与再投资政策是否明确，能平衡家族成员收益需求与企业长期发展？',
        '家族与企业之间的关联交易、资金往来是否规范、透明、有据可查？'
      ]
    },
    {
      key: 'human', name: '家族人力资本', short: '人力资本', weight: 0.15,
      desc: '人是传承的最终载体。评估接班人识别与培养、代际沟通、成员发展与外部人才机制。',
      service: {
        title: '接班人培养计划',
        text: '识别潜在接班人并制定系统培养计划（教育规划、外部历练、企业轮岗、导师机制），同时设计上一代掌权人的放权路线图与退休安排。',
        page: 'home', btn: '了解梦工场生态'
      },
      questions: [
        '家族是否已识别潜在接班人，或明确了“不由家族成员接班”情形下的替代方案（职业经理人/出售/信托持有）？',
        '是否为下一代制定了系统培养计划（教育规划、外部机构历练、企业内轮岗、导师机制）？',
        '下一代是否有真实的接班意愿，且两代人之间就接班预期进行过坦诚、深入的沟通？',
        '家族是否尊重并支持成员多元发展（允许不进入家族企业、支持自主创业并提供试错空间）？',
        '是否为家族成员提供财富、法律、治理等方面的持续教育（家族学院、研修计划、行业交流）？',
        '家族及企业是否有吸引、激励并留任外部职业经理人的机制与文化？',
        '上一代掌权人是否有明确的放权路线图与退休安排（角色转变时间表、“放权不放手”的过渡设计）？',
        '家族成员的能力评估是否引入客观标准（第三方测评、真实业绩检验），避免仅凭身份安排关键岗位？'
      ]
    },
    {
      key: 'risk', name: '风险管理与法律合规', short: '风险合规', weight: 0.10,
      desc: '风险是传承的隐形杀手。评估重大风险识别、保障安排、婚姻/债务隔离与法律文件完备性。',
      service: {
        title: '风险隔离与法律架构',
        text: '系统排查婚姻、债务、税务、跨境等重大风险敞口，以家族信托、大额保单与完备法律文件构建家族资产的"防火墙"。',
        page: 'trust', btn: '了解家族信托'
      },
      questions: [
        '是否系统识别过家族面临的重大风险（经营、婚姻、债务、健康、政策、跨境），并建立应对预案？',
        '家族核心成员是否配置了充足的人身、健康与重大疾病保障安排？',
        '家族成员的婚姻财产是否有事先规划（婚前/婚内财产协议、财产公证、代际赠与的隔离设计）？',
        '家族资产的法律权属是否清晰完备（无代持隐患、权属登记与文件齐全）？',
        '家族及企业的税务、外汇、跨境资产申报是否合规，历史遗留问题是否已排查化解？',
        '是否建立了家族信息安全与隐私保护机制（信息保密制度、网络安全、舆情应对）？',
        '关键法律文件（遗嘱、信托契约、持续性授权书、医疗预嘱）是否已订立并保持定期更新？'
      ]
    },
    {
      key: 'culture', name: '家族文化与凝聚力', short: '文化凝聚', weight: 0.07,
      desc: '文化是穿越周期的软实力。评估价值观共识、家族记忆传递、成员关系与认同感。',
      service: {
        title: '家族文化建设',
        text: '沉淀家族价值观与家训，系统记录家族历史与创业故事，以定期仪式与共同活动持续增强跨代凝聚力与认同感。',
        page: 'home', btn: '了解梦工场生态'
      },
      questions: [
        '家族是否有明确、成文并被各代成员真正认同的价值观与家训？',
        '家族历史与创业故事是否被系统记录并向后代传递（家史、口述史、纪录片、家族博物馆）？',
        '家族是否有定期的共同活动与仪式（年度家族聚会、节日传统），持续增强凝聚力？',
        '家族成员关系是否总体和睦，重大分歧能否通过内部沟通机制得到化解？',
        '下一代是否对家族有强烈的认同感与归属感，以家族身份为荣？',
        '家族价值观是否真实影响财富与企业的重大决策（价值观与行为一致，而非停留在口号）？'
      ]
    },
    {
      key: 'social', name: '社会资本与慈善', short: '社会慈善', weight: 0.05,
      desc: '声誉与社会网络是家族的无形资产。评估家族品牌、慈善体系化与关系网络传承。',
      service: {
        title: '公益慈善规划',
        text: '以家族基金会、慈善信托等体系化方式开展公益慈善，让下一代实质参与，并将社会关系网络从创始人个人有序移交家族。',
        page: 'home', btn: '了解梦工场生态'
      },
      questions: [
        '家族是否拥有良好的社会声誉，并有意识地管理与维护家族品牌形象？',
        '家族是否以体系化方式开展慈善公益（家族基金会、慈善信托、长期项目），而非零散被动捐赠？',
        '慈善事业是否与家族价值观深度结合，并有下一代实质参与（担任理事、主导项目）？',
        '家族的社会关系网络（政、商、学界）是否有传承与移交安排，而非仅系于创始人个人？',
        '家族及企业是否重视并履行社会责任（ESG、员工福祉、社区共建）？'
      ]
    }
  ];

  var GRADES = [
    { min: 85, grade: 'A', name: '基业长青型', cls: 'a', text: '传承体系成熟完备，重点在持续优化与代际迭代，可探索影响力投资、家族学院等高阶议题。' },
    { min: 70, grade: 'B', name: '稳健推进型', cls: 'b', text: '基础扎实但存在结构性短板，建议针对低分维度制定 1–2 年专项提升计划。' },
    { min: 55, grade: 'C', name: '亟待完善型', cls: 'c', text: '传承准备明显不足，存在实质性风险敞口，建议优先补齐财富隔离与治理规则两大底座。' },
    { min: 0,  grade: 'D', name: '高风险预警型', cls: 'd', text: '传承体系基本缺位，突发事件可能引发财富重大损失或家族纷争，需立即启动系统性传承规划。' }
  ];

  var CN_NUM = ['一', '二', '三', '四', '五', '六', '七'];

  /* 展开为扁平题目列表 */
  var FLAT = [];
  DIMENSIONS.forEach(function (dim, di) {
    dim.questions.forEach(function (q, qi) {
      FLAT.push({ dim: di, num: 'Q' + (di + 1) + '.' + (qi + 1), text: q });
    });
  });
  var TOTAL = FLAT.length;

  var answers = new Array(TOTAL).fill(0);
  var current = 0;
  var radarChart = null;

  function $(id) { return document.getElementById(id); }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(answers)); } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === TOTAL) answers = arr;
    } catch (e) {}
  }

  function showView(name) {
    ['asm-intro', 'asm-quiz', 'asm-result'].forEach(function (id) {
      $(id).hidden = (id !== 'asm-' + name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function answeredCount() {
    return answers.filter(function (a) { return a > 0; }).length;
  }

  /* ---------- 答题视图 ---------- */
  function renderQuestion() {
    var item = FLAT[current];
    var dim = DIMENSIONS[item.dim];

    $('asm-progress-text').textContent = '第 ' + (current + 1) + ' / ' + TOTAL + ' 题';
    $('asm-progress-dim').textContent = '已作答 ' + answeredCount() + ' 题';
    $('asm-progress-bar').style.width = (answeredCount() / TOTAL * 100) + '%';

    $('asm-dim-title').textContent = '维度' + CN_NUM[item.dim] + ' · ' + dim.name;
    $('asm-dim-weight').textContent = '权重 ' + Math.round(dim.weight * 100) + '%';
    $('asm-dim-desc').textContent = dim.desc;

    $('asm-qnum').textContent = item.num;
    $('asm-qtext').textContent = item.text;

    var box = $('asm-options');
    box.innerHTML = '';
    SCALE.forEach(function (s) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'asm-option' + (answers[current] === s.score ? ' selected' : '');
      btn.innerHTML =
        '<span class="asm-option-score">' + s.score + '</span>' +
        '<span><span class="asm-option-label">' + s.label + '</span>' +
        '<span class="asm-option-hint">' + s.hint + '</span></span>';
      btn.addEventListener('click', function () { selectOption(s.score); });
      box.appendChild(btn);
    });

    $('asm-prev').disabled = (current === 0);

    /* 卡片入场动画 */
    var card = document.querySelector('.asm-qcard');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  }

  function selectOption(score) {
    answers[current] = score;
    save();
    var options = document.querySelectorAll('.asm-option');
    options.forEach(function (el, i) {
      el.classList.toggle('selected', SCALE[i].score === score);
    });
    setTimeout(function () {
      if (current < TOTAL - 1) {
        current++;
        renderQuestion();
      } else {
        finish();
      }
    }, 260);
  }

  /* ---------- 计分 ---------- */
  function computeScores() {
    var idx = 0;
    var dims = DIMENSIONS.map(function (dim) {
      var sum = 0;
      for (var i = 0; i < dim.questions.length; i++) sum += answers[idx++];
      return {
        dim: dim,
        score: Math.round((sum / dim.questions.length) / 5 * 100)
      };
    });
    var total = Math.round(dims.reduce(function (acc, d) {
      return acc + d.score * d.dim.weight;
    }, 0));
    return { dims: dims, total: total };
  }

  function gradeOf(total) {
    for (var i = 0; i < GRADES.length; i++) {
      if (total >= GRADES[i].min) return GRADES[i];
    }
    return GRADES[GRADES.length - 1];
  }

  function scoreColor(s) {
    if (s >= 80) return 'var(--green)';
    if (s >= 60) return 'var(--primary)';
    if (s >= 40) return 'var(--amber)';
    return 'var(--red)';
  }
  function statusOf(s) {
    if (s >= 80) return '体系成熟，持续优化即可';
    if (s >= 60) return '基础尚可，仍有提升空间';
    if (s >= 40) return '存在短板，建议专项提升';
    return '明显缺位，需要优先补齐';
  }

  /* ---------- 报告视图 ---------- */
  function finish() {
    var result = computeScores();
    var g = gradeOf(result.total);

    /* 先显示报告视图，确保图表/动画能拿到真实布局尺寸 */
    showView('result');

    $('asm-score-num').innerHTML = result.total + '<span>/100</span>';
    $('asm-grade-badge').textContent = g.grade + ' · ' + g.name;
    $('asm-grade-badge').className = 'asm-grade-badge asm-grade-' + g.cls;
    $('asm-grade-text').textContent = g.text;

    /* 维度条形 */
    var bars = $('asm-dim-bars');
    bars.innerHTML = '';
    result.dims.forEach(function (d, i) {
      var row = document.createElement('div');
      row.className = 'asm-bar-row';
      row.innerHTML =
        '<div class="asm-bar-head">' +
          '<span class="asm-bar-name">维度' + CN_NUM[i] + ' · ' + d.dim.name +
            '<em>权重 ' + Math.round(d.dim.weight * 100) + '%</em></span>' +
          '<span class="asm-bar-score" style="color:' + scoreColor(d.score) + '">' + d.score + ' 分</span>' +
        '</div>' +
        '<div class="asm-bar-track"><div class="asm-bar-fill" style="width:0%;background:' + scoreColor(d.score) + '"></div></div>' +
        '<div class="asm-bar-status">' + statusOf(d.score) + '</div>';
      bars.appendChild(row);
    });
    requestAnimationFrame(function () {
      setTimeout(function () {
        bars.querySelectorAll('.asm-bar-fill').forEach(function (el, i) {
          el.style.width = result.dims[i].score + '%';
        });
      }, 60);
    });

    /* 雷达图 */
    if (radarChart) { radarChart.destroy(); radarChart = null; }
    if (window.Chart) {
      radarChart = new Chart($('asm-radar').getContext('2d'), {
        type: 'radar',
        data: {
          labels: result.dims.map(function (d) { return d.dim.short; }),
          datasets: [{
            label: '健康度得分',
            data: result.dims.map(function (d) { return d.score; }),
            backgroundColor: 'rgba(212, 175, 55, 0.18)',
            borderColor: '#d4af37',
            borderWidth: 2,
            pointBackgroundColor: '#185fa5',
            pointBorderColor: '#185fa5',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            r: {
              min: 0, max: 100,
              ticks: { stepSize: 20, display: false },
              grid: { color: 'rgba(0,0,0,0.06)' },
              angleLines: { color: 'rgba(0,0,0,0.06)' },
              pointLabels: {
                color: '#1a1a2e',
                font: { size: 12, weight: '600', family: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif' }
              }
            }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    /* 服务匹配：得分 < 70 的维度，按从低到高排序 */
    var svc = $('asm-services');
    svc.innerHTML = '';
    var weak = result.dims.filter(function (d) { return d.score < 70; })
                          .sort(function (a, b) { return a.score - b.score; });
    if (weak.length === 0) {
      var ok = document.createElement('div');
      ok.className = 'card card-sm';
      ok.style.gridColumn = '1 / -1';
      ok.innerHTML =
        '<h4 style="font-size:.95rem;margin-bottom:8px;">七大维度均表现良好</h4>' +
        '<p style="font-size:.82rem;color:var(--text-secondary);line-height:1.7;">您的家族传承体系整体健康。建议每 1–2 年复测一次，并探索影响力投资、家族学院等高阶议题，让体系随代际持续迭代。</p>';
      svc.appendChild(ok);
    } else {
      weak.forEach(function (d) {
        var tagCls = d.score < 40 ? 'urgent' : (d.score < 60 ? 'improve' : 'watch');
        var tagTxt = d.score < 40 ? '紧迫' : (d.score < 60 ? '待提升' : '可关注');
        var card = document.createElement('div');
        card.className = 'card card-sm asm-service-card';
        card.innerHTML =
          '<span class="asm-service-tag ' + tagCls + '">' + tagTxt + ' · ' + d.score + ' 分</span>' +
          '<h4>' + d.dim.name + ' → ' + d.dim.service.title + '</h4>' +
          '<p>' + d.dim.service.text + '</p>' +
          '<button type="button" class="btn btn-primary btn-sm" data-asm-nav="' + d.dim.service.page + '">' +
            d.dim.service.btn + '</button>';
        svc.appendChild(card);
      });
    }
  }

  /* ---------- 交互入口 ---------- */
  function startQuiz() {
    load();
    /* 续答：跳到第一道未作答的题 */
    var firstEmpty = answers.indexOf(0);
    current = firstEmpty === -1 ? 0 : firstEmpty;
    showView('quiz');
    renderQuestion();
  }

  function restart() {
    answers = new Array(TOTAL).fill(0);
    save();
    current = 0;
    showView('quiz');
    renderQuestion();
  }

  function goPage(page) {
    var link = document.querySelector('.nav-link[data-page="' + page + '"]');
    if (link) { link.click(); return; }
    if (typeof navigateTo === 'function') navigateTo(page);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = $('asm-intro');
    if (!root) return;

    $('asm-start').addEventListener('click', startQuiz);
    $('asm-prev').addEventListener('click', function () {
      if (current > 0) { current--; renderQuestion(); }
    });
    $('asm-restart').addEventListener('click', restart);
    $('asm-back-intro').addEventListener('click', function () { showView('intro'); });
    $('asm-go-home').addEventListener('click', function () { goPage('home'); });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-asm-nav]');
      if (btn) goPage(btn.getAttribute('data-asm-nav'));
    });

    /* 键盘 1–5 作答（仅在答题视图且测评页可见时） */
    document.addEventListener('keydown', function (e) {
      if ($('asm-quiz').hidden) return;
      var page = document.getElementById('page-academy');
      if (!page || !page.classList.contains('active')) return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 5) selectOption(n);
    });
  });
})();
