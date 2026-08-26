/**
 * Strategy case library: horizontal browsing, generic case homepages,
 * controlled attachment previews, and drill-down to the existing Skyworth chapters.
 */
(function() {
  'use strict';

  var cases = window.STRATEGY_CASES || [];
  var carouselIndex = 0;
  var previewReturnFocus = null;
  var touchStartX = null;

  function pad(value) { return String(value).padStart(2, '0'); }

  function caseBySlug(slug) {
    return cases.find(function(item) { return item.slug === slug; }) || null;
  }

  function caseIndex(slug) {
    return cases.findIndex(function(item) { return item.slug === slug; });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function(char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  function visualMarkup(item, context) {
    var documentVisual = item.hero && item.hero.indexOf('/previews/') !== -1;
    if (item.hero) {
      return '<figure class="strategy-case-photo' + (documentVisual ? ' document-visual' : '') + '">' +
        '<img src="' + escapeHtml(item.hero) + '" alt="' + escapeHtml(item.alt) + '"/>' +
        '<figcaption>' + escapeHtml(item.caption) + '</figcaption></figure>';
    }
    return '<div class="strategy-case-photo strategy-case-photo-fallback tone-' + escapeHtml(item.tone) + '" role="img" aria-label="' + escapeHtml(item.name + '案例识别图') + '">' +
      '<span>' + escapeHtml(item.english) + '</span><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(context || item.type) + '</small></div>';
  }

  function renderCarousel(index) {
    if (!cases.length) return;
    carouselIndex = (index + cases.length) % cases.length;
    var item = cases[carouselIndex];
    var stage = document.getElementById('strategy-case-carousel-stage');
    var counter = document.getElementById('strategy-case-counter');
    var dots = document.getElementById('strategy-case-dots');
    if (!stage) return;

    stage.classList.remove('is-ready');
    stage.innerHTML = '<article class="strategy-case-slide tone-' + escapeHtml(item.tone) + '">' +
      '<button class="strategy-case-brand" type="button" onclick="strategyOpenCase(\'' + escapeHtml(item.slug) + '\')" aria-label="进入' + escapeHtml(item.name) + '案例主页">' +
        '<small>' + escapeHtml(item.english) + '</small><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(item.type) + '</span></button>' +
      visualMarkup(item, item.type) +
      '<div class="strategy-case-story"><span class="strategy-case-type">' + escapeHtml(item.status) + ' · ' + escapeHtml(item.ticker) + '</span>' +
        '<h3>' + escapeHtml(item.headline) + '</h3><p>' + escapeHtml(item.summary) + '</p>' +
        '<button class="strategy-case-open" onclick="strategyOpenCase(\'' + escapeHtml(item.slug) + '\')" type="button">进入案例主页 <span>→</span></button></div>' +
      '</article>';
    if (counter) counter.textContent = '案例库 · ' + pad(carouselIndex + 1) + ' / ' + pad(cases.length);
    if (dots) {
      dots.innerHTML = cases.map(function(caseItem, dotIndex) {
        var active = dotIndex === carouselIndex;
        return '<button type="button" class="' + (active ? 'active' : '') + '" aria-label="查看' + escapeHtml(caseItem.name) + '" aria-current="' + (active ? 'true' : 'false') + '" onclick="strategySelectCase(' + dotIndex + ')"><span>' + pad(dotIndex + 1) + '</span><b>' + escapeHtml(caseItem.name) + '</b></button>';
      }).join('');
    }
    window.requestAnimationFrame(function() { stage.classList.add('is-ready'); });
  }

  function updateViewClass(view) {
    var page = document.getElementById('page-strategy');
    if (!page) return;
    page.classList.remove('strategy-hub-active', 'strategy-case-active', 'strategy-depth-active');
    page.classList.add(view === 'detail' ? 'strategy-case-active' : view === 'depth' ? 'strategy-depth-active' : 'strategy-hub-active');
    page.setAttribute('data-strategy-view', view);
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

  function ensureStrategyPage() {
    var page = document.getElementById('page-strategy');
    if (page && !page.classList.contains('active') && typeof navigateTo === 'function') {
      navigateTo('strategy', { skipHistory: true, scroll: false, preserveStrategyView: true });
    }
  }

  function scrollTopForView(options) {
    if (options && options.scroll === false) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function strategyShowHub(options) {
    options = options || {};
    ensureStrategyPage();
    updateViewClass('hub');
    var detail = document.getElementById('strategy-case-detail');
    if (detail) { detail.hidden = true; detail.innerHTML = ''; }
    setHistory('#strategy', { page: 'strategy', strategyView: 'hub' }, options);
    scrollTopForView(options);
    document.title = '梦工场 · 家族传承系统 | 从价值创造到百年传承';
  }

  function strategyScrollToCases() {
    var target = document.getElementById('strategy-cases');
    if (!target) return;
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  function methodMarkup(item) {
    return item.method.map(function(step, index) {
      return '<li><span>' + pad(index + 1) + '</span><strong>' + escapeHtml(step) + '</strong></li>';
    }).join('');
  }

  function attachmentMarkup(item, attachment, index) {
    var preview = attachment.preview
      ? '<img src="' + escapeHtml(attachment.preview) + '" alt="' + escapeHtml(attachment.title + '预览') + '"/>'
      : '<div class="strategy-attachment-file"><span>' + escapeHtml(attachment.type) + '</span><b>' + escapeHtml(item.name) + '</b></div>';
    return '<button class="strategy-attachment-card" type="button" onclick="strategyPreviewAttachment(\'' + escapeHtml(item.slug) + '\',' + index + ')">' +
      '<span class="strategy-attachment-preview">' + preview + '</span>' +
      '<span class="strategy-attachment-copy"><small>' + escapeHtml(attachment.role) + ' · ' + escapeHtml(attachment.type) + '</small><strong>' + escapeHtml(attachment.title) + '</strong><em>点击预览</em></span></button>';
  }

  function renderCaseDetail(item) {
    var index = caseIndex(item.slug);
    var previous = cases[(index - 1 + cases.length) % cases.length];
    var next = cases[(index + 1) % cases.length];
    var deepAction = item.slug === 'skyworth'
      ? '<button class="btn btn-primary" type="button" onclick="strategyOpenSkyworthDepth(1)">查看双章节完整案例</button>'
      : '<button class="btn btn-primary" type="button" onclick="document.getElementById(\'strategy-case-materials\').scrollIntoView({behavior:\'smooth\'})">浏览项目附件</button>';

    return '<div class="strategy-detail-hero tone-' + escapeHtml(item.tone) + '"><div class="strategy-case-shell">' +
      '<nav class="strategy-detail-breadcrumb" aria-label="案例路径"><button type="button" onclick="strategyShowHub()">战略与实践</button><span>/</span><b>' + escapeHtml(item.name) + '</b></nav>' +
      '<div class="strategy-detail-hero-grid"><div class="strategy-detail-copy"><p class="strategy-hub-kicker">案例 ' + pad(index + 1) + ' / ' + pad(cases.length) + ' · ' + escapeHtml(item.status) + '</p>' +
        '<div class="strategy-detail-wordmark"><small>' + escapeHtml(item.english) + '</small><h1>' + escapeHtml(item.name) + '</h1><span>' + escapeHtml(item.ticker) + '</span></div>' +
        '<h2>' + escapeHtml(item.headline) + '</h2><p>' + escapeHtml(item.summary) + '</p><div class="strategy-detail-actions">' + deepAction + '<button class="btn btn-secondary" type="button" onclick="strategyShowHub()">返回案例库</button></div></div>' +
        '<div class="strategy-detail-visual">' + visualMarkup(item, item.type) + '<div class="strategy-detail-stamp"><span>' + escapeHtml(item.type) + '</span><b>' + item.materialsTotal + '</b><small>项资料</small></div></div></div>' +
      '</div></div>' +
      '<section class="strategy-detail-logic"><div class="strategy-case-shell"><div class="strategy-detail-question"><p class="strategy-hub-kicker">项目命题</p><h2>' + escapeHtml(item.question) + '</h2></div>' +
        '<div class="strategy-detail-method"><div><span>研究路径</span><ol>' + methodMarkup(item) + '</ol></div><aside><span>阶段成果</span><p>' + escapeHtml(item.outcome) + '</p><small>页面表述基于资料包，未披露内部原始数据与未经确认的经营结果。</small></aside></div></div></section>' +
      '<section class="strategy-detail-materials" id="strategy-case-materials"><div class="strategy-case-shell"><header><div><p class="strategy-hub-kicker">关联附件 · 受控预览</p><h2>从案例主页，下钻到研究与演示材料</h2></div><p>资料包共 ' + item.materialsTotal + ' 项；此处展示核心材料与安全预览。内部估值、个人信息、签章及未确认结论不直接公开。</p></header>' +
        '<div class="strategy-attachment-grid">' + item.attachments.map(function(attachment, attachmentIndex) { return attachmentMarkup(item, attachment, attachmentIndex); }).join('') + '</div></div></section>' +
      '<nav class="strategy-detail-pagination" aria-label="相邻案例"><button type="button" onclick="strategyOpenCase(\'' + escapeHtml(previous.slug) + '\')"><small>上一个案例</small><strong>← ' + escapeHtml(previous.name) + '</strong></button>' +
        '<button type="button" onclick="strategyOpenCase(\'' + escapeHtml(next.slug) + '\')"><small>下一个案例</small><strong>' + escapeHtml(next.name) + ' →</strong></button></nav>';
  }

  function strategyOpenCase(slug, options) {
    options = options || {};
    var item = caseBySlug(slug);
    if (!item) return;
    ensureStrategyPage();
    var detail = document.getElementById('strategy-case-detail');
    if (!detail) return;
    carouselIndex = caseIndex(slug);
    renderCarousel(carouselIndex);
    detail.innerHTML = renderCaseDetail(item);
    detail.hidden = false;
    updateViewClass('detail');
    setHistory('#strategy-case-' + slug, { page: 'strategy', strategyCase: slug }, options);
    scrollTopForView(options);
    document.title = item.name + '案例 · 梦工场战略与实践';
  }

  function strategyOpenSkyworthDepth(chapter, options) {
    options = options || {};
    ensureStrategyPage();
    updateViewClass('depth');
    var detail = document.getElementById('strategy-case-detail');
    if (detail) detail.hidden = true;
    chapter = Number(chapter) === 2 ? 2 : 1;
    if (typeof strategyOpenChapter === 'function') {
      strategyOpenChapter(chapter, { scroll: options.scroll !== false });
    }
    setHistory(chapter === 2 ? '#strategy-chapter2' : '#strategy-chapter1', { page: 'strategy', strategyChapter: chapter, strategyCase: 'skyworth' }, options);
    if (options.scroll === false) window.scrollTo(0, 0);
    document.title = '创维汽车战略定位完整案例 · 梦工场';
  }

  function previewModal() {
    var modal = document.getElementById('strategy-attachment-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'strategy-attachment-modal';
    modal.id = 'strategy-attachment-modal';
    modal.hidden = true;
    modal.innerHTML = '<div class="strategy-attachment-backdrop" onclick="strategyCloseAttachmentPreview()"></div><section class="strategy-attachment-dialog" role="dialog" aria-modal="true" aria-labelledby="strategy-preview-title"><button class="strategy-preview-close" type="button" aria-label="关闭附件预览" onclick="strategyCloseAttachmentPreview()">×</button><div id="strategy-preview-content"></div></section>';
    document.body.appendChild(modal);
    return modal;
  }

  function strategyPreviewAttachment(slug, attachmentIndex) {
    var item = caseBySlug(slug);
    var attachment = item && item.attachments[attachmentIndex];
    if (!attachment) return;
    previewReturnFocus = document.activeElement;
    var modal = previewModal();
    var content = document.getElementById('strategy-preview-content');
    var visual = attachment.preview
      ? '<div class="strategy-preview-visual"><img src="' + escapeHtml(attachment.preview) + '" alt="' + escapeHtml(attachment.title + '预览图') + '"/></div>'
      : '<div class="strategy-preview-visual strategy-preview-file"><span>' + escapeHtml(attachment.type) + '</span><strong>' + escapeHtml(item.name) + '</strong></div>';
    var action = '';
    if (attachment.action === 'deep-1') action = '<button class="btn btn-primary" type="button" onclick="strategyCloseAttachmentPreview();strategyOpenSkyworthDepth(1)">进入第一章完整演示</button>';
    if (attachment.action === 'deep-2') action = '<button class="btn btn-primary" type="button" onclick="strategyCloseAttachmentPreview();strategyOpenSkyworthDepth(2)">进入第二章完整演示</button>';
    content.innerHTML = visual + '<div class="strategy-preview-copy"><p class="strategy-hub-kicker">' + escapeHtml(attachment.role) + ' · ' + escapeHtml(attachment.type) + '</p><h2 id="strategy-preview-title">' + escapeHtml(attachment.title) + '</h2><p>' + escapeHtml(attachment.summary) + '</p>' +
      '<div class="strategy-preview-notice"><strong>' + (attachment.restricted ? '脱敏凭证' : '受控预览') + '</strong><span>' + (attachment.restricted ? '原件含公司地址、统一社会信用代码、签章等信息，未复制到公开网页。' : '本预览用于说明交付物结构；原始内部材料、估值数据与未确认判断不在公开页面直接下载。') + '</span></div>' + action + '</div>';
    modal.hidden = false;
    document.body.classList.add('strategy-preview-open');
    modal.querySelector('.strategy-preview-close').focus();
  }

  function strategyCloseAttachmentPreview() {
    var modal = document.getElementById('strategy-attachment-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('strategy-preview-open');
    if (previewReturnFocus && typeof previewReturnFocus.focus === 'function') previewReturnFocus.focus();
  }

  function routeFromLocation(options) {
    var hash = window.location.hash.replace('#', '');
    if (hash === 'strategy-chapter1' || hash === 'strategy-chapter2') {
      strategyOpenSkyworthDepth(hash === 'strategy-chapter2' ? 2 : 1, options);
      return;
    }
    if (hash.indexOf('strategy-case-') === 0) {
      strategyOpenCase(hash.replace('strategy-case-', ''), options);
      return;
    }
    if (hash === 'strategy') strategyShowHub(options);
  }

  function setupEvents() {
    var previous = document.getElementById('strategy-case-prev');
    var next = document.getElementById('strategy-case-next');
    var carousel = document.querySelector('.strategy-case-carousel');
    if (previous) previous.addEventListener('click', function() { renderCarousel(carouselIndex - 1); });
    if (next) next.addEventListener('click', function() { renderCarousel(carouselIndex + 1); });
    if (carousel) {
      carousel.addEventListener('keydown', function(event) {
        if (event.key === 'ArrowLeft') { event.preventDefault(); renderCarousel(carouselIndex - 1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); renderCarousel(carouselIndex + 1); }
      });
      carousel.addEventListener('touchstart', function(event) { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
      carousel.addEventListener('touchend', function(event) {
        if (touchStartX == null) return;
        var delta = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(delta) > 52) renderCarousel(carouselIndex + (delta < 0 ? 1 : -1));
        touchStartX = null;
      }, { passive: true });
    }
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') strategyCloseAttachmentPreview();
    });
    window.addEventListener('popstate', function() {
      window.setTimeout(function() { routeFromLocation({ pushHistory: false, scroll: true }); }, 10);
    });
  }

  function init() {
    renderCarousel(0);
    setupEvents();
    previewModal();
    if (window.location.hash.indexOf('#strategy') === 0) {
      routeFromLocation({ replaceHistory: true, scroll: false });
    }
  }

  window.strategySelectCase = renderCarousel;
  window.strategyShowHub = strategyShowHub;
  window.strategyScrollToCases = strategyScrollToCases;
  window.strategyOpenCase = strategyOpenCase;
  window.strategyOpenSkyworthDepth = strategyOpenSkyworthDepth;
  window.strategyPreviewAttachment = strategyPreviewAttachment;
  window.strategyCloseAttachmentPreview = strategyCloseAttachmentPreview;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
