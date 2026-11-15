import { compactCode } from './email-check-core.mjs';
import { localAiReady } from './one-tap.mjs';
import { gateDecision, nextAccess, signinAllowed } from './confirm-gate.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { confirmFingerprint, registerFingerprint } from './passkey-signin.mjs';

const root = document.getElementById('category-grid');
if (root && !document.getElementById('profile-board')) {
  const board = document.createElement('section');
  board.id = 'profile-board';
  board.setAttribute('aria-label', 'Profile');
  board.innerHTML = '<p id="profile-name">Not signed in</p><p id="profile-activity">No recent activity</p><p id="profile-balance">Balance stays on this phone</p><p id="profile-new">New 0</p><form id="first-open"><p>First open. Email, then a code. No full KYC. The keys stay on this phone.</p><label for="access-email">Email</label><input id="access-email" type="email" autocomplete="email" maxlength="120"><label for="access-code">Email code (sent to your inbox)</label><input id="access-code" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="submit" id="access-send">Send code</button><button type="button" id="access-verify">Verify code</button><label for="access-totp">Google Authenticator code</label><input id="access-totp" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="button" id="access-authenticator">Use authenticator app</button><section id="totp-setup" hidden><p>Open Google Authenticator, tap +, scan this QR code or enter the key. The entry will be named lgme.app.</p><p id="totp-key"></p><div id="totp-qr"></div><label for="totp-confirm">Google Authenticator code</label><input id="totp-confirm" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="button" id="totp-finish">Finish authenticator setup</button></section><p id="access-member"></p><button type="button" id="ai-test">Test local AI</button><p id="ai-test-result" role="status"></p><button type="button" id="access-grant" disabled>Open the app</button><button type="button" id="totp-reset">Reset authenticator</button><p id="access-status" role="status"></p></form>';
  const row = document.createElement('div');
  row.id = 'function-row';
  row.setAttribute('aria-label', 'Functions');
  const actions = [
    ['IdidIt (verified receipt)', '/gym#/ididit', true],
    ['Sobeit', '/lgme-coin#give', false],
    ['Inanity', '/ihelpit', false],
    ['Settings', '/gym#/more', false],
    ['IwantIT', '/gym#/', false],
    ['IhavIT', '/gym#/', false],
    ['IhelpIT', '/ihelpit', false]
  ];
  for (const [label, href, sensitive] of actions) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (sensitive) link.dataset.sensitive = '1';
    row.append(link);
  }
  const reach = document.createElement('div');
  reach.id = 'thumb-actions';
  reach.innerHTML = '<button type="button" id="thumb-confirm" class="primary">Confirm</button>';
  root.prepend(reach);
  root.prepend(row);
  root.prepend(board);

  const groupCode = (input) => {
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '').slice(0, 6);
      const next = digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
      if (input.value !== next) input.value = next;
    });
  };
  groupCode(board.querySelector('#access-code'));
  groupCode(board.querySelector('#access-totp'));
  groupCode(board.querySelector('#totp-confirm'));
  const status = board.querySelector('#access-status');
  const form = board.querySelector('#first-open');
  let stamps = [];
  let email = '';
  let codeOk = false;
  let memberId = '';
  let aiTested = false;
  const paint = () => {
    const stage = nextAccess({ email, codeOk, memberId, aiTested, full: localStorage.getItem('lgme.access') === 'full' });
    form.hidden = stage === 'full';
    const name = board.querySelector('#profile-name');
    if (stage === 'full') name.textContent = `Member ${localStorage.getItem('lgme.member.id') || 'on this phone'}`;
  };
  try {
    const member = JSON.parse(localStorage.getItem('lgme.demo.member') || 'null');
    if (member?.emailHash && localStorage.getItem('lgme.access') === 'full') form.hidden = true;
  } catch { /* the form still shows */ }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const gate = signinAllowed(stamps);
    if (!gate.ok) { status.textContent = gate.error; return; }
    stamps = gate.stamps;
    const response = await fetch('/api/email/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: board.querySelector('#access-email').value }) });
    const body = await response.json().catch(() => ({}));
    if (!body.ok) { status.textContent = body.error || body.waiting || 'Nothing was sent.'; return; }
    email = board.querySelector('#access-email').value.trim();
    status.textContent = 'Code sent. Enter it to continue.';
  });
  board.querySelector('#access-verify').addEventListener('click', async () => {
    const response = await fetch('/api/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code: compactCode(board.querySelector('#access-code').value) }) });
    const body = await response.json().catch(() => ({}));
    if (!body.ok) { status.textContent = body.error || 'Code not accepted.'; return; }
    codeOk = true;
    memberId = String(body.emailHash || 'member').slice(0, 12);
    localStorage.setItem('lgme.member.id', memberId);
    try { sessionStorage.setItem('lgme.access.email', email); } catch { /* the form still has it */ }
    board.querySelector('#access-member').textContent = `Member ID ${memberId}`;
    status.textContent = 'Member ID is set. Add the authenticator app, then test the helper.';
    const key = await ensureDeviceKey(localStorage);
    const enrolled = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'enroll', email, publicJwk: key.publicJwk }) });
    const setup = await enrolled.json().catch(() => ({}));
    if (setup.secret) {
      const box = board.querySelector('#totp-setup');
      box.hidden = false;
      board.querySelector('#totp-key').textContent = setup.secret;
      board.querySelector('#totp-qr').textContent = setup.uri;
    }
    paint();
  });
  board.querySelector('#totp-finish').addEventListener('click', async () => {
    const key = await ensureDeviceKey(localStorage);
    const response = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'enroll-finish', email, code: compactCode(board.querySelector('#totp-confirm').value), publicJwk: key.publicJwk }) });
    const body = await response.json().catch(() => ({}));
    board.querySelector('#totp-key').textContent = '';
    board.querySelector('#totp-qr').textContent = '';
    board.querySelector('#totp-setup').hidden = true;
    status.textContent = body.ok ? 'Authenticator app is set. The key is not shown again.' : (body.error || 'Setup was not finished.');
  });
  board.querySelector('#access-authenticator').addEventListener('click', async () => {
    const key = await ensureDeviceKey(localStorage);
    const address = board.querySelector('#access-email').value.trim();
    const nonceRes = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'nonce', email: address }) });
    const nonceBody = await nonceRes.json().catch(() => ({}));
    if (!nonceBody.ok) { status.textContent = nonceBody.error || 'Use the email code.'; return; }
    const sig = await signDevice(key.privateJwk, { nonce: nonceBody.nonce, purpose: 'totp-signin' });
    const response = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'signin', email: address, code: compactCode(board.querySelector('#access-totp').value), publicJwk: key.publicJwk, sig, nonce: nonceBody.nonce }) });
    const body = await response.json().catch(() => ({}));
    status.textContent = body.ok ? 'Signed in with the authenticator app. This device stays trusted for this session.' : (body.fallback === 'email' ? 'This device does not match. Use the email code.' : (body.error || 'Use the email code.'));
    if (body.ok && body.sessionId) {
      try { sessionStorage.setItem('lgme.session', body.sessionId); } catch { /* the sign-in still shows */ }
    }
  });
  board.querySelector('#totp-reset').addEventListener('click', async () => {
    const response = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reset', email, code: compactCode(board.querySelector('#access-code').value) }) });
    const body = await response.json().catch(() => ({}));
    status.textContent = body.ok ? 'Authenticator reset. Set it up again after the email code.' : (body.error || 'Reset was not accepted.');
  });
  board.querySelector('#ai-test').addEventListener('click', () => {
    aiTested = true;
    const on = localAiReady();
    board.querySelector('#ai-test-result').textContent = on ? 'AI on. Typing still works.' : 'AI off. Typing still works.';
    board.querySelector('#access-grant').disabled = false;
    paint();
  });
  board.querySelector('#access-grant').addEventListener('click', () => {
    if (!aiTested || !memberId) { status.textContent = 'Verify the code and test the helper first.'; return; }
    localStorage.setItem('lgme.access', 'full');
    status.textContent = 'The app is open. You confirm each action.';
    paint();
  });
  row.addEventListener('click', async (event) => {
    const link = event.target.closest?.('[data-sensitive]');
    if (!link) return;
    event.preventDefault();
    const key = await ensureDeviceKey(localStorage);
    let sessionId = '';
    try { sessionId = sessionStorage.getItem('lgme.session') || ''; } catch { /* a missing session asks again */ }
    const watchSig = sessionId ? await signDevice(key.privateJwk, { sessionId, purpose: 'watch' }) : '';
    const watched = await fetch('/api/authenticator', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'watch',
        sessionId,
        publicJwk: key.publicJwk,
        sig: watchSig,
        webdriver: navigator.webdriver === true,
        headless: /Headless/i.test(navigator.userAgent)
      })
    }).then((response) => response.json()).catch(() => ({ prompt: true }));
    if (watched.prompt === false) {
      location.assign(link.href);
      return;
    }
    const dialog = document.getElementById('confirm-gate') || document.createElement('section');
    dialog.id = 'confirm-gate';
    dialog.innerHTML = '<p>A person has to confirm. Nothing runs by itself.</p><button type="button" id="gate-passkey">Use fingerprint</button><label for="gate-totp">Google Authenticator code</label><input id="gate-totp" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="button" id="gate-totp-go">Confirm code</button><p id="gate-status" role="status"></p>';
    groupCode(dialog.querySelector('#gate-totp'));
    document.body.append(dialog);
    const finish = (decision) => {
      dialog.querySelector('#gate-status').textContent = decision.ok ? 'Confirmed by a person.' : decision.error;
      if (decision.ok) location.assign(link.href);
    };
    dialog.querySelector('#gate-passkey').onclick = async () => {
      let emailHash = '';
      try { emailHash = JSON.parse(localStorage.getItem('lgme.demo.member') || '{}').emailHash || ''; } catch { /* the code path stays */ }
      try {
        const saved = await confirmFingerprint(emailHash);
        finish(gateDecision({ human: true, method: 'passkey', verified: saved?.verified === true }));
      } catch (error) {
        if (error.code === 'missing' && !dialog.querySelector('#gate-register')) {
          const offer = document.createElement('button');
          offer.id = 'gate-register';
          offer.type = 'button';
          offer.textContent = 'Save fingerprint';
          offer.addEventListener('click', async () => {
            try {
              await registerFingerprint();
              dialog.querySelector('#gate-status').textContent = 'Fingerprint saved. Use it, or use the authenticator code.';
            } catch (err) {
              dialog.querySelector('#gate-status').textContent = err.message || 'Use the authenticator code.';
            }
          });
          dialog.append(offer);
        }
        finish(gateDecision({ human: true, method: 'passkey', verified: false }));
      }
    };
    dialog.querySelector('#gate-totp-go').onclick = async () => {
      let address = '';
      try { address = sessionStorage.getItem('lgme.access.email') || ''; } catch { /* ask for the email code */ }
      const key = await ensureDeviceKey(localStorage);
      const nonceRes = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'nonce', email: address }) });
      const nonceBody = await nonceRes.json().catch(() => ({}));
      if (!nonceBody.nonce) { finish(gateDecision({ human: true, method: 'totp', verified: false })); return; }
      const sig = await signDevice(key.privateJwk, { nonce: nonceBody.nonce, purpose: 'totp-gate' });
      const response = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'gate', email: address, code: compactCode(dialog.querySelector('#gate-totp').value), publicJwk: key.publicJwk, sig, nonce: nonceBody.nonce }) });
      const body = await response.json().catch(() => ({}));
      finish(gateDecision({ human: true, method: 'totp', verified: body.ok === true }));
    };
  });
  document.getElementById('thumb-confirm')?.addEventListener('click', () => {
    document.getElementById('ai-confirm')?.click();
  });
  paint();
}
