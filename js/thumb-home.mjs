import { attestBadges } from './attest-follow.mjs';
import { compactCode } from './email-check-core.mjs';
import { localAiReady } from './one-tap.mjs';
import { gateDecision, nextAccess, signinAllowed } from './confirm-gate.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { confirmFingerprint, fingerprintSupported, registerFingerprint } from './passkey-signin.mjs';

const root = document.getElementById('category-grid');
if (root && !document.getElementById('profile-board')) {
  const paintBadges = (open) => {
    let items = [];
    try { items = JSON.parse(localStorage.getItem('lgme.attest.items') || '[]'); } catch { items = []; }
    if (open) {
      items = items.map((item) => ({ ...item, seen: true, attested: item.attested }));
      try { localStorage.setItem('lgme.attest.items', JSON.stringify(items.map((item) => ({ ...item, seen: true })))); } catch { /* the badges still show */ }
    }
    const counts = attestBadges(open ? [] : items, Date.now());
    const host = board.querySelector('#attest-badges');
    host.replaceChildren();
    for (const [label, count] of Object.entries(counts)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'new-badge';
      button.textContent = `${label} ${count}`;
      button.addEventListener('click', () => paintBadges(true));
      host.append(button);
    }
  };
  const board = document.createElement('section');
  board.id = 'profile-board';
  board.setAttribute('aria-label', 'Profile');
  board.innerHTML = '<p id="profile-name">Not signed in</p><div id="attest-badges" aria-label="Message dashboard"></div><p id="profile-activity">No recent activity</p><p id="profile-balance">Balance stays on this phone</p><p id="profile-new">New 0</p><form id="first-open"><p id="step-count">1 of 3</p><section class="access-card" id="step-email"><h2>Sign in with email</h2><label for="access-email">Email</label><input id="access-email" type="email" autocomplete="email" maxlength="120"><button type="submit" id="access-send" class="primary">Send code</button><label for="access-code">Email code</label><input id="access-code" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="button" id="access-verify" class="primary">Verify</button></section><p id="step-or">or</p><section class="access-card" id="step-totp"><h2>Sign in with Google Authenticator</h2><label for="access-totp">Google Authenticator code</label><input id="access-totp" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="button" id="access-authenticator" class="primary">Sign in</button><button type="button" id="totp-setup-open" class="secondary">Set up authenticator</button><section id="totp-setup" hidden><p>Open Google Authenticator, tap +, scan this QR code or enter the key. The entry will be named lgme.app.</p><p id="totp-key"></p><div id="totp-qr"></div><label for="totp-confirm">Google Authenticator code</label><input id="totp-confirm" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="button" id="totp-finish" class="primary">Finish authenticator setup</button><button type="button" id="totp-reset" class="secondary">Reset authenticator</button></section></section><p id="step-or-fp">or</p><section class="access-card" id="step-fingerprint"><h2>Sign in with fingerprint</h2><p id="fingerprint-note" hidden>Fingerprint sign-in is not available on this device.</p><button type="button" id="access-fingerprint" class="primary">Sign in with fingerprint</button></section><section class="access-card" id="step-ai" hidden><h2>Test local AI</h2><p id="access-member"></p><button type="button" id="fingerprint-setup" class="secondary" hidden>Set up fingerprint</button><button type="button" id="ai-test" class="primary">Test local AI</button><p id="ai-test-result" role="status"></p><button type="button" id="access-grant" class="primary" disabled>Open the app</button></section><p id="access-status" role="status"></p></form>';
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
  const maskEmail = (value) => {
    const [name, host] = String(value || '').split('@');
    return host ? `${name.slice(0, 1)}…@${host}` : 'your inbox';
  };
  const mark = (node, kind, text) => {
    status.className = kind === 'ok' ? 'is-ok' : 'is-error';
    status.textContent = text;
    if (node) {
      node.classList.remove('is-busy');
      node.classList.add(kind === 'ok' ? 'is-done' : 'is-error');
    }
  };
  const busy = async (node, work) => {
    const label = node.textContent;
    node.disabled = true;
    node.classList.add('is-busy');
    node.textContent = 'Sending…';
    try { navigator.vibrate?.(12); } catch { /* this device does not vibrate */ }
    try {
      return await work();
    } finally {
      node.disabled = false;
      if (node.classList.contains('is-busy')) node.textContent = label;
      node.classList.remove('is-busy');
    }
  };
  const paint = () => {
    const stage = nextAccess({ email, codeOk, memberId, aiTested, full: localStorage.getItem('lgme.access') === 'full' });
    const signed = stage === 'full' || codeOk;
    form.hidden = stage === 'full';
    board.querySelector('#step-email').hidden = signed;
    board.querySelector('#step-or').hidden = signed;
    board.querySelector('#step-totp').hidden = signed;
    board.querySelector('#step-or-fp').hidden = signed;
    board.querySelector('#step-fingerprint').hidden = signed;
    board.querySelector('#step-ai').hidden = !signed || stage === 'full';
    board.querySelector('#fingerprint-setup').hidden = !codeOk || stage === 'full';
    board.querySelector('#step-count').textContent = stage === 'full' ? '3 of 3' : signed ? '3 of 3' : '1 of 3';
    const name = board.querySelector('#profile-name');
    if (stage === 'full') name.textContent = `Member ${localStorage.getItem('lgme.member.id') || 'on this phone'}`;
  };
  try {
    const member = JSON.parse(localStorage.getItem('lgme.demo.member') || 'null');
    if (member?.emailHash && localStorage.getItem('lgme.access') === 'full') form.hidden = true;
  } catch { /* the form still shows */ }
  fingerprintSupported().then((yes) => {
    if (yes) return;
    board.querySelector('#access-fingerprint').hidden = true;
    board.querySelector('#fingerprint-note').hidden = false;
  });
  board.querySelector('#access-fingerprint').addEventListener('click', async () => {
    const button = board.querySelector('#access-fingerprint');
    await busy(button, async () => {
      try {
        const saved = await confirmFingerprint(memberId);
        if (saved?.verified === true) {
          codeOk = true;
          if (!memberId) memberId = 'device';
          mark(button, 'ok', 'Verified');
          paint();
        } else mark(button, 'error', 'The fingerprint was not accepted.');
      } catch (error) {
        mark(button, 'error', error.code === 'missing' ? 'No fingerprint yet. Set it up after you sign in.' : (error.message || 'The fingerprint was not accepted.'));
      }
    });
  });
  board.querySelector('#fingerprint-setup').addEventListener('click', async () => {
    if (!codeOk) { mark(null, 'error', 'Verify email or the authenticator before saving a fingerprint.'); return; }
    const button = board.querySelector('#fingerprint-setup');
    await busy(button, async () => {
      try {
        await registerFingerprint();
        mark(button, 'ok', 'Verified');
      } catch (error) {
        mark(button, 'error', error.message || 'The fingerprint was not accepted.');
      }
    });
  });
  board.querySelector('#access-totp').addEventListener('focus', () => { board.querySelector('#step-count').textContent = '2 of 3'; });
  board.querySelector('#totp-setup-open').addEventListener('click', () => {
    board.querySelector('#totp-setup').hidden = false;
    board.querySelector('#step-count').textContent = '2 of 3';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = board.querySelector('#access-send');
    const gate = signinAllowed(stamps);
    if (!gate.ok) { mark(button, 'error', gate.error); return; }
    const address = board.querySelector('#access-email').value.trim();
    await busy(button, async () => {
      const response = await fetch('/api/email/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: address }) });
      const body = await response.json().catch(() => ({}));
      if (!body.ok) { mark(button, 'error', body.error || body.waiting || 'Nothing was sent.'); return; }
      stamps = gate.stamps;
      email = address;
      mark(button, 'ok', `Code sent to ${maskEmail(address)}`);
    });
  });
  board.querySelector('#access-verify').addEventListener('click', async () => {
    const button = board.querySelector('#access-verify');
    await busy(button, async () => {
    const response = await fetch('/api/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code: compactCode(board.querySelector('#access-code').value) }) });
    const body = await response.json().catch(() => ({}));
    if (!body.ok) { mark(button, 'error', body.error || 'Code not accepted.'); return; }
    codeOk = true;
    memberId = String(body.emailHash || 'member').slice(0, 12);
    localStorage.setItem('lgme.member.id', memberId);
    try { sessionStorage.setItem('lgme.access.email', email); } catch { /* the form still has it */ }
    board.querySelector('#access-member').textContent = `Member ID ${memberId}`;
    mark(button, 'ok', 'Verified');
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
  });
  board.querySelector('#totp-finish').addEventListener('click', async () => {
    const key = await ensureDeviceKey(localStorage);
    const response = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'enroll-finish', email, code: compactCode(board.querySelector('#totp-confirm').value), publicJwk: key.publicJwk }) });
    const body = await response.json().catch(() => ({}));
    board.querySelector('#totp-key').textContent = '';
    board.querySelector('#totp-qr').textContent = '';
    board.querySelector('#totp-setup').hidden = true;
    mark(null, body.ok ? 'ok' : 'error', body.ok ? 'Verified' : (body.error || 'Setup was not finished.'));
  });
  board.querySelector('#access-authenticator').addEventListener('click', async () => {
    const key = await ensureDeviceKey(localStorage);
    const address = board.querySelector('#access-email').value.trim();
    const nonceRes = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'nonce', email: address }) });
    const nonceBody = await nonceRes.json().catch(() => ({}));
    if (!nonceBody.ok) { mark(board.querySelector('#access-authenticator'), 'error', nonceBody.error || 'Use the email code.'); return; }
    const sig = await signDevice(key.privateJwk, { nonce: nonceBody.nonce, purpose: 'totp-signin' });
    const response = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'signin', email: address, code: compactCode(board.querySelector('#access-totp').value), publicJwk: key.publicJwk, sig, nonce: nonceBody.nonce }) });
    const body = await response.json().catch(() => ({}));
    if (body.ok) { codeOk = true; if (!memberId) memberId = 'device'; }
    mark(board.querySelector('#access-authenticator'), body.ok ? 'ok' : 'error', body.ok ? 'Verified' : (body.fallback === 'email' ? 'This device does not match. Use the email code.' : (body.error || 'Use the email code.')));
    paint();
    if (body.ok && body.sessionId) {
      try { sessionStorage.setItem('lgme.session', body.sessionId); } catch { /* the sign-in still shows */ }
    }
  });
  board.querySelector('#totp-reset').addEventListener('click', async () => {
    const response = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reset', email, code: compactCode(board.querySelector('#access-code').value) }) });
    const body = await response.json().catch(() => ({}));
    mark(null, body.ok ? 'ok' : 'error', body.ok ? 'Verified' : (body.error || 'Reset was not accepted.'));
  });
  board.querySelector('#ai-test').addEventListener('click', () => {
    aiTested = true;
    const on = localAiReady();
    board.querySelector('#ai-test-result').textContent = on ? 'AI on. Typing still works.' : 'AI off. Typing still works.';
    board.querySelector('#access-grant').disabled = false;
    paint();
  });
  board.querySelector('#access-grant').addEventListener('click', () => {
    if (!aiTested || !memberId) { mark(null, 'error', 'Verify the code and test the helper first.'); return; }
    localStorage.setItem('lgme.access', 'full');
    mark(null, 'ok', 'Verified');
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
  paint();
  paintBadges();
}
