import { CHIP_IDS, defaultVariant, validateVariant } from './variant-schema.mjs';

const ACTIVE = 'lgme.variant.active';
const UNDO = 'lgme.variant.undo';
const SEEN = 'lgme.screen.chosen';

function clone(mode, patch) {
  return { ...defaultVariant(), ...patch, mode };
}

export function screenPresets() {
  const base = defaultVariant();
  return {
    simple: clone('simple', {
      theme: 'paper',
      home: 'actions-first',
      chips: [CHIP_IDS[0]],
      dockChips: ['Log a workout', 'Speak a receipt', 'What can I do here?']
    }),
    everyday: clone('everyday', {}),
    full: clone('full', {
      theme: 'gold',
      home: 'chips-first',
      chips: [...CHIP_IDS],
      dockChips: ['Log a workout', 'I want something', 'I have something', 'What can I do here?']
    })
  };
}

export function recommendMode({ largeText = false, voiceUsed = false } = {}) {
  if (largeText || voiceUsed) return { mode: 'simple', reason: 'Large text or voice was used, so Simple is the suggestion.' };
  return { mode: 'everyday', reason: 'Everyday matches the screen you have now.' };
}

export function applyMode(storage, mode) {
  const preset = screenPresets()[mode];
  const checked = validateVariant(preset);
  if (!checked.ok) return checked;
  try { storage.setItem(UNDO, storage.getItem(ACTIVE) || ''); } catch { /* undo stays empty */ }
  storage.setItem(ACTIVE, JSON.stringify(checked.variant));
  storage.setItem(SEEN, '1');
  const size = mode === 'full' ? 'compact' : mode === 'simple' ? 'tall' : 'normal';
  try { storage.setItem('lgme.dock.size', size); } catch { /* the screen still changes */ }
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = checked.variant.theme;
    document.documentElement.dataset.home = checked.variant.home;
    document.documentElement.dataset.screen = mode;
  }
  return { ok: true, variant: checked.variant };
}

export function undoMode(storage) {
  const prev = storage.getItem(UNDO);
  if (prev) storage.setItem(ACTIVE, prev);
  else storage.removeItem(ACTIVE);
  return { ok: true, variant: prev ? JSON.parse(prev) : defaultVariant() };
}

export function screenChosen(storage) {
  return storage.getItem(SEEN) === '1';
}

export function screenModePrompt(text) {
  const q = String(text || '').toLowerCase();
  if (/make it simpler|bigger text|large print|simple screen/.test(q)) return { mode: 'simple', line: 'Simple uses large print and paper contrast. Confirm to apply it.' };
  if (/everyday screen|default screen/.test(q)) return { mode: 'everyday', line: 'Everyday is the current night screen. Confirm to apply it.' };
  if (/full screen|denser screen|show every category/.test(q)) return { mode: 'full', line: 'Full shows every category chip. Confirm to apply it.' };
  return null;
}
