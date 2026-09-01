import { initAgentChat } from '../vendor/aily-web-sdk/aily-web-sdk.js';

const auth = window.DREAMWORKS_STRATEGY_AUTH || { grants: {} };

const definitions = Object.freeze({
  wealth: {
    pageId: 'page-wealth',
    authId: 'wealth-agent-auth-view',
    viewId: 'wealth-agent-websdk-view',
    rootId: 'wealth-agent-container',
    statusId: 'wealth-agent-status',
    errorId: 'wealth-agent-error',
    errorMessageId: 'wealth-agent-error-message',
    retryId: 'wealth-agent-retry',
    traceId: 'wealth-agent-trace',
    timelineId: 'wealth-agent-timeline',
    downloadId: 'wealth-agent-download',
    activeClass: 'wealth-agent-active',
    authClass: 'wealth-agent-auth-active',
    otherClasses: ['wealth-intro-active', 'wealth-wizard-active'],
    hash: '#wealth-agent',
    page: 'wealth',
    title: '身家诊断顾问 · 梦工场',
    label: '身家诊断顾问',
    loading: '正在载入飞书身家诊断顾问',
    back: () => window.wealthShowIntro?.({ pushHistory: true }),
    preserveOption: 'preserveWealthView'
  },
  trust: {
    pageId: 'page-trust',
    authId: 'trust-agent-auth-view',
    viewId: 'trust-agent-websdk-view',
    rootId: 'trust-agent-container',
    statusId: 'trust-agent-status',
    errorId: 'trust-agent-error',
    errorMessageId: 'trust-agent-error-message',
    retryId: 'trust-agent-retry',
    traceId: 'trust-agent-trace',
    timelineId: 'trust-agent-timeline',
    downloadId: 'trust-agent-download',
    activeClass: 'trust-agent-active',
    authClass: 'trust-agent-auth-active',
    otherClasses: ['trust-intro-active', 'trust-wizard-active'],
    hash: '#trust-agent',
    page: 'trust',
    title: '家族信托设立系统顾问 · 梦工场',
    label: '家族信托设立系统顾问',
    loading: '正在载入飞书家族信托顾问',
    back: () => window.trustShowIntro?.({ pushHistory: true }),
    preserveOption: 'preserveTrustView'
  }
});

function safeError(error) {
  return String(error?.message || error || 'Unknown error')
    .replace(/channelToken=[^&\s]+/gi, 'channelToken=[REDACTED]')
    .replace(/wsk_[A-Za-z0-9_-]+/g, 'wsk_[REDACTED]')
    .slice(0, 400);
}

function createTraceId(scope) {
  const suffix = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `dw-aily-${scope}-${suffix}`;
}

