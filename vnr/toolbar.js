(function () {
  const input = document.getElementById('vnr-search'),
    clear = document.getElementById('clear-vnr'),
    count = document.getElementById('vnr-count');
  input.disabled = false;
  function updateZoom() {
    document.documentElement.style.setProperty('--vnr-zoom', String(viewerZoom));
    document.getElementById('vnr-zoom-value').textContent = Math.round(viewerZoom * 100) + '%';
    document.getElementById('vnr-zoom-out').disabled = viewerZoom <= 0.75;
    document.getElementById('vnr-zoom-in').disabled = viewerZoom >= 3;
    persistViewer();
  }
  function zoom(change) {
    // The saved page can lag behind ordinary scrolling. Anchor the content
    // actually beneath the fixed controls before changing document geometry.
    const line =
      (document.querySelector('.vnr-position')?.getBoundingClientRect().bottom || 162) + 8;
    const pages = [...document.querySelectorAll('.page')];
    const page = pages.find((node) => node.getBoundingClientRect().bottom > line) || pages.at(-1);
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const y = Math.max(0, Math.min(1, (line - rect.top) / rect.height));
    const left = scrollX;
    viewerPage = Number(page.id.slice(5));
    document.getElementById('vnr-page').value = viewerPage;
    viewerZoom = Math.max(0.75, Math.min(3, viewerZoom + change));
    updateZoom();
    if (selected >= 0) renderHits(false);
    // Read the new dimensions synchronously so repeated taps cannot restore
    // an earlier position in a later animation frame.
    const resized = page.getBoundingClientRect();
    window.scrollTo({
      top: scrollY + resized.top + y * resized.height - line,
      left,
      behavior: 'auto',
    });
  }
  document.getElementById('vnr-zoom-out').onclick = () => zoom(-0.25);
  document.getElementById('vnr-zoom-in').onclick = () => zoom(0.25);
  function pageGo() {
    const value = Number(document.getElementById('vnr-page').value);
    if (Number.isInteger(value) && value >= 1 && value <= 207) jumpPage(value);
  }
  document.getElementById('vnr-page-go').onclick = pageGo;
  document.getElementById('vnr-page').onkeydown = (event) => {
    if (event.key === 'Enter') pageGo();
  };

  function show(v) {
    count.textContent = v.active + '/' + v.total;
    clear.style.display = input.value ? 'block' : 'none';
  }
  input.addEventListener('input', () => show(runSearch(input.value)));
  clear.addEventListener('click', () => {
    input.value = '';
    show(runSearch(''));
    input.focus();
  });
  document.getElementById('vnr-prev').addEventListener('click', () => show(nextHit(false)));
  document.getElementById('vnr-next').addEventListener('click', () => show(nextHit(true)));
  document.getElementById('vnr-toc').addEventListener('click', () => jumpPage(2));
  const oldQuery = typeof viewerSaved.query === 'string' ? viewerSaved.query : '',
    oldSelected = viewerSaved.selected,
    oldPage = viewerPage;
  input.value = oldQuery;
  show(runSearch(oldQuery));
  if (Number.isInteger(oldSelected) && oldSelected >= 0 && oldSelected < matches.length) {
    selected = oldSelected;
    renderHits();
    show({ active: selected + 1, total: matches.length });
  }
  updateZoom();
  jumpPage(oldPage);
})();
