import { attestBadges } from './attest-follow.mjs';
import { deleteLocalFunction, exportLocalFunctions, importLocalFunctions, readLocalFunctions } from './local-functions.mjs';
import { applyMode, recommendMode, screenChosen, screenPresets, undoMode } from './screen-modes.mjs';
import { formatCredits } from './work-credits.mjs';
import { compactCode } from './email-check-core.mjs';
import { localAiReady } from './one-tap.mjs';
import { gateDecision, nextAccess, signinAllowed } from './confirm-gate.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { NO_FINGERPRINT, finishFingerprintPrompt, fingerprintSupported, prepareFingerprintPrompt, startFingerprintPrompt } from './passkey-signin.mjs';

const root = document.getElementById('category-grid');
if (root) {
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
  let board = document.getElementById('profile-board');
  let row = document.getElementById('function-row');
  let mine = document.getElementById('my-functions');
  if (!board) {
    board = document.createElement('section');
    board.id = 'profile-board';
    board.setAttribute('aria-label', 'Profile');
    board.innerHTML = '<p id="profile-name">Not signed in</p><button type="button" id="screen-reopen" class="secondary">Choose your screen</button><button type="button" id="credits-total" hidden>Creo 0.00</button><button type="button" id="messages-open">Messages</button><div id="attest-badges" hidden aria-label="Message dashboard"></div><details id="my-credits"><summary>My Creo</summary><ul id="creo-glossary"><li>Debit = you owe.</li><li>Credit = you lend.</li><li>Creo = value you create (the IdidIt currency).</li></ul><p id="contrib-preview">Contribute $lgme is a simulation. Live payments are off. Example price. Collective Fund and Health Sub-floor split 50/50.</p><p id="my-credits-balance"></p><ul id="my-credits-history"></ul><p id="my-credits-rules"></p></details><p id="profile-activity">No recent activity</p><p id="profile-balance">Balance stays on this phone</p><p id="profile-new">New 0</p><form id="first-open"><p id="step-count">Step 1 of 3: email or authenticator, then fingerprint, then AI test</p><section class="access-card" id="step-email"><h2>Sign in with email</h2><label for="access-email">Email</label><input id="access-email" type="email" autocomplete="email" maxlength="120"><button type="submit" id="access-send" class="primary">Send code</button><label for="access-code">Email code</label><input id="access-code" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="button" id="access-verify" class="primary">Verify</button></section><p id="step-or">or</p><section class="access-card" id="step-totp"><h2>Sign in with Google Authenticator</h2><label for="access-totp">Google Authenticator code</label><input id="access-totp" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="button" id="access-authenticator" class="primary">Sign in</button><button type="button" id="totp-setup-open" class="secondary">Set up authenticator</button><section id="totp-setup" hidden><p>Open Google Authenticator, tap +, scan this QR code or enter the key. The entry will be named lgme.app.</p><p id="totp-key"></p><div id="totp-qr"></div><label for="totp-confirm">Google Authenticator code</label><input id="totp-confirm" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="button" id="totp-finish" class="primary">Finish authenticator setup</button><button type="button" id="totp-reset" class="secondary">Reset authenticator</button></section></section><p id="step-or-fp">or</p><section class="access-card" id="step-fingerprint"><h2>Sign in with fingerprint</h2><p id="fingerprint-note" hidden>This phone has no fingerprint or screen lock. Use the authenticator code.</p><button type="button" id="access-fingerprint" class="primary">Sign in with fingerprint</button></section><section class="access-card" id="step-ai" hidden><h2>Test local AI</h2><p id="access-member"></p><button type="button" id="fingerprint-setup" class="secondary" hidden>Set up fingerprint</button><button type="button" id="ai-test" class="primary">Test local AI</button><p id="ai-test-result" role="status"></p><button type="button" id="access-grant" class="primary" disabled>Open the app</button></section><p id="access-status" role="status"></p></form>';
    row = document.createElement('div');
    row.id = 'function-row';
    row.setAttribute('aria-label', 'Functions');
    for (const [label, href, sensitive] of [
      ['IdidIt (verified receipt)', '/gym#/ididit', true],
      ['Sobeit', '/lgme-coin#give', false],
      ['Inanity', '/ihelpit', false],
      ['Settings', '/gym#/more', false],
      ['IwantIT', '/gym#/', false],
      ['IhavIT', '/gym#/', false],
      ['IhelpIT', '/ihelpit', false]
    ]) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      if (sensitive) link.dataset.sensitive = '1';
      row.append(link);
    }
    mine = document.createElement('details');
    mine.id = 'my-functions';
    const summary = document.createElement('summary');
    summary.textContent = 'My Agency';
    mine.append(summary);
    root.prepend(mine);
    root.prepend(row);
    root.prepend(board);
  }
  const summary = mine.querySelector('summary');
  const paintMine = () => {
    for (const node of [...mine.children]) if (node !== summary) node.remove();
    const tag = document.createElement('span');
    tag.textContent = 'local only';
    mine.append(tag);
    for (const item of readLocalFunctions(localStorage)) {
      const label = document.createElement('button');
      label.type = 'button';
      label.textContent = item.label;
      label.addEventListener('click', () => {
        const ask = document.getElementById('ai-ask');
        if (ask) ask.value = item.prompt;
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => { deleteLocalFunction(localStorage, item.id); paintMine(); });
      mine.append(label, remove);
    }
    const exp = document.createElement('button');
    exp.type = 'button';
    exp.id = 'functions-export';
    exp.textContent = 'Export';
    exp.addEventListener('click', () => { mine.dataset.export = exportLocalFunctions(localStorage); });
    const file = document.createElement('input');
    file.id = 'functions-import';
    file.type = 'file';
    file.accept = 'application/json';
    file.hidden = !mine.open;
    file.setAttribute('aria-label', 'Choose File');
    file.addEventListener('change', async () => {
      const text = await file.files?.[0]?.text();
      if (text) importLocalFunctions(localStorage, text);
      paintMine();
    });
    mine.append(exp, file);
  };
  mine.addEventListener('toggle', paintMine);
  paintMine();

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
    const screenStep = board.querySelector('#step-screen');
    if (screenStep) screenStep.hidden = !(aiTested && !screenChosen(localStorage));
    board.querySelector('#fingerprint-setup').hidden = !codeOk || stage === 'full';
    board.querySelector('#step-count').textContent = stage === 'full' || signed
      ? 'Step 3 of 3: test the helper'
      : 'Step 1 of 3: email or authenticator, then fingerprint, then AI test';
    const name = board.querySelector('#profile-name');
    if (stage === 'full') name.textContent = `Member ${localStorage.getItem('lgme.member.id') || 'on this phone'}`;
  };
  try {
    const member = JSON.parse(localStorage.getItem('lgme.demo.member') || 'null');
    if (member?.emailHash && localStorage.getItem('lgme.access') === 'full') form.hidden = true;
  } catch { /* the form still shows */ }
  let fingerReady = null;
  const armFingerprint = () => {
    prepareFingerprintPrompt().then((next) => { fingerReady = next; }).catch((error) => {
      fingerReady = { ok: false, message: error.message || NO_FINGERPRINT };
    });
  };
  armFingerprint();
  fingerprintSupported().then((yes) => {
    const note = board.querySelector('#fingerprint-note');
    const button = board.querySelector('#access-fingerprint');
    button.hidden = false;
    button.disabled = false;
    if (yes) { note.hidden = true; return; }
    note.hidden = false;
    note.textContent = NO_FINGERPRINT;
  });
  const tapFingerprint = (button, allow) => {
    button.addEventListener('click', () => {
      if (allow && !allow()) return;
      const ready = fingerReady;
      if (!ready?.ok) {
        mark(button, 'error', ready?.message || 'Tap again to show the fingerprint prompt. Or use the authenticator code.');
        armFingerprint();
        return;
      }
      const pending = startFingerprintPrompt(ready);
      fingerReady = null;
      armFingerprint();
      busy(button, async () => {
        try {
          const started = await pending;
          const saved = await finishFingerprintPrompt(started, memberId);
          if (started.kind === 'create') {
            mark(button, 'ok', 'Fingerprint saved. Tap again to sign in, or use the authenticator code.');
            armFingerprint();
            return;
          }
          if (saved?.verified === true) {
            codeOk = true;
            if (!memberId) memberId = 'device';
            mark(button, 'ok', 'Verified');
            paint();
          } else mark(button, 'error', 'The fingerprint was not accepted. Use the authenticator code.');
        } catch (error) {
          mark(button, 'error', error.message || 'The fingerprint prompt did not open. Use the authenticator code.');
        }
      });
    });
  };
  tapFingerprint(board.querySelector('#access-fingerprint'));
  tapFingerprint(board.querySelector('#fingerprint-setup'), () => {
    if (codeOk) return true;
    mark(null, 'error', 'Verify email or the authenticator before saving a fingerprint.');
    return false;
  });
  board.querySelector('#access-totp').addEventListener('focus', () => { board.querySelector('#step-count').textContent = 'Step 2 of 3: fingerprint, then the AI test'; });
  board.querySelector('#totp-setup-open').addEventListener('click', () => {
    board.querySelector('#totp-setup').hidden = false;
    board.querySelector('#step-count').textContent = 'Step 2 of 3: fingerprint, then the AI test';
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
    armFingerprint();
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
    if (body.ok) { codeOk = true; if (!memberId) memberId = 'device'; armFingerprint(); }
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
    let gateReady = null;
    const armGate = () => {
      prepareFingerprintPrompt().then((next) => { gateReady = next; }).catch((error) => {
        gateReady = { ok: false, message: error.message || NO_FINGERPRINT };
      });
    };
    armGate();
    dialog.querySelector('#gate-passkey').onclick = () => {
      let emailHash = '';
      try { emailHash = JSON.parse(localStorage.getItem('lgme.demo.member') || '{}').emailHash || ''; } catch { /* the code path stays */ }
      const statusLine = dialog.querySelector('#gate-status');
      const ready = gateReady;
      if (!ready?.ok) {
        statusLine.textContent = ready?.message || 'Tap again to show the fingerprint prompt. Or use the authenticator code.';
        armGate();
        return;
      }
      const pending = startFingerprintPrompt(ready);
      gateReady = null;
      armGate();
      pending.then(async (started) => {
        const saved = await finishFingerprintPrompt(started, emailHash);
        if (started.kind === 'create') {
          statusLine.textContent = 'Fingerprint saved. Tap again, or use the authenticator code.';
          return;
        }
        finish(gateDecision({ human: true, method: 'passkey', verified: saved?.verified === true }));
      }).catch((error) => {
        statusLine.textContent = error.message || 'The fingerprint prompt did not open. Use the authenticator code.';
      });
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
  const paintCredits = () => {
    let book = { balances: {}, history: [] };
    try { book = JSON.parse(localStorage.getItem('lgme.credits.mine') || '{}'); } catch { /* an empty book stays */ }
    const member = localStorage.getItem('lgme.member.id') || '';
    const total = board.querySelector('#credits-total');
    total.hidden = !member;
    total.textContent = `Creo ${formatCredits(book.balances?.[member] || 0)}`;
    total.onclick = () => { board.querySelector('#my-credits').open = true; };
    const messages = board.querySelector('#messages-open');
    if (messages && !messages.dataset.bound) {
      messages.dataset.bound = '1';
      messages.addEventListener('click', () => {
        const badges = board.querySelector('#attest-badges');
        badges.hidden = !badges.hidden;
      });
    }
    board.querySelector('#my-credits-balance').textContent = member ? `Balance ${formatCredits(book.balances?.[member] || 0)}` : 'Sign in to see your Creo.';
    const list = board.querySelector('#my-credits-history');
    list.replaceChildren(...(book.history || []).filter((row) => row.member === member).map((row) => {
      const item = document.createElement('li');
      item.textContent = `${row.when}: ${row.why} ${row.amount > 0 ? '+' : ''}${formatCredits(row.amount)} Creo`;
      return item;
    }));
    board.querySelector('#my-credits-rules').textContent = 'Creo is an in-app unit, not $lgme. Amounts are in data/credit-rules.json. Only you see this panel.';
    fetch('/data/credit-rules.json').then((response) => response.json()).then((rules) => {
      board.querySelector('#my-credits-rules').textContent = `${rules.note} IdidIt ${rules.ididit}. Attestation ${rules.attestation}. Listing ${rules.listing}. Proposal ${rules.proposal}. Quiz ${rules.quiz}.`;
    }).catch(() => {});
  };
  const screen = document.createElement('section');
  screen.id = 'step-screen';
  screen.className = 'access-card';
  screen.hidden = true;
  const rec = recommendMode({
    largeText: localStorage.getItem('lgme.dock.size') === 'tall',
    voiceUsed: localStorage.getItem('lgme.voice.used') === '1'
  });
  screen.innerHTML = `<h2>Choose your screen</h2><p id="screen-reason">${rec.reason}</p><p>The screen can be tailored. Pick a mode.</p>`;
  for (const [id, label] of [['simple', 'Simple'], ['everyday', 'Everyday'], ['full', 'Full']]) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'primary';
    card.id = `screen-${id}`;
    card.textContent = label;
    card.setAttribute('aria-pressed', rec.mode === id ? 'true' : 'false');
    card.addEventListener('click', () => {
      const applied = applyMode(localStorage, id);
      status.textContent = applied.ok ? `Applied ${label}.` : applied.error;
      paint();
    });
    screen.append(card);
  }
  const undo = document.createElement('button');
  undo.type = 'button';
  undo.id = 'screen-undo';
  undo.className = 'secondary';
  undo.textContent = 'Undo';
  undo.addEventListener('click', () => { undoMode(localStorage); status.textContent = 'Undone.'; paint(); });
  const more = document.createElement('a');
  more.id = 'screen-more';
  more.href = '/customize';
  more.textContent = 'Customize more';
  screen.append(undo, more);
  board.append(screen);
  let reopen = document.getElementById('screen-reopen');
  if (!reopen) {
    reopen = document.createElement('button');
    reopen.type = 'button';
    reopen.id = 'screen-reopen';
    reopen.className = 'secondary';
    reopen.textContent = 'Choose your screen';
    board.querySelector('#profile-name').after(reopen);
  }
  reopen.addEventListener('click', () => { screen.hidden = false; });
  paint();
  paintBadges();
  paintCredits();
}
