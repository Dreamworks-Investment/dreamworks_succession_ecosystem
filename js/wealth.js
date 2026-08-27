/**
 * wealth.js — 身家诊断五步向导
 */

// Load saved state on page init
const WEALTH_SAMPLE_ASSETS = {
  cash: [
    { name: 'XX银行活期及现金管理', bookValue: '202', fiveYearReturn: '0.5', liquid: '随时可用' },
    { name: 'XX银行三年期大额存单', bookValue: '102', fiveYearReturn: '2.5', liquid: '1年以上' },
    { name: '货币基金及短期理财', bookValue: '1293', fiveYearReturn: '2', liquid: '7天内' }
  ],
  realestate: [
    { name: '深圳湾自住房', location: '深圳南山区', bookValue: '33209', fiveYearGrowth: '2.2', usage: '自住' },
    { name: '前海投资公寓', location: '深圳前海', bookValue: '49027', fiveYearGrowth: '-1.5', usage: '空置' },
    { name: '上海陆家嘴住宅', location: '上海浦东新区', bookValue: '2090', fiveYearGrowth: '3.5', usage: '出租' },
    { name: '东莞产业园办公室物业', location: '东莞松山湖', bookValue: '1000', fiveYearGrowth: '4', usage: '经营使用' }
  ],
  business: [
    { name: '深圳XX科技有限公司', share: '100', equity: '23000', roe: '8' },
    { name: 'XXX投资管理有限公司', share: '23', equity: '20123', roe: '26' },
    { name: '杭州XX数据有限公司', share: '10', equity: '3091', roe: '-8.5' }
  ],
  financial: [
    { name: 'XX中国成长基金份额', marketValue: '1203', fiveYearReturn: '12', type: '私募股权' },
    { name: 'XXX指数基金组合', marketValue: '10280', fiveYearReturn: '9', type: '基金' }
  ],
  loans: [
    { borrower: '核心合作企业周转借款', amount: '9200', rate: '3', risk: '低' },
    { borrower: '朋友创业项目过桥借款', amount: '2005', rate: '1', risk: '高' }
  ],
  debt: [
    { source: '深圳湾住宅按揭贷款', amount: '10211', rate: '3.2', term: '10' },
    { source: '企业经营性信用贷款', amount: '120', rate: '5.3', term: '5' }
  ]
};

const WEALTH_SAMPLE_EXPENSES = [
  { description: '子女教育支出', amount: '600', firstYear: '3', frequency: 'annual', duration: '4' },
  { description: '父母养老与医疗储备', amount: '300', firstYear: '5', frequency: 'annual', duration: '10' },
  { description: '家族治理与传承安排', amount: '1200', firstYear: '8', frequency: 'once', duration: '1' }
];

const WEALTH_FIELD_MAPS = {
  cash: ['name', 'bookValue', 'fiveYearReturn', 'liquid'],
  realestate: ['name', 'location', 'bookValue', 'fiveYearGrowth', 'usage'],
  business: ['name', 'share', 'equity', 'roe'],
  financial: ['name', 'marketValue', 'fiveYearReturn', 'type'],
  loans: ['borrower', 'amount', 'rate', 'risk'],
  debt: ['source', 'amount', 'rate', 'term']
};

const WEALTH_NAME_PRESETS = {
  cash: ['活期及现金管理', '定期存款', '大额存单', '货币基金', '其他（自定义）'],
  realestate: ['自住房', '投资住宅', '商业物业', '工业物业', '其他（自定义）'],
  business: ['核心经营企业', '控股子公司', '参股企业', '创业项目', '其他（自定义）'],
  financial: ['公募基金', '私募基金', '股票组合', '保险或年金', '其他（自定义）'],
  loans: ['关联企业借款', '朋友借款', '过桥借款', '员工借款', '其他（自定义）'],
  debt: ['住房按揭', '经营贷款', '信用贷款', '股东借款', '其他（自定义）']
};

function wealthSetView(view, options = {}) {
  const page = document.getElementById('page-wealth');
  if (!page) return;

  const wizardActive = view === 'wizard';
  page.classList.toggle('wealth-intro-active', !wizardActive);
  page.classList.toggle('wealth-wizard-active', wizardActive);
  document.getElementById('wealth-system-intro')?.setAttribute('aria-hidden', String(wizardActive));
  document.getElementById('wealth-diagnosis-wizard')?.setAttribute('aria-hidden', String(!wizardActive));

  if (options.pushHistory || options.replaceHistory) {
    const method = options.replaceHistory ? 'replaceState' : 'pushState';
    const hash = wizardActive ? '#wealth-system' : '#wealth';
    try {
      window.history[method]({ page: 'wealth', wealthView: wizardActive ? 'wizard' : 'intro' }, '', hash);
    } catch (error) {}
  }

  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: options.smooth ? 'smooth' : 'auto' });
}

function wealthShowIntro(options = {}) {
  wealthSetView('intro', options);
}

function wealthEnterSystem(options = {}) {
  wealthSetView('wizard', options);
  window.setTimeout(() => document.querySelector('#wealth-diagnosis-wizard h2')?.focus({ preventScroll: true }), 0);
}

window.wealthShowIntro = wealthShowIntro;
window.wealthEnterSystem = wealthEnterSystem;

