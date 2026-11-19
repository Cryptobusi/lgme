import { defaultVariant, validateVariant } from './variant-schema.mjs';
import { incognitoOn } from './incognito.mjs';
import { pageOverview } from './control-help.mjs';

export const MODE_KEY = 'lgme.ui.mode';
export const USE_KEY = 'lgme.ui.uses';
export const OFFER_KEY = 'lgme.ui.offer';
export const SHORTCUT_KEY = 'lgme.ui.shortcuts';
export const USE_MIN = 5;

export const SHORTCUTS = Object.freeze({
  health: { label: 'Health', href: '/gym' },
  ididit: { label: 'IdidIt', href: '/gym#/ididit' },
  messages: { label: 'Messages', href: '/#messages' },
  exchange: { label: 'Exchange', href: '/exchange' },
  inventory: { label: 'Inventory', href: '/inventory' },
  attest: { label: 'Attest', href: '/exchange#help-resolve' }
});

export function readMode(storage) {
  try { return storage?.getItem(MODE_KEY) === 'manual' ? 'manual' : 'guided'; } catch { return 'guided'; }
}

export function setMode(storage, mode) {
  const next = mode === 'manual' ? 'manual' : 'guided';
  try { storage.setItem(MODE_KEY, next); } catch { /* the chip still shows the choice */ }
  return next;
}

export function guideCards(mode) {
  return mode !== 'manual';
}

export function explainOnTap(mode) {
  return mode !== 'manual';
}

export function fieldGuideWithoutModel(mode) {
  return mode !== 'manual';
}

export function nextStep(pathname, hash) {
  const page = pageOverview(pathname, hash, '');
  return { primary: page.steps[0] || 'Read this page', alternates: page.steps.slice(1, 3) };
}

export function promotion(pathname = '/', hash = '') {
  const path = String(pathname || '/').replace(/\.html$/, '') || '/';
  const mark = String(hash || '');
  if (path === '/') return 'Health is open. A finished session can become an IdidIt receipt after you tap OK.';
  if (path.startsWith('/gym') && mark.includes('ididit')) return 'When the words are right, tap OK to keep the receipt on this phone.';
  if (path.startsWith('/gym')) return 'Another member can attest a receipt later. Nothing is sent until you tap OK.';
  if (path.startsWith('/exchange')) return 'A listing can be drafted here. It stays on this phone until you tap OK.';
  if (path.startsWith('/inventory')) return 'An item you already have can be noted for later. Nothing is published until you tap OK.';
  return 'You can keep a short note on this phone. Nothing is sent until you tap OK.';
}

export function readUses(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(USE_KEY) || '{}');
    const uses = {};
    for (const id of Object.keys(SHORTCUTS)) {
      const count = Number(parsed?.[id]);
      if (Number.isInteger(count) && count > 0) uses[id] = count;
    }
    return uses;
  } catch { return {}; }
}

export function noteUse(storage, id, incognito = false) {
  if (incognito || !SHORTCUTS[id]) return readUses(storage);
  const uses = readUses(storage);
  uses[id] = (uses[id] || 0) + 1;
  try { storage.setItem(USE_KEY, JSON.stringify(uses)); } catch { /* the count stays for this view */ }
  return uses;
}

export function actionIdFrom(el) {
  if (!el || typeof el.getAttribute !== 'function') return '';
  const id = el.id || '';
  if (id === 'messages-open' || id === 'message-ok') return 'messages';
  if (id === 'start-health') return 'health';
  const href = el.getAttribute('href') || '';
  if (/ididit/i.test(`${id} ${href}`)) return 'ididit';
  if (/attest/i.test(`${id} ${href}`)) return 'attest';
  if (href.startsWith('/inventory')) return 'inventory';
  if (href.startsWith('/exchange')) return 'exchange';
  if (href === '/gym' || href.startsWith('/gym#') || href.startsWith('/gym/')) return 'health';
  return '';
}

export function topActions(uses, min = USE_MIN) {
  return Object.entries(uses || {})
    .filter(([id, count]) => SHORTCUTS[id] && count >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}

export function readOffer(storage) {
  try {
    const value = storage?.getItem(OFFER_KEY);
    return value === 'dismissed' || value === 'accepted' ? value : '';
  } catch { return ''; }
}

export function shortcutOffer(storage) {
  if (readOffer(storage)) return null;
  const top = topActions(readUses(storage));
  return top.length ? top.slice(0, 4) : null;
}

export function readShortcuts(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(SHORTCUT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => SHORTCUTS[id]).slice(0, 4) : [];
  } catch { return []; }
}

export function dismissOffer(storage) {
  try { storage.setItem(OFFER_KEY, 'dismissed'); } catch { /* the offer stays closed for this view */ }
}

export function pinShortcuts(storage, ids) {
  const shortcuts = (ids || []).filter((id) => SHORTCUTS[id]).slice(0, 4);
  try { storage.setItem(SHORTCUT_KEY, JSON.stringify(shortcuts)); } catch { /* the row still shows */ }
  try { storage.setItem(OFFER_KEY, 'accepted'); } catch { /* the offer stays closed */ }
  try {
    const draft = JSON.parse(storage.getItem('lgme.variant.draft') || 'null') || defaultVariant();
    draft.shortcuts = shortcuts;
    const checked = validateVariant(draft);
    if (checked.ok) storage.setItem('lgme.variant.draft', JSON.stringify(checked.variant));
  } catch { /* the home row is enough until a version is offered */ }
  return shortcuts;
}

export function resetShortcuts(storage) {
  try { storage.removeItem(SHORTCUT_KEY); } catch { /* the row clears in the view */ }
  return [];
}

export function incognitoBlocksUses(storage) {
  return incognitoOn(storage);
}