function createClient(scope, definition) {
  const elements = {
    page: document.getElementById(definition.pageId),
    authView: document.getElementById(definition.authId),
    view: document.getElementById(definition.viewId),
    root: document.getElementById(definition.rootId),
    status: document.getElementById(definition.statusId),
    error: document.getElementById(definition.errorId),
    errorMessage: document.getElementById(definition.errorMessageId),
    retry: document.getElementById(definition.retryId),
    traceLabel: document.getElementById(definition.traceId),
    timeline: document.getElementById(definition.timelineId),
    download: document.getElementById(definition.downloadId)
  };
  let config = null;
  let configPromise = null;
  let sdk = null;
  let mountPromise = null;
  let generation = 0;
  let trace = null;

  function loadingMarkup() {
    return `<div class="strategy-agent-websdk-loading" role="status"><span aria-hidden="true"></span><strong>${definition.loading}</strong><small>首次打开可能需要完成飞书登录</small></div>`;
  }

  function renderTrace() {
    if (!elements.timeline || !trace) return;
    elements.timeline.textContent = '';
    trace.events.forEach((event) => {
      const item = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = `+${event.offsetMs}ms ${event.stage}`;
      item.append(strong, document.createTextNode(` · ${event.outcome}`));
      elements.timeline.appendChild(item);
    });
  }

  function addTrace(stage, outcome, data = {}) {
    if (!trace) return;
    trace.events.push({
      sequence: trace.events.length + 1,
      timestamp: new Date().toISOString(),
      offsetMs: Date.now() - Date.parse(trace.startedAt),
      stage,
      outcome,
      data
    });
    renderTrace();
  }

  function beginTrace() {
    trace = {
      traceId: createTraceId(scope),
      operation: `feishu.aily-web-sdk.${scope}.initAgentChat`,
      startedAt: new Date().toISOString(),
      page: { origin: location.origin, pathname: location.pathname, hostname: location.hostname },
      configuration: {
        channelTokenPresent: Boolean(config?.channelToken),
        channelTokenLength: String(config?.channelToken || '').length,
        sdkVersion: config?.sdkVersion || 'unknown',
        expectedIframeOrigin: config?.iframeOrigin || 'https://aily.feishu.cn',
        configuredAllowedHost: config?.allowedHost || null
      },
      events: []
    };
    if (elements.traceLabel) elements.traceLabel.textContent = trace.traceId;
    addTrace('trace.started', 'start');
  }

  function setStatus(text, state = '') {
    if (!elements.status) return;
    elements.status.textContent = text;
    elements.status.classList.toggle('is-ready', state === 'ready');
    elements.status.classList.toggle('is-error', state === 'error');
  }

  async function loadConfig() {
    if (config?.channelToken) return config;
    if (configPromise) return configPromise;
    configPromise = fetch(`/api/strategy-auth/agent-config/${scope}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.config?.channelToken) {
        const error = new Error(payload.error?.message || `${definition.label}配置未能载入。`);
        error.code = payload.error?.code || 'CONFIG_LOAD_FAILED';
        throw error;
      }
      config = {
        channelToken: String(payload.config.channelToken),
        sdkVersion: String(payload.config.sdkVersion || '0.0.12'),
        iframeOrigin: String(payload.config.iframeOrigin || 'https://aily.feishu.cn'),
        allowedHost: String(payload.config.allowedHost || '')
      };
      return config;
    }).finally(() => { configPromise = null; });
    return configPromise;
  }

  function explainError(error) {
    const message = safeError(error);
    if (/domain|origin|白名单|unauthorized/i.test(message)) return '当前网站域名可能不在飞书 Web SDK 白名单内，请核对线上域名。';
    if (/login|auth|登录|permission/i.test(message)) return '飞书登录或智能体可用范围校验没有通过，请使用获授权的飞书账号。';
    if (/timeout|network|fetch|load/i.test(message)) return '飞书会话面板加载超时，请检查网络后重试。';
    return `飞书 Web SDK 初始化失败：${message}`;
  }

  function showError(error) {
    const message = explainError(error);
    setStatus('连接失败', 'error');
    if (elements.errorMessage) elements.errorMessage.textContent = message;
    if (elements.error) elements.error.hidden = false;
    addTrace('sdk.init.error', 'error', { code: error?.code || 'SDK_INIT_FAILED', message });
  }

  async function destroy(options = {}) {
    generation += 1;
    const instance = sdk;
    sdk = null;
    mountPromise = null;
    if (instance?.destroy) {
      try {
        await Promise.race([
          Promise.resolve(instance.destroy()),
          new Promise((resolve) => setTimeout(resolve, 1500))
        ]);
        addTrace('sdk.destroy', 'success');
      } catch (error) {
        addTrace('sdk.destroy', 'warning', { message: safeError(error) });
      }
    }
    if (elements.root && options.reset !== false) elements.root.innerHTML = loadingMarkup();
    if (elements.error) elements.error.hidden = true;
    setStatus('准备连接');
  }

  async function mount() {
    if (!elements.root) return null;
    if (sdk) return sdk;
    if (mountPromise) return mountPromise;
    const currentGeneration = ++generation;
    elements.root.innerHTML = loadingMarkup();
    if (elements.error) elements.error.hidden = true;
    setStatus('正在验证访问会话');
    mountPromise = (async () => {
      try {
        await loadConfig();
        beginTrace();
        addTrace('protected.config', 'success', { tokenPresent: true });
        const hostMatches = !config.allowedHost || location.hostname === config.allowedHost;
        addTrace('origin.checked', hostMatches ? 'success' : 'warning', { currentHost: location.hostname, matchesConfiguredHost: hostMatches });
        setStatus('正在连接');
        const startedAt = Date.now();
        const instance = await initAgentChat(elements.root, { channelToken: config.channelToken });
        if (currentGeneration !== generation) {
          await instance?.destroy?.();
          return null;
        }
        sdk = instance;
        const iframe = elements.root.querySelector('iframe');
        if (iframe) iframe.setAttribute('title', `${definition.label}飞书会话面板`);
        setStatus('会话面板已载入', 'ready');
        addTrace('sdk.init.completed', 'success', { initDurationMs: Date.now() - startedAt, iframePresent: Boolean(iframe) });
        return sdk;
      } catch (error) {
        if (!trace) beginTrace();
        showError(error);
        return null;
      } finally {
        if (currentGeneration === generation) mountPromise = null;
      }
    })();
    return mountPromise;
  }

  function setHistory(options = {}) {
    if (!options.pushHistory && !options.replaceHistory) return;
    const state = { page: definition.page, [`${definition.page}View`]: 'agent' };
    try {
      window.history[options.replaceHistory ? 'replaceState' : 'pushState'](state, '', definition.hash);
    } catch (error) { location.hash = definition.hash; }
  }

  function open(options = {}) {
    if (!elements.page?.classList.contains('active') && typeof window.navigateTo === 'function') {
      window.navigateTo(definition.page, { skipHistory: true, scroll: false, [definition.preserveOption]: true });
    }
    const granted = Boolean(auth.grants?.[scope]);
    elements.page?.classList.remove(...definition.otherClasses, definition.activeClass, definition.authClass);
    elements.page?.classList.add(granted ? definition.activeClass : definition.authClass);
    elements.authView?.setAttribute('aria-hidden', String(granted));
    elements.view?.setAttribute('aria-hidden', String(!granted));
    setHistory(options);
    document.title = granted ? definition.title : `访问验证 · ${definition.label}`;
    if (options.scroll !== false) scrollTo({ top: 0, behavior: 'auto' });
    if (granted) void mount();
    else setTimeout(() => document.getElementById(`${scope}-agent-username`)?.focus({ preventScroll: true }), 50);
  }

  function downloadTrace() {
    if (!trace) return;
    const blob = new Blob([JSON.stringify({ ...trace, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dreamworks-${scope}-aily-diagnostics-${trace.traceId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  elements.retry?.addEventListener('click', async () => { await destroy(); await mount(); });
  elements.download?.addEventListener('click', downloadTrace);
  return { open, mount, destroy, diagnostics: () => trace ? JSON.parse(JSON.stringify(trace)) : null };
}

const clients = Object.fromEntries(Object.entries(definitions).map(([scope, definition]) => [scope, createClient(scope, definition)]));

window.wealthAilyOpen = clients.wealth.open;
window.wealthAilyMount = clients.wealth.mount;
window.wealthAilyAgentDestroy = clients.wealth.destroy;
window.wealthAilyDiagnostics = clients.wealth.diagnostics;
window.trustAilyOpen = clients.trust.open;
window.trustAilyMount = clients.trust.mount;
window.trustAilyAgentDestroy = clients.trust.destroy;
window.trustAilyDiagnostics = clients.trust.diagnostics;

if (location.hash === '#wealth-agent') requestAnimationFrame(() => clients.wealth.open({ replaceHistory: true, scroll: false }));
if (location.hash === '#trust-agent') requestAnimationFrame(() => clients.trust.open({ replaceHistory: true, scroll: false }));

window.addEventListener('pagehide', () => {
  void clients.wealth.destroy({ reset: false });
  void clients.trust.destroy({ reset: false });
});