function setupWealthIntro() {
  const m2Input = document.getElementById('m2-rate-input');
  if (m2Input) m2Input.value = String(AppState.requiredReturn.r3 ?? 10);
  const principalInput = document.getElementById('investable-principal-input');
  if (principalInput && Number.isFinite(Number.parseFloat(AppState.requiredReturn.principalOverride))) {
    principalInput.value = String(AppState.requiredReturn.principalOverride);
  }
  const flagUsage = document.getElementById('flag-usage');
  const flagConvenience = document.getElementById('flag-convenience');
  const flagEmotional = document.getElementById('flag-emotional');
  if (flagUsage) flagUsage.checked = Boolean(AppState.flags.usage);
  if (flagConvenience) flagConvenience.checked = Boolean(AppState.flags.convenience);
  if (flagEmotional) flagEmotional.checked = Boolean(AppState.flags.emotional);

  renderExpenseRows();
  renderAllAssetTables();

  // Restore asset category tab event listeners
  document.querySelectorAll('#wealth-step-content [data-asset-cat]').forEach(btn => {
    btn.addEventListener('click', function() {
      switchTab(this.dataset.assetCat || this.dataset.tab, '#wealth-step-content');
      showTabPanel('asset-' + (this.dataset.assetCat || this.dataset.tab), '#wealth-step-content');
    });
  });

  document.getElementById('btn-load-sample')?.addEventListener('click', loadWealthSampleData);
  document.getElementById('btn-clear-assets')?.addEventListener('click', clearWealthAssets);
  document.getElementById('m2-rate-input')?.addEventListener('change', updateRequiredReturnDisplay);
  document.getElementById('investable-principal-input')?.addEventListener('change', updateRequiredReturnDisplay);

}

function loadWealthSampleData() {
  AppState.assets = JSON.parse(JSON.stringify(WEALTH_SAMPLE_ASSETS));
  AppState.flags = { usage: false, convenience: false, emotional: false };
  AppState.expenses = JSON.parse(JSON.stringify(WEALTH_SAMPLE_EXPENSES));
  AppState.requiredReturn = { r1: null, r2: null, r3: 10, winner: 'r3', computation: null, principalOverride: null };
  AppState.dcfResults = null;
  AppState.wealthStep = 1;

  document.getElementById('flag-usage').checked = false;
  document.getElementById('flag-convenience').checked = false;
  document.getElementById('flag-emotional').checked = false;
  const m2Input = document.getElementById('m2-rate-input');
  const principalInput = document.getElementById('investable-principal-input');
  if (m2Input) m2Input.value = '10';
  if (principalInput) principalInput.value = '';

  renderExpenseRows();
  renderAllAssetTables();
  goToStep(1);
  updateRequiredReturnDisplay();

  showWealthToast('样本案例已加载，您可以继续浏览完整诊断流程。');
}

function clearExpenseRows() {
  const container = document.getElementById('expense-list');
  if (container) container.innerHTML = '';
}

function clearWealthAssets() {
  AppState.assets = {
    cash: [], realestate: [], business: [], financial: [], loans: [], debt: []
  };
  AppState.flags = { usage: false, convenience: false, emotional: false };
  AppState.expenses = [];
  AppState.requiredReturn = { r1: null, r2: null, r3: 10, winner: 'r3', computation: null, principalOverride: null };
  AppState.dcfResults = null;
  renderExpenseRows();

  const r1Display = document.getElementById('r1-display');
  const requiredReturnDisplay = document.getElementById('r-required-display');
  const usageFlag = document.getElementById('flag-usage');
  const convenienceFlag = document.getElementById('flag-convenience');
  const emotionalFlag = document.getElementById('flag-emotional');

  if (r1Display) r1Display.textContent = '--%';
  if (requiredReturnDisplay) requiredReturnDisplay.textContent = '--%';
  if (usageFlag) usageFlag.checked = false;
  if (convenienceFlag) convenienceFlag.checked = false;
  if (emotionalFlag) emotionalFlag.checked = false;
  const m2Input = document.getElementById('m2-rate-input');
  const principalInput = document.getElementById('investable-principal-input');
  if (m2Input) m2Input.value = '10';
  if (principalInput) principalInput.value = '';

  renderAllAssetTables();
  saveState();
}

// Go to a specific step
function goToStep(step) {
  AppState.wealthStep = step;
  saveState();

  // Update step indicators
  document.querySelectorAll('[data-step]').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active', 'completed');
    if (s < step) el.classList.add('completed');
    if (s === step) el.classList.add('active');
  });

  // Show step panel
  document.querySelectorAll('.step-panel').forEach(panel => {
    panel.classList.toggle('active', parseInt(panel.dataset.wstep) === step);
  });

  // Step-specific initializations
  if (step === 2) updateRequiredReturnDisplay();
  if (step === 3) computeDCF();
  if (step === 4) renderGrowthChart();
  if (step === 5) generateActionSuggestions();

  window.scrollTo({ top: document.getElementById('wealth-step-content').offsetTop - 80, behavior: 'smooth' });
}

// --- Asset Inventory Functions ---

function ensureWealthPresetList(category) {
  const id = `wealth-presets-${category}`;
  if (document.getElementById(id)) return id;
  const list = document.createElement('datalist');
  list.id = id;
  (WEALTH_NAME_PRESETS[category] || []).forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    list.appendChild(option);
  });
  document.body.appendChild(list);
  return id;
}

function createWealthAssetControl(category, field, idx, value = '') {
  const selectOptions = {
    liquid: ['随时可用', '7天内', '1个月内', '1年以上', '其他'],
    usage: ['自住', '出租', '空置', '经营使用', '其他'],
    type: ['股票', '基金', '私募股权', '保险或年金', '其他'],
    risk: ['低', '中', '高', '待评估', '其他']
  };
  const isNameField = ['name', 'borrower', 'source'].includes(field);
  const isAmount = ['bookValue', 'marketValue', 'equity', 'amount'].includes(field);
  const isRate = ['fiveYearReturn', 'fiveYearGrowth', 'roe', 'rate', 'share'].includes(field);
  let control;

  if (selectOptions[field]) {
    control = document.createElement('select');
    control.className = 'form-input';
    const options = value && !selectOptions[field].includes(String(value))
      ? [...selectOptions[field], String(value)]
      : selectOptions[field];
    options.forEach(optionValue => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      control.appendChild(option);
    });
  } else {
    control = document.createElement('input');
    control.className = 'form-input';
    control.type = isAmount || isRate || field === 'term' ? 'number' : 'text';
    if (isAmount) {
      control.min = '0';
      control.step = '1';
      control.placeholder = '万元';
    } else if (isRate) {
      control.step = '0.1';
      control.min = field === 'share' ? '0' : '-100';
      control.max = field === 'share' ? '100' : '100';
      control.placeholder = '%';
    } else if (field === 'term') {
      control.min = '0';
      control.step = '1';
      control.placeholder = '年';
    } else {
      control.placeholder = field === 'location' ? '城市+区域' : '';
    }
    if (isNameField) control.setAttribute('list', ensureWealthPresetList(category));
  }

  control.style.cssText = 'padding:6px 10px;font-size:.85rem;min-width:80px;';
  control.dataset.cat = category;
  control.dataset.idx = idx;
  control.dataset.field = field;
  control.value = value || '';
  control.setAttribute('aria-label', `${category}-${field}`);
  control.addEventListener('change', persistAssetData);
  return control;
}

