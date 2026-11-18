import { incognitoOn } from './incognito.mjs';
import { playTapeTick, tapeTicksOn } from './press-feedback.mjs';

const GAP = 100;

export function installTapeScroll(scope = globalThis, storage = scope.localStorage) {
  if (!scope?.document || scope.document.documentElement.dataset.tapeScroll === '1') return;
  scope.document.documentElement.dataset.tapeScroll = '1';
  let last = 0;
  scope.addEventListener('scroll', () => {
    if (!scope.document.documentElement.classList.contains('tape')) return;
    const now = Date.now();
    if (now - last < GAP) return;
    if (!tapeTicksOn({ storage, media: scope.matchMedia?.bind(scope), incognito: incognitoOn(storage) })) return;
    last = now;
    playTapeTick(scope);
  }, { passive: true });
}

installTapeScroll();
