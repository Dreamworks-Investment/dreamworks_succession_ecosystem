/**
 * app.js — SPA路由 & 全局状态管理
 * 梦工场 · 家族传承系统
 */

// Global state
const AppState = {
  currentPage: 'home',
  wealthStep: 1,
  assets: {
    cash: [],
    realestate: [],
    business: [],
    financial: [],
    loans: [],
    debt: []
  },
  flags: { usage: false, convenience: false, emotional: false },
  expenses: [],
  requiredReturn: { r1: null, r2: null, r3: 10, winner: 'r3', computation: null, principalOverride: null },
  dcfResults: null,
  wealthDataMode: 'self',
  // Autosave
  autosaveTimer: null
};

// Capture the entry route while the document is still being parsed. This keeps
// refreshable case/chapter deep links stable even when other modules initialise
// on DOMContentLoaded and update History state.
const INITIAL_ROUTE_HASH = window.location.hash.replace(/^#/, '');

// Load saved state from localStorage
function loadSavedState() {
  try {
    const saved = localStorage.getItem('workbuddy_wealth_state');
    if (saved) {
      const data = JSON.parse(saved);
      AppState.assets = data.assets || AppState.assets;
      AppState.flags = data.flags || AppState.flags;
      AppState.expenses = data.expenses || AppState.expenses;
      AppState.requiredReturn = Object.assign({}, AppState.requiredReturn, data.requiredReturn || {});
      AppState.dcfResults = data.dcfResults || null;
      AppState.wealthStep = data.wealthStep || 1;
      AppState.wealthDataMode = data.wealthDataMode === 'sample' ? 'sample' : 'self';
    }
  } catch(e) { /* ignore */ }
}

function saveState() {
  try {
    localStorage.setItem('workbuddy_wealth_state', JSON.stringify({
      assets: AppState.assets,
      flags: AppState.flags,
      expenses: AppState.expenses,
      requiredReturn: AppState.requiredReturn,
      dcfResults: AppState.dcfResults,
      wealthStep: AppState.wealthStep,
      wealthDataMode: AppState.wealthDataMode
    }));
  } catch(e) { /* ignore */ }
}

// Navigation
function navigateTo(page, options = {}) {
  const targetPage = document.getElementById('page-' + page);
  if (!targetPage) {
    console.warn('[navigation] Page not found:', page);
    return;
  }

  if (page !== 'strategy' && document.getElementById('page-strategy')?.classList.contains('strategy-agent-active')) {
    if (typeof window.strategyAgentDestroy === 'function') void window.strategyAgentDestroy();
  }
  if (page !== 'value' && document.getElementById('page-value')?.classList.contains('value-agent-active')) {
    if (typeof window.valueAgentDestroy === 'function') void window.valueAgentDestroy();
  }
  if (page !== 'wealth' && document.getElementById('page-wealth')?.classList.contains('wealth-agent-active')) {
    if (typeof window.wealthAilyAgentDestroy === 'function') void window.wealthAilyAgentDestroy();
  }
  if (page !== 'trust' && document.getElementById('page-trust')?.classList.contains('trust-agent-active')) {
    if (typeof window.trustAilyAgentDestroy === 'function') void window.trustAilyAgentDestroy();
  }

  AppState.currentPage = page;

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Update pages
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el === targetPage);
  });

  // Generic navigation to “战略与实践” starts at the value-diagnosis cover.
  // Direct library, case, and chapter routes preserve their requested depth.
  if (page === 'strategy' && !options.preserveStrategyView && typeof window.strategyShowIntro === 'function') {
    window.strategyShowIntro({ pushHistory: false, scroll: false });
  }

  // Generic navigation to “狠值投资” starts at its explanatory slides.
  // Direct #value-agent routes preserve the embedded research-assistant view.
  if (page === 'value' && !options.preserveValueView && typeof window.valueShowIntro === 'function') {
    window.valueShowIntro({ scroll: false });
  }

  // Generic navigation to “身家诊断” always starts at its explanatory cover.
  // Direct #wealth-system routes and browser history can preserve the wizard view.
  if (page === 'wealth' && !options.preserveWealthView && typeof window.wealthShowIntro === 'function') {
    window.wealthShowIntro({ pushHistory: false, scroll: false });
  }

  // Generic navigation to “家族信托” starts at the explanatory cover.
  // Direct #trust-system routes and browser history can preserve the wizard view.
  if (page === 'trust' && !options.preserveTrustView && typeof window.trustShowIntro === 'function') {
    window.trustShowIntro({ pushHistory: false, scroll: false });
  }

  // Generic navigation to “传承学院” starts at its explanatory cover.
  // Direct #academy-system routes and browser history preserve the assessment view.
  if (page === 'academy' && !options.preserveAcademyView && typeof window.academyShowCover === 'function') {
    window.academyShowCover({ pushHistory: false, scroll: false });
  }

  if (typeof updateBackToCycleButton === 'function') {
    updateBackToCycleButton(page);
  }

  // Record internal navigation so browser Back/Forward remains meaningful.
  if (!options.skipHistory) {
    const nextHash = '#' + page;
    if (window.location.hash !== nextHash) {
      try {
        window.history.pushState({ page }, '', nextHash);
      } catch (error) {
        // Some file:// environments restrict History API writes.
        // Navigation still works; only browser Back/Forward is unavailable there.
      }
    }
  }

  if (options.scroll !== false) {
    window.scrollTo(0, 0);
  }
}

