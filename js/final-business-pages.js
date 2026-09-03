/**
 * final-business-pages.js
 * 传承学院两级入口 + 六共愿景互动。
 */
(function () {
  'use strict';

  const ACADEMY_MILESTONES = Object.freeze({
    opening: {
      icon: '🏫',
      date: '2024年11月',
      stage: '学习营开学',
      summary: '从一份个人SMART计划开始，把家族学习、个人成长与未来实践目标写成可回看的起点。',
      materials: [
        {
          title: '梦工场传承学院个人SMART计划表',
          url: 'https://www.feishu.cn/docx/Ie8KdYNJCo73WKxuhLecxbhBn0f'
        }
      ]
    },
    'inheritance-investment': {
      icon: '🏛️',
      date: '2025年3月',
      stage: '传承与投资',
      summary: '围绕传承第一性原理与长期价值投资建立共同语言，从“知道”走向能够表达、讨论和判断。',
      materials: [
        {
          title: '传承学院问卷',
          url: 'https://www.feishu.cn/docx/QZpddvpM9oi6MlxxWY0c5d1Xnth'
        },
        {
          title: '传承认知与投资认知问卷',
          url: 'https://www.feishu.cn/docx/X1qNdRe5IoTmS3xiYLHcVWRynIJ'
        }
      ]
    },
    trust: {
      icon: '🛡️',
      date: '2025年4月',
      stage: '信托认知',
      summary: '理解家族信托与慈善信托的功能、边界和基本设立逻辑，为未来的家族实践建立工具认知。',
      materials: [
        {
          title: '家族信托与慈善信托QA',
          url: 'https://www.feishu.cn/docx/Gdj2d5DEYoJOeOxl4pnc48gWnIg'
        }
      ]
    },
    graduation: {
      icon: '🎓',
      date: '2025年5月1日',
      stage: '学习营毕业',
      summary: '用毕业陈述回望学习成果，再以六个月规划承接实践营与长期陪跑。毕业是阶段节点，不是关系终点。',
      materials: [
        {
          title: '关于传承 · 毕业逐字稿',
          url: 'https://www.feishu.cn/docx/W3DQdPH7mo47fex61kQcG4GYnIg'
        },
        {
          title: '毕业规划',
          url: 'https://www.feishu.cn/docx/FbAOdcrcMoZ5UxxupFWchscHnCe'
        }
      ]
    }
  });

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

  function academySelectMaterial(milestone, materialIndex) {
    const material = milestone && milestone.materials && milestone.materials[materialIndex];
    if (!material) return;

    const title = document.getElementById('academy-document-title');
    const open = document.getElementById('academy-document-open');
    const frame = document.getElementById('academy-document-frame');
    const placeholder = document.getElementById('academy-document-placeholder');
    if (title) title.textContent = material.title;
    if (open) open.href = material.url;
    if (frame) {
      frame.title = material.title + '预览';
      frame.src = material.url;
    }
    if (placeholder) placeholder.setAttribute('aria-hidden', 'true');

    document.querySelectorAll('#academy-preview-material-list button').forEach((button, index) => {
      const isActive = index === materialIndex;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function academyRenderMilestone(milestoneKey) {
    const milestone = ACADEMY_MILESTONES[milestoneKey];
    if (!milestone) return null;

    const title = document.getElementById('academy-preview-title');
    const summary = document.getElementById('academy-preview-summary');
    const icon = document.getElementById('academy-preview-icon');
    const date = document.getElementById('academy-preview-date');
    const stage = document.getElementById('academy-preview-stage');
    const list = document.getElementById('academy-preview-material-list');
    if (title) title.textContent = milestone.stage + ' · 阶段材料';
    if (summary) summary.textContent = milestone.summary;
    if (icon) icon.textContent = milestone.icon;
    if (date) date.textContent = milestone.date;
    if (stage) stage.textContent = milestone.stage;

    if (list) {
      list.replaceChildren();
      milestone.materials.forEach((material, index) => {
        const button = document.createElement('button');
        const fileIcon = document.createElement('span');
        const label = document.createElement('b');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(index === 0));
        button.classList.toggle('is-active', index === 0);
        fileIcon.textContent = '文';
        label.textContent = material.title;
        button.append(fileIcon, label);
        button.addEventListener('click', () => academySelectMaterial(milestone, index));
        list.appendChild(button);
      });
    }

    academySelectMaterial(milestone, 0);
    return milestone;
  }

  function academySetView(view, options) {
    const settings = Object.assign({ pushHistory: false, replaceHistory: false, scroll: true }, options || {});
    const page = document.getElementById('page-academy');
    const views = {
      cover: document.getElementById('academy-cover-view'),
      about: document.getElementById('academy-about-view'),
      cases: document.getElementById('academy-cases-view'),
      material: document.getElementById('academy-material-view'),
      system: document.getElementById('academy-system-view')
    };
    if (!page || !views.cover || !views.system) return;

    const safeView = views[view] ? view : 'cover';
    ['cover', 'about', 'cases', 'material', 'system'].forEach((viewName) => {
      page.classList.toggle('academy-' + viewName + '-active', viewName === safeView);
      if (views[viewName]) views[viewName].setAttribute('aria-hidden', String(viewName !== safeView));
    });

    const milestoneKey = settings.milestoneKey || '';
    const routeMap = {
      cover: '#academy',
      about: '#academy-about',
      cases: '#academy-cases',
      system: '#academy-system',
      material: '#academy-material-' + milestoneKey
    };
    const route = routeMap[safeView];
    const state = { page: 'academy', academyView: safeView };
    if (safeView === 'material') state.academyMilestone = milestoneKey;

    try {
      if (settings.pushHistory) window.history.pushState(state, '', route);
      if (settings.replaceHistory) window.history.replaceState(state, '', route);
    } catch (error) {
      // file:// previews can restrict History API. The view still changes.
    }

    if (settings.scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => {
      const activeView = views[safeView];
      const focusTarget = activeView && (
        activeView.querySelector('h1, h2') || activeView.querySelector('button, [tabindex]')
      );
      if (!focusTarget) return;
      focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }, settings.scroll ? 260 : 0);

    if (safeView === 'cases') {
      const cap = document.querySelector('.academy-graduation-cap');
      if (cap) {
        cap.classList.remove('academy-graduation-cap');
        void cap.offsetWidth;
        cap.classList.add('academy-graduation-cap');
      }
    }

    if (safeView !== 'material') {
      const frame = document.getElementById('academy-document-frame');
      if (frame && frame.src && frame.src !== 'about:blank') frame.src = 'about:blank';
    }
  }

  function academyShowCover(options) {
    academySetView('cover', options);
  }

  function academyEnterSystem(options) {
    academySetView('system', options);
  }

  function academyShowAbout(options) {
    academySetView('about', options);
  }

  function academyShowCases(options) {
    academySetView('cases', options);
  }

  function academyOpenMilestone(milestoneKey, options) {
    if (!academyRenderMilestone(milestoneKey)) return;
    academySetView('material', Object.assign({}, options || {}, { milestoneKey }));
  }

  function academyRestoreView(state, options) {
    const view = state && state.academyView ? state.academyView : 'cover';
    if (view === 'material' && state.academyMilestone) {
      academyOpenMilestone(state.academyMilestone, Object.assign({}, options || {}, { milestoneKey: state.academyMilestone }));
      return;
    }
    academySetView(view, options);
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
  window.academyShowAbout = academyShowAbout;
  window.academyShowCases = academyShowCases;
  window.academyOpenMilestone = academyOpenMilestone;
  window.academyRestoreView = academyRestoreView;
  window.activateSixCommonVision = renderVisionPreview;

  document.addEventListener('DOMContentLoaded', setupVisionExperience);
})();
