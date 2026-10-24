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
})();
