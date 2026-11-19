import { attestBadges } from './attest-follow.mjs';
import { deleteLocalFunction, exportLocalFunctions, importLocalFunctions, readLocalFunctions } from './local-functions.mjs';
import { applyMode, recommendMode, screenChosen, screenPresets, undoMode } from './screen-modes.mjs';
import { formatCredits } from './work-credits.mjs';
import { listPending } from './incognito.mjs';
import { readHealthConsent } from './health-safeguards.mjs';
import { compactCode } from './email-check-core.mjs';
import { localAiReady } from './one-tap.mjs';
import { gateDecision, nextAccess, signinAllowed } from './confirm-gate.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { NO_FINGERPRINT, fingerprintErrorLine, fingerprintGuideHtml, finishFingerprintPrompt, fingerprintSupported, prepareFingerprintPrompt, startFingerprintPrompt } from './passkey-signin.mjs';
import { askDevice } from './device-ask.mjs';
import { dismissOffer, pinShortcuts, readShortcuts, resetShortcuts, shortcutOffer, SHORTCUTS } from './guide-mode.mjs';

function setDot(id, kind, label) {
  const dot = document.getElementById(id);
  if (!dot) return;
  dot.className = `dash-dot is-${kind}`;
  dot.setAttribute('aria-label', label);
}

function paintDash(book, member) {
  if (!document.getElementById('home-board')) return;
  const rows = member ? (book?.history || []).filter((row) => row.member === member) : [];
  const credit = rows.reduce((sum, row) => sum + (Number(row.amount) > 0 ? Number(row.amount) : 0), 0);
  const debit = rows.reduce((sum, row) => sum + (Number(row.amount) < 0 ? Number(row.amount) : 0), 0);
  const creo = document.getElementById('dash-creo-figure');
  const debitLine = document.getElementById('dash-debit');
  const creditLine = document.getElementById('dash-credit');
  if (!rows.length) {
    if (creo) creo.textContent = 'None yet';
    if (debitLine) debitLine.textContent = 'None yet';
    if (creditLine) creditLine.textContent = 'None yet';
    setDot('dash-creo-dot', 'wait', 'No Creo yet');
  } else {
    if (creo) creo.textContent = formatCredits(book.balances?.[member] || 0);
    if (debitLine) debitLine.textContent = formatCredits(debit);
    if (creditLine) creditLine.textContent = formatCredits(credit);
    setDot('dash-creo-dot', 'go', 'Creo on this phone');
  }
  const today = new Date().toISOString().slice(0, 10);
  const todays = rows.filter((row) => String(row.when || '').slice(0, 10) === today);
  const todayFigure = document.getElementById('dash-today-figure');
  const todayList = document.getElementById('dash-today-list');
  if (todayFigure) todayFigure.textContent = todays.length ? String(todays.length) : 'None yet';
  if (todayList) {
    todayList.replaceChildren();
    if (!todays.length) todayList.append(Object.assign(document.createElement('li'), { textContent: 'Nothing logged today.' }));
    todays.slice(-4).forEach((row) => todayList.append(Object.assign(document.createElement('li'), { textContent: `${row.why || 'Activity'} ${formatCredits(row.amount)}` })));
  }
  setDot('dash-today-dot', todays.length ? 'go' : 'wait', todays.length ? 'Activity today' : 'Nothing logged today');
  const receipt = [...rows].reverse().find((row) => /receipt|ididit/i.test(String(row.why || '')));
  const receiptFigure = document.getElementById('dash-receipt-figure');
  const receiptDetail = document.getElementById('dash-receipt-detail');
  if (receipt) {
    if (receiptFigure) receiptFigure.textContent = formatCredits(receipt.amount);
    if (receiptDetail) receiptDetail.textContent = `${receipt.why} · ${receipt.when || ''}`.trim();
    setDot('dash-receipt-dot', 'go', 'Receipt on this phone');
  } else {
    if (receiptFigure) receiptFigure.textContent = 'None yet';
    if (receiptDetail) receiptDetail.textContent = 'No receipt yet.';
    setDot('dash-receipt-dot', 'wait', 'No receipt yet');
  }
  const consent = readHealthConsent(localStorage);
  const consentFigure = document.getElementById('dash-consent-figure');
  const consentDetail = document.getElementById('dash-consent-detail');
  if (!consent) {
    if (consentFigure) consentFigure.textContent = 'None yet';
    if (consentDetail) consentDetail.textContent = 'Not answered.';
    setDot('dash-consent-dot', 'wait', 'Health consent not answered');
  } else if (consent.adult) {
    if (consentFigure) consentFigure.textContent = consent.collect ? 'On' : 'Age only';
    if (consentDetail) consentDetail.textContent = `Collect ${consent.collect ? 'on' : 'off'}. Share ${consent.share ? 'on' : 'off'}.`;
    setDot('dash-consent-dot', 'go', 'Health consent saved');
  } else {
    if (consentFigure) consentFigure.textContent = 'Not confirmed';
    if (consentDetail) consentDetail.textContent = 'Age is not confirmed.';
    setDot('dash-consent-dot', 'stop', 'Health consent needs age');
  }
  const pending = listPending(localStorage);
  const held = document.getElementById('dash-incognito-figure');
  const heldDetail = document.getElementById('dash-incognito-detail');
  if (pending.length) {
    if (held) held.textContent = String(pending.length);
    if (heldDetail) heldDetail.textContent = `${pending.length} waiting on this phone.`;
    setDot('dash-incognito-dot', 'wait', 'Incognito items waiting');
  } else {
    if (held) held.textContent = 'None';
    if (heldDetail) heldDetail.textContent = 'Nothing is waiting.';
    setDot('dash-incognito-dot', 'go', 'No Incognito items waiting');
  }
  const chip = document.getElementById('incognito-chip');
  let hidden = false;
  try { hidden = localStorage.getItem('lgme.incognito') === '1'; } catch { hidden = false; }
  if (chip) chip.setAttribute('aria-pressed', hidden ? 'true' : 'false');
  const notice = document.getElementById('notice-text')?.textContent?.trim() || '';
  const noticeFigure = document.getElementById('dash-notice-figure');
  const noticeDetail = document.getElementById('dash-notice-detail');
  if (notice) {
    if (noticeFigure) noticeFigure.textContent = 'Testnet';
    if (noticeDetail) noticeDetail.textContent = notice;
    setDot('dash-notice-dot', 'go', 'Testnet notice');
  } else {
    if (noticeFigure) noticeFigure.textContent = 'None';
    if (noticeDetail) noticeDetail.textContent = 'No notice.';
    setDot('dash-notice-dot', 'stop', 'Testnet notice missing');
  }
}

