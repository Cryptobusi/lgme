const KEY = 'lgme.device.allow.';

export function deviceAllowed(kind, storage = globalThis.sessionStorage) {
  try { return storage?.getItem(KEY + kind) === 'yes'; } catch { return false; }
}

export function askDevice({ kind, purpose, allow, deny }) {
  if (typeof document === 'undefined') {
    allow();
    return;
  }
  if (deviceAllowed(kind)) {
    allow();
    return;
  }
  let bubble = document.getElementById('device-ask');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.id = 'device-ask';
    bubble.hidden = true;
    bubble.innerHTML = '<div class="device-ask-card" role="dialog" aria-modal="true" aria-labelledby="device-ask-title"><button type="button" id="device-ask-x" aria-label="Close">×</button><h2 id="device-ask-title"></h2><p id="device-ask-purpose"></p><p class="device-ask-actions"><button type="button" id="device-allow">Allow</button><button type="button" id="device-not-now">Not now</button></p></div>';
    document.body.append(bubble);
  }
  const titles = {
    microphone: 'Use the microphone?',
    camera: 'Use the camera?',
    fingerprint: 'Use the fingerprint sensor?',
    notifications: 'Show reminders?',
    contacts: 'See contacts?'
  };
  bubble.querySelector('#device-ask-title').textContent = titles[kind] || 'Allow this on the phone?';
  bubble.querySelector('#device-ask-purpose').textContent = purpose;
  bubble.hidden = false;
  const close = (answer) => {
    bubble.hidden = true;
    if (answer === 'no' && deny) deny();
  };
  bubble.querySelector('#device-ask-x').onclick = () => close('no');
  bubble.querySelector('#device-not-now').onclick = () => {
    try { sessionStorage.setItem(KEY + kind, 'no'); } catch { /* the choice stays for this tap */ }
    close('no');
  };
  bubble.querySelector('#device-allow').onclick = () => {
    try { sessionStorage.setItem(KEY + kind, 'yes'); } catch { /* the browser prompt still waits for this tap */ }
    bubble.hidden = true;
    allow();
  };
}
