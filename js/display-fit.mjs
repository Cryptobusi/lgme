export const FONT_STEPS = [0.85, 1, 1.15, 1.3, 1.5];
export const DENSITY_KEY = 'lgme.display.step';
export const EASY_KEY = 'lgme.display.easy';
export const SIMPLE = {
  Introduction: 'Start',
  Inventory: 'My list',
  SobeIt: 'Books'
};

export function osTextScale(remPx) {
  const px = Number(remPx);
  if (!Number.isFinite(px) || px <= 0) return 1;
  return Math.round((px / 16) * 100) / 100;
}

export function pickDensity(probe = {}) {
  const view = probe.visualViewport || {};
  const width = Number(view.width ?? probe.width) || 0;
  const height = Number(view.height ?? probe.height) || 0;
  const safe = probe.safeArea || {};
  const usableW = Math.max(0, width - (Number(safe.left) || 0) - (Number(safe.right) || 0));
  const usableH = Math.max(0, height - (Number(safe.top) || 0) - (Number(safe.bottom) || 0));
  const os = osTextScale(probe.remPx);
  const fitW = usableW / os;
  const fitH = usableH / os;
  const orientation = probe.orientation || (height >= width ? 'portrait' : 'landscape');
  let density = 'regular';
  if (fitW < 720 || fitH < 520 || (orientation === 'landscape' && fitH < 420)) density = 'compact';
  else if (fitW >= 840 && fitH >= 700) density = 'roomy';
  return { density, osScale: os, orientation, reducedMotion: probe.reducedMotion === true, fitW, fitH };
}

export function defaultStepForScreen(probe = {}) {
  const view = probe.visualViewport || {};
  const width = Number(view.width ?? probe.width) || 0;
  const height = Number(view.height ?? probe.height) || 0;
  const dpr = Number(probe.dpr) > 0 ? Number(probe.dpr) : 1;
  const longest = Math.max(width, height) * dpr;
  if (width >= 340 && longest >= 700) return 1;
  return 0;
}

export function changeStep(step, dir) {
  const current = Math.min(FONT_STEPS.length - 1, Math.max(0, Number(step) || 0));
  if (dir === 0) return 1;
  return Math.min(FONT_STEPS.length - 1, Math.max(0, current + dir));
}

export function fontScale(step, remPx, easy) {
  const index = Math.min(FONT_STEPS.length - 1, Math.max(0, Number(step) || 0));
  const chosen = FONT_STEPS[index];
  if (!easy) return chosen;
  const os = Number(remPx) > 0 ? Number(remPx) : 16;
  return Math.max(chosen, 18 / os);
}

export function readDisplay(storage) {
  let step = 1;
  let easy = false;
  try {
    const raw = storage?.getItem(DENSITY_KEY);
    const saved = raw == null || raw === '' ? NaN : Number(raw);
    if (Number.isInteger(saved) && saved >= 0 && saved < FONT_STEPS.length) step = saved;
    easy = storage?.getItem(EASY_KEY) === '1';
  } catch { /* the default size still applies */ }
  return { step, easy };
}

export function writeDisplay(storage, state) {
  try {
    storage.setItem(DENSITY_KEY, String(state.step));
    storage.setItem(EASY_KEY, state.easy ? '1' : '0');
  } catch { /* a private window keeps the choice for this view */ }
}

export function simpleLabel(text, easy) {
  if (!easy) return text;
  return SIMPLE[text] || text;
}

export function applyDisplay(root, state, probe) {
  const picked = pickDensity(probe);
  const scale = fontScale(state.step, probe.remPx, state.easy);
  root.dataset.density = picked.density;
  root.dataset.orient = picked.orientation;
  root.dataset.motion = picked.reducedMotion ? 'reduce' : 'ok';
  if (state.easy) root.dataset.easy = '1';
  else delete root.dataset.easy;
  if (root.classList) root.classList.toggle('is-easy', state.easy === true);
  if (root.style?.setProperty) {
    root.style.setProperty('--lgme-font', String(Math.round(scale * 1000) / 1000));
    root.style.setProperty('--lgme-os', String(picked.osScale));
  }
  return { ...picked, scale, step: state.step, easy: state.easy === true };
}

function px(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function remProbe(doc) {
  const probe = doc.createElement('div');
  probe.textContent = 'M';
  probe.style.cssText = 'position:absolute;left:-999px;top:0;font-size:medium;line-height:1;padding:0;margin:0;border:0;width:1em;';
  (doc.body || doc.documentElement).appendChild(probe);
  const size = probe.getBoundingClientRect().width || 16;
  probe.remove();
  return size;
}

function safeArea(doc, view) {
  const probe = doc.createElement('div');
  probe.style.cssText = 'position:absolute;left:-999px;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
  (doc.body || doc.documentElement).appendChild(probe);
  const style = view.getComputedStyle(probe);
  const area = {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft)
  };
  probe.remove();
  return area;
}

export function measure(win) {
  const doc = win.document;
  const visual = win.visualViewport;
  return {
    width: win.innerWidth,
    height: win.innerHeight,
    dpr: win.devicePixelRatio || 1,
    visualViewport: visual ? { width: visual.width, height: visual.height } : null,
    safeArea: safeArea(doc, win),
    orientation: win.matchMedia && win.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait',
    reducedMotion: !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches),
    remPx: remProbe(doc)
  };
}

function paintSimple(doc, easy) {
  doc.querySelectorAll('#one-menu a').forEach((el) => {
    if (!el.dataset.plain) el.dataset.plain = el.textContent;
    el.textContent = simpleLabel(el.dataset.plain, easy);
  });
}

export function startDisplay(win = globalThis) {
  const storage = win.localStorage;
  let state = readDisplay(storage);
  try {
    if (storage && storage.getItem('lgme.display.defaulted') !== '1') {
      const fitted = defaultStepForScreen(measure(win));
      if (state.step < fitted) state = { ...state, step: fitted };
      writeDisplay(storage, state);
      storage.setItem('lgme.display.defaulted', '1');
    }
  } catch { /* the saved size still applies */ }
  const paint = () => {
    const probe = measure(win);
    const applied = applyDisplay(win.document.documentElement, state, probe);
    paintSimple(win.document, state.easy);
    win.document.dispatchEvent(new CustomEvent('lgme-display-state', { detail: { ...state, ...applied } }));
    return applied;
  };
  win.document.addEventListener('lgme-display', (event) => {
    const detail = event.detail || {};
    if (detail.easy) state = { ...state, easy: !state.easy };
    if (detail.reset) state = { ...state, step: 1 };
    else if (typeof detail.step === 'number') state = { ...state, step: changeStep(state.step, detail.step) };
    writeDisplay(storage, state);
    paint();
  });
  win.document.addEventListener('click', (event) => {
    if (win.document.documentElement.dataset.density !== 'compact') return;
    const card = event.target.closest && event.target.closest('article.card');
    if (!card || (event.target.closest && event.target.closest('a, button, input, textarea, select, label'))) return;
    card.classList.toggle('is-open');
  });
  paint();
  win.addEventListener('resize', paint);
  win.addEventListener('orientationchange', paint);
  if (win.visualViewport) win.visualViewport.addEventListener('resize', paint);
  return { paint };
}

if (typeof document !== 'undefined') startDisplay();
