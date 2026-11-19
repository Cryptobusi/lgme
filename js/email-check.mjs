import { ensureDeviceKey } from './device-sign.mjs';
import { saveEmailSession } from './health-email.mjs';

const WAITING = 'Email is disabled. Continue with this device.';

function line(text) {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

function field(label, input) {
  const wrap = document.createElement('label');
  wrap.append(label, input);
  return wrap;
}

export async function mountEmailCheck(host) {
  if (!host) return;
  host.replaceChildren(line('Checking the email step…'));
  let status = { enabled: false, missing: [] };
  try {
    const response = await fetch('/api/email/status');
    status = await response.json();
  } catch {
    status = { enabled: false, missing: [] };
  }
  const note = document.createElement('p');
  note.className = 'legend';
  const email = document.createElement('input');
  email.type = 'email';
  email.autocomplete = 'email';
  email.maxLength = 120;
  email.placeholder = 'name@school.edu';
  const result = document.createElement('p');
  result.className = 'legend';
  const send = document.createElement('button');
  send.type = 'button';
  send.textContent = 'Continue on this device';
  note.textContent = status.enabled ? WAITING : WAITING;
  send.addEventListener('click', async () => {
    const typed = email.value.trim();
    const key = await ensureDeviceKey(localStorage);
    let emailHash = `${key.publicJwk.x}`.slice(0, 16);
    if (typed.includes('@')) {
      try {
        const response = await fetch('/api/email/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: typed, publicJwk: key.publicJwk })
        });
        const body = await response.json();
        if (body.emailHash) emailHash = body.emailHash;
      } catch { /* the device session still opens */ }
    }
    saveEmailSession(localStorage, { email: typed, emailHash, x: key.publicJwk.x, y: key.publicJwk.y, at: new Date().toISOString() });
    result.textContent = 'Saved on this phone.';
  });
  const title = document.createElement('h3');
  title.textContent = 'Sign in on this phone';
  host.replaceChildren(title, note, field('Email', email), send, result);
}
