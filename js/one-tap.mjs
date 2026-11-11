const CACHE = 'lgme.helper.pick';
const MEMORY = 'lgme.oneTap.memory';
const PRIVATE = /@|https?:|\b\d{3}[-.\s]?\d{3}|\b(diagnos\w*|prescription|gps|latitude)\b/i;

export function helperNote(id) {
  if (id === 'browser' || id === 'model') return 'Using: on-device AI';
  if (id === 'none') return 'Using: no AI';
  return 'Using: app helper';
}

function browserApi(scope) {
  return scope.LanguageModel || scope.ai?.languageModel || null;
}

function hasBrowser(api) {
  return Boolean(api) && (typeof api.prompt === 'function' || typeof api.create === 'function' || typeof api.availability === 'function');
}

export function pickHelperSync(scope = globalThis, storage = scope.localStorage) {
  const nav = scope.navigator || {};
  if (nav.lgmeAi === 'off') return { id: 'none', note: helperNote('none') };
  if (nav.lgmeAi === 'app') return { id: 'app', note: helperNote('app') };
  if (hasBrowser(browserApi(scope))) return { id: 'browser', note: helperNote('browser') };
  try {
    if (storage?.getItem('lgme.localModel.ready') === '1') return { id: 'model', note: helperNote('model') };
  } catch { /* keep going */ }
  return { id: 'app', note: helperNote('app') };
}

export function refreshHelper(scope = globalThis, storage = scope.localStorage, onChange) {
  const first = pickHelperSync(scope, storage);
  const api = browserApi(scope);
  const finish = (picked) => {
    try { storage?.setItem(CACHE, JSON.stringify({ id: picked.id, at: Date.now() })); } catch { /* the note still shows */ }
    if (picked.note !== first.note && onChange) onChange(picked);
    return picked;
  };
  if (typeof api?.availability !== 'function' || first.id === 'none') return Promise.resolve(finish(first));
  return Promise.race([
    Promise.resolve(api.availability()).then((state) => (state === 'available' || state === 'readily' ? { id: 'browser', note: helperNote('browser') } : first)).catch(() => first),
    new Promise((resolve) => { setTimeout(() => resolve(first), 250); })
  ]).then(finish);
}

export function deviceContext(storage = globalThis.localStorage, session = globalThis.sessionStorage) {
  let memory = {};
  try { memory = JSON.parse(storage?.getItem(MEMORY) || '{}'); } catch { memory = {}; }
  let join = {};
  try { join = JSON.parse(session?.getItem('lgme.join.invite') || '{}'); } catch { join = {}; }
  const raw = storage?.getItem('lgme-gym.seat') || storage?.getItem('lgme-sim:ui:seat') || memory.handle || '';
  const handle = String(raw).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
  const fee = ['pool', 'sponsor', 'self'].includes(join.fee) ? join.fee : (memory.fee || 'self');
  return {
    handle,
    category: storage?.getItem('lgme.entry.category') || memory.category || '',
    skill: String(memory.skill || '').slice(0, 80),
    time: String(memory.time || '').slice(0, 40),
    locale: String(globalThis.navigator?.language || 'en').slice(0, 12),
    fee
  };
}

export function rememberContext(storage, patch) {
  const prior = deviceContext(storage, { getItem: () => null });
  const next = { ...prior, ...patch };
  delete next.locale;
  storage.setItem(MEMORY, JSON.stringify(next));
  return next;
}

async function askBrowser(scope, prompt) {
  const api = browserApi(scope);
  if (!api) return '';
  if (typeof api.prompt === 'function') return String(await api.prompt(prompt) || '');
  if (typeof api.create === 'function') {
    const session = await api.create();
    const text = String(await session.prompt?.(prompt) || '');
    session.destroy?.();
    return text;
  }
  return '';
}

export async function draftWithHelper(helper, { template, prompt, scope = globalThis } = {}) {
  const safeTemplate = String(template || '').slice(0, 280);
  if (!helper || helper.id !== 'browser' || PRIVATE.test(prompt || '') || PRIVATE.test(safeTemplate)) {
    return { text: safeTemplate, helper, sent: false };
  }
  try {
    const text = await Promise.race([
      askBrowser(scope, prompt),
      new Promise((resolve) => { setTimeout(() => resolve(''), 400); })
    ]);
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 280);
    if (!clean || PRIVATE.test(clean)) return { text: safeTemplate, helper, sent: false };
    return { text: clean, helper, sent: false };
  } catch {
    return { text: safeTemplate, helper, sent: false };
  }
}

export function showHelperNote(node, helper) {
  if (node) node.textContent = helper?.note || helperNote('app');
}