function addAssetRow(category) {
  const tbody = document.getElementById('tbl-' + category);
  if (!tbody) return;
  const row = document.createElement('tr');
  const fields = WEALTH_FIELD_MAPS[category];
  if (!fields) return;
  const idx = Date.now();
  fields.forEach(f => {
    const td = document.createElement('td');
    td.appendChild(createWealthAssetControl(category, f, idx));
    row.appendChild(td);
  });

  // Delete button
  const delTd = document.createElement('td');
  const delBtn = document.createElement('button');
  delBtn.textContent = '删除';
  delBtn.className = 'btn btn-sm btn-secondary';
  delBtn.style.cssText = 'padding:4px 10px;font-size:.8rem;';
  delBtn.onclick = function() {
    row.remove();
    persistAssetData();
  };
  delTd.appendChild(delBtn);
  row.appendChild(delTd);

  tbody.appendChild(row);
}

function persistAssetData() {
  Object.keys(WEALTH_FIELD_MAPS).forEach(cat => {
    const inputs = document.querySelectorAll(`#tbl-${cat} [data-cat="${cat}"]`);
    const rows = {};
    inputs.forEach(inp => {
      const idx = inp.dataset.idx;
      if (!rows[idx]) rows[idx] = {};
      rows[idx][inp.dataset.field] = inp.value;
    });
    AppState.assets[cat] = Object.values(rows).filter(r => Object.values(r).some(v => v));
  });

  saveState();
  updateRequiredReturnDisplay();
}

function renderAllAssetTables() {
  Object.keys(WEALTH_FIELD_MAPS).forEach(cat => {
    const tbody = document.getElementById('tbl-' + cat);
    if (!tbody) return;
    tbody.innerHTML = '';

    (AppState.assets[cat] || []).forEach(item => {
      const idx = Date.now() + Math.random();
      const row = document.createElement('tr');

      WEALTH_FIELD_MAPS[cat].forEach(f => {
        const td = document.createElement('td');
        td.appendChild(createWealthAssetControl(cat, f, idx, item[f] || ''));
        row.appendChild(td);
      });

      const delTd = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.textContent = '删除';
      delBtn.className = 'btn btn-sm btn-secondary';
      delBtn.style.cssText = 'padding:4px 10px;font-size:.8rem;';
      delBtn.onclick = () => { row.remove(); persistAssetData(); };
      delTd.appendChild(delBtn);
      row.appendChild(delTd);

      tbody.appendChild(row);
    });
  });

  updateRequiredReturnDisplay();
}

function updateWealthFlags() {
  AppState.flags.usage = document.getElementById('flag-usage')?.checked || false;
  AppState.flags.convenience = document.getElementById('flag-convenience')?.checked || false;
  AppState.flags.emotional = document.getElementById('flag-emotional')?.checked || false;
  saveState();
}

function saveWealthDraft() {
  persistAssetData();
  persistExpenses(false);
  saveState();
  alert('草稿已保存到本地浏览器存储');
}

// --- Required Return Rate (Step 2) ---

function getTotalBookValue() {
  return WealthModel.computeR1(AppState.assets).netAssets;
}

function computeWeightedReturn() {
  return WealthModel.computeR1(AppState.assets).rate;
}

function computeExpenseIRR() {
  return AppState.requiredReturn.computation?.r2?.rate ?? null;
}

function getRequiredRate() {
  const computed = AppState.requiredReturn.computation?.requiredRate;
  if (Number.isFinite(computed)) return computed;
  return Math.max(
    Number.isFinite(AppState.requiredReturn.r1) ? AppState.requiredReturn.r1 : 0,
    Number.isFinite(AppState.requiredReturn.r2) ? AppState.requiredReturn.r2 : 0,
    Number.isFinite(AppState.requiredReturn.r3) ? AppState.requiredReturn.r3 : 10
  );
}

function getM2Rate() {
  return Number.isFinite(AppState.requiredReturn.r3) ? AppState.requiredReturn.r3 : 10;
}

function r2StatusCopy(result) {
  const copies = {
    'no-expenses': '尚未录入有效刚性支出，R₂ 暂不参与取值。',
    'no-principal': '没有可投入本金，无法倒算；请增加本金或重新确认限制资产。',
    'capital-sufficient': '当前可投入本金已覆盖未折现支出，R₂ 的最低要求为 0%。',
    'above-limit': '在 100% 年化上限内仍无法覆盖支出，需要增加本金或降低刚性支出。'
  };
  if (result.status === 'solved') {
    return `${result.cashFlows.length} 个年度现金流，合计 ${fmtMoney(result.totalExpenses)}；按现值等于可投入本金倒算。`;
  }
  return copies[result.status] || '等待计算刚性支出倒算率。';
}

