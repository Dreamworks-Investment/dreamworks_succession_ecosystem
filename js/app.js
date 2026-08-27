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
  requiredReturn: { r1: null, r2: null, r3: 10 },
  dcfResults: null,
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
      AppState.requiredReturn = data.requiredReturn || AppState.requiredReturn;
      AppState.dcfResults = data.dcfResults || null;
      AppState.wealthStep = data.wealthStep || 1;
    }
  } catch(e) { /* ignore */ }
}

function saveState() {
  try {
    localStorage.setItem('workbuddy_wealth_state', JSON.stringify({
      assets: AppState.assets,
      flags: AppState.flags,
      requiredReturn: AppState.requiredReturn,
      dcfResults: AppState.dcfResults,
      wealthStep: AppState.wealthStep
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
  const internalPages = ['home', 'strategy', 'value', 'wealth', 'trust', 'academy'];
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
  } else if (requested.startsWith('strategy-case-')) {
    const strategyCase = requested.replace('strategy-case-', '');
    navigateTo('strategy', { skipHistory: true, scroll: false, preserveStrategyView: true });
    try { window.history.replaceState({ page: 'strategy', strategyCase }, '', '#' + requested); } catch (error) {}
    window.setTimeout(() => {
      if (typeof strategyOpenCase === 'function') {
        strategyOpenCase(strategyCase, { replaceHistory: true, scroll: false });
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
    navigateTo(page, { skipHistory: true, preserveStrategyView });
    if (event.state && event.state.anchor === 'home-value-cycle') {
      window.setTimeout(() => {
        if (typeof scrollHomeJourneyTo === 'function') scrollHomeJourneyTo('home-value-cycle');
      }, 60);
    }
  });

  // Wealth tab switching
  setupWealthIntro();
});
