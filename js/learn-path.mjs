export const PATH_KEY = 'lgme.learn.path';

export const LEVELS = Object.freeze([
  {
    id: 'start',
    n: 1,
    title: 'Getting started',
    chip: 'What is lgme',
    prompt: 'What is this app for',
    guide: 'lgme.app is a work-value credit and barter exchange. Deeds you log as IdidIt earn Creo, the value you create. Only Health is live, and it stays on testnet. Health consent stays on this phone until you tap OK.'
  },
  {
    id: 'receipt',
    n: 2,
    title: 'First receipt',
    chip: 'Log a workout',
    prompt: 'Log a workout',
    guide: 'A workout can become an IdidIt receipt. The draft opens with your words so you can check them. Tap OK on the form when it is right. Nothing is recorded before that.'
  },
  {
    id: 'exchange',
    n: 3,
    title: 'Exchange',
    chip: 'I want something',
    prompt: 'I want a hand this week',
    guide: 'IwantIT is something you want. IhavIT is something you can offer. The listing opens as a draft on this phone. It is kept only after you tap OK.'
  },
  {
    id: 'attest',
    n: 4,
    title: 'Attest',
    chip: 'Attest a receipt',
    prompt: 'Attest a receipt',
    guide: 'An attestation is another member confirming a receipt. Over $100 needs three independent signatures. A refusal stays on record and carries no penalty. Nothing is approved until those taps happen.'
  },
  {
    id: 'yours',
    n: 5,
    title: 'Your way',
    chip: 'My shortcuts',
    prompt: 'Show my shortcuts',
    guide: 'My shortcuts pin actions you use often. My Version is a personal setup of settings, not code. Manual mode hides this path. Nothing is saved until you tap OK.'
  }
]);

function keepIds(list) {
  return Array.isArray(list) ? list.filter((id) => LEVELS.some((level) => level.id === id)) : [];
}

export function readPath(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PATH_KEY) || '{}');
    return { done: keepIds(parsed.done), skipped: keepIds(parsed.skipped) };
  } catch { return { done: [], skipped: [] }; }
}

function writePath(storage, state) {
  try { storage.setItem(PATH_KEY, JSON.stringify({ done: state.done, skipped: state.skipped })); } catch { /* the line still shows this visit */ }
  return readPath(storage);
}

export function currentLevel(storage) {
  const state = readPath(storage);
  return LEVELS.find((level) => !state.done.includes(level.id) && !state.skipped.includes(level.id)) || null;
}

export function pathLine(storage) {
  const level = currentLevel(storage);
  return level ? `Step ${level.n} of 5 · ${level.title}` : '';
}

export function markDone(storage, id) {
  const state = readPath(storage);
  if (!LEVELS.some((level) => level.id === id)) return state;
  if (!state.done.includes(id)) state.done.push(id);
  state.skipped = state.skipped.filter((item) => item !== id);
  return writePath(storage, state);
}

export function skipAhead(storage) {
  const level = currentLevel(storage);
  if (!level) return readPath(storage);
  const state = readPath(storage);
  if (!state.skipped.includes(level.id)) state.skipped.push(level.id);
  return writePath(storage, state);
}

export function resetPath(storage) {
  return writePath(storage, { done: [], skipped: [] });
}

export function actionTotal(uses) {
  return Object.values(uses || {}).reduce((sum, count) => sum + (Number(count) || 0), 0);
}

export function experienced(storage, dockUses = {}, guideUses = {}) {
  const state = readPath(storage);
  if (LEVELS.every((level) => state.done.includes(level.id))) return true;
  return actionTotal(dockUses) >= 5 || actionTotal(guideUses) >= 5;
}

export function guideFor(storage, dockUses = {}, guideUses = {}) {
  const level = currentLevel(storage);
  if (!level) return '';
  if (!experienced(storage, dockUses, guideUses)) return level.guide;
  const [first] = level.guide.split(/(?<=[.?!])\s+/);
  return first || level.guide;
}

export function pathChips(storage, dockUses = {}, guideUses = {}, mode = 'guided') {
  if (mode === 'manual' || experienced(storage, dockUses, guideUses)) return null;
  const level = currentLevel(storage);
  return level ? [level.chip] : null;
}

export function isStartQuestion(text) {
  return /what is this app|what is lgme|what lgme|creo|health consent|how do i use/i.test(String(text || ''));
}

export function eventCompletes(id, event) {
  return (id === 'start' && event === 'start')
    || (id === 'receipt' && event === 'receipt')
    || (id === 'exchange' && event === 'listing')
    || (id === 'attest' && event === 'attest')
    || (id === 'yours' && event === 'yours');
}
