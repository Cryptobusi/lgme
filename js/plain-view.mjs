const KEY = 'lgme.exchange.deepTheory';
const THEORY = new Set([
  '/study', '/manifesto', '/architecture', '/nswo', '/dominion', '/hederica', '/charter', '/bylaws',
  '/membership', '/why-must-we', '/synthesis', '/archive-that-cannot-walk', '/memory-that-walks-recommendations',
  '/human-nature-synthesis', '/operating-system-of-enclosure', '/opportunity', '/game-theory', '/technical',
  '/preparation', '/summary-test', '/mock-runs-report', '/test-300', '/test-1000', '/test-5000', '/pumpup',
  '/story', '/developer-notes', '/homebox', '/bigcapital', '/deployment-manifest', '/the-third-seat',
  '/consciousness', '/countermeasure', '/revelation', '/reversal', '/spp', '/soverx', '/disclosures',
  '#sovereignty', '#schelling', '#marcum', '#connecting', '#order', '#third-seat', '#checks', '#tape',
  '#enrollment', '#next', '#future'
]);

function deepOn() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

function applyPlainView() {
  const on = deepOn();
  document.documentElement.classList.toggle('deep', on);
  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const path = href.split('?')[0];
    if (THEORY.has(path) || THEORY.has(href)) link.hidden = !on;
  });
  document.querySelectorAll('section[id], .topsecret').forEach((node) => {
    if (node.classList.contains('topsecret') || THEORY.has('#' + node.id)) node.hidden = !on;
  });
  document.querySelectorAll('[data-deep-theory]').forEach((button) => {
    button.textContent = on ? 'Deep theory on' : 'Deep theory';
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function bindPlainView() {
  document.querySelectorAll('[data-deep-theory]').forEach((button) => {
    button.addEventListener('click', () => {
      try { localStorage.setItem(KEY, deepOn() ? '0' : '1'); } catch { /* stay simple */ }
      applyPlainView();
    });
  });
  applyPlainView();
}

bindPlainView();
