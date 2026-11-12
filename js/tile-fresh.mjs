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
  root.addEventListener('click', (event) => {
    const tile = event.target.closest?.('[data-entry]');
    if (!tile) return;
    markCategory(readLocal(), tile.getAttribute('data-entry'));
  });
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem('lgme.seen.listings') || '{}'); } catch { return {}; }
}
