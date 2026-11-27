
/**
 * V11.1 · 首页大型价值金字塔与迷你悬浮导航
 */
(function () {
  'use strict';

  const STAGES = ['soil', 'business', 'investment', 'charity', 'legacy'];
  const STAGE_PREVIEWS = {
    legacy: {
      year: '2020',
      title: '传承模式',
      value: '传承价值',
      description: '为高净值家族，基于继往开来的家族传承终极价值，开创具备系统解决方案的独特传承模式。结合身家诊断、家族信托、传承学院、公益慈善，致力于成就家族财富百年传承。'
    },
    charity: {
      year: '2011',
      title: '公益模式',
      value: '传递价值',
      description: '为慈善家与捐赠者基于社会公益价值，打造独特的公益模式。龙越基金会与建辉基金会，成为中国公益知名品牌。'
    },
    investment: {
      year: '2005',
      title: '股权投资模式',
      value: '发现价值',
      description: '为资本家与投资者基于企业股权价值，开创独特的投资模式。以“涨跌都赚钱，下跌赚更多”的独特模式，成就卓越回报。'
    },
    business: {
      year: '1998',
      title: '商业模式',
      value: '增进价值',
      description: '为企业家基于产品与服务价值打造独特的商业模式。创立成美，与特劳特先生合作打造王老吉等强势品牌，实现百倍增长。'
    },
    soil: {
      year: '1992',
      title: '实业阶段',
      value: '创造价值',
      description: '南下深圳正式创业，深耕轻质墙体材料八年，长期占据行业50%以上份额。'
    }
  };
  let miniCollapsed = false;

  function scrollOffset() {
    const globalNav = document.querySelector('.nav');
    const homeNav = document.querySelector('#page-home .home-anchor-shell');
    let offset = 20;
    if (globalNav) offset += globalNav.offsetHeight;
    if (homeNav) offset += homeNav.offsetHeight;
    return offset;
  }

  function scrollToTarget(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = window.pageYOffset + target.getBoundingClientRect().top - scrollOffset();
    window.scrollTo({
      top: Math.max(0, top),
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  }

  function setActiveStage(stageName) {
    document.querySelectorAll('#home-mini-pyramid .home-mini-step').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.stage === stageName);
    });

    document.querySelectorAll('#home-value-summary .home-pyramid-step').forEach((button) => {
      button.classList.toggle(
        'is-active',
        button.dataset.stageTarget === 'home-life-' + stageName
      );
    });
  }

  function setMiniVisible(visible) {
    const mini = document.getElementById('home-mini-pyramid');
    if (!mini) return;
    mini.classList.toggle('is-visible', Boolean(visible));
    mini.setAttribute('aria-hidden', visible ? 'false' : 'true');
    mini.toggleAttribute('inert', !visible);
  }

  function setupNavigationButtons() {
    document.querySelectorAll('[data-stage-target]').forEach((button) => {
      button.addEventListener('click', () => {
        scrollToTarget(button.dataset.stageTarget);
      });
    });
  }

  function setupOverviewPreview() {
    const preview = document.getElementById('home-pyramid-preview');
    const year = document.getElementById('home-pyramid-preview-year');
    const title = document.getElementById('home-pyramid-preview-title');
    const value = document.getElementById('home-pyramid-preview-value');
    const description = document.getElementById('home-pyramid-preview-description');
    const overview = document.querySelector('#home-value-summary .home-pyramid-overview');
    const buttons = Array.from(
      document.querySelectorAll('#home-value-summary .home-pyramid-step[data-stage]')
    );

    if (!preview || !year || !title || !value || !description || !overview || !buttons.length) {
      return;
    }

    const defaultStage = preview.dataset.previewStage || 'legacy';

    const showPreview = (stageName) => {
      const content = STAGE_PREVIEWS[stageName];
      if (!content) return;

      const alreadyCurrent =
        preview.dataset.previewStage === stageName &&
        year.textContent === content.year &&
        title.textContent === content.title &&
        value.textContent === content.value &&
        description.textContent === content.description;

      buttons.forEach((button) => {
        button.classList.toggle('is-previewed', button.dataset.stage === stageName);
      });

      if (alreadyCurrent) return;

      preview.dataset.previewStage = stageName;
      year.textContent = content.year;
      title.textContent = content.title;
      value.textContent = content.value;
      description.textContent = content.description;
    };

    buttons.forEach((button) => {
      button.addEventListener('pointerenter', () => showPreview(button.dataset.stage));
      button.addEventListener('focus', () => showPreview(button.dataset.stage));
    });

    overview.addEventListener('pointerleave', () => {
      const focusedButton = buttons.find((button) => button === document.activeElement);
      showPreview(focusedButton ? focusedButton.dataset.stage : defaultStage);
    });

    overview.addEventListener('focusout', (event) => {
      if (!overview.contains(event.relatedTarget)) showPreview(defaultStage);
    });

    showPreview(defaultStage);
  }

  function setupMiniToggle() {
    const mini = document.getElementById('home-mini-pyramid');
    const toggle = document.getElementById('home-mini-pyramid-toggle');
    if (!mini || !toggle) return;

    toggle.addEventListener('click', () => {
      miniCollapsed = !miniCollapsed;
      mini.classList.toggle('is-collapsed', miniCollapsed);
      toggle.setAttribute('aria-expanded', miniCollapsed ? 'false' : 'true');
    });
  }

  function setupScrollState() {
    const overview = document.getElementById('home-value-summary');
    const lastStage = document.getElementById('home-life-legacy');
    const homePage = document.getElementById('page-home');
    const stageEls = STAGES
      .map((stage) => ({
        stage,
        el: document.getElementById('home-life-' + stage)
      }))
      .filter((item) => item.el);

    if (!overview || !lastStage || !homePage || !stageEls.length) return;

    const update = () => {
      if (!homePage.classList.contains('active')) {
        setMiniVisible(false);
        return;
      }

      const threshold = scrollOffset() + 30;
      const overviewRect = overview.getBoundingClientRect();
      const lastRect = lastStage.getBoundingClientRect();

      const shouldShow =
        overviewRect.bottom <= threshold &&
        lastRect.bottom > threshold + 90;

      setMiniVisible(shouldShow);

      let activeStage = stageEls[0].stage;
      stageEls.forEach((item) => {
        const rect = item.el.getBoundingClientRect();
        if (rect.top <= threshold + 80) activeStage = item.stage;
      });
      setActiveStage(shouldShow ? activeStage : '');
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.setTimeout(update, 120);
  }

  function setupKeyboard() {
    const overviewButtons = Array.from(
      document.querySelectorAll('#home-value-summary .home-pyramid-step')
    );

    overviewButtons.forEach((button, index) => {
      button.addEventListener('keydown', (event) => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();

        let nextIndex = index;
        if (event.key === 'ArrowUp') nextIndex = Math.max(0, index - 1);
        if (event.key === 'ArrowDown') nextIndex = Math.min(overviewButtons.length - 1, index + 1);
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = overviewButtons.length - 1;

        overviewButtons[nextIndex].focus();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNavigationButtons();
    setupOverviewPreview();
    setupMiniToggle();
    setupScrollState();
    setupKeyboard();
  });
})();