function updateRequiredReturnDisplay() {
  const m2Input = document.getElementById('m2-rate-input');
  const m2Value = Number.parseFloat(m2Input?.value);
  const m2Rate = Number.isFinite(m2Value) ? Math.max(0, m2Value) : (AppState.requiredReturn.r3 ?? 10);
  if (m2Input && !m2Input.value) m2Input.value = String(m2Rate);

  const principalInput = document.getElementById('investable-principal-input');
  const principalRaw = principalInput?.value?.trim() || '';
  const principalOverride = principalRaw === '' ? null : Number.parseFloat(principalRaw);
  const calculation = WealthModel.computeRequiredReturn(
    AppState.assets,
    AppState.expenses,
    m2Rate,
    principalOverride
  );

  AppState.requiredReturn.r1 = calculation.r1.rate;
  AppState.requiredReturn.r2 = calculation.r2.rate;
  AppState.requiredReturn.r3 = calculation.r3;
  AppState.requiredReturn.winner = calculation.winner;
  AppState.requiredReturn.computation = calculation;
  AppState.requiredReturn.principalOverride = Number.isFinite(principalOverride) ? principalOverride : null;

  const r1Display = document.getElementById('r1-display');
  const r2Display = document.getElementById('r2-display');
  const r3Display = document.getElementById('r3-display');
  const rReqDisplay = document.getElementById('r-required-display');
  if (r1Display) r1Display.textContent = Number.isFinite(calculation.r1.rate) ? fmtPct(calculation.r1.rate) : '--%';
  if (r2Display) r2Display.textContent = Number.isFinite(calculation.r2.rate) ? fmtPct(calculation.r2.rate) : '--%';
  if (r3Display) r3Display.textContent = fmtPct(calculation.r3);
  if (rReqDisplay) rReqDisplay.textContent = fmtPct(calculation.requiredRate);

  ['r1', 'r2', 'r3'].forEach(key => {
    document.getElementById(`${key}-card`)?.classList.toggle('is-winner', calculation.winner === key);
  });

  const r1Detail = document.getElementById('r1-detail');
  if (r1Detail) {
    r1Detail.textContent = `资产年收益 ${fmtMoney(calculation.r1.annualAssetIncome)} − 负债年成本 ${fmtMoney(calculation.r1.annualDebtCost)}，除以净资产 ${fmtMoney(calculation.r1.netAssets)}。`;
  }
  const r2Detail = document.getElementById('r2-detail');
  if (r2Detail) r2Detail.textContent = r2StatusCopy(calculation.r2);
  const principalDetail = document.getElementById('investable-principal-detail');
  if (principalDetail) {
    principalDetail.textContent = `净资产 ${fmtMoney(calculation.investable.netAssets)} − 自住房 ${fmtMoney(calculation.investable.excludedSelfUseRealEstate)} = 默认可投入本金 ${fmtMoney(calculation.investable.defaultPrincipal)}${calculation.investable.overridden ? `；本次采用手工调整值 ${fmtMoney(calculation.investable.principal)}` : ''}。`;
  }
  if (principalInput) principalInput.placeholder = Math.round(calculation.investable.defaultPrincipal).toLocaleString();
  const summary = document.getElementById('r-required-summary');
  if (summary) summary.textContent = `最终取 ${calculation.winnerLabel} ${fmtPct(calculation.requiredRate)}，因为它是三项有效结果中的最大值。`;
  const formula = document.getElementById('required-return-formula');
  if (formula) {
    const r2Text = Number.isFinite(calculation.r2.rate) ? fmtPct(calculation.r2.rate) : '未形成约束';
    formula.innerHTML = `<strong>R要求 = max（${Number.isFinite(calculation.r1.rate) ? fmtPct(calculation.r1.rate) : '无有效净资产'}，${r2Text}，${fmtPct(calculation.r3)}）= ${fmtPct(calculation.requiredRate)}</strong><span>取值来源：${calculation.winnerLabel}。R₂ 使用逐年现金流现值方程求解，不再用总额和平均年份近似。</span>`;
  }
  const breakdown = document.getElementById('r2-cashflow-breakdown');
  if (breakdown) {
    if (calculation.r2.cashFlows.length === 0) {
      breakdown.innerHTML = '';
    } else {
      const discountRate = Number.isFinite(calculation.r2.rate)
        ? calculation.r2.rate / 100
        : (calculation.r2.status === 'above-limit' ? calculation.r2.maxRate : 0);
      const rows = calculation.r2.cashFlows.map(flow => ({
        ...flow,
        presentValue: flow.amount / Math.pow(1 + discountRate, flow.year)
      }));
      breakdown.innerHTML = `<details open><summary>R₂ 逐年现金流与现值核对</summary><p class="wealth-cashflow-equation">P = Σ CFₜ ÷ (1 + R₂)ᵗ；本次采用本金 ${fmtMoney(calculation.investable.principal)}，${r2StatusCopy(calculation.r2)}</p><div class="table-wrap"><table><thead><tr><th>距今年份</th><th>名义刚性支出</th><th>按 R₂ 折现的现值</th></tr></thead><tbody>${rows.map(row => `<tr><td>第 ${row.year} 年</td><td>${fmtMoney(row.amount)}</td><td>${fmtMoney(row.presentValue)}</td></tr>`).join('')}</tbody><tfoot><tr><th>合计</th><th>${fmtMoney(calculation.r2.totalExpenses)}</th><th>${fmtMoney(rows.reduce((sum, row) => sum + row.presentValue, 0))}</th></tr></tfoot></table></div></details>`;
    }
  }
  saveState();
}

function computeRequiredReturn() {
  persistExpenses(false);
  updateRequiredReturnDisplay();
  showWealthToast('要求回报率已重新计算，并展开三路来源。');
}

function createExpenseInput(className, placeholder, type = 'text', value = '') {
  const input = document.createElement('input');
  input.className = `form-input ${className}`;
  input.placeholder = placeholder;
  input.type = type;
  input.value = value;
  if (type === 'number') {
    input.min = '0';
    input.step = '1';
  }
  input.addEventListener('change', () => {
    persistExpenses();
    updateRequiredReturnDisplay();
  });
  return input;
}

