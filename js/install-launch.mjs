import { deviceContext, pickHelperSync, refreshHelper, showHelperNote } from './one-tap.mjs';

const APP_PATH = '/exchange';
const TIP = 'Share > Add to Home Screen';
export const INSTALLED_WAIT_MS = 500;

export function isStandalone(win, nav) {
  const media = win.matchMedia ? win.matchMedia('(display-mode: standalone)').matches : false;
  return media || nav.standalone === true;
}

export function isIosSafari(nav) {
  const ua = String(nav.userAgent || '');
  const iPadOs = nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1;
  const iOS = /iPhone|iPad|iPod/i.test(ua) || iPadOs;
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return iOS && /WebKit/i.test(ua) && !otherBrowser;
}

export function decideInstallAction({ standalone, iosSafari, hasPrompt, installed }) {
  if (standalone) return 'hide';
  if (iosSafari) return 'tooltip';
  if (installed || !hasPrompt) return 'launch';
  return 'prompt';
}

export function bindInstallLaunch(doc, nav, win) {
  const controls = [...doc.querySelectorAll('[data-install-launch]')];
  if (!controls.length) return { launch() {} };
  let deferred = null;
  let launched = false;
  let installed = false;
  const installedPromise = typeof nav.getInstalledRelatedApps === 'function'
    ? Promise.resolve().then(() => nav.getInstalledRelatedApps()).then((apps) => Array.isArray(apps) && apps.length > 0).catch(() => false)
    : Promise.resolve(false);
  installedPromise.then((yes) => { installed = yes; });

  function launch() {
    if (launched) return;
    win.location.assign(APP_PATH);
    launched = true;
  }

  function plainNavigate(control) {
    const href = control && typeof control.getAttribute === 'function' ? control.getAttribute('href') : '';
    win.location.assign(href || APP_PATH);
    launched = true;
  }

  function installedWithin() {
    return new Promise((resolve) => {
      const timer = win.setTimeout(() => resolve(installed), INSTALLED_WAIT_MS);
      installedPromise.then((yes) => {
        win.clearTimeout(timer);
        resolve(Boolean(yes));
      }, () => {
        win.clearTimeout(timer);
        resolve(false);
      });
    });
  }

  function showTip(control) {
    const bar = control.closest('.launch-bar') || control.parentElement || doc.body;
    let tip = bar.querySelector('.install-tip');
    if (!tip) {
      tip = doc.createElement('span');
      tip.className = 'install-tip';
      tip.setAttribute('role', 'status');
      tip.textContent = TIP;
      bar.append(tip);
    }
    tip.hidden = false;
  }

  function hideForStandalone() {
    if (!isStandalone(win, nav)) return;
    controls.forEach((control) => {
      const bar = control.closest('.launch-bar');
      if (bar) bar.hidden = true;
      else control.hidden = true;
    });
  }

  async function onClick(event) {
    const control = event.currentTarget;
    try {
      event.preventDefault();
      const knownInstalled = await installedWithin();
      const action = decideInstallAction({
        standalone: isStandalone(win, nav),
        iosSafari: isIosSafari(nav),
        hasPrompt: Boolean(deferred),
        installed: knownInstalled
      });
      if (action === 'hide') {
        hideForStandalone();
        return;
      }
      if (action === 'tooltip') {
        showTip(control);
        win.setTimeout(launch, 1400);
        return;
      }
      if (action === 'launch' || !deferred) {
        launch();
        return;
      }
      try {
        deferred.prompt();
        await new Promise((resolve) => {
          const timer = win.setTimeout(resolve, 8000);
          Promise.resolve(deferred.userChoice).then(() => {
            win.clearTimeout(timer);
            resolve();
          }, () => {
            win.clearTimeout(timer);
            resolve();
          });
        });
      } catch { /* accepted or dismissed, still open the desk */ }
      deferred = null;
      launch();
    } catch {
      try { plainNavigate(control); } catch { /* the anchor href still opens the desk without this script */ }
    }
  }

  hideForStandalone();
  const note = doc.getElementById('helper-note');
  const startNote = doc.getElementById('start-helper-note');
  const helper = pickHelperSync(win, win.localStorage);
  showHelperNote(note, helper);
  showHelperNote(startNote, helper);
  const known = deviceContext(win.localStorage, win.sessionStorage);
  if (known.category === 'health' && controls[0] && !isStandalone(win, nav)) controls[0].setAttribute('href', '/gym');
  refreshHelper(win, win.localStorage, (picked) => { showHelperNote(note, picked); showHelperNote(startNote, picked); });
  controls.forEach((control) => control.addEventListener('click', onClick));
  win.addEventListener('pageshow', () => { launched = false; });
  win.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event;
  });
  win.addEventListener('appinstalled', () => launch());
  if ('serviceWorker' in nav) nav.serviceWorker.register('/sw.js').catch(() => {});
  return { launch, showTip };
}

if (typeof document !== 'undefined') bindInstallLaunch(document, navigator, window);
