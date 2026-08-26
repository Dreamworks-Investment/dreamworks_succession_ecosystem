/**
 * strategy.js — 战略与实践双章节独立视图
 * 梦工场 · 家族传承系统
 *
 * V10.8:
 * 1. 第一章、第二章拆分为两个独立章节视图
 * 2. 章节切换支持浏览器前进/后退与直接链接
 * 3. 每章仅展示自己的目录与正文
 * 4. 第一章结尾横向翻页进入第二章
 * 5. 第二章结尾衔接战略定位智能体
 */

/* 可在部署前配置为战略定位智能体公开地址。 */
var STRATEGY_INTERACTION_URL = window.STRATEGY_INTERACTION_URL || '';

var StrategyChapterState = {
  current: 1,
  pageActive: false
};

function getStrategyOffset() {
  var nav = document.querySelector('.nav');
  var chapterbar = document.querySelector('.strategy-chapterbar');
  var toc = document.getElementById('strategy-toc');
  return (nav ? nav.offsetHeight : 56) +
    (chapterbar ? chapterbar.offsetHeight : 54) +
    (toc ? toc.offsetHeight : 48) + 14;
}

function getTargetChapter(targetId) {
  var target = document.getElementById(targetId);
  if (!target) return null;
  var view = target.closest('.strategy-chapter-view');
  if (!view) return null;
  return Number(view.getAttribute('data-strategy-chapter-view')) || null;
}

