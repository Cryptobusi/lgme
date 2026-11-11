import { listingsFor } from './category-listings.mjs';

const LOCAL = 'lgme.seen.listings';
const ACTIONS = ['ididit', 'iwantit', 'ihavit'];

export function badgeText(count) {
  const n = Number(count) || 0;
  if (n <= 0) return '';
  return n > 9 ? '9+' : String(n);
}

export function freshCount(rows, seenAt) {
  const seen = Date.parse(seenAt || '') || 0;
  return (rows || []).filter((row) => Date.parse(row.at) > seen).length;
}

export function actionCount(categoryId, actionId, seen) {
  return freshCount(listingsFor(categoryId, actionId), seen?.[`action:${categoryId}:${actionId}`]);
}

export function categoryCount(categoryId, seen) {
  return ACTIONS.reduce((sum, action) => sum + actionCount(categoryId, action, seen), 0);
}

function viewerId() {
  try {
    const member = JSON.parse(localStorage.getItem('lgme.demo.member') || 'null');
    if (member?.demo === true && member.emailHash) return String(member.emailHash).slice(0, 80);
    const id = localStorage.getItem('lgme.member') || '';
    if (/^[a-z0-9:-]{2,80}$/.test(id)) return id;
  } catch { /* guest */ }
  return '';
}

export function readSeen() {
  try { return JSON.parse(localStorage.getItem(LOCAL) || '{}'); } catch { return {}; }
}

export async function loadSeen() {
  const seen = readSeen();
  const user = viewerId();
  if (!user) return seen;
  try {
    const body = await (await fetch(`/api/seen?user=${encodeURIComponent(user)}`)).json();
    const remote = body?.seen && typeof body.seen === 'object' ? body.seen : {};
    const next = { ...seen, ...remote };
    localStorage.setItem(LOCAL, JSON.stringify(next));
    return next;
  } catch {
    return seen;
  }
}

export async function markSeen(seen, key) {
  const next = { ...seen, [key]: new Date().toISOString() };
  try { localStorage.setItem(LOCAL, JSON.stringify(next)); } catch { /* the mark still returns */ }
  const user = viewerId();
  if (user) {
    fetch('/api/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, key }) }).catch(() => {});
  }
  return next;
}

export function markCategory(seen, categoryId) {
  let next = seen;
  for (const action of ACTIONS) next = { ...next, [`action:${categoryId}:${action}`]: new Date().toISOString() };
  try { localStorage.setItem(LOCAL, JSON.stringify(next)); } catch { /* guest storage */ }
  const user = viewerId();
  if (user) {
    for (const action of ACTIONS) {
      fetch('/api/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, key: `action:${categoryId}:${action}` }) }).catch(() => {});
    }
  }
  return next;
}

export function applyBadge(node, count, label) {
  node.classList.toggle('is-new', count > 0);
  let badge = node.querySelector('.new-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'new-badge';
    badge.setAttribute('aria-hidden', 'true');
    node.append(badge);
  }
  badge.textContent = badgeText(count);
  if (count > 0) node.setAttribute('aria-label', `${label}, ${badgeText(count)} new`);
}
