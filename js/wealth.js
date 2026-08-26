/**
 * wealth.js — 身家诊断五步向导
 */

// Load saved state on page init
const WEALTH_SAMPLE_ASSETS = {
  cash: [
    { name: 'XX银行活期及现金管理', bookValue: '202', fiveYearReturn: '0', liquid: '5000' },
    { name: 'XX银行三年期大额存单', bookValue: '102', fiveYearReturn: '2', liquid: '32' },
    { name: '货币基金及短期理财', bookValue: '1293', fiveYearReturn: '2', liquid: '1000' }
  ],
  realestate: [
    { name: '深圳湾住宅', location: '深圳南山区', bookValue: '33209', fiveYearGrowth: '0.7', usage: '自用' },
    { name: '前海投资公寓', location: '深圳前海', bookValue: '49027', fiveYearGrowth: '-1.5', usage: '投资' },
    { name: '上海陆家嘴住宅', location: '上海浦东新区', bookValue: '209', fiveYearGrowth: '103', usage: '出租' },
    { name: '杭州未来科技城住宅', location: '杭州余杭区', bookValue: '502', fiveYearGrowth: '191', usage: '自用' },
    { name: '惠州临海度假住宅', location: '惠州惠东县', bookValue: '540', fiveYearGrowth: '10.2', usage: '出租' },
    { name: '东莞产业园办公室物业', location: '东莞松山湖', bookValue: '1000', fiveYearGrowth: '5', usage: '自用/出租' }
  ],
  business: [
    { name: '深圳XX科技有限公司', share: '210', equity: '23', roe: '3' },
    { name: 'XXX投资管理有限公司', share: '23', equity: '20123', roe: '26' },
    { name: '杭州XX数据有限公司', share: '1', equity: '23091', roe: '-8.5' }
  ],
  financial: [
    { name: 'XX中国成长基金份额', marketValue: '1203', fiveYearReturn: '23', type: 'VC' },
    { name: 'XXX指数基金组合', marketValue: '10280', fiveYearReturn: '3', type: '基金' }
  ],
  loans: [
    { borrower: '核心合作企业周转借款', amount: '9200', rate: '3', risk: '低' },
    { borrower: '朋友创业项目过桥借款', amount: '2005', rate: '1', risk: '高' }
  ],
  debt: [
    { source: '深圳湾住宅按揭贷款', amount: '10211', rate: '10', term: '10' },
    { source: '企业经营性信用贷款', amount: '120', rate: '313', term: '5' }
  ]
};

function setupWealthIntro() {
  // Restore saved asset tables
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
}

function loadWealthSampleData() {
  AppState.assets = JSON.parse(JSON.stringify(WEALTH_SAMPLE_ASSETS));
  AppState.flags = { usage: false, convenience: false, emotional: false };
  AppState.dcfResults = null;
  AppState.wealthStep = 1;

  clearExpenseRows();
  addExpenseRow();
  addExpenseRow();

  const expenseRows = document.querySelectorAll('#expense-list .form-row');
  if (expenseRows[0]) {
    expenseRows[0].querySelector('.expense-desc').value = '传承税及家族管理费';
    expenseRows[0].querySelector('.expense-amount').value = '3500';
    expenseRows[0].querySelector('.expense-year').value = '3';
  }
  if (expenseRows[1]) {
    expenseRows[1].querySelector('.expense-desc').value = '未来家庭教育与医疗支出';
    expenseRows[1].querySelector('.expense-amount').value = '1800';
    expenseRows[1].querySelector('.expense-year').value = '5';
  }

  document.getElementById('flag-usage').checked = false;
  document.getElementById('flag-convenience').checked = false;
  document.getElementById('flag-emotional').checked = false;

  renderAllAssetTables();
  goToStep(1);
  updateRequiredReturnDisplay();

  alert('样本案例已加载，您可以继续浏览身家诊断完整流程。');
}

function clearExpenseRows() {
  document.querySelectorAll('#expense-list .form-row').forEach(row => row.remove());
}