function addExpenseRow(data = {}, options = {}) {
  const container = document.getElementById('expense-list');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'wealth-expense-row';
  row.appendChild(createExpenseInput('expense-desc', '支出项目', 'text', data.description || data.desc || ''));
  row.appendChild(createExpenseInput('expense-amount', '每次金额（万元）', 'number', data.amount || ''));
  row.appendChild(createExpenseInput('expense-year', '首次发生（年）', 'number', data.firstYear || data.year || ''));
  const frequency = document.createElement('select');
  frequency.className = 'form-input expense-frequency';
  [['once', '一次性'], ['annual', '每年发生']].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    frequency.appendChild(option);
  });
  frequency.value = data.frequency === 'annual' ? 'annual' : 'once';
  const duration = createExpenseInput('expense-duration', '持续年数', 'number', data.duration || '1');
  duration.disabled = frequency.value !== 'annual';
  frequency.addEventListener('change', () => {
    duration.disabled = frequency.value !== 'annual';
    if (duration.disabled) duration.value = '1';
    persistExpenses();
    updateRequiredReturnDisplay();
  });
  row.appendChild(frequency);
  row.appendChild(duration);
  const delBtn = document.createElement('button');
  delBtn.textContent = '×';
  delBtn.className = 'wealth-expense-remove';
  delBtn.type = 'button';
  delBtn.setAttribute('aria-label', '删除这项未来支出');
  delBtn.onclick = () => {
    row.remove();
    persistExpenses();
    updateRequiredReturnDisplay();
  };
  row.appendChild(delBtn);
  container.appendChild(row);
  if (options.persist !== false) persistExpenses();
}

function persistExpenses(shouldSave = true) {
  AppState.expenses = Array.from(document.querySelectorAll('#expense-list .wealth-expense-row')).map(row => ({
    description: row.querySelector('.expense-desc')?.value?.trim() || '',
    amount: row.querySelector('.expense-amount')?.value || '',
    firstYear: row.querySelector('.expense-year')?.value || '',
    frequency: row.querySelector('.expense-frequency')?.value || 'once',
    duration: row.querySelector('.expense-duration')?.value || '1'
  })).filter(item => Object.values(item).some(value => value && value !== 'once' && value !== '1'));
  if (shouldSave) saveState();
}

function renderExpenseRows() {
  clearExpenseRows();
  const expenses = Array.isArray(AppState.expenses) ? AppState.expenses : [];
  if (expenses.length === 0) addExpenseRow({}, { persist: false });
  else expenses.forEach(expense => addExpenseRow(expense, { persist: false }));
}

