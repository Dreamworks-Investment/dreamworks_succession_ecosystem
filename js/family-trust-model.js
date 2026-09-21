/**
 * family-trust-model.js
 * 家族信托意愿访谈的纯数据模型；不包含 DOM，便于回归测试与后续接 API。
 */
(function (global) {
  'use strict';

  const INITIAL_STATE = {
    step: 1,
    profile: {
      name: '', age: '', industry: '', company: '', listed: '', assetScale: '',
      childrenCount: '', childrenDesc: '', successionWill: ''
    },
    purposes: [],
    intent: {
      termYears: '', annualCap: '', beneficiaries: '', exclusions: '',
      distribution: '', guardrails: ''
    },
    assetAmounts: { financial: 0, equity: 0, realestate: 0, other: 0 },
    assets: { source: '', phaseOne: '', phaseTwo: '', debt: '' },
    governance: {
      trusteeCriteria: '', protector: '', committee: '', investment: '',
      cultureCharity: '', confidentiality: '', confidentialityAcknowledged: false
    },
    notes: { 1: '', 2: '', 3: '', 4: '' }
  };

  const DEMO_STATE = {
    step: 1,
    profile: {
      name: '孙海蛋（虚拟案例）',
      age: '83',
      industry: '传媒',
      company: '啊哇比广播有限公司（持股38%，任董事长）',
      listed: '是',
      assetScale: '金融资产约18.01亿元、股权约1.25亿元、不动产约8.09亿元',
      childrenCount: '20',
      childrenDesc: '20位子女，年龄、职业及所在地差异较大；部分已在家族企业任职，部分暂无接班意愿。',
      successionWill: '优先隔离企业、婚姻与债务风险；实现3—4代传承，并建立接班与家族治理机制。'
    },
    purposes: ['风险隔离', '财富保值增值', '代际传承', '家族治理', '公益慈善'],
    intent: {
      termYears: '58',
      annualCap: '100',
      beneficiaries: '本人、配偶、20位子女以及子女的后代。',
      exclusions: '姻亲及旁系亲属暂不纳入；是否附条件纳入留待专业访谈确认。',
      distribution: '40%支持接班与任职成员，20%支持其他后代，30%作为三代教育生活储备，2.5%慈善、2.5%应急、5%激励；按人生阶段分期拨付。',
      guardrails: '设置反挥霍与重大不良行为条款，采用暂停、观察、恢复与永久取消的分级机制；认定证据和恢复程序待法律化。'
    },
    assetAmounts: { financial: 180100, equity: 12500, realestate: 80900, other: 0 },
    assets: {
      source: '经营所得、投资收益、现金存款、企业股权及境内外房产；权属、完税及跨境资料待核验。',
      phaseOne: '3—5年先装入闲置资金、部分基金份额、可转移股权及处置后的闲置房产资金。',
      phaseTwo: '5—10年根据上市锁定期、固收期限与日常资金安排，逐步纳入核心资产。',
      debt: '重点核验企业负债、对外担保、股权锁定期、房产抵押及跨境资产合规。'
    },
    governance: {
      trusteeCriteria: '持牌独立、规模与服务年限充足、团队稳定；排除有信用、财务或信托被击穿重大记录的机构。',
      protector: '由可信任的家族成员与专业人士共同监督受托人，保留审查、建议更换与重大事项否决机制。',
      committee: '本人、配偶、二儿子及可信任亲属组成家族委员会；成员增补、回避和表决机制待细化。',
      investment: '长期目标年化10%，分阶段目标需做压力测试；禁止高杠杆、裸做空及未经授权的衍生品风险。',
      cultureCharity: '建立家规家德家风、教育与职业支持机制；设置慈善与家族应急储备。',
      confidentiality: '身份、资产权属、账户、受益人与健康信息分级授权；敏感原件仅在正式尽调环节线下提交。',
      confidentialityAcknowledged: true
    },
    notes: {
      1: '虚拟角色扮演数据，仅用于演示交互流程。',
      2: '分配比例和不良行为认定标准需由家族与律师共同复核。',
      3: '境外现金、境外房产与拟上市股权需分别建立专项工作流。',
      4: '具体受托机构、保护人权限与争议解决口径仍待确认。'
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createInitialState() {
    return clone(INITIAL_STATE);
  }

  function createDemoState() {
    return clone(DEMO_STATE);
  }

  function mergeState(base, incoming) {
    const next = clone(base || INITIAL_STATE);
    const source = incoming && typeof incoming === 'object' ? incoming : {};
    ['profile', 'intent', 'assetAmounts', 'assets', 'governance', 'notes'].forEach((key) => {
      next[key] = Object.assign({}, next[key], source[key] || {});
    });
    next.purposes = Array.isArray(source.purposes) ? source.purposes.slice() : next.purposes;
    next.step = Math.min(5, Math.max(1, Number.parseInt(source.step, 10) || 1));
    return next;
  }

  function numberValue(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function totalAssets(state) {
    const amounts = (state && state.assetAmounts) || {};
    return ['financial', 'equity', 'realestate', 'other'].reduce((sum, key) => sum + numberValue(amounts[key]), 0);
  }

  function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function formatMoneyWan(value) {
    const number = numberValue(value);
    if (!number) return '0 万';
    if (number >= 10000) return `${(number / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 亿`;
    return `${number.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 万`;
  }

  function firstText(value, fallback) {
    return hasText(value) ? value.trim() : fallback;
  }

  function analyse(stateInput) {
    const state = mergeState(INITIAL_STATE, stateInput);
    const total = totalAssets(state);
    const checks = [
      { label: '委托人及企业画像', weight: 10, ready: hasText(state.profile.name) && hasText(state.profile.company) },
      { label: '家庭成员与接班意愿', weight: 10, ready: hasText(state.profile.childrenDesc) && hasText(state.profile.successionWill) },
      { label: '信托目的', weight: 10, ready: state.purposes.length > 0 },
      { label: '受益人范围', weight: 10, ready: hasText(state.intent.beneficiaries) },
      { label: '分配与保护规则', weight: 12, ready: hasText(state.intent.distribution) && hasText(state.intent.guardrails) },
      { label: '拟装入财产', weight: 12, ready: total > 0 && hasText(state.assets.source) },
      { label: '分阶段装入路径', weight: 8, ready: hasText(state.assets.phaseOne) || hasText(state.assets.phaseTwo) },
      { label: '受托与监督机制', weight: 12, ready: hasText(state.governance.trusteeCriteria) && hasText(state.governance.protector) },
      { label: '家族治理与投资边界', weight: 8, ready: hasText(state.governance.committee) && hasText(state.governance.investment) },
      { label: '演示边界确认', weight: 8, ready: Boolean(state.governance.confidentialityAcknowledged) }
    ];
    const score = checks.reduce((sum, check) => sum + (check.ready ? check.weight : 0), 0);
    const gaps = checks.filter((check) => !check.ready).map((check) => check.label);

    const elements = [
      ['信托名称', `${firstText(state.profile.name, '委托人')}家族信托（暂定）`],
      ['信托目的', state.purposes.length ? state.purposes.join(' · ') : '待确认'],
      ['信托财产', total ? `${formatMoneyWan(total)}（当前录入）` : '待盘点'],
      ['委托人', firstText(state.profile.name, '待确认')],
      ['受托人', hasText(state.governance.trusteeCriteria) ? '按已录入标准比选，具体机构待确认' : '待建立比选标准'],
      ['受益人', firstText(state.intent.beneficiaries, '待确认')],
      ['受益安排', firstText(state.intent.distribution, '待确认')],
      ['保护人', firstText(state.governance.protector, '待确认')],
      ['投资顾问', hasText(state.governance.investment) ? '由专业团队按投资边界另行确认' : '待确认'],
      ['慈善顾问', state.purposes.includes('公益慈善') ? '建议纳入专项顾问，具体人选待确认' : '暂不设置 / 待确认'],
      ['存续期限', numberValue(state.intent.termYears) ? `${numberValue(state.intent.termYears)} 年（意愿值）` : '待确认']
    ];

    const actions = [];
    const push = (title, copy, priority) => actions.push({ title, copy, priority: priority || '中' });
    if (!total) push('先完成资产与权属盘点', '至少录入拟规划资产规模，并区分所有权、共有、抵押、锁定和跨境状态。', '高');
    else if (total < 1000) push('核验家族信托设立门槛', '当前录入金额低于 1000 万元，应与持牌受托机构核验适用结构或替代工具。', '高');
    if (!hasText(state.assets.source) || !hasText(state.assets.debt)) push('完成资金来源与债务担保核验', '风险隔离不等于逃避既有债务；正式方案前需建立完整的权属、完税、债务及担保清单。', '高');
    if (numberValue(state.assetAmounts.equity) > 0 || state.profile.listed === '是' || state.profile.listed === '拟上市') push('为企业股权建立专项装入路径', '逐项核验股权转让限制、上市锁定期、税务成本、公司治理和控制权安排。', '高');
    if (numberValue(state.assetAmounts.realestate) > 0) push('区分自用与可处置不动产', '逐套确认所在地、用途、共有/抵押状态及处置或装入的可行性。', '中');
    if (!hasText(state.intent.distribution) || !hasText(state.intent.guardrails)) push('把分配意愿改写成可执行规则', '补充触发条件、证明材料、审批人、暂停期、恢复条件和争议处理，避免只写价值判断。', '高');
    if (!hasText(state.governance.trusteeCriteria) || !hasText(state.governance.protector)) push('启动受托人和保护人比选', '先定义资质、稳定性、权限、替换机制和利益冲突边界，再选择具体机构与人选。', '中');
    if (numberValue(state.intent.termYears) >= 50 && !hasText(state.governance.committee)) push('为超长期存续设计治理换届', '明确家族委员会增补、回避、表决、失能与代际交接机制。', '中');
    if (!state.governance.confidentialityAcknowledged) push('先确认演示边界并进入保密流程', '本页不构成签约；正式访谈前应分别查阅并签署保密协议与服务协议。', '高');
    push('安排专业顾问复核会', '携带本摘要进入 16 问正式访谈，形成备忘录、十一要素表及受托机构可法审的方案。', '下一步');

    const name = firstText(state.profile.name, '该家族');
    const purposeText = state.purposes.length ? state.purposes.slice(0, 3).join('、') : '传承目标';
    const summary = `${name}当前已形成以${purposeText}为核心的初步意愿框架；已录入拟规划资产${formatMoneyWan(total)}。${gaps.length ? `仍有 ${gaps.length} 类关键信息需要在正式顾问访谈中补齐。` : '核心信息已具备进入专业方案设计的讨论基础。'}`;

    return {
      score,
      gaps,
      checks,
      elements,
      actions: actions.slice(0, 7),
      totalAssets: total,
      meetsThreshold: total >= 1000,
      summary
    };
  }

  global.FamilyTrustModel = {
    createInitialState,
    createDemoState,
    mergeState,
    totalAssets,
    formatMoneyWan,
    analyse
  };
})(globalThis);
