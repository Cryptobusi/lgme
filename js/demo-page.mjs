import { CHOICES, DISCLAIMER, countByCategory, draftFor, examplePosts, markSeen, newSince, readDemo, readPosts, readSeen, saveDemo } from './demo-onboard.mjs';
import { COLLECT_LABEL, SHARE_LABEL, readHealthConsent, writeHealthConsent } from './health-safeguards.mjs';
import { AI_ENABLE, deviceContext, draftWithHelper, localAiReady, pickHelperSync, showHelperNote } from './one-tap.mjs';
import { ensureDeviceKey } from './device-sign.mjs';

const root = document.getElementById('demo-root');
if (!root) throw new Error('missing demo root');

const PENDING = 'lgme.demo.pending';
const NEEDS_ACCOUNT = new Set(['IwantIT', 'IdidIt (verified receipt)', 'IwanIT help develop', 'Offer', 'Health']);
const state = { step: 'email', email: '', choice: '', draft: null, busy: false };

function readPending() {
  try { return JSON.parse(sessionStorage.getItem(PENDING) || 'null'); } catch { return null; }
}

function writePending(value) {
  if (!value) sessionStorage.removeItem(PENDING);
  else sessionStorage.setItem(PENDING, JSON.stringify(value));
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

function showBoard() {
  document.documentElement.classList.remove('demo-gate');
  document.body.classList.remove('demo-gate');
}

function accountReady() {
  const member = readDemo(localStorage);
  return Boolean(member && member.disclaimer !== false);
}

function paintHome() {
  showBoard();
  state.step = 'home';
  document.querySelectorAll('.tile-new').forEach((node) => node.remove());
  const posts = [...readPosts(localStorage), ...examplePosts()];
  const fresh = newSince(posts, readSeen(localStorage));
  const counts = countByCategory(fresh);
  const hosts = {
    Health: '#health-tile',
    Campus: '[data-entry="campus"]',
    'Neighbor help': '[data-entry="neighbor"]',
    Hosts: '[data-entry="hosts"]',
    Circles: '[data-entry="circles"]',
    Stories: '[data-entry="stories"]',
    Exchange: '[data-entry="exchange"]'
  };
  for (const [category, count] of Object.entries(counts)) {
    const host = document.querySelector(hosts[category] || '');
    if (!host) continue;
    const badge = el('button', { type: 'button', class: 'tile-new demo-badge', 'data-category': category }, [`${count} new`]);
    badge.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      markSeen(localStorage, category);
      badge.remove();
      const href = { Health: '/gym', Campus: '/campus', Exchange: '/exchange' }[category] || '/';
      location.assign(href);
    });
    host.append(badge);
  }
  root.replaceChildren(el('span', { id: 'demo-home-note' }, ['']));
}

function begin(choice) {
  if (!choice || choice === 'Browse' || !NEEDS_ACCOUNT.has(choice)) {
    document.querySelector('.entry-grid')?.scrollIntoView({ block: 'start' });
    return;
  }
  state.choice = choice;
  if (accountReady() && (navigator.onLine === false || !localAiReady())) {
    const flag = document.getElementById('ai-flag');
    if (flag) flag.hidden = false;
    return;
  }
  if (accountReady()) {
    writePending(null);
    paintGuide();
    root.scrollIntoView({ block: 'start' });
    return;
  }
  writePending({ step: 'email', choice });
  paintEmail();
  root.scrollIntoView({ block: 'start' });
}