// Tab switching
function switchTab(tabName, containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.querySelectorAll('.tab-btn').forEach(btn => {
    const key = btn.dataset.tab || btn.dataset.assetCat;
    btn.classList.toggle('active', key === tabName);
  });
}

function showTabPanel(panelId, containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === panelId);
  });
}

// Format helpers
function fmtMoney(val) {
  if (val == null || isNaN(val)) return '--';
  if (Math.abs(val) >= 10000) return (val / 10000).toFixed(2) + ' 亿';
  if (Math.abs(val) >= 10) return Math.round(val).toLocaleString() + ' 万';
  return val.toFixed(2) + ' 万';
}

function fmtPct(val) {
  if (val == null || isNaN(val)) return '--%';
  return val.toFixed(1) + '%';
}

function fmtDelta(val) {
  if (val == null || isNaN(val)) return '--';
  if (val > 0) return '+' + val.toFixed(1) + '%';
  return val.toFixed(1) + '%';
}

// Color helpers
function colorForReturn(r, threshold) {
  if (r >= threshold) return 'tag-green';
  if (r >= threshold * 0.7) return 'tag-amber';
  return 'tag-red';
}

// Event delegation for tab buttons
document.addEventListener('DOMContentLoaded', () => {
  loadSavedState();

  // Nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  // Restore direct links such as #strategy / #wealth and initialise History state.
  const requested = INITIAL_ROUTE_HASH || window.location.hash.replace(/^#/, '');
  const internalPages = ['home', 'strategy', 'value', 'wealth', 'trust', 'academy', 'charity', 'vision'];
  if (requested === 'strategy-chapter1' || requested === 'strategy-chapter2') {
    const strategyChapter = requested === 'strategy-chapter2' ? 2 : 1;
    navigateTo('strategy', { skipHistory: true, scroll: false, preserveStrategyView: true });
    try {
      window.history.replaceState(
        { page: 'strategy', strategyChapter, strategyCase: 'skyworth' },
        '',
        '#' + requested
      );
    } catch (error) {}
    window.setTimeout(() => {
      if (typeof strategyOpenSkyworthDepth === 'function') {
        strategyOpenSkyworthDepth(strategyChapter, { replaceHistory: true, scroll: false });
      }
    }, 0);
  } else if (requested === 'strategy-library') {
    navigateTo('strategy', { skipHistory: true, scroll: false, preserveStrategyView: true });
    try { window.history.replaceState({ page: 'strategy', strategyView: 'hub' }, '', '#strategy-library'); } catch (error) {}
    window.setTimeout(() => {
      if (typeof strategyShowHub === 'function') {
        strategyShowHub({ replaceHistory: true, scroll: false });
      }
    }, 0);
  } else if (requested === 'strategy-agent') {
    navigateTo('strategy', { skipHistory: true, scroll: false, preserveStrategyView: true });
    try { window.history.replaceState({ page: 'strategy', strategyView: 'agent' }, '', '#strategy-agent'); } catch (error) {}
    window.setTimeout(() => {
      if (typeof strategyOpenAgent === 'function') {
        strategyOpenAgent({ replaceHistory: true, scroll: false });
      }
    }, 0);
  } else if (requested === 'value-agent') {
    navigateTo('value', { skipHistory: true, scroll: false, preserveValueView: true });
    try { window.history.replaceState({ page: 'value', valueView: 'agent' }, '', '#value-agent'); } catch (error) {}
    window.setTimeout(() => {
      if (typeof window.valueOpenAgent === 'function') {
        window.valueOpenAgent({ replaceHistory: true, scroll: false });
      }
    }, 0);
  } else if (requested.startsWith('strategy-case-')) {
    const strategyCase = requested.replace('strategy-case-', '');
    navigateTo('strategy', { skipHistory: true, scroll: false, preserveStrategyView: true });
    try { window.history.replaceState({ page: 'strategy', strategyCase }, '', '#' + requested); } catch (error) {}
    window.setTimeout(() => {
      if (typeof strategyOpenCase === 'function') {
        strategyOpenCase(strategyCase, { replaceHistory: true, scroll: false });
      }
    }, 0);
  } else if (requested === 'wealth-system') {
    navigateTo('wealth', { skipHistory: true, scroll: false, preserveWealthView: true });
    try { window.history.replaceState({ page: 'wealth', wealthView: 'wizard' }, '', '#wealth-system'); } catch (error) {}
    window.setTimeout(() => {
      if (typeof window.wealthEnterSystem === 'function') {
        window.wealthEnterSystem({ pushHistory: false, scroll: false });
      }
    }, 0);
  } else if (requested === 'wealth-agent') {
    navigateTo('wealth', { skipHistory: true, scroll: false, preserveWealthView: true });
    try { window.history.replaceState({ page: 'wealth', wealthView: 'agent' }, '', '#wealth-agent'); } catch (error) {}
    window.setTimeout(() => {
      if (typeof window.wealthAilyOpen === 'function') window.wealthAilyOpen({ replaceHistory: true, scroll: false });
    }, 0);
  } else if (requested === 'trust-system') {
    navigateTo('trust', { skipHistory: true, scroll: false, preserveTrustView: true });
    try { window.history.replaceState({ page: 'trust', trustView: 'wizard' }, '', '#trust-system'); } catch (error) {}
    window.setTimeout(() => {
      if (typeof window.trustEnterSystem === 'function') {
        window.trustEnterSystem({ pushHistory: false, scroll: false });
      }
    }, 0);
  } else if (requested === 'trust-agent') {
    navigateTo('trust', { skipHistory: true, scroll: false, preserveTrustView: true });
    try { window.history.replaceState({ page: 'trust', trustView: 'agent' }, '', '#trust-agent'); } catch (error) {}
    window.setTimeout(() => {
      if (typeof window.trustAilyOpen === 'function') window.trustAilyOpen({ replaceHistory: true, scroll: false });
    }, 0);
  } else if (requested === 'academy-system') {
    navigateTo('academy', { skipHistory: true, scroll: false, preserveAcademyView: true });
    try { window.history.replaceState({ page: 'academy', academyView: 'system' }, '', '#academy-system'); } catch (error) {}
    window.setTimeout(() => {
      if (typeof window.academyEnterSystem === 'function') {
        window.academyEnterSystem({ pushHistory: false, scroll: false });
      }
    }, 0);
  } else if (internalPages.includes(requested)) {
    navigateTo(requested, { skipHistory: true });
    try { window.history.replaceState({ page: requested }, '', '#' + requested); } catch (error) {}
  } else if (requested === 'home-value-cycle') {
    navigateTo('home', { skipHistory: true, scroll: false });
    try { window.history.replaceState({ page: 'home', anchor: 'home-value-cycle' }, '', '#home-value-cycle'); } catch (error) {}
  } else {
    navigateTo('home', { skipHistory: true, scroll: false });
    try { window.history.replaceState({ page: 'home' }, '', '#home'); } catch (error) {}
  }

  window.addEventListener('popstate', (event) => {
    const page = event.state && event.state.page ? event.state.page : 'home';
    const preserveStrategyView = page === 'strategy' && event.state &&
      (event.state.strategyCase || event.state.strategyChapter || event.state.strategyView);
    const preserveValueView = page === 'value' && event.state && event.state.valueView === 'agent';
    const preserveWealthView = page === 'wealth' && event.state && ['wizard', 'agent'].includes(event.state.wealthView);
    const preserveTrustView = page === 'trust' && event.state && ['wizard', 'agent'].includes(event.state.trustView);
    const preserveAcademyView = page === 'academy' && event.state && event.state.academyView === 'system';
    navigateTo(page, {
      skipHistory: true,
      preserveStrategyView,
      preserveValueView,
      preserveWealthView,
      preserveTrustView,
      preserveAcademyView
    });
    if (preserveValueView) {
      window.setTimeout(() => {
        if (typeof window.valueOpenAgent === 'function') {
          window.valueOpenAgent({ scroll: false });
        }
      }, 0);
    }
    if (preserveWealthView && event.state.wealthView === 'wizard') {
      window.setTimeout(() => {
        if (typeof window.wealthEnterSystem === 'function') {
          window.wealthEnterSystem({ pushHistory: false, scroll: false });
        }
      }, 0);
    }
    if (preserveWealthView && event.state.wealthView === 'agent') {
      window.setTimeout(() => window.wealthAilyOpen?.({ scroll: false }), 0);
    }
    if (preserveTrustView && event.state.trustView === 'wizard') {
      window.setTimeout(() => {
        if (typeof window.trustEnterSystem === 'function') {
          window.trustEnterSystem({ pushHistory: false, scroll: false });
        }
      }, 0);
    }
    if (preserveTrustView && event.state.trustView === 'agent') {
      window.setTimeout(() => window.trustAilyOpen?.({ scroll: false }), 0);
    }
    if (preserveAcademyView) {
      window.setTimeout(() => {
        if (typeof window.academyEnterSystem === 'function') {
          window.academyEnterSystem({ pushHistory: false, scroll: false });
        }
      }, 0);
    }
    if (event.state && event.state.anchor === 'home-value-cycle') {
      window.setTimeout(() => {
        if (typeof scrollHomeJourneyTo === 'function') scrollHomeJourneyTo('home-value-cycle');
      }, 60);
    }
  });

  // Wealth tab switching
  setupWealthIntro();
});
