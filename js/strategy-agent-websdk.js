import { initAgentChat } from '../vendor/aily-web-sdk/aily-web-sdk.js';

const config = window.STRATEGY_AILY_WEB_SDK || {};
const root = document.getElementById('strategy-agent-websdk-container');
const status = document.getElementById('strategy-agent-websdk-status');
const errorBox = document.getElementById('strategy-agent-websdk-error');
const errorMessage = document.getElementById('strategy-agent-websdk-error-message');
const retryButton = document.getElementById('strategy-agent-websdk-retry');
const traceLabel = document.getElementById('strategy-agent-websdk-trace');
const timeline = document.getElementById('strategy-agent-websdk-timeline');
const downloadButton = document.getElementById('strategy-agent-websdk-download');

let sdkInstance = null;
let mountPromise = null;
let generation = 0;
let trace = null;

function traceId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `dw-aily-${window.crypto.randomUUID()}`;
  }
  return `dw-aily-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeError(error) {
  const message = error && error.message ? String(error.message) : String(error || 'Unknown error');
  return message
    .replace(/channelToken=[^&\s]+/gi, 'channelToken=[REDACTED]')
    .replace(/wsk_[A-Za-z0-9_-]+/g, 'wsk_[REDACTED]')
    .slice(0, 400);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function destroySdkInstance(instance, timeoutMs = 1500) {
  return Promise.race([
    Promise.resolve()
      .then(() => instance.destroy())
      .then(() => ({ outcome: 'success' }))
      .catch((error) => ({ outcome: 'warning', message: safeError(error) })),
    new Promise((resolve) => window.setTimeout(() => {
      resolve({ outcome: 'warning', message: `destroy timed out after ${timeoutMs}ms` });
    }, timeoutMs))
  ]);
}

function beginTrace() {
  trace = {
    traceId: traceId(),
    operation: 'feishu.aily-web-sdk.initAgentChat',
    startedAt: new Date().toISOString(),
    sdkVersion: config.sdkVersion || 'unknown',
    page: {
      origin: window.location.origin,
      pathname: window.location.pathname,
      hostname: window.location.hostname
    },
    configuration: {
      channelTokenPresent: Boolean(config.channelToken),
      channelTokenLength: typeof config.channelToken === 'string' ? config.channelToken.length : 0,
      expectedIframeOrigin: config.iframeOrigin || 'https://aily.feishu.cn',
      configuredAllowedHost: config.allowedHost || null,
      customParamsMode: 'disabled'
    },
    events: []
  };
  if (traceLabel) traceLabel.textContent = trace.traceId;
  renderTrace();
  addTrace('trace.started', 'start');
}

function addTrace(stage, outcome, data = {}) {
  if (!trace) return;
  const timestamp = new Date().toISOString();
  trace.events.push({
    sequence: trace.events.length + 1,
    timestamp,
    offsetMs: Date.parse(timestamp) - Date.parse(trace.startedAt),
    stage,
    outcome,
    data
  });
  renderTrace();
}

function renderTrace() {
  if (!timeline || !trace) return;
  timeline.innerHTML = trace.events.map((event) => {
    const data = Object.keys(event.data || {}).length
      ? ` · ${Object.entries(event.data).map(([key, value]) => `${escapeHtml(key)}=${escapeHtml(value)}`).join(', ')}`
      : '';
    return `<li><strong>+${Number(event.offsetMs) || 0}ms ${escapeHtml(event.stage)}</strong> · ${escapeHtml(event.outcome)}${data}</li>`;
  }).join('');
}

function setStatus(text, state) {
  if (!status) return;
  status.textContent = text;
  status.classList.toggle('is-ready', state === 'ready');
  status.classList.toggle('is-error', state === 'error');
}

function loadingMarkup() {
  return '<div class="strategy-agent-websdk-loading" id="strategy-agent-websdk-loading" role="status">' +
    '<span aria-hidden="true"></span>' +
    '<strong>正在载入飞书智能体会话面板</strong>' +
    '<small>首次打开可能需要完成飞书登录</small>' +
    '</div>';
}

function hideLoading() {
  const loading = document.getElementById('strategy-agent-websdk-loading');
  if (loading) loading.hidden = true;
}

function showError(message, code) {
  setStatus('连接失败', 'error');
  hideLoading();
  if (errorMessage) errorMessage.textContent = message;
  if (errorBox) errorBox.hidden = false;
  addTrace('sdk.init.error', 'error', { code, message });
}

function explainError(error) {
  const message = safeError(error);
  if (/domain|origin|白名单|unauthorized/i.test(message)) {
    return '当前网站域名可能不在飞书 Web SDK 白名单内，请核对线上域名后重试。';
  }
  if (/login|auth|登录|permission/i.test(message)) {
    return '飞书登录或智能体可用范围校验没有通过，请用获授权的飞书账号重新登录。';
  }
  if (/timeout|network|fetch|load/i.test(message)) {
    return '飞书会话面板加载超时，请检查网络后重新连接。';
  }
  return `飞书 Web SDK 初始化失败：${message}`;
}

async function destroyAgent(options = {}) {
  generation += 1;
  const instance = sdkInstance;
  sdkInstance = null;
  mountPromise = null;
  if (instance && typeof instance.destroy === 'function') {
    const result = await destroySdkInstance(instance);
    addTrace('sdk.destroy', result.outcome, result.message ? { message: result.message } : {});
  }
  if (root && options.reset !== false) root.innerHTML = loadingMarkup();
  if (errorBox) errorBox.hidden = true;
  setStatus('准备连接');
}

async function mountAgent() {
  if (!root) return;
  if (sdkInstance) {
    setStatus('会话面板已连接', 'ready');
    return sdkInstance;
  }
  if (mountPromise) return mountPromise;

  const currentGeneration = ++generation;
  beginTrace();
  root.innerHTML = loadingMarkup();
  if (errorBox) errorBox.hidden = true;
  setStatus('正在连接');

  const onAllowedHost = !config.allowedHost || window.location.hostname === config.allowedHost;
  addTrace('origin.checked', onAllowedHost ? 'success' : 'warning', {
    currentHost: window.location.hostname || 'local-file',
    matchesConfiguredHost: onAllowedHost
  });

  if (!config.channelToken) {
    showError('定位智体缺少飞书 Web SDK channelToken 配置。', 'CHANNEL_TOKEN_MISSING');
    return null;
  }

  addTrace('sdk.init.started', 'start', {
    channelTokenPresent: true,
    customParamsInjected: false
  });

  let iframeLoaded = false;
  let iframeFailed = false;
  const initStartedAt = Date.now();
  const observer = new MutationObserver(() => {
    const iframe = root.querySelector('iframe');
    if (!iframe || iframe.dataset.dreamworksObserved === 'true') return;
    iframe.dataset.dreamworksObserved = 'true';
    iframe.setAttribute('title', '梦工场定位智体飞书会话面板');
    addTrace('iframe.created', 'success', {
      host: (() => { try { return new URL(iframe.src).host; } catch { return 'unknown'; } })()
    });
    iframe.addEventListener('load', () => {
      iframeLoaded = true;
      hideLoading();
      setStatus('会话面板已载入', 'ready');
      addTrace('iframe.loaded', 'success');
    }, { once: true });
    iframe.addEventListener('error', () => {
      iframeFailed = true;
      showError('飞书会话面板资源加载失败，请检查网络后重试。', 'IFRAME_LOAD_ERROR');
    }, { once: true });
  });
  observer.observe(root, { childList: true });

  mountPromise = (async () => {
    try {
      const instance = await initAgentChat(root, { channelToken: config.channelToken });
      if (currentGeneration !== generation) {
        if (instance && typeof instance.destroy === 'function') await destroySdkInstance(instance);
        return null;
      }
      sdkInstance = instance;
      hideLoading();
      const initDurationMs = Date.now() - initStartedAt;
      const handshakeTimedOutLikely = initDurationMs >= 29500;
      if (!iframeFailed) {
        setStatus(
          handshakeTimedOutLikely ? '会话面板已载入 · 身份待确认' : '会话面板已载入',
          'ready'
        );
      }
      addTrace('sdk.init.completed', handshakeTimedOutLikely ? 'warning' : 'success', {
        iframeLoadObserved: iframeLoaded,
        initDurationMs,
        handshake: handshakeTimedOutLikely ? 'not-confirmed' : 'confirmed'
      });
      return instance;
    } catch (error) {
      if (currentGeneration === generation) {
        showError(explainError(error), 'SDK_INIT_FAILED');
      }
      return null;
    } finally {
      observer.disconnect();
      if (currentGeneration === generation) mountPromise = null;
    }
  })();

  return mountPromise;
}

function downloadTrace() {
  if (!trace) return;
  const payload = {
    ...trace,
    exportedAt: new Date().toISOString(),
    outcome: trace.events.some((event) => event.outcome === 'error') ? 'error' : 'success'
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dreamworks-aily-diagnostics-${trace.traceId}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

if (retryButton) {
  retryButton.addEventListener('click', async () => {
    await destroyAgent();
    await mountAgent();
  });
}

if (downloadButton) downloadButton.addEventListener('click', downloadTrace);

window.strategyAgentMount = mountAgent;
window.strategyAgentDestroy = destroyAgent;
window.strategyAgentDiagnostics = () => trace ? JSON.parse(JSON.stringify(trace)) : null;

const strategyPage = document.getElementById('page-strategy');
if (window.location.hash === '#strategy-agent' || strategyPage?.classList.contains('strategy-agent-active')) {
  void mountAgent();
}

window.addEventListener('pagehide', () => {
  void destroyAgent({ reset: false });
});