function clearWealthAssets() {
  AppState.assets = {
    cash: [], realestate: [], business: [], financial: [], loans: [], debt: []
  };
  AppState.flags = { usage: false, convenience: false, emotional: false };
  AppState.requiredReturn = { r1: null, r2: null, r3: 10 };
  AppState.dcfResults = null;
  clearExpenseRows();

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

function addAssetRow(category) {
  const tbody = document.getElementById('tbl-' + category);
  if (!tbody) return;

  const row = document.createElement('tr');
  let fields;

  switch (category) {
    case 'cash':
      fields = ['name', 'bookValue', 'fiveYearReturn', 'liquid'];
      break;
    case 'realestate':
      fields = ['name', 'location', 'bookValue', 'fiveYearGrowth', 'usage'];
      break;
    case 'business':
      fields = ['name', 'share', 'equity', 'roe'];
      break;
    case 'financial':
      fields = ['name', 'marketValue', 'fiveYearReturn', 'type'];
      break;
    case 'loans':
      fields = ['borrower', 'amount', 'rate', 'risk'];
      break;
    case 'debt':
      fields = ['source', 'amount', 'rate', 'term'];
      break;
    default:
      return;
  }

  const idx = Date.now();

  fields.forEach(f => {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.className = 'form-input';
    input.style.cssText = 'padding:6px 10px;font-size:.85rem;min-width:80px;';
    input.dataset.cat = category;
    input.dataset.idx = idx;
    input.dataset.field = f;
    if (f === 'bookValue' || f === 'marketValue' || f === 'equity' || f === 'amount') {
      input.type = 'number';
      input.placeholder = '万元';
    } else if (f === 'fiveYearReturn' || f === 'fiveYearGrowth' || f === 'roe' || f === 'rate' || f === 'share') {
      input.type = 'number';
      input.placeholder = '%';
      input.step = '0.1';
    } else {
      input.type = 'text';
      input.placeholder = f === 'location' ? '城市+区域' : f === 'usage' ? '自用/出租' : f === 'type' ? '股票/基金/VC' : f === 'risk' ? '低/中/高' : '';
    }
    input.addEventListener('change', persistAssetData);
    td.appendChild(input);
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
  // Collect all asset data from tables
  const categories = ['cash', 'realestate', 'business', 'financial', 'loans', 'debt'];
  const fieldMaps = {
    cash: ['name', 'bookValue', 'fiveYearReturn', 'liquid'],
    realestate: ['name', 'location', 'bookValue', 'fiveYearGrowth', 'usage'],
    business: ['name', 'share', 'equity', 'roe'],
    financial: ['name', 'marketValue', 'fiveYearReturn', 'type'],
    loans: ['borrower', 'amount', 'rate', 'risk'],
    debt: ['source', 'amount', 'rate', 'term']
  };

  categories.forEach(cat => {
    const inputs = document.querySelectorAll(`#tbl-${cat} input[data-cat="${cat}"]`);
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
  const fieldMaps = {
    cash: ['name', 'bookValue', 'fiveYearReturn', 'liquid'],
    realestate: ['name', 'location', 'bookValue', 'fiveYearGrowth', 'usage'],
    business: ['name', 'share', 'equity', 'roe'],
    financial: ['name', 'marketValue', 'fiveYearReturn', 'type'],
    loans: ['borrower', 'amount', 'rate', 'risk'],
    debt: ['source', 'amount', 'rate', 'term']
  };

  Object.keys(fieldMaps).forEach(cat => {
    const tbody = document.getElementById('tbl-' + cat);
    if (!tbody) return;
    tbody.innerHTML = '';

    (AppState.assets[cat] || []).forEach(item => {
      const idx = Date.now() + Math.random();
      const row = document.createElement('tr');

      fieldMaps[cat].forEach(f => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.className = 'form-input';
        input.style.cssText = 'padding:6px 10px;font-size:.85rem;min-width:80px;';
        input.dataset.cat = cat;
        input.dataset.idx = idx;
        input.dataset.field = f;
        input.value = item[f] || '';
        input.addEventListener('change', persistAssetData);
        td.appendChild(input);
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
  saveState();
  alert('草稿已保存到本地浏览器存储');
}

// --- Required Return Rate (Step 2) ---

function getTotalBookValue() {
  let total = 0;
  const catValueFields = {
    cash: 'bookValue', realestate: 'bookValue', business: 'equity',
    financial: 'marketValue', loans: 'amount'
  };

  Object.entries(catValueFields).forEach(([cat, field]) => {
    (AppState.assets[cat] || []).forEach(item => {
      const v = parseFloat(item[field]);
      if (!isNaN(v)) total += v;
    });
  });

  // Subtract debt
  (AppState.assets.debt || []).forEach(item => {
    const v = parseFloat(item.amount);
    if (!isNaN(v)) total -= v;
  });

  return total;
}

function computeWeightedReturn() {
  let totalValue = 0;
  let weightedReturn = 0;
  const catConfigs = [
    { cat: 'cash', valField: 'bookValue', retField: 'fiveYearReturn' },
    { cat: 'realestate', valField: 'bookValue', retField: 'fiveYearGrowth' },
    { cat: 'business', valField: 'equity', retField: 'roe' },
    { cat: 'financial', valField: 'marketValue', retField: 'fiveYearReturn' },
    { cat: 'loans', valField: 'amount', retField: 'rate' }
  ];

  catConfigs.forEach(({ cat, valField, retField }) => {
    (AppState.assets[cat] || []).forEach(item => {
      const val = parseFloat(item[valField]) || 0;
      const ret = parseFloat(item[retField]) || 0;
      totalValue += val;
      weightedReturn += val * ret;
    });
  });

  // Debt is negative value, reduces the denominator
  (AppState.assets.debt || []).forEach(item => {
    const val = parseFloat(item.amount) || 0;
    totalValue -= val;
  });

  return totalValue > 0 ? (weightedReturn / totalValue) : 0;
}

function computeExpenseIRR() {
  const expenseDescs = document.querySelectorAll('.expense-desc');
  const expenseAmounts = document.querySelectorAll('.expense-amount');
  const expenseYears = document.querySelectorAll('.expense-year');

  const totalBook = getTotalBookValue();
  if (totalBook <= 0) return null;

  // Simple approach: compute total PV of expenses at different rates
  // Find rate where total PV of expenses = total book value
  let totalExpenses = 0;
  let weightedYear = 0;
  let count = 0;

  for (let i = 0; i < expenseDescs.length; i++) {
    const desc = expenseDescs[i].value.trim();
    const amount = parseFloat(expenseAmounts[i].value);
    const year = parseFloat(expenseYears[i].value);
    if (desc && !isNaN(amount) && !isNaN(year) && year > 0) {
      totalExpenses += amount;
      weightedYear += year * amount;
      count++;
    }
  }

  if (count === 0 || totalExpenses <= 0) return null;

  // Average year weighted by amount
  const avgYear = weightedYear / totalExpenses;

  // Simplified: R2 = (TotalExpenses / BookValue)^(1/avgYear) - 1
  const ratio = totalExpenses / totalBook;
  if (ratio <= 0 || avgYear <= 0) return null;

  const irr = (Math.pow(ratio, 1 / avgYear) - 1) * 100;
  return Math.max(0, Math.min(50, irr));
}

function updateRequiredReturnDisplay() {
  const r1 = computeWeightedReturn();
  AppState.requiredReturn.r1 = r1 > 0 ? r1 : null;

  const irr = computeExpenseIRR();
  AppState.requiredReturn.r2 = irr;

  const r1Display = document.getElementById('r1-display');
  if (r1Display) r1Display.textContent = r1 > 0 ? fmtPct(r1) : '--%';

  const rRequired = Math.max(
    r1 || 0,
    irr || 0,
    AppState.requiredReturn.r3 || 10
  );

  const rReqDisplay = document.getElementById('r-required-display');
  if (rReqDisplay) rReqDisplay.textContent = fmtPct(rRequired);

  saveState();
}

function computeRequiredReturn() {
  updateRequiredReturnDisplay();
}

function addExpenseRow() {
  const container = document.getElementById('expense-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'form-row';
  row.style.marginBottom = '8px';

  ['支出项目', '金额（万元）', '距今N年'].forEach((placeholder, i) => {
    const input = document.createElement('input');
    input.className = 'form-input ' + ['expense-desc', 'expense-amount', 'expense-year'][i];
    input.placeholder = placeholder;
    if (i > 0) input.type = 'number';
    row.appendChild(input);
  });

  const delBtn = document.createElement('button');
  delBtn.textContent = '×';
  delBtn.style.cssText = 'background:none;border:none;color:var(--red);cursor:pointer;font-size:1.2rem;';
  delBtn.onclick = () => row.remove();
  row.appendChild(delBtn);

  container.appendChild(row);
}

// --- DCF Computation (Step 3) ---

function computeDCF() {
  const r = Math.max(
    AppState.requiredReturn.r1 || 0,
    AppState.requiredReturn.r2 || 0,
    AppState.requiredReturn.r3 || 10
  ) / 100;

  if (r <= 0 || r > 0.5) return;

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
    detailRows,
    destroyed: totalBook - totalPV,
    discountPct: totalBook > 0 ? ((totalPV - totalBook) / totalBook * 100) : 0
  };

  renderStep3();

}

function renderStep3() {
  if (!AppState.dcfResults) return;

  const { totalBook, totalPV, destroyed, discountPct, detailRows, discountRate } = AppState.dcfResults;
  const currentR = AppState.requiredReturn.r1 || 0;
  const requiredR = Math.max(AppState.requiredReturn.r1 || 0, AppState.requiredReturn.r2 || 0, AppState.requiredReturn.r3 || 10);

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

      <div style="font-size:.9rem;color:var(--text-secondary);margin-bottom:16px;">账面净资产 vs 真实身家（以 ${fmtPct(requiredR)} 折现率衡量）</div>
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
  const currentReturn = AppState.requiredReturn.r1 || 3;
  const requiredReturn = Math.max(
    AppState.requiredReturn.r1 || 0,
    AppState.requiredReturn.r2 || 0,
    AppState.requiredReturn.r3 || 10
  );
  const m2Rate = 10;

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

function generateActionSuggestions() {
  const totalBook = getTotalBookValue();
  const currentReturn = AppState.requiredReturn.r1 || 3;
  const requiredReturn = Math.max(
    AppState.requiredReturn.r1 || 0,
    AppState.requiredReturn.r2 || 0,
    AppState.requiredReturn.r3 || 10
  );

  // Sort categories by destruction amount
  const catConfigs = [
    { cat: 'cash', valField: 'bookValue', retField: 'fiveYearReturn', label: '现金类' },
    { cat: 'realestate', valField: 'bookValue', retField: 'fiveYearGrowth', label: '不动产' },
    { cat: 'business', valField: 'equity', retField: 'roe', label: '企业股权' },
    { cat: 'financial', valField: 'marketValue', retField: 'fiveYearReturn', label: '金融资产' },
    { cat: 'loans', valField: 'amount', retField: 'rate', label: '对外放贷' }
  ];

  const r = requiredReturn / 100;
  const T = 10;
  const categories = [];

  catConfigs.forEach(({ cat, valField, retField, label }) => {
    let book = 0, pv = 0;
    (AppState.assets[cat] || []).forEach(item => {
      const bv = parseFloat(item[valField]) || 0;
      const assetRet = (parseFloat(item[retField]) || 0) / 100;
      book += bv;
      if (bv > 0 && assetRet > 0) {
        pv += bv * assetRet * (1 - Math.pow(1 + r, -T)) / r + bv / Math.pow(1 + r, T);
      } else {
        pv += bv / Math.pow(1 + r, Math.min(T, 5));
      }
    });
    categories.push({ label, book, pv, destroyed: book - pv, avgReturn: book > 0 ? (pv / book > 0.01 ? assetRetForCat(cat) : 0) : 0 });
  });

  categories.sort((a, b) => b.destroyed - a.destroyed);

  // Build suggestions HTML
  const container = document.getElementById('action-suggestions');
  if (!container) return;

  let suggestionsHTML = `
    <div class="alert alert-danger" style="margin-bottom:20px;">
      <strong>核心策略：</strong>让整体身家加权年化回报率（当前 ${fmtPct(currentReturn)}）超过要求回报率（${fmtPct(requiredReturn)}）。找出损毁身家最多的资产，逐一给出调整方案。
    </div>
  `;

  categories.forEach((cat, i) => {
    if (cat.destroyed <= 0 || cat.book <= 0) return;
    const pctDestroyed = (cat.destroyed / cat.book * 100).toFixed(1);

    let suggestion = '';
    if (cat.label === '现金类') {
      suggestion = '大量现金以低利率存放，每年隐性损毁巨大。建议在保证6-12个月生活开支的前提下，将冗余现金逐步转入更高回报的长期资产配置。';
    } else if (cat.label === '企业股权') {
      suggestion = '企业回报率低于要求回报率，且增长空间有限。建议将企业视为"现金奶牛"，减少额外资本投入，将每年产生的现金流分散配置到更高回报的资产中。如企业有战略增长潜力，建议启动"企业价值诊断"模块的线②"战略增进"寻找做大R/G/S的具体路径。';
    } else if (cat.label === '对外放贷') {
      suggestion = '民间借贷风险回报严重不对称——收有限利息却承担本金损失风险。建议尽快收回本金，未来慎重发放个人对外贷款。';
    } else {
      suggestion = '该资产类别整体回报率低于要求回报率。建议逐项审视各资产，考虑替换为更高回报的配置方案。';
    }

    suggestionsHTML += `
      <div class="card card-sm" style="margin-bottom:16px;">
        <h4 style="color:var(--red);margin-bottom:8px;">建议${i + 1}：优化${cat.label}配置</h4>
        <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:8px;">
          <strong>现状：</strong>${cat.label}资产约 ${fmtMoney(cat.book)}，整体损毁约 ${fmtMoney(cat.destroyed)}（${pctDestroyed}%）。
        </p>
        <p style="font-size:.85rem;color:var(--text-secondary);line-height:1.8;">${suggestion}</p>
      </div>
    `;
  });

  // Risk management suggestion
  suggestionsHTML += `
    <div class="card card-sm" style="margin-bottom:16px;border-left:4px solid var(--accent);">
      <h4 style="margin-bottom:8px;">风险管理建议</h4>
      <ul style="font-size:.85rem;color:var(--text-secondary);line-height:2;padding-left:20px;">
        <li><strong>家族信托架构</strong>：隔离企业经营风险对家族财富的冲击</li>
        <li><strong>资本久期匹配</strong>：长短期资本与需求端匹配，长期资本追求长期高收益</li>
        <li><strong>资产分散化</strong>：从单一行业/单一企业 → 多元化股权配置</li>
        <li><strong>定期体检</strong>：建议年度完整复检，季度快速检视。重大资产变动后立即复检</li>
      </ul>
    </div>
  `;

  container.innerHTML = suggestionsHTML;

  // Update plan comparison table
  const pv = totalBook;
  const planAReturn = Math.min(currentReturn + 3, requiredReturn + 1);
  const planBReturn = Math.min(currentReturn + 6, requiredReturn + 3);

  document.getElementById('plan-current-r').textContent = fmtPct(currentReturn);
  document.getElementById('plan-a-r').textContent = fmtPct(planAReturn);
  document.getElementById('plan-b-r').textContent = fmtPct(planBReturn);

  [10, 20, 40].forEach(y => {
    const currFV = totalBook * Math.pow(1 + currentReturn / 100, y);
    const aFV = totalBook * Math.pow(1 + planAReturn / 100, y);
    const bFV = totalBook * Math.pow(1 + planBReturn / 100, y);

    const currEl = document.getElementById(`plan-current-${y}y`);
    const aEl = document.getElementById(`plan-a-${y}y`);
    const bEl = document.getElementById(`plan-b-${y}y`);

    if (currEl) currEl.textContent = fmtMoney(currFV);
    if (aEl) aEl.textContent = fmtMoney(aFV);
    if (bEl) bEl.textContent = fmtMoney(bFV);

    if (y === 40) {
      const deltaA = document.getElementById('plan-a-delta');
      const deltaB = document.getElementById('plan-b-delta');
      if (deltaA) deltaA.textContent = '+' + fmtMoney(aFV - currFV);
      if (deltaB) deltaB.textContent = '+' + fmtMoney(bFV - currFV);
    }
  });
}

function assetRetForCat(cat) {
  const fields = {
    cash: 'fiveYearReturn', realestate: 'fiveYearGrowth',
    business: 'roe', financial: 'fiveYearReturn', loans: 'rate'
  };
  const field = fields[cat];
  if (!field) return 0;
  const assets = AppState.assets[cat] || [];
  if (assets.length === 0) return 0;
  return assets.reduce((sum, a) => sum + (parseFloat(a[field]) || 0), 0) / assets.length;
}


// Export button click handler
function exportWealthReportHandler() {
  exportWealthReport();
}