function paintGuide() {
  state.busy = false;
  showBoard();
  const ctx = { ...deviceContext(), handle: readDemo(localStorage)?.handle || 'demo', category: deviceContext().category || 'Health' };
  const helper = pickHelperSync();
  const base = draftFor(state.choice, ctx);
  state.draft = base;
  const note = el('p', { id: 'demo-helper' });
  showHelperNote(note, helper);
  const title = el('input', { id: 'demo-title', maxlength: '80', value: base.title });
  const body = el('textarea', { id: 'demo-note', maxlength: '280' });
  body.value = base.note;
  const explain = el('button', { type: 'button', id: 'demo-explain' }, ['Explain']);
  explain.addEventListener('click', async () => {
    const result = await draftWithHelper(helper, {
      template: body.value,
      prompt: `Explain this request in one short sentence. ${body.value}`,
      scope: window
    });
    if (result.blocked) { note.textContent = result.notice || AI_ENABLE; return; }
    if (result.text) body.value = result.text;
  });
  const confirm = el('button', { type: 'button', class: 'primary', id: 'demo-confirm' }, ['Confirm']);
  confirm.addEventListener('click', async () => {
    if (state.busy) return;
    if (navigator.onLine === false || !localAiReady()) {
      note.textContent = AI_ENABLE;
      return;
    }
    state.busy = true;
    confirm.disabled = true;
    const raw = String(ctx.category || '').toLowerCase();
    const named = { campus: 'Campus', exchange: 'Exchange', neighbor: 'Neighbor help', hosts: 'Hosts', circles: 'Circles', stories: 'Stories', health: 'Health' }[raw] || 'Health';
    saveDemo(localStorage, { choice: state.choice });
    writePending(null);
    if (state.choice === 'Health') { location.assign('/gym#/start'); return; }
    if (state.choice === 'IwanIT help develop') {
      const target = named;
      await fetch('/api/develop/want', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'IwanIT', category: target, title: title.value, body: body.value, skill: '', time: '' })
      }).catch(() => {});
      state.step = 'home';
      paintHome();
      return;
    }
    state.step = 'home';
    paintHome();
    root.replaceChildren(el('p', { id: 'browse-only' }, ['Only Health can list, trade, or record a receipt. Other categories are in development. Use IwanIT to take part.']));
  });
  root.replaceChildren(el('section', { id: 'demo-guide' }, [
    note,
    el('h2', {}, [state.choice]),
    el('label', { for: 'demo-title' }, ['Title. ', el('span', { class: 'demo-help' }, [base.titleHelp])]),
    title,
    el('label', { for: 'demo-note' }, ['Note. ', el('span', { class: 'demo-help' }, [base.noteHelp])]),
    body,
    explain,
    confirm
  ]));
  draftWithHelper(helper, { template: base.note, prompt: `Draft one sentence for ${state.choice}. ${base.note}`, scope: window })
    .then((result) => { body.value = result.text; });
}

function paintChoice() {
  root.replaceChildren(el('section', { id: 'demo-choice' }, [
    el('h2', {}, ['What do you want to do?']),
    el('div', { class: 'demo-choices' }, CHOICES.map((name) => {
      const button = el('button', { type: 'button', class: 'demo-choice' }, [name]);
      button.addEventListener('click', () => {
        state.choice = name;
        state.step = 'guide';
        writePending({ step: 'guide', choice: name });
        paintGuide();
      });
      return button;
    }))
  ]));
}

function paintDisclaimer() {
  const button = el('button', { type: 'button', class: 'primary', id: 'demo-understand' }, ['I understand']);
  button.addEventListener('click', () => {
    const pending = readPending();
    const choice = state.choice || pending?.choice || '';
    saveDemo(localStorage, { disclaimer: true });
    const prior = readHealthConsent(localStorage);
    if (choice === 'Health' && prior?.adult !== true) {
      writePending({ step: 'health', choice, returnTo: pending?.returnTo || '' });
      paintHealthConsent();
      return;
    }
    writePending(null);
    if (pending?.returnTo && pending.returnTo.startsWith('/')) {
      location.assign(pending.returnTo);
      return;
    }
    if (choice && NEEDS_ACCOUNT.has(choice)) {
      state.choice = choice;
      paintGuide();
      root.scrollIntoView({ block: 'start' });
      return;
    }
    paintHome();
  });
  root.replaceChildren(el('section', { id: 'demo-disclaimer' }, [
    el('h2', {}, ['Demo']),
    ...DISCLAIMER.map((line) => el('p', {}, [line])),
    el('p', {}, [el('a', { href: '/disclaimer' }, ['Live beta v.5 disclaimer'])]),
    state.choice === 'Health' ? el('p', {}, [el('a', { href: '/gym/health-data' }, ['Health data notice'])]) : el('span', {}, ['']),
    button
  ]));
}

function paintHealthConsent() {
  const collect = el('input', { type: 'checkbox', id: 'collect-health' });
  const share = el('input', { type: 'checkbox', id: 'share-health' });
  const status = el('p', { id: 'health-consent-status', role: 'status' });
  const note = el('p', { id: 'health-consent-note' }, ['Health notes stay on this phone. Only a hash can leave, and only after you confirm a Health step.']);
  const button = el('button', { type: 'button', class: 'primary', id: 'age-confirm' }, ['I am 18 or older']);
  button.addEventListener('click', () => {
    if (collect.checked !== true) {
      status.textContent = 'Check the box to keep health notes on this phone, or leave Health.';
      return;
    }
    writeHealthConsent(localStorage, { adult: true, collect: true, share: share.checked === true });
    const pending = readPending();
    writePending(null);
    if (pending?.returnTo && pending.returnTo.startsWith('/')) {
      location.assign(pending.returnTo);
      return;
    }
    state.choice = 'Health';
    paintGuide();
  });
  draftWithHelper(pickHelperSync(), {
    template: note.textContent,
    prompt: 'One short sentence: health notes stay on this phone until the person confirms.',
    scope: window
  }).then((result) => { if (result.text) note.textContent = result.text; });
  root.replaceChildren(el('section', { id: 'health-consent' }, [
    el('h2', {}, ['Health']),
    note,
    el('label', { class: 'check', for: 'collect-health' }, [collect, ` ${COLLECT_LABEL}`]),
    el('label', { class: 'check', for: 'share-health' }, [share, ` ${SHARE_LABEL}`]),
    el('p', {}, ['Sharing stays off unless you check it. You can turn it off later in Health settings.']),
    el('p', {}, [el('a', { href: '/gym/health-data' }, ['Health data notice']), ' · ', el('a', { href: '/gym/breach-plan' }, ['Report a problem'])]),
    button,
    status
  ]));
}

