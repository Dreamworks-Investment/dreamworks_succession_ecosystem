/**
 * wealth-agent.js — 五步身家诊断到 WorkBuddy 专家的安全交接层
 */
(function () {
  'use strict';

  const state = {
    configured: false,
    mode: 'live',
    authMode: 'none',
    sessionId: '',
    busy: false
  };

  const get = id => document.getElementById(id);
  const numberOrNull = value => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  };

  function sumBy(items, key) {
    return (items || []).reduce((sum, item) => sum + (numberOrNull(item?.[key]) || 0), 0);
  }

  function deidentifyAssets(assets) {
    const mapRows = (items, mapper) => (items || []).map((item, index) => ({
      item: index + 1,
      ...mapper(item)
    }));
    return {
      cash: mapRows(assets.cash, item => ({
        amountWan: numberOrNull(item.bookValue),
        annualReturnPct: numberOrNull(item.fiveYearReturn),
        liquidity: item.liquid || '未填写'
      })),
      realestate: mapRows(assets.realestate, item => ({
        amountWan: numberOrNull(item.bookValue),
        annualGrowthPct: numberOrNull(item.fiveYearGrowth),
        usage: item.usage || '未填写'
      })),
      business: mapRows(assets.business, item => ({
        equityWan: numberOrNull(item.equity),
        holdingPct: numberOrNull(item.share),
        annualRoePct: numberOrNull(item.roe)
      })),
      financial: mapRows(assets.financial, item => ({
        marketValueWan: numberOrNull(item.marketValue),
        annualReturnPct: numberOrNull(item.fiveYearReturn),
        type: item.type || '未填写'
      })),
      loans: mapRows(assets.loans, item => ({
        amountWan: numberOrNull(item.amount),
        annualRatePct: numberOrNull(item.rate),
        risk: item.risk || '未填写'
      })),
      debt: mapRows(assets.debt, item => ({
        amountWan: numberOrNull(item.amount),
        annualRatePct: numberOrNull(item.rate),
        remainingYears: numberOrNull(item.term)
      }))
    };
  }

  function buildDiagnosisContext() {
    const assets = AppState.assets || {};
    const anonymizedAssets = deidentifyAssets(assets);
    const totalAssets =
      sumBy(assets.cash, 'bookValue') +
      sumBy(assets.realestate, 'bookValue') +
      sumBy(assets.business, 'equity') +
      sumBy(assets.financial, 'marketValue') +
      sumBy(assets.loans, 'amount');
    const totalDebt = sumBy(assets.debt, 'amount');
    const required = AppState.requiredReturn || {};
    const dcf = AppState.dcfResults || {};

    return {
      schemaVersion: 'dreamworks-wealth-handoff-v1',
      generatedAt: new Date().toISOString(),
      units: { money: '万元', rate: '%' },
      privacy: {
        namesRemoved: true,
        directIdentityFieldsIncluded: false,
        note: '各资产名称、主体名称、地点和支出说明未提交；仅保留分析所需的金额、比率、期限和功能属性。'
      },
      inventory: {
        totals: {
          grossAssetsWan: totalAssets,
          liabilitiesWan: totalDebt,
          bookNetWorthWan: totalAssets - totalDebt
        },
        functionalFlags: {
          usage: Boolean(AppState.flags?.usage),
          convenience: Boolean(AppState.flags?.convenience),
          emotional: Boolean(AppState.flags?.emotional)
        },
        categories: anonymizedAssets
      },
      requiredReturn: {
        currentWeightedAnnualReturnPct: numberOrNull(required.r1),
        rigidCashflowRequiredReturnPct: numberOrNull(required.r2),
        m2ProtectionRatePct: numberOrNull(required.r3),
        finalRequiredReturnPct: typeof getRequiredRate === 'function' ? numberOrNull(getRequiredRate()) : null,
        winningConstraint: required.winner || null,
        investablePrincipalWan: numberOrNull(required.computation?.investable?.principal)
      },
      rigidExpenses: (AppState.expenses || []).map((expense, index) => ({
        item: index + 1,
        amountWan: numberOrNull(expense.amount),
        firstYear: numberOrNull(expense.firstYear),
        frequency: expense.frequency || '未填写',
        durationYears: numberOrNull(expense.duration)
      })),
      realNetWorth: {
        bookNetWorthWan: numberOrNull(dcf.totalBook),
        discountedNetWorthWan: numberOrNull(dcf.totalPV),
        valueGapWan: numberOrNull(dcf.destroyed),
        discountPct: numberOrNull(dcf.discountPct),
        horizonYears: numberOrNull(dcf.horizonYears),
        discountRatePct: numberOrNull(dcf.discountRate)
      },
      completedWorkflow: [
        '资产盘点',
        '要求回报率（R1、刚性支出倒算、M2 三者取最大值）',
        '真实身家折现',
        '财富增长曲线',
        '规则化行动建议'
      ]
    };
  }

  function buildInitialPrompt(context) {
    return [
      '你正在接续梦工场身家诊断系统已经完成的五步诊断。以下 JSON 是由用户明确授权提交的脱敏摘要，金额单位为万元。',
      '',
      '<diagnosis_summary>',
      JSON.stringify(context, null, 2),
      '</diagnosis_summary>',
      '',
      '请调用已安装的 shenjia-diagnosis 专家能力继续服务，并遵守以下交接规则：',
      '1. 不要让用户重复填写摘要里已有的数据，也不要猜测已被脱敏的姓名或主体。',
      '2. 先用简短语言确认你看到了哪些关键结论，再指出当前最重要的 1—3 个待核对缺口。',
      '3. 每轮只提出最有决策价值的问题，优先补齐刚性支出、流动性安全、资产功能和传承约束。',
      '4. 输出用于顾问复核，不作具体证券、产品、法律或税务结论；遇到这些事项应明确建议由持牌专业人士确认。',
      '5. 第一轮末尾只问一个最优先的问题，引导用户继续。'
    ].join('\n');
  }

  async function readApiError(response, fallback) {
    try {
      const payload = await response.json();
      return payload?.error?.message || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function setAvailability(status, message) {
    const badge = get('wealth-agent-availability');
    if (!badge) return;
    badge.classList.remove('is-checking', 'is-offline');
    if (status === 'checking') badge.classList.add('is-checking');
    if (status === 'offline') badge.classList.add('is-offline');
    badge.textContent = message;
  }

  function updateStartButton() {
    const start = get('wealth-agent-start');
    if (!start) return;
    start.disabled = !state.configured || !get('wealth-agent-consent')?.checked || state.busy;
  }

  async function checkStatus() {
    setAvailability('checking', '正在检查服务…');
    try {
      const response = await fetch('/api/wealth-agent/status', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('status unavailable');
      const payload = await response.json();
      state.configured = Boolean(payload.configured);
      state.mode = payload.mode || 'live';
      state.authMode = payload.authMode || 'none';
      if (state.configured) {
        setAvailability('online', state.mode === 'mock'
          ? '模拟联调可用'
          : state.authMode === 'oauth'
            ? payload.runtimeSecretConfigured
              ? '企业 OAuth + Runtime Key 已配置'
              : '企业 OAuth 已配置'
            : 'API Key 已配置');
        get('wealth-agent-setup-note').textContent = state.mode === 'mock'
          ? '当前为本地模拟联调，不会向云端提交数据。'
          : '首次进入时将验证凭据并创建本次专用的私有 Runtime。';
      } else {
        setAvailability('offline', '尚未配置');
        get('wealth-agent-setup-note').textContent = '请先在部署平台设置企业 OAuth 凭据或 API Key。';
      }
    } catch (error) {
      state.configured = false;
      setAvailability('offline', '接口不可用');
      get('wealth-agent-setup-note').textContent = '当前页面未连接到支持 WorkBuddy 的 Node 服务。';
    }
    updateStartButton();
  }

  function appendMessage(role, text, extraClass = '') {
    const messages = get('wealth-agent-messages');
    if (!messages) return null;
    const article = document.createElement('article');
    article.className = `wealth-agent-message is-${role}${extraClass ? ` ${extraClass}` : ''}`;
    const label = document.createElement('span');
    label.textContent = role === 'user' ? '您' : role === 'assistant' ? '身家诊断专家' : '系统';
    const content = document.createElement('p');
    content.textContent = text;
    article.append(label, content);
    messages.appendChild(article);
    messages.scrollTop = messages.scrollHeight;
    return content;
  }

  function setBusy(busy, statusText) {
    state.busy = busy;
    const input = get('wealth-agent-input');
    const send = get('wealth-agent-send');
    if (input) input.disabled = busy;
    if (send) send.disabled = busy;
    if (statusText && get('wealth-agent-live-status')) get('wealth-agent-live-status').textContent = statusText;
    updateStartButton();
  }

  async function streamPrompt(prompt, displayText) {
    if (!state.sessionId || state.busy) return;
    if (displayText) appendMessage('user', displayText);
    setBusy(true, '专家正在分析…');
    const assistantContent = appendMessage('assistant', '');
    let receivedText = false;

    try {
      const response = await fetch(`/api/wealth-agent/session/${encodeURIComponent(state.sessionId)}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({ prompt })
      });
      if (!response.ok) throw new Error(await readApiError(response, '专家诊断请求失败。'));
      if (!response.body) throw new Error('浏览器未收到流式响应。');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let event;
          try { event = JSON.parse(line); } catch (error) { continue; }
          if (event.type === 'text' && typeof event.text === 'string') {
            receivedText = true;
            assistantContent.textContent += event.text;
            get('wealth-agent-messages').scrollTop = get('wealth-agent-messages').scrollHeight;
          } else if (event.type === 'status' && event.text) {
            get('wealth-agent-live-status').textContent = event.text;
          } else if (event.type === 'error') {
            streamError = event.error?.message || '专家诊断未完成。';
          }
        }
      }
      if (streamError) throw new Error(streamError);
      if (!receivedText) assistantContent.textContent = '本轮没有收到可显示的文本，请重试或重新进入专家会话。';
      setBusy(false, '本轮诊断完成');
      get('wealth-agent-input')?.focus();
    } catch (error) {
      assistantContent.textContent = error.message || '专家诊断暂时不可用，请稍后重试。';
      assistantContent.parentElement?.classList.add('is-error');
      setBusy(false, '连接出现问题');
    }
  }

  async function startSession() {
    if (!state.configured || !get('wealth-agent-consent')?.checked || state.busy) return;
    setBusy(true, '正在创建私有会话…');
    const start = get('wealth-agent-start');
    start.textContent = '正在连接 WorkBuddy…';
    try {
      const context = buildDiagnosisContext();
      const response = await fetch('/api/wealth-agent/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ consent: true, context })
      });
      if (!response.ok) throw new Error(await readApiError(response, '无法创建专家会话。'));
      const payload = await response.json();
      state.sessionId = payload.sessionId;
      state.mode = payload.mode || state.mode;
      get('wealth-agent-launch').hidden = true;
      get('wealth-agent-console').hidden = false;
      get('wealth-agent-messages').textContent = '';
      appendMessage('system', state.mode === 'mock' ? '模拟专家会话已建立' : '私有 Runtime 会话已建立，诊断摘要已脱敏');
      get('wealth-agent-console').scrollIntoView({ behavior: 'smooth', block: 'start' });
      setBusy(false, '已连接');
      await streamPrompt(buildInitialPrompt(context), '已提交五步诊断摘要（名称及主体信息已脱敏）');
    } catch (error) {
      setBusy(false, '连接失败');
      showWealthToast(error.message || '无法连接身家诊断专家。', true);
    } finally {
      start.textContent = '进入 AI 身家诊断专家 →';
      updateStartButton();
    }
  }

  function returnToResults() {
    get('wealth-agent-console').hidden = true;
    get('wealth-agent-launch').hidden = false;
    get('wealth-agent-launch').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function endSession() {
    const sessionId = state.sessionId;
    state.sessionId = '';
    setBusy(false, '会话已结束');
    get('wealth-agent-messages').textContent = '';
    returnToResults();
    if (!sessionId) return;
    try {
      await fetch(`/api/wealth-agent/session/${encodeURIComponent(sessionId)}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
    } catch (error) {}
  }

  function setup() {
    const start = get('wealth-agent-start');
    if (!start) return;
    get('wealth-agent-consent')?.addEventListener('change', updateStartButton);
    start.addEventListener('click', startSession);
    get('wealth-agent-back')?.addEventListener('click', returnToResults);
    get('wealth-agent-end')?.addEventListener('click', endSession);
    get('wealth-agent-form')?.addEventListener('submit', event => {
      event.preventDefault();
      const input = get('wealth-agent-input');
      const prompt = input?.value.trim();
      if (!prompt || state.busy) return;
      input.value = '';
      void streamPrompt(prompt, prompt);
    });
    window.addEventListener('pagehide', () => {
      if (state.sessionId && navigator.sendBeacon) {
        navigator.sendBeacon(`/api/wealth-agent/session/${encodeURIComponent(state.sessionId)}/close`, new Blob(['{}'], { type: 'application/json' }));
      }
    });
    void checkStatus();
  }

  document.addEventListener('DOMContentLoaded', setup);
  window.wealthAgentBuildDiagnosisContext = buildDiagnosisContext;
})();
