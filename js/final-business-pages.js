/**
 * final-business-pages.js
 * 传承学院两级入口 + 六共愿景互动。
 */
(function () {
  'use strict';

  const SIX_COMMON_VISION = {
    value: {
      index: '01',
      title: '共识狠值',
      points: [
        ['可持续', '以实业的眼光做投资，不赌涨跌，只买狠值。'],
        ['赚钱', '长期复利，让资产在足够长的时间里赚足够多的钱。'],
        ['省心', '无需年年寻找“股神”，把精力还给事业、家庭与长期目标。']
      ]
    },
    governance: {
      index: '02',
      title: '共有治理',
      points: [
        ['拥有', '达成共同目标后，以股权和长期机制分享治理成果。'],
        ['透明', '投资逻辑清晰、底层资产清晰、责任边界清晰。'],
        ['共建', '客户与合作伙伴参与公司治理和事业共创。']
      ]
    },
    enterprise: {
      index: '03',
      title: '共创基业',
      points: [
        ['空间', '资管行业空间巨大，比它更大的，是中国家族传承事业。'],
        ['三十年', '面向未来长期财富代际转移窗口，共建跨周期能力。'],
        ['同心圆', '围绕家、增长与传承，形成同一项长期事业。']
      ]
    },
    succession: {
      index: '04',
      title: '共同传承',
      points: [
        ['终极', '人生的终极价值来自家庭未来的延拓，长期目标是传承。'],
        ['工程', '上一代愿意传、下一代有能力承，靠系统教育与实践完成交接。'],
        ['目标', '以确定性狠值，成就家族财富百年传承。']
      ]
    },
    ecosystem: {
      index: '05',
      title: '共享生态',
      points: [
        ['相伴', '和拥有同样爱与梦想的人在一起，荣辱与共，成为真正的家人。'],
        ['支撑', '相互支撑、建立机制、共同创造业绩，形成持续创造价值的生态。'],
        ['共生', '为孩子们组建一个向上、向善、彼此成就的传承生态圈。']
      ]
    },
    future: {
      index: '06',
      title: '共益未来',
      points: [
        ['原则', '积善之家，必有余庆——追求超越个人与家族的社会价值。'],
        ['方式', '通过公益慈善、家族慈善信托等工具，让家族本身成为一道光。'],
        ['愿景', '照亮社会，也回应尊贵家族“被社会需要”的更高层需求。']
      ]
    }
  };

  function academySetView(view, options) {
    const settings = Object.assign({ pushHistory: false, replaceHistory: false, scroll: true }, options || {});
    const page = document.getElementById('page-academy');
    const cover = document.getElementById('academy-cover-view');
    const system = document.getElementById('academy-system-view');
    if (!page || !cover || !system) return;

    const showSystem = view === 'system';
    page.classList.toggle('academy-system-active', showSystem);
    page.classList.toggle('academy-cover-active', !showSystem);
    cover.setAttribute('aria-hidden', String(showSystem));
    system.setAttribute('aria-hidden', String(!showSystem));

    const route = showSystem ? '#academy-system' : '#academy';
    const state = showSystem
      ? { page: 'academy', academyView: 'system' }
      : { page: 'academy', academyView: 'cover' };

    try {
      if (settings.pushHistory) window.history.pushState(state, '', route);
      if (settings.replaceHistory) window.history.replaceState(state, '', route);
    } catch (error) {
      // file:// previews can restrict History API. The view still changes.
    }

    if (settings.scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => {
      const focusTarget = showSystem
        ? system.querySelector('h2, button, [tabindex]')
        : cover.querySelector('h1, button, [tabindex]');
      if (!focusTarget) return;
      focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }, settings.scroll ? 260 : 0);
  }

  function academyShowCover(options) {
    academySetView('cover', options);
  }

  function academyEnterSystem(options) {
    academySetView('system', options);
  }

  function renderVisionPreview(key) {
    const content = SIX_COMMON_VISION[key];
    if (!content) return;

    const indexElement = document.getElementById('vision-preview-index');
    const titleElement = document.getElementById('vision-preview-title');
    const pointsElement = document.getElementById('vision-preview-points');
    if (!indexElement || !titleElement || !pointsElement) return;

    indexElement.textContent = content.index + ' · SIX-COMMON VISION';
    titleElement.textContent = content.title;
    pointsElement.replaceChildren();

    content.points.forEach(([label, copy]) => {
      const item = document.createElement('li');
      const strong = document.createElement('strong');
      const span = document.createElement('span');
      strong.textContent = label;
      span.textContent = copy;
      item.append(strong, span);
      pointsElement.appendChild(item);
    });

    document.querySelectorAll('.vision-node').forEach((node) => {
      const isActive = node.dataset.vision === key;
      node.classList.toggle('is-active', isActive);
      node.setAttribute('aria-pressed', String(isActive));
    });

    const core = document.getElementById('vision-core');
    if (core) {
      core.classList.remove('is-updating');
      void core.offsetWidth;
      core.classList.add('is-updating');
    }
  }

  function setupVisionExperience() {
    const orbit = document.getElementById('vision-orbit');
    if (!orbit) return;

    const nodes = Array.from(orbit.querySelectorAll('.vision-node'));
    nodes.forEach((node, nodeIndex) => {
      const activate = () => renderVisionPreview(node.dataset.vision);
      node.addEventListener('mouseenter', activate);
      node.addEventListener('focus', activate);
      node.addEventListener('click', activate);
      node.addEventListener('keydown', (event) => {
        let nextIndex = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (nodeIndex + 1) % nodes.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (nodeIndex - 1 + nodes.length) % nodes.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = nodes.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        nodes[nextIndex].focus();
      });
    });

    renderVisionPreview('value');
  }

  window.academyShowCover = academyShowCover;
  window.academyEnterSystem = academyEnterSystem;
  window.activateSixCommonVision = renderVisionPreview;

  document.addEventListener('DOMContentLoaded', setupVisionExperience);
})();
