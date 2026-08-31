import { initAgentChat } from '../vendor/aily-web-sdk/aily-web-sdk.js';

const config = window.VALUE_AILY_WEB_SDK || {};
const page = document.getElementById('page-value');
const view = document.getElementById('value-agent-websdk-view');
const root = document.getElementById('value-agent-websdk-container');
const status = document.getElementById('value-agent-websdk-status');
const errorBox = document.getElementById('value-agent-websdk-error');
const errorMessage = document.getElementById('value-agent-websdk-error-message');
const retryButton = document.getElementById('value-agent-websdk-retry');
const traceLabel = document.getElementById('value-agent-websdk-trace');
const timeline = document.getElementById('value-agent-websdk-timeline');
const downloadButton = document.getElementById('value-agent-websdk-download');
const copyStatus = document.getElementById('value-agent-copy-status');

const skillTemplates = Object.freeze({
  general: [
    '/dreamworks-full-report-xu-prefin-v2',
    '标的：请填写公司名称或股票代码',
    '需求：请按通用梦工场框架生成深研底稿，并列出红蓝军 PK、证据缺口与下一轮任务。'
  ].join('\n'),
  'innovative-drug': [
    '/dreamworks-innovative-drug-report-xu-prefin-v2',
    '标的：请填写创新药公司名称或股票代码',
    '需求：请按创新药专用框架研究研发管线、临床进度、竞争格局、商业化路径与关键证据风险。'
  ].join('\n')
});

let sdkInstance = null;
let mountPromise = null;
let generation = 0;
let trace = null;

function traceId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `dw-aily-research-${window.crypto.randomUUID()}`;
  }
  return `dw-aily-research-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
    operation: 'feishu.aily-web-sdk.initAgentChat.research',
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
  return '<div class="strategy-agent-websdk-loading" id="value-agent-websdk-loading" role="status">' +
    '<span aria-hidden="true"></span>' +
    '<strong>正在载入飞书投研会话面板</strong>' +
    '<small>首次打开可能需要完成飞书登录</small>' +
    '</div>';
}

function hideLoading() {
  const loading = document.getElementById('value-agent-websdk-loading');
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
    return '飞书登录或投研专员可用范围校验没有通过，请用获授权的飞书账号重新登录。';
  }
  if (/timeout|network|fetch|load/i.test(message)) {
    return '飞书投研会话面板加载超时，请检查网络后重新连接。';
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
  if (!root) return null;
  if (sdkInstance) {
    setStatus('会话面板已载入', 'ready');
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
    showError('投研专员缺少飞书 Web SDK channelToken 配置。', 'CHANNEL_TOKEN_MISSING');
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
    iframe.setAttribute('title', '梦工场投研专员飞书会话面板');
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
      showError('飞书投研会话面板资源加载失败，请检查网络后重试。', 'IFRAME_LOAD_ERROR');
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
  anchor.download = `dreamworks-research-aily-diagnostics-${trace.traceId}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard copy failed');
}

function setupSkillButtons() {
  document.querySelectorAll('[data-value-skill]').forEach((button) => {
    button.addEventListener('click', async () => {
      const skill = button.dataset.valueSkill;
      const template = skillTemplates[skill];
      if (!template) return;
      const originalText = button.textContent;
      try {
        await copyText(template);
        button.textContent = '已复制，粘贴到右侧会话框';
        button.classList.add('is-copied');
        if (copyStatus) copyStatus.textContent = '技能指令及提问模板已复制；请粘贴到右侧输入框并填写真实标的信息。';
        addTrace('skill.template.copied', 'success', { skill });
      } catch (error) {
        if (copyStatus) copyStatus.textContent = '浏览器未允许自动复制，请手动选中上方技能指令复制。';
        addTrace('skill.template.copied', 'warning', { skill, message: safeError(error) });
      }
      window.setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('is-copied');
      }, 2600);
    });
  });
}

function setHistory(options) {
  if (!options || (!options.pushHistory && !options.replaceHistory)) return;
  const state = options.agent
    ? { page: 'value', valueView: 'agent' }
    : { page: 'value', valueView: 'intro' };
  const hash = options.agent ? '#value-agent' : '#value';
  try {
    if (options.replaceHistory) window.history.replaceState(state, '', hash);
    else window.history.pushState(state, '', hash);
  } catch (error) {
    window.location.hash = hash;
  }
}

function ensureValuePage() {
  if (page && !page.classList.contains('active') && typeof window.navigateTo === 'function') {
    window.navigateTo('value', { skipHistory: true, scroll: false, preserveValueView: true });
  }
}

function valueOpenAgent(options = {}) {
  ensureValuePage();
  if (page) page.classList.add('value-agent-active');
  if (view) view.setAttribute('aria-hidden', 'false');
  setHistory({ ...options, agent: true });
  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: 'auto' });
  document.title = '梦工场投研专员 · 狠值投资';
  void mountAgent();
}

function valueShowIntro(options = {}) {
  ensureValuePage();
  if (page) page.classList.remove('value-agent-active');
  if (view) view.setAttribute('aria-hidden', 'true');
  setHistory({ ...options, agent: false });
  void destroyAgent();
  document.title = '狠值投资 · 梦工场家族传承系统';
  if (options.scrollToEntry) {
    window.requestAnimationFrame(() => {
      document.getElementById('value-slide-15')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  } else if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

if (retryButton) {
  retryButton.addEventListener('click', async () => {
    await destroyAgent();
    await mountAgent();
  });
}
if (downloadButton) downloadButton.addEventListener('click', downloadTrace);
setupSkillButtons();

window.valueOpenAgent = valueOpenAgent;
window.valueShowIntro = valueShowIntro;
window.valueAgentMount = mountAgent;
window.valueAgentDestroy = destroyAgent;
window.valueAgentDiagnostics = () => trace ? JSON.parse(JSON.stringify(trace)) : null;

if (window.location.hash === '#value-agent' || page?.classList.contains('value-agent-active')) {
  window.requestAnimationFrame(() => valueOpenAgent({ replaceHistory: true, scroll: false }));
}

window.addEventListener('pagehide', () => {
  void destroyAgent({ reset: false });
});
