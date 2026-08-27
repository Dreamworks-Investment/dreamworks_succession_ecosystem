/**
 * home-journey.js — 新版首页“富过三代”叙事与六道人生历程
 * 原生 HTML/CSS/JS；不依赖外部服务。
 */

(function () {
  'use strict';

  const DEFAULT_JOURNEY = {
    label: '人生历程 · 六道关',
    title: '从一代拥有，到世代相传',
    copy: '企业价值、财富管理、身家诊断、风险隔离、后代认知与社会声誉，构成一个彼此咬合的完整系统。'
  };

  function setJourneySummary(label, title, copy) {
    const labelEl = document.getElementById('home-life-journey-summary-label');
    const titleEl = document.getElementById('home-life-journey-summary-title');
    const copyEl = document.getElementById('home-life-journey-summary-copy');
    if (labelEl) labelEl.textContent = label || DEFAULT_JOURNEY.label;
    if (titleEl) titleEl.textContent = title || DEFAULT_JOURNEY.title;
    if (copyEl) copyEl.textContent = copy || DEFAULT_JOURNEY.copy;
  }

  function activateJourneyNode(node) {
    document.querySelectorAll('.home-life-journey-node').forEach(item => {
      item.classList.toggle('is-active', item === node);
    });
    const step = node.querySelector('span');
    setJourneySummary(
      `人生历程 · 第 ${step ? step.textContent.trim() : ''} 关`,
      node.dataset.title,
      node.dataset.copy
    );
  }

  function resetJourneySummary() {
    document.querySelectorAll('.home-life-journey-node').forEach(item => {
      item.classList.remove('is-active');
    });
    setJourneySummary(DEFAULT_JOURNEY.label, DEFAULT_JOURNEY.title, DEFAULT_JOURNEY.copy);
  }

  function enterBusinessPage(page) {
    if (!page) return;
    if (page === 'value') {
      if (typeof openValueInvestment === 'function') openValueInvestment();
      return;
    }
    if (typeof navigateTo === 'function') navigateTo(page);
  }

  function enterJourneyDestination(node) {
    if (node.dataset.target) {
      window.scrollHomeJourneyTo(node.dataset.target);
      return;
    }
    enterBusinessPage(node.dataset.page);
  }

  function setupJourneyInteractions() {
    document.querySelectorAll('.home-life-journey-node').forEach(node => {
      node.addEventListener('mouseenter', () => activateJourneyNode(node));
      node.addEventListener('focus', () => activateJourneyNode(node));
      node.addEventListener('mouseleave', () => {
        if (!node.matches(':focus-visible')) resetJourneySummary();
      });
      node.addEventListener('blur', resetJourneySummary);
      node.addEventListener('click', () => enterJourneyDestination(node));
    });

    document.querySelectorAll('.home-system-module-link, .home-system-charity-foundation').forEach(node => {
      node.addEventListener('click', () => enterJourneyDestination(node));
    });
  }

  function setupReveal() {
    const targets = document.querySelectorAll(
      '.home-founder-grid, .home-timeline-item, .home-credibility-card, .home-legacy-closing, ' +
      '.home-system-slide, .home-system-module-link, .home-life-journey-heading, ' +
      '.home-life-journey-node, .home-life-journey-summary'
    );
    targets.forEach(el => el.classList.add('home-journey-reveal'));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

    targets.forEach(el => observer.observe(el));
  }

  window.scrollHomeJourneyTo = function scrollHomeJourneyTo(id) {
    const scroll = () => {
      const target = document.getElementById(id);
      if (!target) return;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    };

    const homePage = document.getElementById('page-home');
    if (!homePage || !homePage.classList.contains('active')) {
      if (typeof navigateTo === 'function') navigateTo('home');
      window.setTimeout(scroll, 80);
    } else {
      scroll();
    }
  };

  window.goToHomeCycle = function goToHomeCycle() {
    window.scrollHomeJourneyTo('home-value-cycle');
  };

  window.updateBackToCycleButton = function updateBackToCycleButton(page) {
    const button = document.getElementById('back-to-value-cycle');
    if (!button) return;
    button.classList.toggle('visible', page !== 'home' && page !== 'value');
  };


  function getHomeAnchorOffset() {
    const globalNav = document.querySelector('.nav');
    const anchorShell = document.querySelector('#page-home .home-anchor-shell');
    let offset = 12;
    if (globalNav) offset += globalNav.offsetHeight;
    if (anchorShell) offset += anchorShell.offsetHeight;
    return offset;
  }

  function setActiveHomeAnchor(targetId) {
    const links = document.querySelectorAll('#page-home .home-anchor-link');
    links.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('data-target') === targetId);
    });
    const active = document.querySelector('#page-home .home-anchor-link.is-active');
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }

  function initHomeAnchorNav() {
    const homePage = document.getElementById('page-home');
    if (!homePage) return;

    const links = Array.from(homePage.querySelectorAll('.home-anchor-link'));
    const sections = links
      .map((link) => {
        const id = link.getAttribute('data-target');
        return { id, el: document.getElementById(id) };
      })
      .filter((item) => item.el);

    if (!sections.length) return;

    const spy = () => {
      if (!homePage.classList.contains('active')) return;
      const threshold = getHomeAnchorOffset() + 24;
      let currentId = sections[0].id;
      sections.forEach((item) => {
        const rect = item.el.getBoundingClientRect();
        if (rect.top - threshold <= 0) currentId = item.id;
      });
      setActiveHomeAnchor(currentId);
    };

    window.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('resize', spy);
    window.setTimeout(spy, 120);
  }

  window.homeScrollTo = function homeScrollTo(id) {
    const scroll = () => {
      const target = document.getElementById(id);
      if (!target) return;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const top = window.pageYOffset + target.getBoundingClientRect().top - getHomeAnchorOffset();
      window.scrollTo({ top: Math.max(top, 0), behavior: reduceMotion ? 'auto' : 'smooth' });
      setActiveHomeAnchor(id);
    };

    const homePage = document.getElementById('page-home');
    if (!homePage || !homePage.classList.contains('active')) {
      if (typeof navigateTo === 'function') navigateTo('home');
      window.setTimeout(scroll, 80);
    } else {
      scroll();
    }
  };


  document.addEventListener('DOMContentLoaded', () => {
    setupJourneyInteractions();
    setupReveal();
    initHomeAnchorNav();

    const current = (window.AppState && window.AppState.currentPage) || 'home';
    window.updateBackToCycleButton(current);

    if (window.location.hash === '#home-value-cycle') {
      window.setTimeout(() => window.scrollHomeJourneyTo('home-value-cycle'), 80);
    }
  });
})();
