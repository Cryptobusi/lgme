import { categoryCount, loadSeen, markCategory } from './new-marks.mjs';

const root = document.getElementById('category-grid');
if (root) {
  const paint = (seen) => {
    root.querySelectorAll('[data-entry]').forEach((tile) => {
      const id = tile.getAttribute('data-entry');
      const count = categoryCount(id, seen);
      tile.classList.toggle('is-new', count > 0);
      let badge = tile.querySelector('.new-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'new-badge';
        badge.setAttribute('aria-hidden', 'true');
        tile.append(badge);
      }
      badge.textContent = count > 9 ? '9+' : count ? String(count) : '';
      const name = tile.querySelector('.tile-name')?.textContent || 'Category';
      if (count) tile.setAttribute('aria-label', `${name}, ${badge.textContent} new`);
    });
  };
  loadSeen().then(paint);
  const open = document.getElementById('help-develop-open');
  const sheet = document.getElementById('help-develop-sheet');
  const chips = document.getElementById('help-develop-chips');
  const go = document.getElementById('help-develop-go');
  if (open && sheet && chips && go) {
    const names = [...root.querySelectorAll('.tile-name')].map((node) => node.textContent.trim()).filter((name) => name !== 'Health');
    names.forEach((name, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      button.addEventListener('click', () => {
        chips.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', 'false'));
        button.setAttribute('aria-pressed', 'true');
        go.href = `/develop?category=${encodeURIComponent(name)}`;
      });
      chips.append(button);
    });
    open.addEventListener('click', () => { sheet.hidden = !sheet.hidden; });
  }
  root.addEventListener('click', (event) => {
    const tile = event.target.closest?.('[data-entry]');
    if (!tile) return;
    markCategory(readLocal(), tile.getAttribute('data-entry'));
  });
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem('lgme.seen.listings') || '{}'); } catch { return {}; }
}