function showWealthToast(message, isError = false) {
  document.querySelector('.wealth-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = `wealth-toast${isError ? ' is-error' : ''}`;
  toast.setAttribute('role', isError ? 'alert' : 'status');
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

// --- DCF Computation (Step 3) ---

function computeDCF() {
  updateRequiredReturnDisplay();
  const r = getRequiredRate() / 100;

  if (r <= 0 || r > 1) return;

  const catConfigs = [
    { cat: 'cash', valField: 'bookValue', retField: 'fiveYearReturn', label: '现金类', usage: false },
    { cat: 'realestate', valField: 'bookValue', retField: 'fiveYearGrowth', label: '不动产', usage: false },
    { cat: 'business', valField: 'equity', retField: 'roe', label: '企业股权', usage: false },
    { cat: 'financial', valField: 'marketValue', retField: 'fiveYearReturn', label: '金融资产', usage: false },
    { cat: 'loans', valField: 'amount', retField: 'rate', label: '对外放贷', usage: false }
  ];

  const T = 10; // 10-year assessment horizon

  let totalBook = 0;
  let totalPV = 0;

  const detailRows = [];

  catConfigs.forEach(({ cat, valField, retField, label }) => {
    let catBook = 0;
    let catPV = 0;

    (AppState.assets[cat] || []).forEach(item => {
      const bookVal = parseFloat(item[valField]) || 0;
      const assetReturn = (parseFloat(item[retField]) || 0) / 100;
      catBook += bookVal;

      if (bookVal > 0 && assetReturn > 0) {
        // Simplified DCF: PV = bookValue * (assetReturn/r) * (1 - 1/(1+r)^T) + bookValue/(1+r)^T
        // If the asset's rate is below r, its PV will be discounted
        const annualCF = bookVal * assetReturn;
        const pvCF = annualCF * (1 - Math.pow(1 + r, -T)) / r;
        const pvTerminal = bookVal / Math.pow(1 + r, T);
        catPV += pvCF + pvTerminal;
      } else {
        // If no return data, use book value with slight discount
        catPV += bookVal / Math.pow(1 + r, Math.min(T, 5));
      }
    });

    totalBook += catBook;
    totalPV += catPV;

    const destroyed = catBook - catPV;
    const pctOfTotal = totalBook > 0 ? (catBook / totalBook * 100) : 0;

    detailRows.push({
      label,
      bookVal: catBook,
      pv: catPV,
      destroyed,
      pctOfTotal,
      assessment: destroyed > catBook * 0.3 ? '严重损毁' :
                  destroyed > catBook * 0.1 ? '中度损毁' :
                  destroyed > 0 ? '轻微损毁' : '价值增进'
    });
  });

  // Debt
  let totalDebt = 0;
  (AppState.assets.debt || []).forEach(item => {
    const amt = parseFloat(item.amount) || 0;
    totalDebt += amt;
  });

  totalBook -= totalDebt;
  totalPV -= totalDebt; // Debt reduces both equally

  AppState.dcfResults = {
    totalBook,
    totalPV,
    discountRate: r * 100,
    horizonYears: T,
    detailRows,
    destroyed: totalBook - totalPV,
    discountPct: totalBook > 0 ? ((totalPV - totalBook) / totalBook * 100) : 0
  };

  renderStep3();

}

function renderStep3() {
  if (!AppState.dcfResults) return;

  const { totalBook, totalPV, destroyed, discountPct, detailRows, discountRate } = AppState.dcfResults;
  const currentR = Number.isFinite(AppState.requiredReturn.r1) ? AppState.requiredReturn.r1 : 0;
  const requiredR = getRequiredRate();

  // Update impact card - expanded with KPI inequality
  const impactEl = document.getElementById('wealth-impact');
  if (impactEl) {
    const kpiPassed = currentR >= requiredR;
    impactEl.className = kpiPassed ? 'card' : 'impact-card';
    impactEl.innerHTML = `
      <!-- KPI Inequality Banner -->
      <div style="text-align:center;padding:20px;border-radius:12px;margin-bottom:20px;background:${kpiPassed ? 'var(--green-light)' : 'var(--red-light)'};">
        <div style="font-size:1.6rem;font-weight:700;color:${kpiPassed ? 'var(--green)' : 'var(--red)'};margin-bottom:4px;">
          R<sub>身家</sub> ${fmtPct(currentR)} &nbsp;${kpiPassed ? '&ge;' : '&lt;'}&nbsp; R<sub>要求</sub> ${fmtPct(requiredR)}
        </div>
        <div style="font-size:.9rem;color:${kpiPassed ? 'var(--green)' : 'var(--red)'};">
          ${kpiPassed ? '整体身家回报率超过要求回报率，财富在真正增长' : '整体身家回报率低于要求回报率——你的财富在悄悄缩水'}
        </div>
        ${!kpiPassed ? '<div style="font-size:.8rem;color:var(--red);margin-top:4px;opacity:.8;">差距 ' + (requiredR - currentR).toFixed(1) + ' 个百分点，40年后财富差额可达数十倍</div>' : ''}
      </div>

      <div style="font-size:.9rem;color:var(--text-secondary);margin-bottom:16px;">账面净资产 vs 真实身家（中性单情景 · ${discountRate ? AppState.dcfResults.horizonYears : 10} 年评估期 · 以 ${fmtPct(requiredR)} 折现率衡量）</div>
      <div class="compare-2" style="gap:12px;grid-template-columns:1fr 1fr;">
        <div class="compare-col dim">
          <div class="label">账面净资产</div>
          <div class="number" style="font-size:2.4rem;">${fmtMoney(totalBook)}</div>
        </div>
        <div class="compare-col highlight">
          <div class="label">真实身家（现值）</div>
          <div class="number" style="font-size:2.4rem;">${fmtMoney(totalPV)}</div>
          <div style="color:${discountPct < -0.5 ? 'var(--red)' : discountPct > 0.5 ? 'var(--green)' : 'var(--text-secondary)'};font-weight:700;font-size:1.1rem;margin-top:4px;">
            ${discountPct < -0.5 ? '折价 ' + Math.abs(discountPct).toFixed(1) + '%' : discountPct > 0.5 ? '溢价 +' + discountPct.toFixed(1) + '%' : '基本持平'}
          </div>
        </div>
      </div>
      <p style="font-size:.85rem;color:var(--text-secondary);margin-top:12px;text-align:center;">
        差额：<strong style="color:var(--red);">${fmtMoney(destroyed)}</strong>
        ${currentR < requiredR ? '——你名义上有 ' + fmtMoney(totalBook) + '，但按合格富人的最低赚钱速度衡量，真实价值只有 ' + fmtMoney(totalPV) : ''}
      </p>
    `;
  }

  // Detail table
  const tbody = document.getElementById('detail-tbody');
  if (tbody) {
    tbody.innerHTML = detailRows.map(r => `
      <tr>
        <td style="font-weight:500;">${r.label}</td>
        <td>${fmtMoney(r.bookVal)}</td>
        <td>${fmtMoney(r.pv)}</td>
        <td style="color:${r.destroyed > 0 ? 'var(--red)' : 'var(--green)'};">${fmtMoney(r.destroyed)}</td>
        <td><span class="tag ${r.destroyed > r.bookVal * 0.1 ? 'tag-red' : r.destroyed > 0 ? 'tag-amber' : 'tag-green'}">${r.assessment}</span></td>
      </tr>
    `).join('');
  }

  // Render destruction chart
  renderDestructionChart(detailRows);
}

function renderDestructionChart(detailRows) {
  const canvas = document.getElementById('destructionChart');
  if (!canvas) return;

  if (canvas._chart) canvas._chart.destroy();

  const labels = detailRows.map(r => r.label);
  const data = detailRows.map(r => Math.max(0, r.destroyed));

  canvas._chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '价值损毁（万元）',
        data,
        backgroundColor: ['#f09595', '#f5c4b3', '#fcebeb', '#fef3e0', '#fcebeb'],
        borderColor: ['#a32d2d', '#d85a30', '#d4537e', '#ef9f27', '#ba7517'],
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => fmtMoney(ctx.raw)
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: '#f0ede5' },
          ticks: {
            callback: v => {
              if (v >= 10000) return (v / 10000).toFixed(1) + '亿';
              return Math.round(v) + '万';
            }
          }
        }
      }
    }
  });
}

// --- Growth Curve (Step 4) ---

