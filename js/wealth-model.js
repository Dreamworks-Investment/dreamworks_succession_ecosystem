(function (root) {
  'use strict';

  const ASSET_CONFIGS = [
    { cat: 'cash', value: 'bookValue', rate: 'fiveYearReturn', label: '现金类' },
    { cat: 'realestate', value: 'bookValue', rate: 'fiveYearGrowth', label: '不动产' },
    { cat: 'business', value: 'equity', rate: 'roe', label: '企业股权' },
    { cat: 'financial', value: 'marketValue', rate: 'fiveYearReturn', label: '金融资产' },
    { cat: 'loans', value: 'amount', rate: 'rate', label: '对外放贷' }
  ];

  function number(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function sum(items, getter) {
    return (items || []).reduce((total, item) => total + getter(item), 0);
  }

  function computeR1(assets) {
    let grossAssets = 0;
    let annualAssetIncome = 0;

    ASSET_CONFIGS.forEach(config => {
      (assets?.[config.cat] || []).forEach(item => {
        const value = Math.max(0, number(item[config.value]));
        const rate = number(item[config.rate]);
        grossAssets += value;
        annualAssetIncome += value * rate / 100;
      });
    });

    const debtBalance = sum(assets?.debt, item => Math.max(0, number(item.amount)));
    const annualDebtCost = sum(assets?.debt, item => {
      return Math.max(0, number(item.amount)) * Math.max(0, number(item.rate)) / 100;
    });
    const netAssets = grossAssets - debtBalance;
    const netAnnualIncome = annualAssetIncome - annualDebtCost;

    return {
      rate: netAssets > 0 ? netAnnualIncome / netAssets * 100 : null,
      grossAssets,
      debtBalance,
      netAssets,
      annualAssetIncome,
      annualDebtCost,
      netAnnualIncome
    };
  }

  function computeInvestablePrincipal(assets) {
    const r1 = computeR1(assets);
    const selfUseRealEstate = sum(assets?.realestate, item => {
      const usage = String(item.usage || '');
      return usage.includes('自住') || usage.includes('自用') ? Math.max(0, number(item.bookValue)) : 0;
    });
    return {
      principal: Math.max(0, r1.netAssets - selfUseRealEstate),
      netAssets: r1.netAssets,
      excludedSelfUseRealEstate: selfUseRealEstate
    };
  }

  function normalizeExpenses(expenses) {
    return (expenses || []).map(item => {
      const firstYear = Math.max(1, Math.round(number(item.firstYear ?? item.year, 1)));
      const frequency = item.frequency === 'annual' ? 'annual' : 'once';
      const duration = frequency === 'annual'
        ? Math.max(1, Math.round(number(item.duration, 1)))
        : 1;
      return {
        description: String(item.description ?? item.desc ?? '').trim(),
        amount: Math.max(0, number(item.amount)),
        firstYear,
        frequency,
        duration
      };
    }).filter(item => item.description && item.amount > 0);
  }

  function expandExpenseCashFlows(expenses) {
    const flows = new Map();
    normalizeExpenses(expenses).forEach(item => {
      const repetitions = item.frequency === 'annual' ? item.duration : 1;
      for (let index = 0; index < repetitions; index += 1) {
        const year = item.firstYear + index;
        flows.set(year, (flows.get(year) || 0) + item.amount);
      }
    });
    return Array.from(flows.entries())
      .map(([year, amount]) => ({ year, amount }))
      .sort((a, b) => a.year - b.year);
  }

  function presentValue(cashFlows, rate) {
    return (cashFlows || []).reduce((total, flow) => {
      return total + flow.amount / Math.pow(1 + rate, flow.year);
    }, 0);
  }

  function solveExpenseRate(principal, expenses, options = {}) {
    const cashFlows = expandExpenseCashFlows(expenses);
    const totalExpenses = sum(cashFlows, flow => flow.amount);
    const maxRate = Number.isFinite(options.maxRate) ? options.maxRate : 1;

    if (cashFlows.length === 0) {
      return { rate: null, status: 'no-expenses', cashFlows, totalExpenses, principal };
    }
    if (!Number.isFinite(principal) || principal <= 0) {
      return { rate: null, status: 'no-principal', cashFlows, totalExpenses, principal };
    }

    const pvAtZero = presentValue(cashFlows, 0);
    if (principal >= pvAtZero) {
      return { rate: 0, status: 'capital-sufficient', cashFlows, totalExpenses, principal, pvAtZero };
    }

    const pvAtMax = presentValue(cashFlows, maxRate);
    if (pvAtMax > principal) {
      return { rate: null, status: 'above-limit', cashFlows, totalExpenses, principal, pvAtZero, pvAtMax, maxRate };
    }

    let low = 0;
    let high = maxRate;
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const mid = (low + high) / 2;
      if (presentValue(cashFlows, mid) > principal) low = mid;
      else high = mid;
    }
    const rate = (low + high) / 2;
    return {
      rate: rate * 100,
      status: 'solved',
      cashFlows,
      totalExpenses,
      principal,
      pvAtZero,
      checkPV: presentValue(cashFlows, rate)
    };
  }

  function computeRequiredReturn(assets, expenses, m2Rate, principalOverride) {
    const r1 = computeR1(assets);
    const investable = computeInvestablePrincipal(assets);
    const hasOverride = Number.isFinite(Number.parseFloat(principalOverride));
    const defaultPrincipal = investable.principal;
    const principal = hasOverride ? Math.max(0, number(principalOverride)) : defaultPrincipal;
    const r2 = solveExpenseRate(principal, expenses);
    const r3 = Math.max(0, number(m2Rate, 10));
    const candidates = [
      { key: 'r1', label: '当前身家净回报率', value: Number.isFinite(r1.rate) ? r1.rate : null },
      { key: 'r2', label: '刚性支出倒算率', value: Number.isFinite(r2.rate) ? r2.rate : null },
      { key: 'r3', label: 'M2购买力基准', value: r3 }
    ];
    const eligible = candidates.filter(candidate => Number.isFinite(candidate.value));
    const winner = eligible.reduce((best, candidate) => {
      return !best || candidate.value > best.value ? candidate : best;
    }, null);

    return {
      r1,
      r2,
      r3,
      investable: { ...investable, defaultPrincipal, principal, overridden: hasOverride },
      requiredRate: winner ? winner.value : r3,
      winner: winner?.key || 'r3',
      winnerLabel: winner?.label || 'M2购买力基准'
    };
  }

  function buildAssetDistribution(assets) {
    const rows = ASSET_CONFIGS.map(config => ({
      key: config.cat,
      label: config.label,
      value: sum(assets?.[config.cat], item => Math.max(0, number(item[config.value])))
    }));
    const total = sum(rows, row => row.value);
    return rows.map(row => ({
      ...row,
      share: total > 0 ? row.value / total * 100 : 0
    }));
  }

  function buildDamageDistribution(detailRows) {
    const groups = [
      { key: 'severe', label: '严重损毁', value: 0 },
      { key: 'moderate', label: '中度损毁', value: 0 },
      { key: 'light', label: '轻微损毁', value: 0 },
      { key: 'positive', label: '价值增进', value: 0 }
    ];
    const byLabel = new Map(groups.map(group => [group.label, group]));
    (detailRows || []).forEach(row => {
      const group = byLabel.get(row.assessment) || byLabel.get('轻微损毁');
      group.value += Math.max(0, number(row.bookVal));
    });
    const total = sum(groups, group => group.value);
    return groups.map(group => ({
      ...group,
      share: total > 0 ? group.value / total * 100 : 0
    }));
  }

  function buildGrowthSeries(baseValue, currentRate, requiredRate, m2Rate, years) {
    const timeline = Array.isArray(years) && years.length
      ? years.map(year => Math.max(0, number(year)))
      : [0, 5, 10, 15, 20, 25, 30, 35, 40];
    const base = Math.max(0, number(baseValue));
    const grow = rate => timeline.map(year => base * Math.pow(1 + number(rate) / 100, year));
    return {
      years: timeline,
      current: grow(currentRate),
      required: grow(requiredRate),
      m2: grow(m2Rate)
    };
  }

  root.WealthModel = {
    ASSET_CONFIGS,
    number,
    computeR1,
    computeInvestablePrincipal,
    normalizeExpenses,
    expandExpenseCashFlows,
    presentValue,
    solveExpenseRate,
    computeRequiredReturn,
    buildAssetDistribution,
    buildDamageDistribution,
    buildGrowthSeries
  };
})(typeof window !== 'undefined' ? window : globalThis);