function paintCode() {
  const code = el('input', { id: 'demo-code', inputmode: 'numeric', maxlength: '6', autocomplete: 'one-time-code' });
  const status = el('p', { id: 'demo-status', role: 'status' });
  const button = el('button', { type: 'button', class: 'primary', id: 'demo-verify' }, ['Verify']);
  button.addEventListener('click', async () => {
    if (!/^\d{6}$/.test(code.value)) { status.textContent = 'Enter the 6-digit code.'; return; }
    const key = await ensureDeviceKey(localStorage);
    const response = await fetch('/api/email/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: state.email, code: code.value, publicJwk: key.publicJwk })
    });
    const body = await response.json().catch(() => ({}));
    if (!body.ok) { status.textContent = body.error || body.waiting || 'Not verified.'; return; }
    saveDemo(localStorage, { emailHash: body.emailHash || 'demo', disclaimer: false, at: new Date().toISOString() });
    localStorage.setItem('lgme-gym.seat', 'demo');
    writePending({ step: 'disclaimer', choice: state.choice, returnTo: readPending()?.returnTo || '' });
    state.email = '';
    state.step = 'disclaimer';
    paintDisclaimer();
  });
  root.replaceChildren(el('section', { id: 'demo-code-step' }, [
    el('h2', {}, ['Enter the code']),
    el('p', {}, ['We sent a 6-digit code. It stays on this demo.']),
    el('label', { for: 'demo-code' }, ['Code']),
    code,
    button,
    status
  ]));
}

function paintEmail() {
  const email = el('input', { id: 'demo-email', type: 'email', maxlength: '120', autocomplete: 'email' });
  const status = el('p', { id: 'demo-status', role: 'status' });
  const button = el('button', { type: 'button', class: 'primary', id: 'demo-send' }, ['Send code']);
  button.addEventListener('click', async () => {
    status.textContent = 'Sending…';
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.value })
    });
    const body = await response.json().catch(() => ({}));
    if (!body.ok) { status.textContent = body.error || body.waiting || 'Email sign-in is not connected yet.'; return; }
    state.email = email.value.trim();
    state.step = 'code';
    writePending({ step: 'code', email: state.email, choice: state.choice, returnTo: readPending()?.returnTo || '' });
    paintCode();
  });
  root.replaceChildren(el('section', { id: 'demo-email-step' }, [
    el('h2', {}, ['Demo sign-in']),
    el('p', {}, ['Email and a 6-digit code. That is the whole sign-in.']),
    el('label', { for: 'demo-email' }, ['Email']),
    email,
    button,
    status
  ]));
}

document.querySelectorAll('#demo-actions [data-choice]').forEach((button) => {
  button.addEventListener('click', () => begin(button.getAttribute('data-choice')));
});
document.getElementById('demo-signin')?.addEventListener('click', () => {
  state.choice = '';
  writePending({ step: 'email', choice: '' });
  paintEmail();
  root.scrollIntoView({ block: 'start' });
});
document.getElementById('start-health')?.addEventListener('click', (event) => {
  if (accountReady()) return;
  event.preventDefault();
  begin('Health');
});

const member = readDemo(localStorage);
const pending = readPending();
const ask = new URLSearchParams(location.search).get('demo') === '1';
if (pending?.step === 'code' && pending.email) {
  state.email = pending.email;
  state.choice = pending.choice || '';
  paintCode();
} else if (pending?.step === 'health' && pending.choice === 'Health') {
  state.choice = 'Health';
  paintHealthConsent();
} else if (member?.disclaimer === false) {
  state.choice = pending?.choice || '';
  paintDisclaimer();
} else if (ask || (pending?.step === 'email' && pending.choice)) {
  state.choice = pending?.choice || 'Health';
  paintEmail();
} else if (pending?.step === 'guide' && pending.choice && accountReady()) {
  state.choice = pending.choice;
  paintGuide();
} else {
  paintHome();
}
