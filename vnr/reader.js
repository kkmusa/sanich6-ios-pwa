document.addEventListener(
  'error',
  (event) => {
    if (event.target.matches?.('.page img')) {
      const notice = document.getElementById('vnr-missing-pages');
      if (notice) notice.hidden = false;
    }
  },
  true,
);
const VIEWER_STATE_KEY = 'sanich6_vnr_reader_v1';
let viewerSaved = {};
try {
  viewerSaved = JSON.parse(sessionStorage.getItem(VIEWER_STATE_KEY) || '{}') || {};
} catch {}
let viewerZoom = Number.isFinite(viewerSaved.zoom)
    ? Math.max(0.75, Math.min(3, viewerSaved.zoom))
    : 1,
  viewerPage = Number.isInteger(viewerSaved.page)
    ? Math.max(1, Math.min(207, viewerSaved.page))
    : 1;
let matches = [],
  selected = -1;
function persistViewer() {
  try {
    sessionStorage.setItem(
      VIEWER_STATE_KEY,
      JSON.stringify({
        query: document.getElementById('vnr-search').value,
        selected,
        zoom: viewerZoom,
        page: viewerPage,
      }),
    );
  } catch {}
}

const searchPages = wordPages.map((words) => {
  let text = '',
    offsets = [];
  for (const word of words) {
    offsets.push(text.length);
    text += word[0].toLocaleLowerCase('ru').replace(/ё/g, 'е') + ' ';
  }
  return { text, offsets };
});
function jumpPage(n) {
  const p = document.getElementById('page-' + n);
  if (p) {
    viewerPage = n;
    document.getElementById('vnr-page').value = n;
    p.scrollIntoView({ block: 'start', behavior: 'auto' });
    persistViewer();
  }
}
function openExternal(url) {
  location.href = url;
}
function clearHits() {
  document.querySelectorAll('.hit').forEach((x) => x.remove());
}
function showMatch(m, active, scroll = true) {
  const p = document.getElementById('page-' + (m.p + 1));
  if (!p) return;
  let first;
  for (const box of m.boxes) {
    const el = document.createElement('span');
    el.className = 'hit' + (active ? ' current' : '');
    el.style.cssText = `left:${box[1]}%;top:${box[2]}%;width:${box[3]}%;height:${box[4]}%;`;
    p.appendChild(el);
    first ??= el;
  }
  if (active && scroll) {
    viewerPage = m.p + 1;
    document.getElementById('vnr-page').value = viewerPage;
  }
  if (active && first && scroll)
    first.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
}
function renderHits(scroll = true) {
  clearHits();
  if (selected < 0) return;
  const page = matches[selected].p;
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].p === page) showMatch(matches[i], i === selected, scroll);
  }
}
function runSearch(q) {
  matches = [];
  selected = -1;
  clearHits();
  q = q.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
  if (!q) {
    persistViewer();
    return { active: 0, total: 0 };
  }
  for (let pi = 0; pi < searchPages.length; pi++) {
    const { text, offsets } = searchPages[pi];
    let at = 0;
    while ((at = text.indexOf(q, at)) !== -1) {
      // Locate the first affected word without scanning the entire page per result.
      let low = 0,
        high = offsets.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (offsets[mid] <= at) low = mid + 1;
        else high = mid;
      }
      const boxes = [];
      for (let wi = Math.max(0, low - 1); wi < offsets.length && offsets[wi] < at + q.length; wi++)
        boxes.push(wordPages[pi][wi]);
      if (boxes.length) matches.push({ p: pi, boxes });
      at += q.length;
    }
  }
  if (matches.length) selected = 0;
  renderHits();
  persistViewer();
  return { active: selected + 1, total: matches.length };
}
function nextHit(forward) {
  if (!matches.length) return { active: 0, total: 0 };
  selected = (selected + (forward ? 1 : -1) + matches.length) % matches.length;
  renderHits();
  persistViewer();
  return { active: selected + 1, total: matches.length };
}
