/**
 * Confidential home-page media gate.
 * The full-resolution image remains on a cookie-protected server path and is
 * requested only after this independent scope has been authenticated.
 */
(function () {
  'use strict';

  const auth = window.DREAMWORKS_STRATEGY_AUTH || { grants: {}, configured: {} };

  function setupConfidentialMedia() {
    const media = document.querySelector('[data-confidential-media]');
    const image = media && media.querySelector('[data-confidential-image]');
    const open = media && media.querySelector('[data-confidential-open]');
    const modal = document.querySelector('[data-confidential-modal]');
    const username = document.getElementById('home-confidential-username');
    if (!media || !image || !open || !modal) return;

    const closeButtons = Array.from(modal.querySelectorAll('[data-confidential-close]'));
    let lastFocused = null;

    const closeModal = () => {
      modal.hidden = true;
      document.body.classList.remove('has-confidential-modal');
      if (lastFocused) lastFocused.focus({ preventScroll: true });
    };

    const unlockMedia = () => {
      const source = image.dataset.src;
      image.addEventListener('load', () => media.classList.add('is-unlocked'), { once: true });
      image.addEventListener('error', () => media.classList.remove('is-unlocked'), { once: true });
      if (source && !image.getAttribute('src')) image.src = source;
      open.hidden = true;
      media.classList.add('is-unlocked');
      media.setAttribute('aria-label', '已解锁的战略沟通截图');
      closeModal();
    };

    const openModal = () => {
      lastFocused = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('has-confidential-modal');
      window.setTimeout(() => username?.focus({ preventScroll: true }), 30);
    };

    if (auth.grants && auth.grants.chat) {
      unlockMedia();
      try {
        const stored = JSON.parse(window.sessionStorage.getItem('dreamworks:auth-return') || 'null');
        if (stored && stored.scope === 'chat') {
          window.sessionStorage.removeItem('dreamworks:auth-return');
          window.requestAnimationFrame(() => {
            media.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
              block: 'center'
            });
          });
        }
      } catch (error) {
        window.sessionStorage.removeItem('dreamworks:auth-return');
      }
    } else {
      open.addEventListener('click', openModal);
    }

    closeButtons.forEach((button) => button.addEventListener('click', closeModal));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) closeModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupConfidentialMedia);
  } else {
    setupConfidentialMedia();
  }
})();
