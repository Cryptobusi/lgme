const SOUND_KEY = 'lgme.sounds';

export function soundsOn(storage) {
  try { return storage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}

export function setSounds(storage, on) {
  storage.setItem(SOUND_KEY, on ? 'on' : 'off');
  return { on: on === true, local: true };
}

export function motionReduced(media = globalThis.matchMedia) {
  try { return media?.('(prefers-reduced-motion: reduce)')?.matches === true; } catch { return false; }
}

let audioCtx;

export function playTick(scope = globalThis) {
  const Ctx = scope.AudioContext || scope.webkitAudioContext;
  if (!Ctx) return false;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.045);
  return true;
}

export function pressTarget(node) {
  return node?.closest?.('button, [role="button"]') || null;
}

export function installPressFeedback(scope = globalThis, storage = scope.localStorage) {
  if (!scope?.document || scope.document.documentElement.dataset.pressFeedback === '1') return;
  scope.document.documentElement.dataset.pressFeedback = '1';
  scope.document.addEventListener('pointerdown', (event) => {
    const button = pressTarget(event.target);
    if (!button || button.disabled) return;
    if (!motionReduced(scope.matchMedia?.bind(scope))) {
      button.classList.add('is-pressed');
      scope.setTimeout(() => button.classList.remove('is-pressed'), 160);
    }
    try { scope.navigator?.vibrate?.(10); } catch { /* this phone does not vibrate */ }
    if (soundsOn(storage)) playTick(scope);
  }, true);
}