function renderGrowthChart() {
  const canvas = document.getElementById('growthChart');
  if (!canvas) return;

  if (canvas._chart) canvas._chart.destroy();

  const totalBook = getTotalBookValue();
  updateRequiredReturnDisplay();
  const currentReturn = Number.isFinite(AppState.requiredReturn.r1) ? AppState.requiredReturn.r1 : 0;
  const requiredReturn = getRequiredRate();
  const m2Rate = getM2Rate();

  if (totalBook <= 0) return;

  const years = [0, 5, 10, 15, 20, 25, 30, 35, 40];
  const pv = totalBook;

  const currentLine = years.map(y => pv * Math.pow(1 + currentReturn / 100, y));
  const requiredLine = years.map(y => pv * Math.pow(1 + requiredReturn / 100, y));
  const m2Line = years.map(y => pv * Math.pow(1 + m2Rate / 100, y));

  canvas._chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: years.map(y => y === 0 ? '当前' : y + '年'),
      datasets: [
        {
          label: '当前结构 (' + fmtPct(currentReturn) + ')',
          data: currentLine,
          borderColor: '#a32d2d',
          backgroundColor: 'rgba(163,45,45,.08)',
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: false,
          tension: 0.3
        },
        {
          label: '要求回报率 (' + fmtPct(requiredReturn) + ')',
          data: requiredLine,
          borderColor: '#d4af37',
          backgroundColor: 'rgba(212,175,55,.08)',
          borderWidth: 3,
          borderDash: [],
          pointRadius: 4,
          fill: false,
          tension: 0.3
        },
        {
          label: 'M2购买力 (' + fmtPct(m2Rate) + ')',
          data: m2Line,
          borderColor: '#b4b2a9',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 3,
          fill: false,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.label + ': ' + fmtMoney(ctx.raw)
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: '#f0ede5' },
          ticks: {
            callback: v => {
              if (v >= 10000) return (v / 10000).toFixed(1) + '亿';
              return Math.round(v) + '万';
            }
          }
        }
      }
    }
  });

  // Fill growth table
  const tbody = document.getElementById('growth-table-body');
  if (tbody) {
    const keyYears = [0, 5, 10, 15, 20, 40];
    const keyIdx = keyYears.map(y => years.indexOf(y));

    tbody.innerHTML = keyYears.map((y, i) => {
      const idx = keyIdx[i];
      const diff = requiredLine[idx] - currentLine[idx];
      return `
        <tr>
          <td style="font-weight:500;">${y === 0 ? '当前' : y + '年后'}</td>
          <td>${fmtMoney(currentLine[idx])}</td>
          <td>${fmtMoney(requiredLine[idx])}</td>
          <td>${fmtMoney(m2Line[idx])}</td>
          <td style="color:${diff > 0 ? 'var(--red)' : 'var(--green)'};font-weight:600;">${fmtMoney(diff)}</td>
        </tr>
      `;
    }).join('');
  }
}

// --- Action Suggestions (Step 5) ---

function escapeWealthHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function buildActionRecommendations() {
  const requiredReturn = getRequiredRate();
  const currentReturn = Number.isFinite(AppState.requiredReturn.r1) ? AppState.requiredReturn.r1 : 0;
  const r1 = WealthModel.computeR1(AppState.assets);
  const recommendations = [];
  const add = (priority, title, evidence, action, caveat) => recommendations.push({ priority, title, evidence, action, caveat });

  const cashTotal = (AppState.assets.cash || []).reduce((sum, item) => sum + (parseFloat(item.bookValue) || 0), 0);
  if (cashTotal > 0) {
    const cashIncome = (AppState.assets.cash || []).reduce((sum, item) => sum + (parseFloat(item.bookValue) || 0) * (parseFloat(item.fiveYearReturn) || 0) / 100, 0);
    const cashRate = cashTotal > 0 ? cashIncome / cashTotal * 100 : 0;
    if (cashRate < requiredReturn) {
      add('中', '核定流动性缓冲，识别冗余现金', `现金类约 ${fmtMoney(cashTotal)}，年化回报率约 ${fmtPct(cashRate)}，低于要求回报率 ${fmtPct(requiredReturn)}。`, '先核定未来 6–12 个月的刚性支出与应急资金，再对超过缓冲的现金做长期配置复核。', '不得以追求收益为由牺牲短期支付能力。');
    }
  }

  (AppState.assets.realestate || []).forEach(item => {
    const name = item.name || '未命名不动产';
    const value = parseFloat(item.bookValue) || 0;
    const rate = parseFloat(item.fiveYearGrowth) || 0;
    const usage = String(item.usage || '待确认');
    if (usage.includes('自住') || usage.includes('自用')) {
      add('观察', `保护自住房：${name}`, `账面值 ${fmtMoney(value)}，用途为自住；该部分已从可投入本金中剔除。`, '保持居住保障属性，仅纳入总身家和风险隔离审视，不以提高回报率为由自动建议出售。', '如存在高额按揭，仍需结合负债成本单独评估。');
    } else if (usage.includes('空置') || rate < requiredReturn) {
      add(usage.includes('空置') || rate < 0 ? '高' : '中', `复核低效不动产：${name}`, `用途为${usage}，账面值 ${fmtMoney(value)}，年化增值率 ${fmtPct(rate)}。`, '核验出租率、持有成本、税费与可变现性，形成“继续持有、改善运营或退出评估”的顾问复核清单。', '系统不直接给出出售时点或价格。');
    }
  });

  (AppState.assets.business || []).forEach(item => {
    const name = item.name || '未命名企业股权';
    const value = parseFloat(item.equity) || 0;
    const rate = parseFloat(item.roe) || 0;
    if (rate < 0) {
      add('高', `停止无依据追加投入：${name}`, `权益值 ${fmtMoney(value)}，年化 ROE ${fmtPct(rate)}，当前处于价值损耗状态。`, '先完成企业价值诊断、现金流与行业前景复核，再决定修复、收缩或退出方向。', '退出属于重大决策，必须由企业、税务和法律顾问共同审核。');
    } else if (rate < requiredReturn) {
      add('中', `启动企业价值增进复核：${name}`, `权益值 ${fmtMoney(value)}，年化 ROE ${fmtPct(rate)}，低于要求回报率 ${fmtPct(requiredReturn)}。`, '从定位、增长、资本占用和分红能力四方面识别提升路径，并评估是否减少继续投入。', '未完成经营质量复核前，不把企业简单归类为应退出资产。');
    } else {
      add('观察', `保持优质经营资产治理：${name}`, `年化 ROE ${fmtPct(rate)}，达到当前要求回报率。`, '持续跟踪经营现金流、治理和分红，将可分配利润与家族其他资产做风险隔离。', '达到回报要求不代表可以忽略集中度风险。');
    }
  });

  (AppState.assets.loans || []).forEach(item => {
    const name = item.borrower || '未命名对外放贷';
    const amount = parseFloat(item.amount) || 0;
    const rate = parseFloat(item.rate) || 0;
    const risk = String(item.risk || '待评估');
    if (risk === '高' || rate < requiredReturn) {
      add(risk === '高' ? '高' : '中', `复核对外放贷：${name}`, `本金 ${fmtMoney(amount)}，年利率 ${fmtPct(rate)}，风险等级${risk}。`, '核验担保、回款来源和到期日；对风险收益不匹配的借款制定回收与止新增计划。', '不得仅凭利率高低判断本金安全。');
    }
  });

  (AppState.assets.debt || []).forEach(item => {
    const name = item.source || '未命名负债';
    const amount = parseFloat(item.amount) || 0;
    const rate = parseFloat(item.rate) || 0;
    if (rate >= requiredReturn) {
      add('高', `优先处理高成本负债：${name}`, `余额 ${fmtMoney(amount)}，年利率 ${fmtPct(rate)}，不低于要求回报率。`, '优先评估再融资、降低利率或有序偿还，减少对净身家回报的持续拖累。', '偿还后仍需保留覆盖刚性支出的流动性缓冲。');
    } else {
      add('观察', `保留低成本融资弹性：${name}`, `余额 ${fmtMoney(amount)}，年利率 ${fmtPct(rate)}，低于要求回报率 ${fmtPct(requiredReturn)}。`, '不机械提前偿还，先比较资金用途、期限匹配和流动性安全。', '只有在替代用途风险可控时，利差比较才有意义。');
    }
  });

  WealthModel.ASSET_CONFIGS.forEach(config => {
    const categoryValue = (AppState.assets[config.cat] || []).reduce((sum, item) => sum + (parseFloat(item[config.value]) || 0), 0);
    if (r1.grossAssets > 0 && categoryValue / r1.grossAssets >= 0.5) {
      add('中', `降低${config.label}单类集中风险`, `${config.label}占总资产约 ${(categoryValue / r1.grossAssets * 100).toFixed(1)}%。`, '设置年度集中度复核，评估经营、地域、发行人和流动性是否形成单点脆弱性。', '分散化不是平均分配，应结合能力圈与资产属性。');
    }
  });

  if (AppState.flags.usage) add('中', '提高闲置资产使用效率', '已勾选“资产使用率低/闲置”。', '逐项记录闲置原因、持有成本和激活条件，优先处理没有战略用途的长期闲置资产。', '情感与家族用途需单独标注，不与纯财务资产混算。');
  if (AppState.flags.convenience) add('中', '量化便利性成本', '已勾选“为便利牺牲回报”。', '把便利性带来的收益损失显性化，确认家族愿意支付的年度成本上限。', '便利性本身可能有价值，目标是知情选择而非一律取消。');
  if (AppState.flags.emotional) add('观察', '区分情感资产与投资资产', '已勾选“情感绑定难变现”。', '单独列示情感价值、继承意愿和不可出售限制，避免用纯投资回报口径误判。', '情感资产仍需纳入维护成本和传承安排。');

  if (recommendations.length === 0) {
    add('观察', '保持年度身家体检', `当前身家净回报率 ${fmtPct(currentReturn)}，要求回报率 ${fmtPct(requiredReturn)}。`, '每季度快速复核资产与负债变化，每年完整重做一次诊断。', '重大企业、家庭或资产事件发生后应立即复检。');
  }

  const order = { '高': 0, '中': 1, '观察': 2 };
  return recommendations.sort((a, b) => order[a.priority] - order[b.priority]);
}

