/**
 * Public strategy access router. Credentials never enter storage or page source;
 * the server issues an HttpOnly signed session cookie after validation.
 */
(function() {
  'use strict';

  var auth = window.DREAMWORKS_STRATEGY_AUTH || {
    grants: { cases: false, chat: false, agent: false, value: false, wealth: false, trust: false },
    configured: { cases: false, chat: false, agent: false, value: false, wealth: false, trust: false, session: false }
  };
  var grants = auth.grants || {};
  var protectedRouter = {
    showIntro: typeof window.strategyShowIntro === 'function' ? window.strategyShowIntro : null,
    showHub: typeof window.strategyShowHub === 'function' ? window.strategyShowHub : null,
    scrollToCases: typeof window.strategyScrollToCases === 'function' ? window.strategyScrollToCases : null,
    openCase: typeof window.strategyOpenCase === 'function' ? window.strategyOpenCase : null,
    openDepth: typeof window.strategyOpenSkyworthDepth === 'function' ? window.strategyOpenSkyworthDepth : null,
    openAgent: typeof window.strategyOpenAgent === 'function' ? window.strategyOpenAgent : null
  };

  function ensureStrategyPage() {
    var page = document.getElementById('page-strategy');
    if (page && !page.classList.contains('active') && typeof window.navigateTo === 'function') {
      window.navigateTo('strategy', { skipHistory: true, scroll: false, preserveStrategyView: true });
    }
    return page;
  }

  function setHistory(hash, state, options) {
    options = options || {};
    try {
      if (options.replaceHistory) window.history.replaceState(state, '', hash);
      else if (options.pushHistory !== false) window.history.pushState(state, '', hash);
    } catch (error) {
      window.location.hash = hash;
    }
  }

  function setPublicView(view, options) {
    options = options || {};
    var page = ensureStrategyPage();
    if (!page) return;
    var leavingAgent = page.classList.contains('strategy-agent-active') && view !== 'agent';
    page.classList.remove(
      'strategy-intro-active',
      'strategy-hub-active',
      'strategy-case-active',
      'strategy-depth-active',
      'strategy-agent-active',
      'strategy-agent-auth-active'
    );
    page.classList.add(
      view === 'intro' ? 'strategy-intro-active' :
      view === 'agent' ? 'strategy-agent-active' :
      view === 'agent-auth' ? 'strategy-agent-auth-active' : 'strategy-hub-active'
    );
    page.setAttribute('data-strategy-view', view);
    var authView = document.getElementById('strategy-agent-auth-view');
    var agentView = document.getElementById('strategy-agent-websdk-view');
    if (authView) authView.setAttribute('aria-hidden', view === 'agent-auth' ? 'false' : 'true');
    if (agentView) agentView.setAttribute('aria-hidden', view === 'agent' ? 'false' : 'true');
    if (leavingAgent && typeof window.strategyAgentDestroy === 'function') {
      void window.strategyAgentDestroy();
    }
    if (options.scroll !== false) window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function showIntro(options) {
    if (grants.cases && protectedRouter.showIntro) return protectedRouter.showIntro(options || {});
    options = options || {};
    setPublicView('intro', options);
    setHistory('#strategy', { page: 'strategy', strategyView: 'intro' }, options);
    document.title = '价值诊断与增进系统 · 梦工场战略与实践';
  }

  function showHub(options) {
    if (grants.cases && protectedRouter.showHub) return protectedRouter.showHub(options || {});
    options = options || {};
    setPublicView('hub', options);
    setHistory('#strategy-library', { page: 'strategy', strategyView: 'hub' }, options);
    document.title = '梦工场 · 家族传承系统 | 从价值创造到百年传承';
  }

  function scrollToGate() {
    var target = document.getElementById('strategy-cases-access');
    if (!target) return;
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
    window.setTimeout(function() {
      document.getElementById('strategy-cases-username')?.focus({ preventScroll: true });
    }, 350);
  }

  function requestCases(hash, state, options) {
    options = options || {};
    showHub({ pushHistory: false, scroll: false });
    setHistory(hash, state, options);
    scrollToGate();
  }

  function scrollToCases() {
    if (grants.cases && protectedRouter.scrollToCases) return protectedRouter.scrollToCases();
    requestCases('#strategy-library', { page: 'strategy', strategyView: 'hub', access: 'cases' }, { pushHistory: true });
  }

  function openCase(slug, options) {
    if (grants.cases && protectedRouter.openCase) return protectedRouter.openCase(slug, options || {});
    requestCases(
      '#strategy-case-' + String(slug || 'skyworth'),
      { page: 'strategy', strategyCase: String(slug || 'skyworth'), access: 'cases' },
      options || {}
    );
  }

  function openDepth(chapter, options) {
    if (grants.cases && protectedRouter.openDepth) return protectedRouter.openDepth(chapter, options || {});
    var safeChapter = Number(chapter) === 2 ? 2 : 1;
    requestCases(
      '#strategy-chapter' + safeChapter,
      { page: 'strategy', strategyChapter: safeChapter, strategyCase: 'skyworth', access: 'cases' },
      options || {}
    );
  }

  function openAgent(options) {
    options = options || {};
    if (grants.agent) {
      if (protectedRouter.openAgent) return protectedRouter.openAgent(options);
      setPublicView('agent', options);
      setHistory('#strategy-agent', { page: 'strategy', strategyView: 'agent' }, options);
      document.title = '梦工场定位智体 · 战略与实践';
      window.requestAnimationFrame(function() {
        if (typeof window.strategyAgentMount === 'function') void window.strategyAgentMount();
      });
      return;
    }
    setPublicView('agent-auth', options);
    setHistory('#strategy-agent', { page: 'strategy', strategyView: 'agent-auth' }, options);
    document.title = '访问验证 · 梦工场定位智体';
    window.setTimeout(function() {
      document.getElementById('strategy-agent-username')?.focus({ preventScroll: true });
    }, 50);
  }

  async function submitAccess(form) {
    var scope = form.getAttribute('data-strategy-auth-form');
    var message = document.querySelector('[data-strategy-auth-message="' + scope + '"]');
    var submit = form.querySelector('[type="submit"]');
    var username = form.elements.username.value.trim();
    var password = form.elements.password.value;
    if (!username || !password) {
      if (message) message.textContent = '请输入账号和密码。';
      return;
    }
    if (message) {
      message.classList.remove('is-success');
      message.textContent = '正在验证…';
    }
    if (submit) submit.disabled = true;
    try {
      var response = await fetch('/api/strategy-auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: scope, username: username, password: password })
      });
      var payload = await response.json().catch(function() { return {}; });
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error && payload.error.message ? payload.error.message : '验证没有通过，请稍后重试。');
      }
      form.elements.password.value = '';
      if (message) {
        message.classList.add('is-success');
        message.textContent = '验证通过，正在进入…';
      }
      if (scope === 'chat') {
        grants.chat = true;
        window.dispatchEvent(new CustomEvent('dreamworks:auth-granted', { detail: { scope: scope } }));
        return;
      }
      window.location.reload();
    } catch (error) {
      if (message) message.textContent = error && error.message ? error.message : '验证服务暂时不可用，请稍后重试。';
      if (submit) submit.disabled = false;
    }
  }

  function routeProtectedHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (hash === 'strategy-agent' && !grants.agent) {
      openAgent({ pushHistory: false, scroll: false });
      return;
    }
    if (!grants.cases && (hash === 'strategy-library' || hash.indexOf('strategy-case-') === 0 || /^strategy-chapter[12]$/.test(hash))) {
      showHub({ pushHistory: false, scroll: false });
      window.setTimeout(scrollToGate, 30);
    }
  }

  function init() {
    var casesGate = document.getElementById('strategy-cases-access');
    if (casesGate && grants.cases) casesGate.hidden = true;
    document.querySelectorAll('[data-strategy-auth-form]').forEach(function(form) {
      var scope = form.getAttribute('data-strategy-auth-form');
      if (auth.configured && auth.configured[scope] === false) {
        var message = document.querySelector('[data-strategy-auth-message="' + scope + '"]');
        if (message) message.textContent = '该访问区域尚未完成部署环境配置，请联系管理员。';
        form.querySelector('[type="submit"]').disabled = true;
      }
      form.addEventListener('submit', function(event) {
        event.preventDefault();
        void submitAccess(form);
      });
    });
    document.querySelectorAll('[data-password-toggle]').forEach(function(button) {
      button.addEventListener('click', function() {
        var input = document.getElementById(button.getAttribute('data-password-toggle'));
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.textContent = show ? '隐藏' : '显示';
        button.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
      });
    });
    routeProtectedHash();
  }

  window.strategyShowIntro = showIntro;
  window.strategyEnterSystem = showHub;
  window.strategyShowHub = showHub;
  window.strategyScrollToCases = scrollToCases;
  window.strategyOpenCase = openCase;
  window.strategyOpenSkyworthDepth = openDepth;
  window.strategyOpenAgent = openAgent;

  window.addEventListener('popstate', function() {
    window.setTimeout(routeProtectedHash, 30);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
