/* 梦工场市场专员 · WorkBuddy 会话客户端 + 视图切换 */
(function () {
  'use strict';

  const API = '/api/market-agent';
  const page = document.getElementById('page-value');
  const authView = document.getElementById('market-agent-auth-view');
  const webView = document.getElementById('market-agent-websdk-view');

  const state = {
    configured: false,
    mode: 'live',
    sessionId: '',
    busy: false,
    latestTraceId: '',
    exportVersion: '',
    // 文件通道：同一会话内已上传到服务端的附件，追问时不再重复上传。
    uploadedKeys: [],
    fileManifest: null,
    pendingReportType: '',
    pendingReportVersion: '',
    pendingExportFormat: '',
    reportVersion: '',
    reportMode: ''
  };

  // 本次会话里每轮成功的回答都会累积到这里，用于导出详细版 / 简版。
  const reportRounds = [];

  // 每次从「进入市场专员」入口点击进来，都强制回到账号密码封面，
  // 与「狠值投资系统」内存 token（关闭即失效、重新进入需重新登录）的体验保持一致。
  // 只在本次页面会话内生效；登录成功后的整页刷新会重置该标志，避免死循环。
  let requireFreshLogin = false;

  const get = id => document.getElementById(id);

  // 两种报告润览的初始研究指令（进入会话后自动发送）
  const REPORT_PRESETS = Object.freeze({
    listed: {
      label: '上市公司报告润览',
      prompt: [
        '请按「上市公司报告润览」口径展开研究。',
        '研究范围：A 股、港股、美股等公开上市公司，以公开财报、公告、招股书与权威数据源为依据。',
        '请输出结构化研究底稿：公司与行业概览、商业模式、财务质量与关键指标、估值与同业对比、核心风险与证据缺口、下一步深研任务清单。',
        '请先说明需要我补充的标的名称、股票代码、关注期间与重点问题，再开始分析；不要臆造数据，关键结论需标注来源口径。'
      ].join('\n')
    },
    unlisted: {
      label: '非上市公司报告润览',
      prompt: [
        '请按「非上市公司报告润览」口径展开研究。',
        '研究范围：非上市企业及一级市场标的，以公开信息、行业研究、工商与可核验材料为依据；财务数据可能不完整，请明确标注信息边界与假设。',
        '请输出结构化研究底稿：公司与赛道概览、商业模式与收入结构、股权与治理、财务与成长性、竞争壁垒与关键风险、证据缺口与尽调任务清单。',
        '请先说明需要我补充的企业名称、所属行业、发展阶段、可获得的资料与重点问题，再开始分析；不要臆造数据。'
      ].join('\n')
    }
  });

  // 四种直达模式对应专家包里的 A/B/C/D 路由。用户只需选模块 + 版本，
  // 脚本负责拼成专家能识别的模式指令，避免让访客记专业术语。
  const REPORT_MODES = Object.freeze({
    'listed-full': {
      code: 'A', label: '上市公司 · 详细版', version: 'full',
      prompt: [
        '请按专家包的 A 模式（上市公司详细版）处理本次上传的报告底稿。',
        '保留股价、市值、估值倍数、评级等上市口径字段，只去 AI 腔与生产痕迹，不删除论证链。',
        '输出完整章节：公司与行业概览、商业模式、财务质量与关键指标、估值与同业对比、核心风险与证据缺口、下一步深研任务清单。',
        '不要臆造数据；原文没有的数字与引用不得新增，关键结论需说明来源口径。'
      ].join('\n')
    },
    'listed-brief': {
      code: 'B', label: '上市公司 · 简版', version: 'brief',
      prompt: [
        '请按专家包的 B 模式（上市公司简版）处理本次上传的报告底稿。',
        '保留上市核心字段与估值表，压缩重复论证，但六章骨架与证据链不能断。',
        '只留结论与关键要点，内容要一眼看懂；不新增原文没有的数字、引用或评级。',
        '直接输出可交付正文，不要解释转换过程。'
      ].join('\n')
    },
    'unlisted-full': {
      code: 'C', label: '非上市公司 · 详细版', version: 'full',
      prompt: [
        '请按专家包的 C 模式（非上市公司详细版）处理本次上传的报告底稿。',
        '清除股价、市值、目标价、上涨空间、仓位等上市专属字段，改写为非上市语境；缺数据统一收敛为「待核 / 暂无法测算」。',
        '保留完整章节与论证链：公司与赛道概览、商业模式与收入结构、股权与治理、财务与成长性、竞争壁垒与关键风险、证据缺口与尽调清单。',
        '不给买卖指令；不得新增原文没有的数字与引用。'
      ].join('\n')
    },
    'unlisted-brief': {
      code: 'D', label: '非上市公司 · 简版', version: 'brief',
      prompt: [
        '请按专家包的 D 模式（非上市公司简版）处理本次上传的报告底稿。',
        '只留六章骨架与必要附录，压缩到结论与关键要点；招牌方法论术语必须原样保留，正文说人话。',
        '清除上市字段与买卖指令，缺数据用「待核 / 暂无法测算」；新增数字与新增引用必须为 0。',
        '直接输出可交付正文，不要解释转换过程。'
      ].join('\n')
    }
  });

  /* ---------------- 视图切换 ---------------- */

  function ensureValuePage() {
    if (page && !page.classList.contains('active') && typeof window.navigateTo === 'function') {
      window.navigateTo('value', { skipHistory: true, scroll: false, preserveValueView: true });
    }
  }

  function setHistory(options) {
    if (!options || (!options.pushHistory && !options.replaceHistory)) return;
    const stateObj = { page: 'value', valueView: options.view || 'intro' };
    const hash = options.view === 'market-agent' ? '#market-agent' : '#value';
    try {
      if (options.replaceHistory) window.history.replaceState(stateObj, '', hash);
      else window.history.pushState(stateObj, '', hash);
    } catch (error) {
      window.location.hash = hash;
    }
  }

  function clearAllValueViews() {
    if (!page) return;
    page.classList.remove('value-agent-active', 'value-agent-auth-active', 'market-agent-auth-active', 'market-agent-active');
  }

  // 授权状态以服务端注入的 bootstrap 为准：未登录用户不会收到该 grant，
  // 因此点击入口应始终先看到账号密码封面。静态预览（无 bootstrap）也按未登录处理。
  function isAuthorized() {
    // 从入口进入时强制要求重新验证，忽略服务端注入的既有授权。
    if (requireFreshLogin) return false;
    const bootstrap = window.DREAMWORKS_STRATEGY_AUTH;
    if (bootstrap && bootstrap.grants && typeof bootstrap.grants.market === 'boolean') {
      return bootstrap.grants.market;
    }
    return false;
  }

  // 入口点击专用：每次都要求重新验证账号密码。
  // 关键点：已登录时服务端返回的 HTML 里并没有登录封面 DOM（保护块被移除），
  // 单纯用前端标志切换 class 会导致"隐藏了介绍页、又没有封面"的白屏。
  // 因此这里先撤销授权，再整页刷新，让服务端重新渲染出登录封面 DOM。
  async function marketEnterFromEntry(options) {
    options = options || {};
    try {
      await fetch('/api/strategy-auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ scope: 'market' })
      });
    } catch (error) {
      // 登出请求失败也继续刷新；服务端若仍判定已登录，会进入会话面板而非封面。
    }
    // 带上 #market-agent hash 刷新，路由会自动打开市场专员的登录封面。
    try {
      window.history.replaceState({ page: 'value', valueView: 'market-agent' }, '', '#market-agent');
    } catch (error) {
      window.location.hash = 'market-agent';
    }
    window.location.reload();
  }

  function marketOpenAgent(options) {
    options = options || {};
    ensureValuePage();
    clearAllValueViews();
    const authorized = isAuthorized();
    if (page) page.classList.add(authorized ? 'market-agent-active' : 'market-agent-auth-active');
    if (authView) authView.setAttribute('aria-hidden', String(authorized));
    if (webView) webView.setAttribute('aria-hidden', String(!authorized));
    setHistory({ pushHistory: options.pushHistory, replaceHistory: options.replaceHistory, view: 'market-agent' });
    document.title = authorized ? '梦工场市场专员 · 狠值投资' : '访问验证 · 梦工场市场专员';
    if (options.scroll !== false) window.scrollTo({ top: 0, behavior: 'auto' });
    if (authorized) {
      void checkStatus();
      window.setTimeout(() => get('market-agent-input')?.focus({ preventScroll: true }), 60);
    } else {
      window.setTimeout(() => get('market-agent-username')?.focus({ preventScroll: true }), 60);
    }
  }

  function marketShowIntro(options) {
    options = options || {};
    ensureValuePage();
    clearAllValueViews();
    if (authView) authView.setAttribute('aria-hidden', 'true');
    if (webView) webView.setAttribute('aria-hidden', 'true');
    void endSession(true);
    setHistory({ pushHistory: options.pushHistory, replaceHistory: options.replaceHistory, view: 'intro' });
    document.title = '狠值投资 · 梦工场家族传承系统';
    if (options.scrollToEntry) {
      window.requestAnimationFrame(() => {
        get('value-slide-15')?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    } else if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  /* ---------------- 会话交互 ---------------- */

  // 与身家诊断面板共用同一套气泡样式（css/wealth-agent.css 的 .wealth-agent-message），
  // 类名必须是 wealth-agent-message，早前误写成 wealth-agent-msg 导致对话区完全没有样式。
  function appendMessage(role, text) {
    const box = get('market-agent-messages');
    const article = document.createElement('article');
    article.className = `wealth-agent-message is-${role}`;
    const label = document.createElement('span');
    label.textContent = role === 'user' ? '您' : role === 'assistant' ? '梦工场市场专员' : '系统';
    const content = document.createElement('p');
    content.textContent = text;
    article.append(label, content);
    if (box) {
      box.appendChild(article);
      box.scrollTop = box.scrollHeight;
    }
    return content;
  }

  function setBusy(busy, text) {
    state.busy = busy;
    const status = get('market-agent-live-status');
    if (status && text) status.textContent = text;
    syncSendState();
    const input = get('market-agent-input');
    if (input) input.disabled = busy;
  }

  function updateStartButton() {
    const note = get('market-agent-setup-note');
    const ready = state.configured && !state.busy;
    document.querySelectorAll('[data-market-report]').forEach(button => {
      button.disabled = !ready;
    });
    document.querySelectorAll('[data-market-version]').forEach(button => {
      button.disabled = !ready;
    });
    const start = get('market-agent-start');
    if (start) start.disabled = !ready;
    syncGenerateState();
    if (note) {
      note.textContent = state.configured
        ? '服务已就绪，请选择一种报告润览类型。'
        : '服务尚未配置完成，请联系管理员。';
    }
  }

  // 第一步只选模块；第二步再选详细/简版，避免把四种模式一次摊开给用户。
  function selectReportType(reportKey) {
    if (!state.configured || state.busy) return;
    state.pendingReportType = reportKey;
    state.pendingReportVersion = '';
    document.querySelectorAll('[data-market-report]').forEach(button => {
      button.classList.toggle('is-selected', button.dataset.marketReport === reportKey);
    });
    document.querySelectorAll('[data-market-version]').forEach(button => {
      button.classList.remove('is-selected');
    });
    const step = get('market-agent-version-step');
    if (step) step.hidden = false;
    const title = get('market-agent-version-step-title');
    if (title) {
      const label = reportKey === 'unlisted' ? '非上市公司模块' : '上市公司模块';
      title.textContent = `已选择${label} · 请选择报告版本`;
    }
    const note = get('market-agent-setup-note');
    if (note) note.textContent = '选好版本后，上传报告底稿即可一键生成。';
  }

  function setGenerateFeedback(text, isError) {
    const feedback = get('market-agent-generate-feedback');
    if (!feedback) return;
    feedback.textContent = text;
    feedback.classList.toggle('is-error', Boolean(isError));
  }

  function syncGenerateState() {
    const ready = Boolean(
      state.configured && state.sessionId && state.reportType && state.reportVersion &&
      hasReportFile() && !state.busy
    );
    document.querySelectorAll('[data-generate-format]').forEach(button => {
      button.disabled = !ready;
    });
    const summary = get('market-agent-generate-summary');
    if (summary) {
      const mode = REPORT_MODES[`${state.reportType}-${state.reportVersion}`];
      if (!mode) summary.textContent = '请先在上方选择模块与版本。';
      else if (!hasReportFile()) summary.textContent = `已选择${mode.label}，请上传报告底稿后选择格式。`;
      else summary.textContent = `已选择${mode.label}与报告底稿，点击下方格式即可直接生成。`;
    }
  }

  /* ---------------- 运行中实时提示 ---------------- */

  // 真实专家首字要等十几秒，中间必须让人看见"在跑"。这段文案会循环播放并累计用时。
  const RUNNING_STEPS = Object.freeze([
    '已提交研究需求，正在建立私有运行环境…',
    '正在装载市场研究专家设定…',
    '正在读取你补充的材料与口径…',
    '正在搭建报告框架与章节…',
    '正在撰写研究底稿…',
    '正在核对数据口径与证据链…'
  ]);

  // 入口选择报告类型后、进入对话面板前还要建会话，这段空档也要让人看见在动。
  const CONNECT_STEPS = Object.freeze([
    '正在建立私有运行环境…',
    '正在装载市场研究专家设定…',
    '即将进入对话面板…'
  ]);

  function startNoteRotation(element, steps, intervalMs) {
    if (!element) return { stop() {} };
    let index = 0;
    element.textContent = steps[0];
    const timer = window.setInterval(() => {
      index = (index + 1) % steps.length;
      element.textContent = steps[index];
    }, intervalMs || 3500);
    return {
      stop() { window.clearInterval(timer); }
    };
  }

  function createRunningIndicator(content) {
    if (!content) return { note() {}, stop() {} };
    const wrap = document.createElement('span');
    wrap.className = 'market-agent-running';
    const dots = document.createElement('span');
    dots.className = 'market-agent-running-dots';
    dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i += 1) dots.appendChild(document.createElement('i'));
    const label = document.createElement('span');
    label.className = 'market-agent-running-text';
    const elapsed = document.createElement('span');
    elapsed.className = 'market-agent-running-elapsed';
    wrap.append(dots, label, elapsed);
    content.appendChild(wrap);
    content.classList.add('is-running');

    let stepIndex = 0;
    let seconds = 0;
    let noteText = '';
    let stopped = false;
    const render = () => {
      label.textContent = noteText || RUNNING_STEPS[stepIndex];
      elapsed.textContent = seconds > 0 ? `已用时 ${seconds} 秒` : '';
    };
    render();
    const timer = window.setInterval(() => {
      // 会话被清空（结束会话 / 返回入口）时，气泡已被移除，这里自行收尾避免空转
      if (!content.isConnected) {
        window.clearInterval(timer);
        stopped = true;
        return;
      }
      seconds += 1;
      // 每 3 秒换一句，避免长时间停在同一行像是卡住了
      if (seconds % 3 === 0 && !noteText) stepIndex = (stepIndex + 1) % RUNNING_STEPS.length;
      render();
    }, 1000);

    return {
      note(text) {
        if (stopped || !text) return;
        noteText = String(text);
        render();
      },
      stop() {
        if (stopped) return;
        stopped = true;
        window.clearInterval(timer);
        wrap.remove();
        content.classList.remove('is-running');
      }
    };
  }

  /* ---------------- 报告导出（详细版 / 简版 × 四种格式） ---------------- */

  const EXPORT_FORMAT_PROMPT = '请选择文件格式：.md 便于再加工，.docx 便于批注，.html 便于直接阅读，.pdf 便于对外发送。';

  const EXPORT_FORMAT_HINTS = Object.freeze({
    md: '已开始下载 .md 文件，适合再加工或贴进知识库。',
    html: '已开始下载 .html 文件，双击即可用浏览器打开，样式与线上一致。',
    docx: '已开始下载 .docx 文件，可直接用 Word / WPS 打开并继续批注。',
    pdf: 'PDF 已在新窗口打开并调起打印面板，在「目标打印机」里选择「另存为 PDF」即可保存。'
  });

  function exporter() {
    return typeof window.MGCReportExport === 'object' && window.MGCReportExport ? window.MGCReportExport : null;
  }

  function reportFullText() {
    return reportRounds
      .map(text => String(text || '').trim())
      .filter(Boolean)
      .join('\n\n');
  }

  function syncExportPanel() {
    const panel = get('market-agent-export');
    if (!panel) return;
    const hasReport = reportFullText().length > 0;
    panel.hidden = !hasReport;
    if (!hasReport) {
      state.exportVersion = '';
      document.querySelectorAll('[data-export-version]').forEach(button => {
        button.classList.remove('is-selected');
        button.setAttribute('aria-pressed', 'false');
      });
      const formats = panel.querySelector('[data-export-formats]');
      if (formats) formats.hidden = true;
    }
  }

  function currentReportPayload(version) {
    const api = exporter();
    const preset = REPORT_PRESETS[state.reportType];
    const full = reportFullText();
    const body = version === 'brief' && api ? api.buildBrief(full) : full;
    return {
      title: preset ? preset.label : '梦工场报告润览',
      version,
      body,
      agentName: '梦工场市场专员',
      generatedAt: new Date(),
      sessionId: state.sessionId
    };
  }

  function setExportFeedback(text, isError) {
    const feedback = get('market-agent-export-feedback');
    if (!feedback) return;
    feedback.textContent = text;
    feedback.classList.toggle('is-error', Boolean(isError));
  }

  function selectExportVersion(version) {
    state.exportVersion = version;
    document.querySelectorAll('[data-export-version]').forEach(button => {
      const selected = button.dataset.exportVersion === version;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const formats = get('market-agent-export')?.querySelector('[data-export-formats]');
    if (formats) formats.hidden = false;
    setExportFeedback(EXPORT_FORMAT_PROMPT, false);
    const label = version === 'brief' ? '简版' : '详细版';
    const formatsLabel = get('market-agent-export-formats-label');
    if (formatsLabel) formatsLabel.textContent = `已选择${label} · 请选择文件格式`;
  }

  function runExport(format) {
    const api = exporter();
    if (!api) {
      setExportFeedback('导出模块未加载，请刷新页面后重试。', true);
      return;
    }
    if (!state.exportVersion) {
      setExportFeedback('请先选择详细版或简版。', true);
      return;
    }
    const payload = currentReportPayload(state.exportVersion);
    if (!String(payload.body || '').trim()) {
      setExportFeedback('当前没有可导出的正文，请先让市场专员输出报告。', true);
      return;
    }
    try {
      if (format === 'md') api.downloadMarkdown(payload);
      else if (format === 'html') api.downloadHtml(payload);
      else if (format === 'docx') api.downloadDocx(payload);
      else if (format === 'pdf') {
        const result = api.printPdf(payload);
        if (!result.ok) {
          setExportFeedback(
            result.reason === 'popup-blocked'
              ? '浏览器拦截了新窗口。请允许本站弹出窗口后重试，或先下载 .html 再自行打印为 PDF。'
              : 'PDF 打印窗口打开失败，请先下载 .html 再自行打印为 PDF。',
            true
          );
          return;
        }
      }
      setExportFeedback(EXPORT_FORMAT_HINTS[format] || '已开始下载。', false);
    } catch (error) {
      setExportFeedback('导出失败，请重试或换一种格式。', true);
    }
  }

  function bindExport() {
    document.querySelectorAll('[data-export-version]').forEach(button => {
      button.addEventListener('click', () => selectExportVersion(button.dataset.exportVersion));
    });
    document.querySelectorAll('[data-export-format]').forEach(button => {
      button.addEventListener('click', () => runExport(button.dataset.exportFormat));
    });
  }

  function recordDiagnostic(payload, traceId) {    if (!payload || typeof payload !== 'object') return;
    state.latestTraceId = traceId || payload.traceId || state.latestTraceId || '';
    const box = get('market-agent-diagnostics');
    if (box) box.hidden = false;
    const traceLabel = get('market-agent-diagnostic-trace');
    if (traceLabel) traceLabel.textContent = state.latestTraceId || '尚未生成';
    const summary = get('market-agent-diagnostic-summary');
    if (summary && state.latestTraceId) {
      summary.textContent = `本次调用 Trace：${state.latestTraceId}，诊断数据已脱敏。`;
    }
    const timeline = get('market-agent-diagnostic-timeline');
    if (timeline && Array.isArray(payload.events)) {
      timeline.innerHTML = '';
      payload.events.forEach(event => {
        const li = document.createElement('li');
        li.textContent = `+${event.offsetMs || 0}ms · ${event.stage || ''} · ${event.outcome || ''}`;
        timeline.appendChild(li);
      });
    }
  }

  async function checkStatus() {
    if (!webView) return;
    const availability = get('market-agent-availability');
    try {
      const response = await fetch(`${API}/status`, { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      state.configured = Boolean(payload.configured);
      state.mode = payload.mode || 'live';
      if (availability) {
        availability.textContent = state.configured ? '服务可用' : '服务未配置';
        availability.classList.toggle('is-ready', state.configured);
        availability.classList.toggle('is-error', !state.configured);
      }
    } catch (error) {
      state.configured = false;
      if (availability) {
        availability.textContent = '服务不可用';
        availability.classList.add('is-error');
      }
    } finally {
      updateStartButton();
    }
  }

  async function startSession(reportKey, version) {
    if (!state.configured || state.busy) return;
    const preset = REPORT_PRESETS[reportKey] || REPORT_PRESETS.listed;
    const modeKey = `${reportKey}-${version || 'full'}`;
    const mode = REPORT_MODES[modeKey] || REPORT_MODES['listed-full'];
    setBusy(true, '正在创建会话…');
    document.querySelectorAll('[data-market-version]').forEach(button => {
      button.classList.toggle('is-loading', button.dataset.marketVersion === mode.version);
    });
    const connectNote = startNoteRotation(get('market-agent-setup-note'), CONNECT_STEPS, 3500);
    try {
      const response = await fetch(`${API}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          consent: true,
          context: {
            schemaVersion: 'dreamworks-market-agent-v2',
            generatedAt: new Date().toISOString(),
            purpose: `梦工场市场专员 · ${mode.label}`,
            reportType: reportKey,
            reportVersion: mode.version,
            reportMode: mode.code,
            privacy: { namesRemoved: true, directIdentityFieldsIncluded: false }
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || '无法创建市场专员会话。');
      }
      recordDiagnostic(payload.diagnostic, payload.traceId);
      state.sessionId = payload.sessionId;
      state.reportType = reportKey;
      state.reportVersion = mode.version;
      state.reportMode = mode.code;
      state.pendingExportFormat = '';
      state.mode = payload.mode || state.mode;
      get('market-agent-launch').hidden = true;
      get('market-agent-console').hidden = false;
      get('market-agent-messages').textContent = '';
      reportRounds.length = 0;
      state.exportVersion = '';
      attachedFiles.length = 0;
      reportUploadedOnce = false;
      state.uploadedKeys = [];
      state.fileManifest = null;
      renderFileList();
      syncExportPanel();
      const consoleTitle = get('market-agent-console-title');
      if (consoleTitle) consoleTitle.textContent = mode.label;
      setGenerateFeedback(`已选择${mode.label}，上传报告底稿后可直接生成。`);
      get('market-agent-console').scrollIntoView({ behavior: 'smooth', block: 'start' });
      setBusy(false, '已连接');
      // 不预填对话内容；报告口径已通过 context.reportMode 传给服务端。
    } catch (error) {
      setBusy(false, '连接失败');
      appendMessage('error', error.message || '无法连接梦工场市场专员。');
    } finally {
      connectNote.stop();
      document.querySelectorAll('[data-market-version]').forEach(button => {
        button.classList.remove('is-loading');
      });
      updateStartButton();
    }
  }

  async function streamPrompt(prompt, displayText) {
    if (!state.sessionId || state.busy) return false;
    if (displayText) appendMessage('user', displayText);
    setBusy(true, '市场专员正在分析…');
    const assistantContent = appendMessage('assistant', '');
    const running = createRunningIndicator(assistantContent);
    let receivedText = false;
    let promptTraceId = '';
    try {
      const response = await fetch(`${API}/session/${encodeURIComponent(state.sessionId)}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({ prompt })
      });
      if (!response.ok) throw new Error('市场专员请求失败。');
      if (!response.body) throw new Error('浏览器未收到流式响应。');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError = null;
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
          if (event.type === 'trace' && event.traceId) {
            promptTraceId = event.traceId;
          } else if (event.type === 'text' && typeof event.text === 'string') {
            if (!receivedText) running.stop(); // 收到首个字就撤掉进度提示，换成正文
            receivedText = true;
            assistantContent.textContent += event.text;
            const box = get('market-agent-messages');
            if (box) box.scrollTop = box.scrollHeight;
          } else if (event.type === 'status' && event.text) {
            const status = get('market-agent-live-status');
            if (status) status.textContent = event.text;
            running.note(event.text);
          } else if (event.type === 'error') {
            recordDiagnostic(event.diagnostic, event.traceId || promptTraceId);
            streamError = new Error(event.error?.message || '市场专员未完成作答。');
          } else if (event.type === 'done') {
            recordDiagnostic(event.diagnostic, event.traceId || promptTraceId);
          }
        }
      }
      if (streamError) throw streamError;
      running.stop();
      if (!receivedText) {
        assistantContent.textContent = '本轮没有收到可显示的文本，请重试。';
      } else {
        // 成功的这一轮计入报告正文，供详细版 / 简版导出使用
        reportRounds.push(assistantContent.textContent);
        syncExportPanel();
      }
      setBusy(false, receivedText ? '本轮完成 · 可导出报告' : '本轮完成');
      get('market-agent-input')?.focus();
      return receivedText;
    } catch (error) {
      running.stop();
      assistantContent.textContent = error.message || '市场专员暂时不可用，请稍后重试。';
      setBusy(false, '连接出现问题');
      return false;
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    const input = get('market-agent-input');
    const value = (input?.value || '').trim();
    if (!value || state.busy) return;
    if (REQUIRE_REPORT_FILE && !hasReportFile()) {
      syncSendState();
      get('market-agent-upload-report')?.focus();
      return;
    }
    if (input) input.value = '';
    try {
      // 先把本地文件真正送进服务端 workspace，再发送提问。
      await uploadAttachments();
      await streamPrompt(value, value);
    } catch (error) {
      if (input && !input.value) input.value = value;
      appendMessage('error', error.message || '附件上传失败，请重试。');
      setBusy(false, '上传失败');
    }
  }

  // 一键直达：选好模块 + 版本后，点击格式按钮即上传底稿、发送模式指令、
  // 并在专家返回正文后自动下载对应格式。聊天输入仍保留，供追加修改。
  async function runGeneration(format) {
    if (!state.sessionId || state.busy) return;
    if (!hasReportFile()) {
      setGenerateFeedback('请先上传报告底稿，再选择生成格式。', true);
      syncSendState();
      get('market-agent-upload-report')?.focus();
      return;
    }
    const mode = REPORT_MODES[`${state.reportType}-${state.reportVersion}`];
    if (!mode) {
      setGenerateFeedback('请先选择上市公司 / 非上市公司以及详细版 / 简版。', true);
      return;
    }

    state.pendingExportFormat = format;
    state.exportVersion = mode.version;
    document.querySelectorAll('[data-generate-format]').forEach(button => {
      button.classList.toggle('is-loading', button.dataset.generateFormat === format);
    });
    setGenerateFeedback(`正在按${mode.label}生成 .${format} 报告，请稍候…`);

    const deliveryHint = format === 'pdf'
      ? '完成后会打开打印面板，请在目标打印机中选择「另存为 PDF」。'
      : `完成后将自动下载 .${format} 文件。`;
    const prompt = [
      mode.prompt,
      `最终交付格式：${format.toUpperCase()}。请直接输出完整报告正文，不要只给提纲或说明；${deliveryHint}`
    ].join('\n\n');

    reportRounds.length = 0;
    syncExportPanel();
    // syncExportPanel 在无正文时会清空版本，这里重新锁定用户已选版本。
    state.exportVersion = mode.version;
    try {
      await uploadAttachments();
      const ok = await streamPrompt(prompt, `请按${mode.label}生成报告（.${format}）。`);
      if (!ok) {
        setGenerateFeedback('本轮没有收到可导出的正文，请重试或补充底稿。', true);
        return;
      }
      runExport(format);
      setGenerateFeedback(format === 'pdf'
        ? '报告正文已生成，打印面板已打开；选择「另存为 PDF」即可保存。'
        : `报告正文已生成，.${format} 文件已开始下载。`);
    } catch (error) {
      setGenerateFeedback(error.message || '生成失败，请重试。', true);
      appendMessage('error', error.message || '报告生成失败，请重试。');
    } finally {
      document.querySelectorAll('[data-generate-format]').forEach(button => {
        button.classList.remove('is-loading');
      });
      state.pendingExportFormat = '';
      syncGenerateState();
    }
  }

  function returnToLaunch() {
    const consoleEl = get('market-agent-console');
    const launch = get('market-agent-launch');
    if (consoleEl) consoleEl.hidden = true;
    const consoleTitle = get('market-agent-console-title');
    if (consoleTitle) consoleTitle.textContent = '市场顾问对话';
    state.reportType = '';
    state.reportVersion = '';
    state.reportMode = '';
    state.pendingReportType = '';
    state.pendingReportVersion = '';
    state.pendingExportFormat = '';
    document.querySelectorAll('[data-market-report], [data-market-version]').forEach(button => {
      button.classList.remove('is-selected');
    });
    const versionStep = get('market-agent-version-step');
    if (versionStep) versionStep.hidden = true;
    setGenerateFeedback('请先选择报告模式并上传底稿。');
    syncGenerateState();
    if (launch) {
      launch.hidden = false;
      launch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function endSession(silent) {
    const sessionId = state.sessionId;
    state.sessionId = '';
    setBusy(false, '会话已结束');
    const messages = get('market-agent-messages');
    if (messages) messages.textContent = '';
    reportRounds.length = 0;
    state.exportVersion = '';
    state.reportVersion = '';
    state.reportMode = '';
    state.pendingReportType = '';
    state.pendingReportVersion = '';
    state.pendingExportFormat = '';
    attachedFiles.length = 0;
    reportUploadedOnce = false;
    state.uploadedKeys = [];
    state.fileManifest = null;
    renderFileList();
    syncExportPanel();
    if (!silent) returnToLaunch();
    if (!sessionId) return;
    try {
      await fetch(`${API}/session/${encodeURIComponent(sessionId)}/close`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
    } catch (error) { /* ignore */ }
  }

  function copyTrace() {
    if (!state.latestTraceId) return;
    const text = `WorkBuddy 市场专员诊断 Trace: ${state.latestTraceId}`;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  }

  function downloadDiagnostics() {
    if (!state.latestTraceId) return;
    const payload = { traceId: state.latestTraceId, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dreamworks-market-agent-${state.latestTraceId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------------- 本地文件上传（报告底稿必传 / 标的图片可选） ---------------- */

  // 报告底稿是分析的主要依据，必须上传；标的图片只用于报告封面，未上传也不影响出报告。
  const REQUIRE_REPORT_FILE = true;

  // 条目形如 { file, kind }，kind: 'report' | 'image'
  const attachedFiles = [];
  // 底稿只需在本会话内传一次，后续追问不再重复要求上传。
  let reportUploadedOnce = false;

  function filesOfKind(kind) {
    return attachedFiles.filter(item => item.kind === kind);
  }

  function hasReportFile() {
    return reportUploadedOnce || filesOfKind('report').length > 0;
  }

  // 发送按钮是否可用，以及上传区状态文案，都由这里统一计算，避免两处逻辑打架。
  function syncSendState() {
    const needsReport = REQUIRE_REPORT_FILE && !hasReportFile();
    const send = get('market-agent-send');
    if (send) {
      send.disabled = state.busy || !state.sessionId || needsReport;
      send.title = needsReport ? '请先上传报告底稿文件' : '';
    }
    const status = get('market-agent-upload-status');
    if (status) {
      if (hasReportFile()) {
        const uploadedImages = (state.fileManifest?.files || []).filter(file => file.kind === 'image').length;
        const images = filesOfKind('image').length + uploadedImages;
        status.textContent = images
          ? `已上传报告底稿，另有 ${images} 张封面图片，可以开始提问。`
          : '已上传报告底稿，可以开始提问。未上传标的图片，报告封面会用文字版式。';
        status.classList.remove('is-warning');
      } else {
        status.textContent = '尚未上传报告底稿，上传后「发送」才会启用。';
        status.classList.add('is-warning');
      }
    }
    syncGenerateState();
  }

  function renderFileList() {
    const list = get('market-agent-file-list');
    if (!list) return;
    list.innerHTML = '';
    if (!attachedFiles.length) {
      list.hidden = true;
      syncSendState();
      return;
    }
    list.hidden = false;
    attachedFiles.forEach((item, index) => {
      const file = item.file;
      const li = document.createElement('li');
      li.className = `is-${item.kind}`;
      const tag = document.createElement('span');
      tag.className = 'market-agent-file-tag';
      tag.textContent = item.kind === 'report' ? '底稿' : '封面图';
      const name = document.createElement('span');
      name.className = 'market-agent-file-name';
      name.textContent = file.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', `移除 ${file.name}`);
      remove.textContent = '×';
      remove.className = 'market-agent-file-remove';
      remove.addEventListener('click', () => {
        attachedFiles.splice(index, 1);
        // 手动移除底稿后重新要求上传，避免"显示已传过但其实已经没有文件"
        if (item.kind === 'report' && !attachedFiles.some(entry => entry.kind === 'report')) {
          reportUploadedOnce = false;
        }
        renderFileList();
      });
      li.append(tag, name, remove);
      list.appendChild(li);
    });
    syncSendState();
  }

  function bindFileUpload(buttonId, inputId, options) {
    const button = get(buttonId);
    const input = get(inputId);
    if (!button || !input) return;
    const kind = options.kind || 'report';
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const picked = Array.from(input.files || []);
      // 标的图片最多 3 张：超过时只保留新选的最后 3 张，避免列表无限膨胀
      const incoming = options.imagesOnly && picked.length > 3 ? picked.slice(-3) : picked;
      incoming.forEach(file => {
        const duplicated = attachedFiles.some(item => item.file.name === file.name && item.file.size === file.size);
        if (!duplicated) attachedFiles.push({ file, kind });
      });
      input.value = ''; // 允许重复选择同一文件
      renderFileList();
    });
  }

  // 文件通道：FormData 上传到 /upload，服务端落到 workspace 并回传清单。
  // 浏览器只发新选中的文件；同一会话后续追问复用已上传清单。
  function fileKey(item) {
    return `${item.kind}:${item.file.name}:${item.file.size}`;
  }

  function pendingUploads() {
    return attachedFiles.filter(item => !state.uploadedKeys.includes(fileKey(item)));
  }

  async function uploadAttachments() {
    const pending = pendingUploads();
    if (!pending.length) return true;
    setBusy(true, '正在上传底稿与封面图…');
    const status = get('market-agent-upload-status');
    if (status) status.textContent = `正在上传 ${pending.length} 个文件，请稍候…`;
    try {
      const form = new FormData();
      form.append('sessionId', state.sessionId);
      pending.forEach(item => form.append(item.kind, item.file, item.file.name));
      const response = await fetch(`${API}/upload`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        body: form
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || '附件上传失败。');
      }
      state.fileManifest = payload;
      pending.forEach(item => {
        const key = fileKey(item);
        if (!state.uploadedKeys.includes(key)) state.uploadedKeys.push(key);
      });
      if ((payload.files || []).some(file => file.kind === 'report')) reportUploadedOnce = true;
      attachedFiles.length = 0;
      setBusy(false, '附件已上传');
      renderFileList();
      return true;
    } catch (error) {
      setBusy(false, '上传失败');
      renderFileList();
      throw error;
    }
  }

  function init() {
    if (!webView) return; // 未授权用户没有会话面板 DOM
    bindFileUpload('market-agent-upload-report', 'market-agent-report-input', { kind: 'report' });
    bindFileUpload('market-agent-upload-images', 'market-agent-images-input', { kind: 'image', imagesOnly: true });
    syncSendState();
    bindExport();
    document.querySelectorAll('[data-market-report]').forEach(button => {
      button.addEventListener('click', () => selectReportType(button.dataset.marketReport));
    });
    document.querySelectorAll('[data-market-version]').forEach(button => {
      button.addEventListener('click', () => void startSession(state.pendingReportType, button.dataset.marketVersion));
    });
    document.querySelectorAll('[data-generate-format]').forEach(button => {
      button.addEventListener('click', () => void runGeneration(button.dataset.generateFormat));
    });
    get('market-agent-form')?.addEventListener('submit', onSubmit);
    get('market-agent-back')?.addEventListener('click', returnToLaunch);
    get('market-agent-end')?.addEventListener('click', () => void endSession(false));
    get('market-agent-diagnostic-copy')?.addEventListener('click', copyTrace);
    get('market-agent-diagnostic-download')?.addEventListener('click', downloadDiagnostics);
    window.addEventListener('pagehide', () => { void endSession(true); });
    if (window.location.hash === '#market-agent') {
      window.requestAnimationFrame(() => marketOpenAgent({ replaceHistory: true, scroll: false }));
    }
  }

  window.marketOpenAgent = marketOpenAgent;
  window.marketShowIntro = marketShowIntro;
  window.marketEnterFromEntry = marketEnterFromEntry;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