function generateActionSuggestions() {
  updateRequiredReturnDisplay();
  if (!AppState.dcfResults) computeDCF();
  const container = document.getElementById('action-suggestions');
  if (!container) return;
  const currentReturn = Number.isFinite(AppState.requiredReturn.r1) ? AppState.requiredReturn.r1 : 0;
  const requiredReturn = getRequiredRate();
  const recommendations = buildActionRecommendations();
  container.innerHTML = `
    <div class="alert ${currentReturn >= requiredReturn ? 'alert-info' : 'alert-danger'}" style="margin-bottom:20px;">
      <strong>诊断目标：</strong>当前身家净回报率 ${fmtPct(currentReturn)}，要求回报率 ${fmtPct(requiredReturn)}。以下建议按证据与紧迫度排序，不再使用没有资产依据的“+3/+6个百分点”假设。
    </div>
    <div class="wealth-recommendation-list">
      ${recommendations.map(item => `
        <article class="wealth-recommendation">
          <span class="wealth-recommendation-priority wealth-priority-${item.priority === '高' ? 'high' : item.priority === '中' ? 'medium' : 'watch'}">${escapeWealthHTML(item.priority)}优先级</span>
          <div><h5>${escapeWealthHTML(item.title)}</h5><p><strong>证据：</strong>${escapeWealthHTML(item.evidence)}</p><p><strong>行动：</strong>${escapeWealthHTML(item.action)}</p><p><strong>边界：</strong>${escapeWealthHTML(item.caveat)}</p></div>
        </article>
      `).join('')}
    </div>`;
}

window.buildWealthActionRecommendations = buildActionRecommendations;


// Export button click handler
async function exportWealthReportHandler() {
  persistAssetData();
  persistExpenses(false);
  updateRequiredReturnDisplay();
  computeDCF();
  generateActionSuggestions();
  const button = document.querySelector('[onclick="exportWealthReportHandler()"]');
  const originalText = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = '正在生成诊断报告…';
  }
  try {
    const success = await exportWealthReport();
    if (success) showWealthToast('身家诊断报告已生成并开始下载。');
  } catch (error) {
    console.error('Wealth report export failed:', error);
    showWealthToast(`报告生成失败：${error.message}`, true);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}
