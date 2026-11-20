// Keep the same reading location when rotation or the on-screen keyboard resizes the viewer.
(function () {
  const pages = [...document.querySelectorAll('.page')];
  if (!pages.length) return;
  const size = () => [document.documentElement.clientWidth, innerHeight];
  let viewport = size(),
    anchor,
    pending = 0;
  const line = () =>
    (document.querySelector('.vnr-position')?.getBoundingClientRect().bottom || 162) + 8;

  function capture() {
    const top = line();
    const page = pages.find((node) => node.getBoundingClientRect().bottom > top) || pages.at(-1);
    const rect = page.getBoundingClientRect();
    return {
      page,
      fraction: Math.max(0, Math.min(1, (top - rect.top) / rect.height)),
      horizontal: rect.width ? scrollX / rect.width : 0,
    };
  }
  function remember() {
    const current = size();
    // A scroll event can arrive after CSS reflow but before the resize event.
    if (pending || current.some((value, i) => value !== viewport[i])) return;
    anchor = capture();
    const number = Number(anchor.page.id.slice(5));
    if (viewerPage !== number) {
      viewerPage = number;
      const input = document.getElementById('vnr-page');
      if (document.activeElement !== input) input.value = number;
      persistViewer();
    }
  }
  window.addEventListener('scroll', remember, { passive: true });
  window.addEventListener('resize', () => {
    if (pending) cancelAnimationFrame(pending);
    const saved = anchor || capture();
    pending = requestAnimationFrame(() => {
      const rect = saved.page.getBoundingClientRect();
      window.scrollTo({
        top: scrollY + rect.top + saved.fraction * rect.height - line(),
        left: saved.horizontal * rect.width,
        behavior: 'auto',
      });
      viewport = size();
      pending = 0;
      remember();
    });
  });
  document.addEventListener('click', () => requestAnimationFrame(remember));
  window.addEventListener('load', remember);
  remember();

  // Keep only the bookmark/download/position bar out of the way while reading.
  // Opacity preserves its bounds, which the page/zoom anchors above rely on.
  const controls = document.querySelector('.vnr-position');
  if (!controls) return;
  const panels = [
    document.querySelector('.vnr-bookmarks'),
    document.querySelector('.vnr-offline'),
  ].filter(Boolean);
  const pointers = new Set();
  let idleTimer = null,
    touchingControls = false,
    keyboardInput = true;
  const inControls = (target) =>
    target instanceof Element &&
    (controls.contains(target) || panels.some((panel) => panel.contains(target)));
  function pinned() {
    return (
      pointers.size > 0 ||
      touchingControls ||
      (keyboardInput && controls.contains(document.activeElement)) ||
      panels.some((panel) => !panel.hidden)
    );
  }
  function showControls() {
    clearTimeout(idleTimer);
    idleTimer = null;
    controls.classList.remove('vnr-position-idle');
    if (document.hidden || pinned()) return;
    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (!pinned()) controls.classList.add('vnr-position-idle');
    }, 1500);
  }
  document.addEventListener(
    'pointerdown',
    (event) => {
      keyboardInput = false;
      if (inControls(event.target)) pointers.add(event.pointerId);
      showControls();
    },
    { capture: true, passive: true },
  );
  for (const type of ['pointerup', 'pointercancel'])
    window.addEventListener(
      type,
      (event) => {
        pointers.delete(event.pointerId);
        showControls();
      },
      { capture: true, passive: true },
    );
  // Touch events also support WebViews that do not provide pointer events.
  document.addEventListener(
    'touchstart',
    (event) => {
      keyboardInput = false;
      if (inControls(event.target)) touchingControls = true;
      showControls();
    },
    { capture: true, passive: true },
  );
  for (const type of ['touchend', 'touchcancel'])
    window.addEventListener(
      type,
      (event) => {
        if (!event.touches.length) touchingControls = false;
        showControls();
      },
      { capture: true, passive: true },
    );
  for (const type of ['scroll', 'wheel', 'touchmove', 'pointermove'])
    window.addEventListener(type, showControls, { capture: true, passive: true });
  document.addEventListener('keydown', () => {
    keyboardInput = true;
    showControls();
  }, true);
  document.addEventListener('focusin', showControls, true);
  document.addEventListener('focusout', () => Promise.resolve().then(showControls), true);
  const observer = new MutationObserver(showControls);
  for (const panel of panels)
    observer.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', showControls);
  window.addEventListener('pageshow', showControls);
  window.addEventListener('blur', () => {
    pointers.clear();
    touchingControls = false;
    showControls();
  });
  window.addEventListener('pagehide', () => {
    clearTimeout(idleTimer);
    pointers.clear();
    touchingControls = false;
  });
  showControls();
})();
