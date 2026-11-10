import { isIosSafari, isStandalone } from './install-launch.mjs';

export const IOS_INSTALL_HINT = 'On iPhone, tap Share, then Add to Home Screen.';

export function savedPersonalPage(storage) {
  const seat = storage?.getItem?.('lgme-gym.seat') || '';
  const keys = [`lgme.health.page:${seat || 'this-phone'}`];
  if (seat) keys.push('lgme.health.page:this-phone');
  for (const key of keys) {
    try {
      const saved = JSON.parse(storage.getItem(key) || 'null');
      if (saved?.confirmed && saved.layout) return saved;
    } catch { /* a broken record is not a page */ }
  }
  return null;
}

export function personalTarget(storage) {
  return savedPersonalPage(storage) ? '/gym#/page' : '/gym';
}

export function installedEntry(storage, win, nav) {
  if (!isStandalone(win, nav)) return { open: false, href: '' };
  return { open: true, href: personalTarget(storage), splash: false, hops: 0 };
}

export function installHint({ standalone, iosSafari, hasPrompt }) {
  if (standalone) return { show: false, kind: 'hide', text: '' };
  if (iosSafari) return { show: true, kind: 'ios', text: IOS_INSTALL_HINT };
  if (hasPrompt) return { show: true, kind: 'prompt', text: 'Install lgme' };
  return { show: true, kind: 'browser', text: 'Use the browser install control, then open lgme from the icon.' };
}
