import { isIosSafari, isStandalone } from './install-launch.mjs';
import { installHint, installedEntry } from './pwa-open.mjs';

const entry = installedEntry(localStorage, window, navigator);
if (entry.open && location.pathname !== '/gym') location.replace(entry.href);

function paint() {
  const host = document.getElementById('install-lgme');
  if (!host) return;
  const hint = installHint({
    standalone: isStandalone(window, navigator),
    iosSafari: isIosSafari(navigator),
    hasPrompt: Boolean(window.__lgmeInstallPrompt)
  });
  host.hidden = !hint.show;
  const text = document.getElementById('install-lgme-text');
  const button = document.getElementById('install-lgme-button');
  if (text) text.textContent = hint.text;
  if (button) button.hidden = hint.kind !== 'prompt';
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.__lgmeInstallPrompt = event;
  paint();
});

document.getElementById('install-lgme-button')?.addEventListener('click', async () => {
  const prompt = window.__lgmeInstallPrompt;
  if (!prompt) return;
  prompt.prompt();
  await prompt.userChoice;
  window.__lgmeInstallPrompt = null;
  paint();
});

paint();