function wireDash() {
  document.querySelectorAll('#home-board .dash-head').forEach((head) => {
    if (head.dataset.wired) return;
    head.dataset.wired = '1';
    head.addEventListener('click', () => {
      const body = document.getElementById(head.getAttribute('aria-controls') || '');
      if (!body) return;
      const open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', open ? 'false' : 'true');
      body.hidden = open;
      const mark = head.querySelector('.dash-chevron');
      if (mark) mark.textContent = open ? '+' : '–';
    });
  });
}

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
    board.innerHTML = '<p id="profile-name">Not signed in</p><button type="button" id="screen-reopen" class="secondary">Choose your screen</button><button type="button" id="credits-total" hidden>Creo 0.00</button><button type="button" id="messages-open">Messages</button><div id="attest-badges" hidden aria-label="Message dashboard"></div><details id="my-credits"><summary>My Creo</summary><ul id="creo-glossary"><li>Debit = you owe.</li><li>Credit = you lend.</li><li>Creo = value you create (the IdidIt currency).</li></ul><p id="contrib-preview">Contribute $lgme is a simulation. Live payments are off. Example price. Collective Fund and Health Sub-floor split 50/50.</p><p id="my-credits-balance"></p><ul id="my-credits-history"></ul><p id="my-credits-rules"></p></details><p id="profile-activity">No recent activity</p><p id="profile-balance">Balance stays on this phone</p><p id="profile-new">New 0</p><form id="first-open"><p id="step-count">Step 1 of 3: email or authenticator, then fingerprint, then AI test</p><section class="access-card" id="step-email"><h2>Sign in on this phone</h2><p id="signup-privacy">The administrator sees new sign-ups in the owner inbox (email, phone, device, time). No email is sent.</p><label for="access-email">Email</label><input id="access-email" type="email" autocomplete="email" maxlength="120"><button type="submit" id="access-send" class="primary">Continue</button></section><p id="step-or">or</p><section class="access-card" id="step-totp"><h2>Sign in with Google Authenticator</h2><label for="access-totp">Google Authenticator code</label><input id="access-totp" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="button" id="access-authenticator" class="primary">Sign in</button><button type="button" id="totp-setup-open" class="secondary">Set up authenticator</button><section id="totp-setup" hidden><p>Open Google Authenticator, tap +, scan this QR code or enter the key. The entry will be named lgme.app.</p><p id="totp-key"></p><div id="totp-qr"></div><label for="totp-confirm">Google Authenticator code</label><input id="totp-confirm" inputmode="numeric" maxlength="7" autocomplete="one-time-code"><button type="button" id="totp-finish" class="primary">Finish authenticator setup</button><button type="button" id="totp-reset" class="secondary">Reset authenticator</button></section></section><p id="step-or-fp">or</p><section class="access-card" id="step-fingerprint"><h2>Sign in with fingerprint</h2><p id="fingerprint-note" hidden>This phone has no fingerprint or screen lock. Use the authenticator code.</p><button type="button" id="access-fingerprint" class="primary">Sign in with fingerprint</button></section><section class="access-card" id="step-ai" hidden><h2>Test local AI</h2><p id="access-member"></p><button type="button" id="fingerprint-setup" class="secondary" hidden>Set up fingerprint</button><button type="button" id="ai-test" class="primary">Test local AI</button><p id="ai-test-result" role="status"></p><button type="button" id="access-grant" class="primary" disabled>Open the app</button></section><p id="access-status" role="status"></p></form>';
    row = document.createElement('div');
    row.id = 'function-row';
    row.setAttribute('aria-label', 'Functions');
    for (const [label, href, sensitive] of [
      ['IdidIt (verified receipt)', '/gym#/ididit', true],
      ['Sobeit', '/lgme-coin#give', false],
      ['Inanity', '/ihelpit', false],
      ['Settings', '/gym#/more', false],
      ['IwantIT', '/gym#/', false],
      ['IhavIT', '/ihavit', false],
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
  groupCode(board.querySelector('#access-totp'));
  groupCode(board.querySelector('#totp-confirm'));
  const status = board.querySelector('#access-status');
  const form = board.querySelector('#first-open');
  let stamps = [];
  let email = '';
  let codeOk = false;
  let memberId = '';
  let aiTested = false;
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
    node.textContent = 'Saving…';
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
  let fingerCreate = null;
  const armFingerprint = () => {
    prepareFingerprintPrompt().then((next) => {
      fingerReady = next;
      if (next?.ok && next.kind === 'create') fingerCreate = next;
    }).catch((error) => {
      fingerReady = { ok: false, code: 'missing', message: error.message || NO_FINGERPRINT };
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
  const showGuide = (button, step, detail = '', extra = {}) => {
    let host = button.parentElement?.querySelector('.fingerprint-guide');
    if (!host) {
      host = document.createElement('div');
      host.className = 'fingerprint-guide';
      button.insertAdjacentElement('afterend', host);
    }
    const setup = extra.setup || /no passkey/i.test(detail || '');
    host.innerHTML = fingerprintGuideHtml(step, detail, { setup });
    const again = host.querySelector('.fingerprint-again');
    if (again) again.addEventListener('click', () => button.click());
    const create = host.querySelector('.fingerprint-setup');
    if (create) create.addEventListener('click', () => {
      const ready = fingerCreate?.ok ? fingerCreate : (fingerReady?.kind === 'create' ? fingerReady : null);
      showGuide(button, 2);
      if (!ready?.ok) {
        button.classList.remove('is-scanning');
        showGuide(button, 'fail', ready?.message || fingerReady?.message || 'No passkey on this phone yet.', { setup: true });
        armFingerprint();
        return;
      }
      let pending;
      try { pending = startFingerprintPrompt({ ...ready, kind: 'create' }); }
      catch (error) {
        button.classList.remove('is-scanning');
        showGuide(button, 'fail', fingerprintErrorLine(error), { setup: error.code === 'missing' });
        armFingerprint();
        return;
      }
      showGuide(button, 3);
      followFingerprint(button, pending);
    });
    return host;
  };
  const followFingerprint = (button, pending) => {
    pending.then(async (started) => {
      const saved = await finishFingerprintPrompt(started, memberId);
      if (started.kind === 'create') {
        const next = await prepareFingerprintPrompt();
        if (next?.ok && next.kind === 'get') {
          showGuide(button, 2);
          const verified = await startFingerprintPrompt(next);
          const check = await finishFingerprintPrompt(verified, memberId);
          if (check?.verified === true) { unlockMember(button); return; }
        }
        fingerCreate = null;
        showGuide(button, 'fail', 'Fingerprint saved. Tap Try again to unlock.');
        mark(button, 'ok', 'Fingerprint saved. Tap again to sign in, or use the authenticator code.');
        return;
      }
      if (saved?.verified === true) unlockMember(button);
      else showGuide(button, 'fail', 'The fingerprint was not accepted. Use the authenticator code.');
    }).catch((error) => {
      button.classList.remove('is-scanning');
      const line = fingerprintErrorLine(error);
      showGuide(button, 'fail', line, { setup: error?.kind === 'get' || error?.code === 'missing' || /no passkey/i.test(line) });
    });
  };
  const unlockMember = (button) => {
    codeOk = true;
    if (!memberId) memberId = 'device';
    showGuide(button, 'ok');
    mark(button, 'ok', 'Unlocked');
    paint();
  };
  const tapFingerprint = (button, allow) => {
    button.addEventListener('click', () => {
      askDevice({
        kind: 'fingerprint',
        purpose: 'This uses the fingerprint sensor to sign in on this phone. The browser asks only after Allow.',
        allow: () => { runFingerprintTap(button, allow); }
      });
    });
  };
  const runFingerprintTap = (button, allow) => {
    {
      showGuide(button, 2);
      button.classList.add('is-scanning');
      if (allow && !allow()) {
        button.classList.remove('is-scanning');
        showGuide(button, 'fail', 'Verify email or the authenticator before saving a fingerprint.');
        return;
      }
      const ready = fingerReady;
      if (!ready?.ok) {
        button.classList.remove('is-scanning');
        showGuide(button, 'fail', ready?.message || 'No passkey on this phone yet.', { setup: ready?.code === 'missing' || ready?.kind !== 'get' });
        armFingerprint();
        return;
      }
      let pending;
      try { pending = startFingerprintPrompt(ready); }
      catch (error) {
        button.classList.remove('is-scanning');
        showGuide(button, 'fail', fingerprintErrorLine(error), { setup: error.code === 'missing' || ready.kind === 'get' });
        armFingerprint();
        return;
      }
      showGuide(button, 3);
      fingerReady = null;
      armFingerprint();
      followFingerprint(button, pending);
    }
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
    if (!address.includes('@')) { mark(button, 'error', 'Enter an email.'); return; }
    await busy(button, async () => {
      stamps = gate.stamps;
      email = address;
      let body = {};
      try {
        const response = await fetch('/api/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: address }) });
        body = await response.json().catch(() => ({}));
      } catch { body = {}; }
      codeOk = true;
      memberId = String(body.emailHash || 'device').slice(0, 12);
      localStorage.setItem('lgme.member.id', memberId);
      try { sessionStorage.setItem('lgme.access.email', email); } catch { /* the form still has it */ }
      board.querySelector('#access-member').textContent = `Member ID ${memberId}`;
      mark(button, 'ok', 'Saved on this phone.');
      armFingerprint();
      try {
        const key = await ensureDeviceKey(localStorage);
        const enrolled = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'enroll', email, publicJwk: key.publicJwk }) });
        const setup = await enrolled.json().catch(() => ({}));
        if (setup.secret) {
          const box = board.querySelector('#totp-setup');
          box.hidden = false;
          board.querySelector('#totp-key').textContent = setup.secret;
          board.querySelector('#totp-qr').textContent = setup.uri;
        }
      } catch { /* fingerprint and the authenticator still open */ }
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
    if (!nonceBody.ok) { mark(board.querySelector('#access-authenticator'), 'error', nonceBody.error || 'Use fingerprint or the authenticator.'); return; }
    const sig = await signDevice(key.privateJwk, { nonce: nonceBody.nonce, purpose: 'totp-signin' });
    const response = await fetch('/api/authenticator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'signin', email: address, code: compactCode(board.querySelector('#access-totp').value), publicJwk: key.publicJwk, sig, nonce: nonceBody.nonce }) });
    const body = await response.json().catch(() => ({}));
    if (body.ok) { codeOk = true; if (!memberId) memberId = 'device'; armFingerprint(); }
    mark(board.querySelector('#access-authenticator'), body.ok ? 'ok' : 'error', body.ok ? 'Verified' : (body.error || 'Use fingerprint or the authenticator.'));
    paint();
    if (body.ok && body.sessionId) {
      try { sessionStorage.setItem('lgme.session', body.sessionId); } catch { /* the sign-in still shows */ }
    }
  });
  board.querySelector('#totp-reset').addEventListener('click', () => {
    mark(null, 'ok', 'The authenticator stays on this phone.');
  });
  board.querySelector('#ai-test').addEventListener('click', () => {
    aiTested = true;
    const on = localAiReady();
    board.querySelector('#ai-test-result').textContent = on ? 'AI on. Typing still works.' : 'AI off. Typing still works.';
    board.querySelector('#access-grant').disabled = false;
    paint();
  });
  board.querySelector('#access-grant').addEventListener('click', () => {
    if (!aiTested || !memberId) { mark(null, 'error', 'Continue and test the helper first.'); return; }
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
      askDevice({
        kind: 'fingerprint',
        purpose: 'This uses the fingerprint sensor so a person can confirm. The browser asks only after Allow.',
        allow: () => { runGateFingerprint(); }
      });
    };
    const runGateFingerprint = () => {
      let emailHash = '';
      try { emailHash = JSON.parse(localStorage.getItem('lgme.demo.member') || '{}').emailHash || ''; } catch { /* the code path stays */ }
      const statusLine = dialog.querySelector('#gate-status');
      const button = dialog.querySelector('#gate-passkey');
      statusLine.innerHTML = fingerprintGuideHtml(2);
      button.classList.add('is-scanning');
      const ready = gateReady;
      if (!ready?.ok) {
        button.classList.remove('is-scanning');
        statusLine.innerHTML = fingerprintGuideHtml('fail', ready?.message || 'No passkey on this phone yet.', { setup: true });
        armGate();
        return;
      }
      let pending;
      try { pending = startFingerprintPrompt(ready); }
      catch (error) {
        button.classList.remove('is-scanning');
        statusLine.innerHTML = fingerprintGuideHtml('fail', fingerprintErrorLine(error), { setup: error.code === 'missing' || ready.kind === 'get' });
        armGate();
        return;
      }
      statusLine.innerHTML = fingerprintGuideHtml(3);
      gateReady = null;
      armGate();
      pending.then(async (started) => {
        const saved = await finishFingerprintPrompt(started, emailHash);
        if (started.kind === 'create') {
          const next = await prepareFingerprintPrompt();
          if (next?.ok && next.kind === 'get') {
            statusLine.innerHTML = fingerprintGuideHtml(2);
            const verified = await startFingerprintPrompt(next);
            const check = await finishFingerprintPrompt(verified, emailHash);
            if (check?.verified === true) {
              statusLine.innerHTML = fingerprintGuideHtml('ok');
              finish(gateDecision({ human: true, method: 'passkey', verified: true }));
              return;
            }
          }
          statusLine.innerHTML = fingerprintGuideHtml('fail', 'Fingerprint saved. Tap Try again to unlock.');
          return;
        }
        statusLine.innerHTML = fingerprintGuideHtml(saved?.verified === true ? 'ok' : 'fail', 'The fingerprint was not accepted. Use the authenticator code.');
        finish(gateDecision({ human: true, method: 'passkey', verified: saved?.verified === true }));
      }).catch((error) => {
        statusLine.innerHTML = fingerprintGuideHtml('fail', fingerprintErrorLine(error), { setup: error?.kind === 'get' || error?.code === 'missing' });
      });
      if (statusLine.dataset.guide === '1') return;
      statusLine.dataset.guide = '1';
      statusLine.addEventListener('click', (event) => {
        if (event.target.closest('.fingerprint-again')) button.click();
        if (!event.target.closest('.fingerprint-setup')) return;
        const nextReady = fingerCreate?.ok ? fingerCreate : (gateReady?.kind === 'create' ? gateReady : null);
        statusLine.innerHTML = fingerprintGuideHtml(2);
        if (!nextReady?.ok) {
          statusLine.innerHTML = fingerprintGuideHtml('fail', nextReady?.message || 'No passkey on this phone yet.', { setup: true });
          return;
        }
        let createPending;
        try { createPending = startFingerprintPrompt({ ...nextReady, kind: 'create' }); }
        catch (error) {
          statusLine.innerHTML = fingerprintGuideHtml('fail', fingerprintErrorLine(error), { setup: error.code === 'missing' });
          return;
        }
        statusLine.innerHTML = fingerprintGuideHtml(3);
        createPending.catch((error) => {
          statusLine.innerHTML = fingerprintGuideHtml('fail', fingerprintErrorLine(error), { setup: true });
        });
      });
    };
    dialog.querySelector('#gate-totp-go').onclick = async () => {
      let address = '';
      try { address = sessionStorage.getItem('lgme.access.email') || ''; } catch { /* the authenticator still asks */ }
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
        const panel = document.getElementById('message-panel');
        if (!panel) return;
        panel.hidden = false;
        const list = document.getElementById('message-list');
        const empty = document.getElementById('message-empty');
        let rows = [];
        try { rows = JSON.parse(localStorage.getItem('lgme.messages.mine') || '[]'); } catch { rows = []; }
        list.replaceChildren(...(Array.isArray(rows) ? rows : []).map((row) => Object.assign(document.createElement('li'), { textContent: row.text || '' })));
        empty.hidden = list.childElementCount > 0;
        const ok = document.getElementById('message-ok');
        if (ok && ok.dataset.bound !== '1') {
          ok.dataset.bound = '1';
          ok.addEventListener('click', () => {
            const text = document.getElementById('message-draft').value.trim();
            if (!text) { document.getElementById('message-status').textContent = 'Write a message, then tap OK.'; return; }
            rows = Array.isArray(rows) ? rows : [];
            rows.push({ text, sent: false });
            localStorage.setItem('lgme.messages.mine', JSON.stringify(rows));
            document.getElementById('message-status').textContent = 'Kept on this phone. Not sent.';
            list.append(Object.assign(document.createElement('li'), { textContent: text }));
            empty.hidden = true;
          });
        }
      });
    }
    board.querySelector('#my-credits-balance').textContent = member ? `Balance ${formatCredits(book.balances?.[member] || 0)}` : 'Sign in to see your Creo.';
    paintDash(book, member);
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
  wireDash();
  paintShortcuts();
paintCredits();
}

function paintShortcuts() {
  const row = document.getElementById('my-shortcuts');
  const offer = document.getElementById('shortcut-offer');
  if (!row && !offer) return;
  const saved = readShortcuts(localStorage);
  if (row) {
    row.replaceChildren();
    row.hidden = saved.length === 0;
    saved.forEach((id) => {
      const link = document.createElement('a');
      link.href = SHORTCUTS[id].href;
      link.textContent = SHORTCUTS[id].label;
      row.append(link);
    });
    if (saved.length) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.id = 'shortcut-reset';
      reset.textContent = 'Reset shortcuts';
      reset.addEventListener('click', () => { resetShortcuts(localStorage); paintShortcuts(); });
      row.append(reset);
    }
  }
  if (!offer) return;
  const ids = shortcutOffer(localStorage);
  offer.hidden = !ids;
  offer.replaceChildren();
  if (!ids) return;
  const line = document.createElement('span');
  line.textContent = `Pin ${ids.map((id) => SHORTCUTS[id].label).join(', ')} on this phone?`;
  const yes = document.createElement('button');
  yes.type = 'button';
  yes.textContent = 'Pin';
  yes.addEventListener('click', () => { pinShortcuts(localStorage, ids); paintShortcuts(); });
  const no = document.createElement('button');
  no.type = 'button';
  no.textContent = 'Not now';
  no.addEventListener('click', () => { dismissOffer(localStorage); paintShortcuts(); });
  offer.append(line, yes, no);
}
window.addEventListener('lgme-shortcuts', paintShortcuts);
