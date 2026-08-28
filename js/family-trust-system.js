/**
 * family-trust-system.js — 家族信托五阶段意愿访谈 MVP
 * 本地存储 + 规则化摘要 + 浏览器语音转写（可选）+ PDF 导出。
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'dreamworks_family_trust_mvp_v1';
  const GUIDE_QUESTIONS = {
    1: '先简单介绍一下您和家族企业，以及希望传承给下一代的是什么？',
    2: '如果这份信托只能解决三件事，您最希望解决什么？财富给谁、何时给、什么情况下暂停？',
    3: '哪些资产最希望先保护起来？哪些因抵押、锁定、共有或跨境原因需要晚一点处理？',
    4: '未来谁来管理、谁来监督、谁有权调整规则？哪些底线绝不能突破？',
    5: '请检查这份预演：哪些内容已经确定，哪些事项必须交给专业顾问继续核验？'
  };

  let state = globalThis.FamilyTrustModel.createInitialState();
  let recognition = null;
  let listening = false;
  let saveTimer = null;

  function getByPath(object, path) {
    return path.split('.').reduce((value, key) => value && value[key], object);
  }

  function setByPath(object, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((cursor, key) => {
      if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
      return cursor[key];
    }, object);
    target[last] = value;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      state = globalThis.FamilyTrustModel.mergeState(state, saved);
    } catch (error) {
      state = globalThis.FamilyTrustModel.createInitialState();
    }
  }

  function persistState(silent) {
    syncStateFromDom();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (!silent) showToast('家族信托草稿已保存在当前浏览器。');
    } catch (error) {
      if (!silent) showToast('浏览器未允许本地保存，请导出 PDF 留存。');
    }
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => persistState(true), 350);
  }

  function syncStateFromDom() {
    document.querySelectorAll('#trust-system-wizard [data-trust-field]').forEach((input) => {
      const value = input.type === 'checkbox' ? input.checked : input.value;
      setByPath(state, input.dataset.trustField, value);
    });
    state.purposes = Array.from(document.querySelectorAll('#trust-system-wizard [data-trust-purpose]:checked'))
      .map((input) => input.dataset.trustPurpose);
    document.querySelectorAll('#trust-system-wizard [data-trust-amount]').forEach((input) => {
      state.assetAmounts[input.dataset.trustAmount] = Number.parseFloat(input.value) || 0;
    });
    document.querySelectorAll('#trust-system-wizard [data-trust-note]').forEach((input) => {
      state.notes[input.dataset.trustNote] = input.value;
    });
  }

  function syncDomFromState() {
    document.querySelectorAll('#trust-system-wizard [data-trust-field]').forEach((input) => {
      const value = getByPath(state, input.dataset.trustField);
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = value == null ? '' : value;
    });
    document.querySelectorAll('#trust-system-wizard [data-trust-purpose]').forEach((input) => {
      input.checked = state.purposes.includes(input.dataset.trustPurpose);
    });
    document.querySelectorAll('#trust-system-wizard [data-trust-amount]').forEach((input) => {
      const value = Number(state.assetAmounts[input.dataset.trustAmount]) || 0;
      input.value = value || '';
    });
    document.querySelectorAll('#trust-system-wizard [data-trust-note]').forEach((input) => {
      input.value = state.notes[input.dataset.trustNote] || '';
    });
    updateLivePreview();
  }

  function trustSetView(view, options) {
    const settings = options || {};
    const page = document.getElementById('page-trust');
    if (!page) return;
    const wizardActive = view === 'wizard';
    page.classList.toggle('trust-intro-active', !wizardActive);
    page.classList.toggle('trust-wizard-active', wizardActive);
    document.getElementById('trust-system-intro')?.setAttribute('aria-hidden', String(wizardActive));
    document.getElementById('trust-system-wizard')?.setAttribute('aria-hidden', String(!wizardActive));

    if (settings.pushHistory || settings.replaceHistory) {
      const method = settings.replaceHistory ? 'replaceState' : 'pushState';
      const hash = wizardActive ? '#trust-system' : '#trust';
      try {
        window.history[method]({ page: 'trust', trustView: wizardActive ? 'wizard' : 'intro' }, '', hash);
      } catch (error) {}
    }
    if (settings.scroll !== false) window.scrollTo({ top: 0, behavior: settings.smooth ? 'smooth' : 'auto' });
  }

  function trustShowIntro(options) {
    stopVoice();
    trustSetView('intro', options);
  }

  function trustEnterSystem(options) {
    trustSetView('wizard', options);
    trustGoToStep(state.step || 1, { scroll: false });
    window.setTimeout(() => document.querySelector('#trust-system-wizard h2')?.focus({ preventScroll: true }), 0);
  }

  function trustGoToStep(step, options) {
    const settings = options || {};
    syncStateFromDom();
    const nextStep = Math.min(5, Math.max(1, Number.parseInt(step, 10) || 1));
    state.step = nextStep;
    document.querySelectorAll('[data-trust-panel]').forEach((panel) => {
      panel.classList.toggle('is-active', Number(panel.dataset.trustPanel) === nextStep);
    });
    document.querySelectorAll('[data-trust-step]').forEach((button) => {
      const buttonStep = Number(button.dataset.trustStep);
      button.classList.toggle('is-active', buttonStep === nextStep);
      button.classList.toggle('is-complete', buttonStep < nextStep);
      if (buttonStep === nextStep) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    const question = document.getElementById('trust-guide-question');
    if (question) question.textContent = GUIDE_QUESTIONS[nextStep];
    stopVoice();
    updateLivePreview();
    if (nextStep === 5) renderPlan();
    persistState(true);
    if (settings.scroll !== false) {
      document.getElementById('trust-progress')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function updateLivePreview() {
    syncStateFromDomLight();
    const total = globalThis.FamilyTrustModel.totalAssets(state);
    const totalEl = document.getElementById('trust-asset-total');
    const threshold = document.getElementById('trust-threshold-status');
    if (totalEl) totalEl.textContent = globalThis.FamilyTrustModel.formatMoneyWan(total);
    if (threshold) {
      threshold.textContent = total
        ? (total >= 1000 ? '达到当前业务资料中的 1000 万元基础门槛，仍需受托机构核验' : '低于 1000 万元基础门槛，建议评估替代工具')
        : '待录入资产后判断设立门槛';
    }
    const settlor = document.getElementById('trust-map-settlor');
    const beneficiaries = document.getElementById('trust-map-beneficiaries');
    if (settlor) settlor.textContent = state.profile.name || '待填写';
    if (beneficiaries) beneficiaries.textContent = state.intent.beneficiaries || '待填写';
  }

  function syncStateFromDomLight() {
    document.querySelectorAll('#trust-system-wizard [data-trust-amount]').forEach((input) => {
      state.assetAmounts[input.dataset.trustAmount] = Number.parseFloat(input.value) || 0;
    });
    const name = document.querySelector('[data-trust-field="profile.name"]');
    const beneficiaries = document.querySelector('[data-trust-field="intent.beneficiaries"]');
    if (name) state.profile.name = name.value;
    if (beneficiaries) state.intent.beneficiaries = beneficiaries.value;
  }

  function renderPlan() {
    syncStateFromDom();
    const result = globalThis.FamilyTrustModel.analyse(state);
    const score = document.getElementById('trust-readiness-score');
    const label = document.getElementById('trust-readiness-label');
    const lead = document.getElementById('trust-summary-lead');
    if (score) score.textContent = `${result.score}%`;
    if (label) label.textContent = result.score >= 85 ? '可进入专业方案讨论' : result.score >= 60 ? '已有框架，仍需补充' : '建议继续完成访谈';
    if (lead) lead.textContent = result.summary;

    const gaps = document.getElementById('trust-readiness-gaps');
    if (gaps) {
      gaps.innerHTML = `<div class="trust-gap-chips">${result.gaps.length
        ? result.gaps.map((gap) => `<span>${escapeHtml(gap)}待补充</span>`).join('')
        : '<span class="is-ready">核心访谈字段已齐备</span>'}</div>`;
    }
    const elements = document.getElementById('trust-element-list');
    if (elements) {
      elements.innerHTML = result.elements.map(([name, value]) =>
        `<div class="trust-element-item"><span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong></div>`
      ).join('');
    }
    const actions = document.getElementById('trust-action-list');
    if (actions) {
      actions.innerHTML = result.actions.map((action, index) =>
        `<div class="trust-action-item"><span>${index + 1}</span><div><strong>${escapeHtml(action.title)} · ${escapeHtml(action.priority)}</strong><p>${escapeHtml(action.copy)}</p></div></div>`
      ).join('');
    }
  }

  function loadDemo() {
    if (!window.confirm('载入虚拟案例会覆盖当前未保存的表单内容，是否继续？')) return;
    state = globalThis.FamilyTrustModel.createDemoState();
    syncDomFromState();
    trustGoToStep(1, { scroll: false });
    persistState(true);
    showToast('“孙海蛋”虚拟案例已载入。案例不包含身份证、账户或联系方式。');
  }

  function resetSystem() {
    if (!window.confirm('确定清空当前家族信托草稿吗？此操作无法撤销。')) return;
    state = globalThis.FamilyTrustModel.createInitialState();
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) {}
    syncDomFromState();
    trustGoToStep(1, { scroll: false });
    showToast('家族信托草稿已清空。');
  }

  function setupVoice() {
    const button = document.getElementById('trust-voice-button');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!button) return;
    if (!Recognition) {
      button.disabled = true;
      button.textContent = '当前浏览器不支持语音';
      setVoiceStatus('您仍可在“自由补充”框中直接输入。');
      return;
    }
    recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join('');
      const note = document.querySelector(`[data-trust-note="${state.step}"]`);
      if (note) {
        note.value = `${note.value}${note.value ? '\n' : ''}${transcript}`;
        state.notes[state.step] = note.value;
        scheduleSave();
      }
      setVoiceStatus('语音已转成文字，您可以继续修改。');
    };
    recognition.onerror = (event) => {
      listening = false;
      updateVoiceButton();
      const message = event.error === 'not-allowed' ? '麦克风权限未开启，可继续键入。' : '这次没有识别成功，请重试或直接键入。';
      setVoiceStatus(message);
    };
    recognition.onend = () => {
      listening = false;
      updateVoiceButton();
    };
    button.addEventListener('click', () => {
      if (listening) stopVoice();
      else startVoice();
    });
  }

  function startVoice() {
    if (!recognition) return;
    try {
      recognition.start();
      listening = true;
      updateVoiceButton();
      setVoiceStatus('正在聆听，请自然说出您的想法……');
    } catch (error) {
      setVoiceStatus('麦克风正在启动，请稍后再试。');
    }
  }

  function stopVoice() {
    if (recognition && listening) {
      try { recognition.stop(); } catch (error) {}
    }
    listening = false;
    updateVoiceButton();
  }

  function updateVoiceButton() {
    const button = document.getElementById('trust-voice-button');
    const guide = document.getElementById('trust-voice-guide');
    if (button && !button.disabled) button.innerHTML = listening ? '<span aria-hidden="true">■</span> 停止录入' : '<span aria-hidden="true">●</span> 语音录入';
    if (guide) guide.classList.toggle('is-listening', listening);
  }

  function setVoiceStatus(message) {
    const status = document.getElementById('trust-voice-status');
    if (status) status.textContent = message;
  }

  function reportSection(title, body) {
    return `<section style="margin-top:18px;padding:18px;border:1px solid #d9e1e7;border-radius:10px;page-break-inside:avoid"><h2 style="margin:0 0 10px;color:#0c2b48;font-size:17px">${escapeHtml(title)}</h2>${body}</section>`;
  }

  function buildReportNode() {
    const result = globalThis.FamilyTrustModel.analyse(state);
    const today = new Date().toLocaleDateString('zh-CN');
    const purpose = state.purposes.length ? state.purposes.join(' · ') : '待确认';
    const node = document.createElement('div');
    node.setAttribute('aria-hidden', 'true');
    node.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;padding:46px;background:#fff;color:#203648;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;line-height:1.65;z-index:-1';
    const profileRows = [
      ['委托人', state.profile.name || '待确认'], ['年龄', state.profile.age ? `${state.profile.age} 周岁` : '待确认'],
      ['关联企业', state.profile.company || '待确认'], ['行业 / 上市关联', `${state.profile.industry || '待确认'} / ${state.profile.listed || '待确认'}`],
      ['家族成员', state.profile.childrenDesc || '待确认'], ['传承诉求', state.profile.successionWill || '待确认']
    ];
    const tableRows = profileRows.map(([key, value]) => `<tr><th style="width:120px;padding:8px;text-align:left;background:#f3f6f8">${escapeHtml(key)}</th><td style="padding:8px;border-bottom:1px solid #e4e9ed">${escapeHtml(value)}</td></tr>`).join('');
    const elements = result.elements.map(([key, value]) => `<div style="padding:9px 10px;border-left:3px solid #d4af37;background:#f7f8f7"><small style="color:#8b7545">${escapeHtml(key)}</small><strong style="display:block;margin-top:3px;font-size:12px">${escapeHtml(value)}</strong></div>`).join('');
    const actions = result.actions.map((action, index) => `<li style="margin:0 0 8px"><strong>${index + 1}. ${escapeHtml(action.title)}</strong><br><span style="font-size:12px;color:#627585">${escapeHtml(action.copy)}</span></li>`).join('');
    node.innerHTML = `
      <header style="padding-bottom:20px;border-bottom:3px solid #d4af37"><p style="margin:0;color:#997515;font-size:12px;letter-spacing:2px">MENGONGCHANG · FAMILY TRUST</p><h1 style="margin:8px 0 4px;color:#0c2b48;font-family:serif;font-size:30px">家族信托意愿访谈摘要</h1><p style="margin:0;color:#6f8190;font-size:12px">智能交互演示版 · ${escapeHtml(today)} · 完整度 ${result.score}%</p></header>
      ${reportSection('一、家族画像', `<table style="width:100%;border-collapse:collapse;font-size:12px">${tableRows}</table>`)}
      ${reportSection('二、传承意愿', `<p style="margin:0 0 7px"><strong>核心目的：</strong>${escapeHtml(purpose)}</p><p style="margin:0 0 7px"><strong>存续意愿：</strong>${escapeHtml(state.intent.termYears ? `${state.intent.termYears} 年` : '待确认')}</p><p style="margin:0 0 7px"><strong>受益人：</strong>${escapeHtml(state.intent.beneficiaries || '待确认')}</p><p style="margin:0 0 7px"><strong>分配安排：</strong>${escapeHtml(state.intent.distribution || '待确认')}</p><p style="margin:0"><strong>保护条款：</strong>${escapeHtml(state.intent.guardrails || '待确认')}</p>`)}
      ${reportSection('三、拟规划财产与装入节奏', `<p style="margin:0 0 8px"><strong>当前录入总额：</strong>${escapeHtml(globalThis.FamilyTrustModel.formatMoneyWan(result.totalAssets))}</p><p style="margin:0 0 7px"><strong>来源与权属：</strong>${escapeHtml(state.assets.source || '待确认')}</p><p style="margin:0 0 7px"><strong>第一阶段：</strong>${escapeHtml(state.assets.phaseOne || '待确认')}</p><p style="margin:0 0 7px"><strong>第二阶段：</strong>${escapeHtml(state.assets.phaseTwo || '待确认')}</p><p style="margin:0"><strong>债务与争议：</strong>${escapeHtml(state.assets.debt || '待确认')}</p>`)}
      ${reportSection('四、家族信托十一要素初稿', `<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">${elements}</div>`)}
      ${reportSection('五、优先行动建议', `<ol style="margin:0;padding-left:19px">${actions}</ol>`)}
      ${reportSection('正式服务路径', '<p style="margin:0;font-size:12px">意愿与保密（约3天） → 签约与尽调（约4天） → 架构与文本（约21天） → 法审与签署（约28天） → 开户与财产交付（约21天）。实际工期按资料、资产与受托机构法审进度调整。</p>')}
      <footer style="margin-top:22px;padding-top:14px;border-top:1px solid #d9e1e7;color:#6e7e8b;font-size:10px">本摘要仅用于意愿沟通与专业顾问交接，不构成法律、税务、投资或产品建议。正式方案以尽调、协议、信托合同及持牌机构审核结果为准。</footer>`;
    document.body.appendChild(node);
    return node;
  }

  async function exportReport() {
    syncStateFromDom();
    renderPlan();
    const button = document.getElementById('trust-export-report');
    if (!globalThis.html2canvas || !globalThis.jspdf?.jsPDF) {
      showToast('PDF 组件未加载，请刷新页面后重试。');
      return;
    }
    const original = button ? button.textContent : '';
    if (button) { button.disabled = true; button.textContent = '正在生成 PDF…'; }
    let node = null;
    try {
      node = buildReportNode();
      const canvas = await globalThis.html2canvas(node, { scale: 1.6, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const pdf = new globalThis.jspdf.jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const imageWidth = pageWidth - margin * 2;
      const imageHeight = canvas.height * imageWidth / canvas.width;
      const image = canvas.toDataURL('image/jpeg', .93);
      let offset = 0;
      let page = 0;
      do {
        if (page > 0) pdf.addPage();
        pdf.addImage(image, 'JPEG', margin, margin - offset, imageWidth, imageHeight);
        offset += pageHeight - margin * 2;
        page += 1;
      } while (offset < imageHeight);
      const date = new Date().toISOString().slice(0, 10);
      pdf.save(`梦工场家族信托意愿访谈摘要_${date}.pdf`);
      showToast('家族信托意愿访谈摘要 PDF 已生成。');
    } catch (error) {
      console.error('[family-trust] PDF export failed', error);
      showToast('PDF 生成失败，请刷新页面后重试。');
    } finally {
      if (node?.parentNode) node.parentNode.removeChild(node);
      if (button) { button.disabled = false; button.textContent = original; }
    }
  }

  function showToast(message) {
    document.querySelector('.trust-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'trust-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3300);
  }

  function setup() {
    if (!globalThis.FamilyTrustModel || !document.getElementById('page-trust')) return;
    loadState();
    syncDomFromState();
    document.querySelectorAll('#trust-system-wizard input, #trust-system-wizard select, #trust-system-wizard textarea').forEach((input) => {
      input.addEventListener('input', () => { updateLivePreview(); scheduleSave(); });
      input.addEventListener('change', () => { updateLivePreview(); scheduleSave(); });
    });
    document.getElementById('trust-load-demo')?.addEventListener('click', loadDemo);
    document.getElementById('trust-reset')?.addEventListener('click', resetSystem);
    document.getElementById('trust-save-draft')?.addEventListener('click', () => persistState(false));
    document.getElementById('trust-export-report')?.addEventListener('click', exportReport);
    setupVoice();
    trustGoToStep(state.step || 1, { scroll: false });
  }

  globalThis.trustShowIntro = trustShowIntro;
  globalThis.trustEnterSystem = trustEnterSystem;
  globalThis.trustGoToStep = trustGoToStep;
  globalThis.exportFamilyTrustReport = exportReport;
  document.addEventListener('DOMContentLoaded', setup);
})();
