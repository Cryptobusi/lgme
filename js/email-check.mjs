import { ensureDeviceKey } from './device-sign.mjs';
import { check, fields } from './input-schema.mjs';
import { saveEmailSession } from './health-email.mjs';

const WAITING = 'Email sign-in is coming. Nothing is sent until that step is connected. Google sign-in: later.';

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
  const code = document.createElement('input');
  code.inputMode = 'numeric';
  code.maxLength = 6;
  code.autocomplete = 'one-time-code';
  code.placeholder = '6-digit code';
  const invite = document.createElement('input');
  invite.maxLength = 24;
  invite.placeholder = 'Club invite code, optional';
  const result = document.createElement('p');
  result.className = 'legend';
  const send = document.createElement('button');
  send.type = 'button';
  send.textContent = 'Send code';
  const verify = document.createElement('button');
  verify.type = 'button';
  verify.textContent = 'Verify email';
  if (!status.enabled) {
    note.textContent = WAITING;
    send.disabled = true;
    verify.disabled = true;
  } else {
    note.textContent = 'A code expires in 10 minutes. This device keeps the session. Your device key and passkey stay the second check. No phone number and no ID check. Google sign-in: later.';
  }
  send.addEventListener('click', async () => {
    const emailCheck = check(email.value.trim().toLowerCase(), { ...fields.email, required: true }, 'email');
    if (!emailCheck.ok) { result.textContent = emailCheck.error; return; }
    result.textContent = 'Sending…';
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.value })
    });
    const body = await response.json();
    result.textContent = body.ok ? 'Code sent. It expires in 10 minutes.' : (body.error || 'The code was not sent.');
  });
  verify.addEventListener('click', async () => {
    result.textContent = 'Checking…';
    const key = await ensureDeviceKey(localStorage);
    const response = await fetch('/api/email/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.value, code: code.value, invite: invite.value, publicJwk: key.publicJwk })
    });
    const body = await response.json();
    if (!body.ok) { result.textContent = body.error || 'Not verified.'; return; }
    saveEmailSession(localStorage, { email: email.value, emailHash: body.emailHash, x: key.publicJwk.x, y: key.publicJwk.y, at: new Date().toISOString() });
    const campus = body.campusVerified ? 'Campus-verified.' : 'Verified. This domain is not marked as campus.';
    result.textContent = body.member === 'existing' ? `This email is already a member. ${campus}` : `Email verified. ${campus}`;
  });
  const title = document.createElement('h3');
  title.textContent = 'Email sign-in';
  host.replaceChildren(title, note, field('Email', email), field('Code', code), field('Club invite, optional', invite), send, verify, result);
}
