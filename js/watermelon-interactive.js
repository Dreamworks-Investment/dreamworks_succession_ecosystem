
/**
 * V11.6 · 第二章西瓜结语信息图交互
 * Hover previews; click locks; mobile uses click.
 */
(function () {
  'use strict';

  let lockedKey = null;

  function shell() {
    return document.getElementById('ch2-watermelon-detail-shell');
  }

  function stages() {
    return Array.from(document.querySelectorAll('.wm-interactive-stage[data-wm-detail], .wm-convergence-stage[data-wm-detail]'));
  }

  function panels() {
    return Array.from(document.querySelectorAll('.ch2-watermelon-detail-card[data-wm-panel]'));
  }

  function showDetail(key, lock) {
    const detailShell = shell();
    const target = panels().find((item) => item.dataset.wmPanel === key);
    if (!detailShell || !target) return;

    detailShell.hidden = false;
    panels().forEach((panel) => {
      panel.hidden = panel !== target;
    });

    stages().forEach((stage) => {
      stage.classList.toggle('is-active', stage.dataset.wmDetail === key);
    });

    if (lock) lockedKey = key;
  }

  function hideDetail(force) {
    if (lockedKey && !force) return;
    const detailShell = shell();
    if (detailShell) detailShell.hidden = true;
    panels().forEach((panel) => { panel.hidden = true; });
    stages().forEach((stage) => stage.classList.remove('is-active'));
    if (force) lockedKey = null;
  }

  function setupStages() {
    stages().forEach((stage) => {
      const key = stage.dataset.wmDetail;

      stage.addEventListener('mouseenter', () => {
        if (window.matchMedia('(hover: hover)').matches) {
          showDetail(key, false);
        }
      });

      stage.addEventListener('mouseleave', () => {
        if (window.matchMedia('(hover: hover)').matches) {
          if (lockedKey) showDetail(lockedKey, false);
          else hideDetail(false);
        }
      });

      stage.addEventListener('focus', () => {
        showDetail(key, false);
      });

      stage.addEventListener('click', () => {
        if (lockedKey === key) {
          hideDetail(true);
          return;
        }
        showDetail(key, true);
      });

      stage.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          stage.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          hideDetail(true);
          stage.blur();
        }
      });
    });
  }

  function setupClose() {
    const button = document.querySelector('.ch2-watermelon-detail-close');
    if (!button) return;
    button.addEventListener('click', () => hideDetail(true));
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupStages();
    setupClose();
    hideDetail(true);
  });
})();
