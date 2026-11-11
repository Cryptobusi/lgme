import { CATEGORIES } from './category-help.mjs';
import { ACTIONS } from './category-evolve.mjs';

export const DAO_LINE = 'Until a member DAO is established, the administrator has sole right to deny.';
export const THEMES = Object.freeze(['night', 'paper', 'gold']);
export const HOMES = Object.freeze(['actions-first', 'chips-first']);
export const ACTION_IDS = Object.freeze(ACTIONS.map((item) => item.id));
export const CHIP_IDS = Object.freeze(CATEGORIES.filter((item) => item.id !== 'health').map((item) => item.id));
export const HELP_KEYS = Object.freeze(['evolve-name', 'evolve-line', 'version-name', 'version-purpose']);

const BAD = /[<>]|javascript:|url\s*\(|@|https?:|\$trust/i;
const MEDICAL = /\b(diagnos\w*|prescription|treatment|cure)\b/i;

export function officialName(id) {
  return ACTIONS.find((item) => item.id === id)?.name || id;
}

export function defaultVariant() {
  return {
    schema: 1,
    theme: 'night',
    home: 'actions-first',
    order: [...ACTION_IDS],
    extras: { ididit: '', iwantit: '', ihavit: '' },
    chips: [...CHIP_IDS],
    options: {
      ididit: ['I did the session', 'I finished a walk', 'I stretched'],
      iwantit: ['A ride to the park', 'Spotting for a set', 'A quiet walk partner'],
      ihavit: ['I can lead a walk', 'I can spot a set', 'I can bring a mat']
    },
    dockChips: ['Log a workout', 'Make an IdidIt receipt', 'What can I do here?'],
    fieldHelp: {
      'evolve-name': 'A short name for this category. It is checked against names already here.',
      'evolve-line': 'One line on what this is for. No medical claims. It stays a proposal until 3 members attest.',
      'version-name': 'A name for this version of the app. It is checked against versions already offered.',
      'version-purpose': 'One line on what this version is for. It stays on this phone until you confirm.'
    }
  };
}

function plain(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > max || BAD.test(text) || MEDICAL.test(text)) return '';
  return text;
}

function sameIds(list, allowed) {
  const ids = Array.isArray(list) ? list.map((item) => String(item || '')) : [];
  return ids.length === allowed.length && allowed.every((id) => ids.includes(id)) && new Set(ids).size === ids.length;
}

export function validateVariant(input) {
  const base = defaultVariant();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'The version needs a plain settings object.' };
  const theme = THEMES.includes(input.theme) ? input.theme : '';
  const home = HOMES.includes(input.home) ? input.home : '';
  if (!theme || !home || !sameIds(input.order, ACTION_IDS)) return { ok: false, error: 'Use a theme, a home layout, and the three actions.' };
  const extras = {};
  for (const id of ACTION_IDS) {
    const extra = input.extras && input.extras[id] != null ? plain(input.extras[id], 40) : '';
    if (input.extras && input.extras[id] && !extra) return { ok: false, error: 'Keep extra words plain. The action name stays visible.' };
    extras[id] = extra;
  }
  const chips = Array.isArray(input.chips) ? input.chips.filter((id) => CHIP_IDS.includes(id)) : [];
  if (!chips.length || chips.length !== new Set(chips).size) return { ok: false, error: 'Pick at least one category chip.' };
  const options = {};
  for (const id of ACTION_IDS) {
    const rows = Array.isArray(input.options?.[id]) ? input.options[id].map((item) => plain(item, 80)).filter(Boolean) : [];
    if (rows.length < 1 || rows.length > 6) return { ok: false, error: 'Each action needs a short list of options.' };
    options[id] = rows;
  }
  const dockChips = Array.isArray(input.dockChips) ? input.dockChips.map((item) => plain(item, 40)).filter(Boolean) : [];
  if (dockChips.length < 1 || dockChips.length > 6) return { ok: false, error: 'Add a few dock suggestions.' };
  const fieldHelp = {};
  for (const key of HELP_KEYS) {
    const line = plain(input.fieldHelp?.[key], 160);
    if (!line) return { ok: false, error: 'Field help stays one plain line.' };
    fieldHelp[key] = line;
  }
  return { ok: true, variant: { schema: 1, theme, home, order: input.order.map(String), extras, chips, options, dockChips, fieldHelp } };
}

export function diffLines(variant, base = defaultVariant()) {
  const lines = [];
  if (variant.theme !== base.theme) lines.push(`Theme is ${variant.theme}.`);
  if (variant.home !== base.home) lines.push(`Home puts ${variant.home === 'chips-first' ? 'category chips first' : 'the three actions first'}.`);
  if (variant.order.join() !== base.order.join()) lines.push(`Button order is ${variant.order.map(officialName).join(', ')}.`);
  for (const id of ACTION_IDS) {
    if (variant.extras[id]) lines.push(`${officialName(id)} adds “${variant.extras[id]}”.`);
    if (variant.options[id].join('|') !== base.options[id].join('|')) lines.push(`${officialName(id)} options changed.`);
  }
  if (variant.chips.join() !== base.chips.join()) lines.push(`Chips show ${variant.chips.join(', ')}.`);
  if (variant.dockChips.join('|') !== base.dockChips.join('|')) lines.push('Dock suggestions changed.');
  for (const key of HELP_KEYS) {
    if (variant.fieldHelp[key] !== base.fieldHelp[key]) lines.push('A field explanation changed.');
  }
  return lines.length ? lines : ['No changes from the default yet.'];
}

export function readVariant(storage, key) {
  try {
    const parsed = JSON.parse(storage?.getItem(key) || 'null');
    const checked = validateVariant(parsed);
    return checked.ok ? checked.variant : null;
  } catch {
    return null;
  }
}

export function readActive(storage = globalThis.localStorage) {
  return readVariant(storage, 'lgme.variant.active');
}

export function helpOverride(id, storage = globalThis.localStorage) {
  const active = readActive(storage);
  const line = active?.fieldHelp?.[id];
  return typeof line === 'string' ? line : '';
}

export function dockChipsOf(storage = globalThis.localStorage) {
  return readActive(storage)?.dockChips || null;
}
