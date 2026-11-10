const WAITING = 'Email sign-in is built, waiting on an email provider key. Nothing is sent until RESEND_API_KEY, EMAIL_FROM, EMAIL_CODE_PEPPER, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, and EMAIL_CHECK=on are set. Google sign-in: later.';

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
    note.textContent = status.missing?.length ? `${WAITING} Missing: ${status.missing.join(', ')}.` : WAITING;
    send.disabled = true;
    verify.disabled = true;
  } else {
    note.textContent = 'A .edu address is the campus option. A club domain on CLUB_EMAIL_DOMAINS, or a club invite code, can mark a health-club member. Neither is required. One verified email is one member. The code expires in 10 minutes. Full KYC is not started. Google sign-in: later.';
  }
  send.addEventListener('click', async () => {
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
    const response = await fetch('/api/email/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.value, code: code.value, invite: invite.value })
    });
    const body = await response.json();
    if (!body.ok) { result.textContent = body.error || 'Not verified.'; return; }
    const campus = body.campusVerified ? 'Campus-verified.' : 'Verified. This domain is not marked as campus.';
    result.textContent = body.member === 'existing' ? `This email is already a member. ${campus}` : `Email verified. ${campus}`;
  });
  const title = document.createElement('h3');
  title.textContent = 'Campus email check';
  host.replaceChildren(title, note, field('Email', email), field('Code', code), field('Club invite, optional', invite), send, verify, result);
}