function syncStrategyChapterUI(chapter) {
  var chapterString = String(chapter);

  Array.prototype.slice.call(document.querySelectorAll('.strategy-chapter-view')).forEach(function(view) {
    var active = view.getAttribute('data-strategy-chapter-view') === chapterString;
    view.classList.toggle('active', active);
    view.setAttribute('aria-hidden', active ? 'false' : 'true');
  });

  Array.prototype.slice.call(document.querySelectorAll('.strategy-chapter-tab')).forEach(function(tab) {
    var active = tab.getAttribute('data-chapter') === chapterString;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  Array.prototype.slice.call(document.querySelectorAll('.strategy-toc-group')).forEach(function(group) {
    var active = group.getAttribute('data-strategy-toc-chapter') === chapterString;
    group.classList.toggle('active', active);
    group.setAttribute('aria-hidden', active ? 'false' : 'true');
  });

  var breadcrumb = document.getElementById('strategy-breadcrumb-current');
  if (breadcrumb) {
    breadcrumb.textContent = chapter === 2
      ? '第二章 · 创维汽车战略定位最终方案'
      : '第一章 · 创维汽车战略定位的推演之路';
  }

  StrategyChapterState.current = chapter;
}

function updateStrategyHistory(chapter, replace) {
  var hash = chapter === 2 ? '#strategy-chapter2' : '#strategy-chapter1';
  var state = { page: 'strategy', strategyChapter: chapter };
  try {
    if (replace) {
      window.history.replaceState(state, '', hash);
    } else {
      window.history.pushState(state, '', hash);
    }
  } catch (error) {
    window.location.hash = hash;
  }
}

function revealVisibleStrategyElements() {
  window.requestAnimationFrame(function() {
    Array.prototype.slice.call(
      document.querySelectorAll('.strategy-chapter-view.active .strategy-fade-up')
    ).forEach(function(el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 80) {
        el.classList.add('visible');
      }
    });
  });
}

function updateStrategyInteractionEntry() {
  var link = document.querySelector('.strategy-interaction-btn');
  var placeholder = document.querySelector('.strategy-interaction-placeholder');
  var status = document.querySelector('.strategy-agent-status');

  if (link && STRATEGY_INTERACTION_URL) {
    link.classList.add('visible');
    link.setAttribute('href', STRATEGY_INTERACTION_URL);
    if (placeholder) placeholder.style.display = 'none';
    if (status) status.style.display = 'none';
  } else {
    if (link) link.classList.remove('visible');
    if (placeholder) placeholder.style.display = 'inline-flex';
    if (status) status.style.display = '';
  }
}

/**
 * 切换第一章 / 第二章。
 * options:
 * - pushHistory: 写入浏览器历史
 * - replaceHistory: 替换当前历史
 * - scroll: 滚动到该章开头
 */
function strategyOpenChapter(chapter, options) {
  options = options || {};
  chapter = Number(chapter) === 2 ? 2 : 1;

  syncStrategyChapterUI(chapter);
  updateStrategyInteractionEntry();

  if (options.pushHistory) {
    updateStrategyHistory(chapter, false);
  } else if (options.replaceHistory) {
    updateStrategyHistory(chapter, true);
  }

  if (options.scroll) {
    var topId = chapter === 2 ? 'chapter2-overview' : 'roadmap-overview';
    window.requestAnimationFrame(function() {
      var target = document.getElementById(topId);
      if (!target) return;
      var top = target.getBoundingClientRect().top + window.pageYOffset - getStrategyOffset();
      window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
      window.setTimeout(updateActiveStrategySection, 120);
      revealVisibleStrategyElements();
    });
  } else {
    window.setTimeout(updateActiveStrategySection, 50);
    revealVisibleStrategyElements();
  }
}

/* 兼容旧版章节按钮调用。 */
function strategyChapterTo(targetId) {
  var chapter = targetId === 'strategy-chapter2-presentation' ||
    (targetId && targetId.indexOf('chapter2-') === 0) ? 2 : 1;
  strategyOpenChapter(chapter, { pushHistory: true, scroll: true });
}

/* 平滑滚动到指定章节；如果目标在另一个章节，先切换视图。 */
function strategyScrollTo(targetId) {
  var target = document.getElementById(targetId);
  if (!target) return;

  var targetChapter = getTargetChapter(targetId);
  if (targetChapter && targetChapter !== StrategyChapterState.current) {
    strategyOpenChapter(targetChapter, { pushHistory: true, scroll: false });
  }

  window.requestAnimationFrame(function() {
    var currentTarget = document.getElementById(targetId);
    if (!currentTarget) return;
    var top = currentTarget.getBoundingClientRect().top + window.pageYOffset - getStrategyOffset();
    window.scrollTo({
      top: Math.max(0, top),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
    window.setTimeout(updateActiveStrategySection, 100);
  });
}

function enterStrategyInteraction() {
  if (STRATEGY_INTERACTION_URL) {
    window.open(STRATEGY_INTERACTION_URL, '_blank', 'noopener,noreferrer');
  }
}

function toggleRisk(riskId) {
  var card = document.querySelector('[data-risk="' + riskId + '"]');
  if (!card) return;
  card.classList.toggle('expanded');
  var header = card.querySelector('.strategy-risk-header');
  if (header) {
    header.setAttribute('aria-expanded', card.classList.contains('expanded') ? 'true' : 'false');
  }
}

function handleRiskKeydown(event, riskId) {
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    toggleRisk(riskId);
  }
}

function getActiveStrategyTocLinks() {
  return Array.prototype.slice.call(
    document.querySelectorAll(
      '.strategy-toc-group[data-strategy-toc-chapter="' +
      StrategyChapterState.current +
      '"] .strategy-toc-link'
    )
  );
}

function updateActiveStrategySection() {
  if (!StrategyChapterState.pageActive) return;

  var links = getActiveStrategyTocLinks();
  if (!links.length) return;

  var offset = getStrategyOffset() + 48;
  var currentLink = links[0];

  links.forEach(function(link) {
    var target = document.getElementById(link.getAttribute('data-target'));
    if (target && target.getBoundingClientRect().top <= offset) {
      currentLink = link;
    }
  });

  links.forEach(function(link) {
    link.classList.toggle('active', link === currentLink);
  });

  var tocInner = document.querySelector('.strategy-toc-inner');
  if (tocInner && currentLink) {
    var linkLeft = currentLink.offsetLeft;
    var linkRight = linkLeft + currentLink.offsetWidth;
    var visibleLeft = tocInner.scrollLeft;
    var visibleRight = visibleLeft + tocInner.clientWidth;
    if (linkLeft < visibleLeft || linkRight > visibleRight) {
      tocInner.scrollTo({
        left: Math.max(0, linkLeft - tocInner.clientWidth / 2 + currentLink.offsetWidth / 2),
        behavior: 'smooth'
      });
    }
  }
}

(function() {
  'use strict';

  var backTopBtn = null;
  var scrollTicking = false;

  function chapterFromLocation() {
    if (window.location.hash === '#strategy-chapter2') return 2;
    if (window.history.state && Number(window.history.state.strategyChapter) === 2) return 2;
    return 1;
  }

  function setupFadeObserver() {
    var elements = Array.prototype.slice.call(document.querySelectorAll('.strategy-fade-up'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !('IntersectionObserver' in window)) {
      elements.forEach(function(el) { el.classList.add('visible'); });
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -40px 0px'
    });

    elements.forEach(function(el) { observer.observe(el); });
  }

  function createBackTopButton() {
    backTopBtn = document.createElement('button');
    backTopBtn.className = 'strategy-back-top';
    backTopBtn.innerHTML = '↑';
    backTopBtn.setAttribute('aria-label', '返回当前章节顶部');
    backTopBtn.addEventListener('click', function() {
      strategyScrollTo(StrategyChapterState.current === 2 ? 'chapter2-overview' : 'roadmap-overview');
    });
    document.body.appendChild(backTopBtn);
  }

  function updateBackTopButton() {
    if (!backTopBtn) return;
    backTopBtn.classList.toggle(
      'visible',
      StrategyChapterState.pageActive && window.pageYOffset > 400
    );
  }

  function setupPageWatcher() {
    var page = document.getElementById('page-strategy');
    if (!page) return;

    function syncPageState() {
      StrategyChapterState.pageActive = page.classList.contains('active');
      if (StrategyChapterState.pageActive) {
        var chapter = chapterFromLocation();
        strategyOpenChapter(chapter, { scroll: false });
        window.setTimeout(function() {
          updateActiveStrategySection();
          updateBackTopButton();
          revealVisibleStrategyElements();
        }, 80);
      } else if (backTopBtn) {
        backTopBtn.classList.remove('visible');
      }
    }

    var observer = new MutationObserver(syncPageState);
    observer.observe(page, { attributes: true, attributeFilter: ['class'] });
    syncPageState();
  }

  function setupScrollEvents() {
    window.addEventListener('scroll', function() {
      if (scrollTicking) return;
      scrollTicking = true;
      window.requestAnimationFrame(function() {
        updateActiveStrategySection();
        updateBackTopButton();
        scrollTicking = false;
      });
    }, { passive: true });

    window.addEventListener('resize', function() {
      updateActiveStrategySection();
    });

    window.addEventListener('popstate', function(event) {
      var chapter = event.state && event.state.strategyChapter
        ? Number(event.state.strategyChapter)
        : chapterFromLocation();
      window.setTimeout(function() {
        strategyOpenChapter(chapter, { scroll: true });
      }, 20);
    });
  }

  function init() {
    var page = document.getElementById('page-strategy');
    if (!page) return;

    setupFadeObserver();
    createBackTopButton();
    setupPageWatcher();
    setupScrollEvents();
    updateStrategyInteractionEntry();

    var initialChapter = chapterFromLocation();
    syncStrategyChapterUI(initialChapter);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
