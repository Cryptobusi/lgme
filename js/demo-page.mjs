import { CHOICES, DISCLAIMER, countByCategory, draftFor, examplePosts, markSeen, newSince, readDemo, readPosts, readSeen, saveDemo, savePost } from './demo-onboard.mjs';
import { deviceContext, draftWithHelper, pickHelperSync, showHelperNote } from './one-tap.mjs';
import { ensureDeviceKey } from './device-sign.mjs';

const root = document.getElementById('demo-root');
if (!root) throw new Error('missing demo root');

const PENDING = 'lgme.demo.pending';
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

function gate(on) {
  document.body.classList.toggle('demo-gate', on);
}

function paintDashboard() {
  gate(false);
  const posts = [...readPosts(localStorage), ...examplePosts()];
  const fresh = newSince(posts, readSeen(localStorage));
  const counts = countByCategory(fresh);
  const badges = Object.entries(counts).map(([category, count]) => el('button', { type: 'button', class: 'demo-badge', 'data-category': category }, [`${category} ${count} new`]));
  const list = fresh.slice(0, 6).map((post) => el('li', {}, [
    el('button', { type: 'button', class: 'demo-open', 'data-open': post.category }, [`${post.example ? 'Example. ' : ''}${post.category}: ${post.title}`])
  ]));
  root.replaceChildren(el('section', { id: 'demo-dashboard' }, [
    el('h2', {}, ['New since your last visit']),
    el('div', { id: 'demo-badges' }, badges.length ? badges : [el('p', {}, ['No new posts.'])]),
    el('ul', { id: 'demo-new-list' }, list)
  ]));
  root.querySelectorAll('[data-category], [data-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.getAttribute('data-category') || button.getAttribute('data-open');
      markSeen(localStorage, category);
      const href = { Health: '/gym', Campus: '/campus', Exchange: '/exchange' }[category] || '/';
      location.assign(href);
    });
  });
}

function paintGuide() {
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
    body.value = result.text;
  });
  const confirm = el('button', { type: 'button', class: 'primary', id: 'demo-confirm' }, ['Confirm']);
  confirm.addEventListener('click', async () => {
    if (state.busy) return;
    state.busy = true;
    confirm.disabled = true;
    const post = { id: `me-${Date.now()}`, category: state.choice === 'Health' ? 'Health' : (ctx.category || 'Health'), title: title.value, at: new Date().toISOString(), example: false };
    if (state.choice !== 'Browse') savePost(localStorage, post);
    if (state.choice === 'IwanIT help develop') {
      await fetch('/api/develop/want', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'IwanIT', category: 'Health', title: title.value, body: body.value, skill: '', time: '' })
      }).catch(() => {});
    }
    saveDemo(localStorage, { choice: state.choice });
    writePending(null);
    if (state.choice === 'Health') { location.assign('/gym#/start'); return; }
    state.step = 'home';
    paintDashboard();
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
    saveDemo(localStorage, { disclaimer: true });
    writePending({ step: 'choice' });
    state.step = 'choice';
    paintChoice();
  });
  root.replaceChildren(el('section', { id: 'demo-disclaimer' }, [
    el('h2', {}, ['Demo']),
    ...DISCLAIMER.map((line) => el('p', {}, [line])),
    el('p', {}, [el('a', { href: '/disclaimer' }, ['Live beta v.5 disclaimer'])]),
    button
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
    saveDemo(localStorage, { emailHash: body.emailHash || 'demo', at: new Date().toISOString() });
    localStorage.setItem('lgme-gym.seat', 'demo');
    writePending(null);
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
    writePending({ step: 'code', email: state.email });
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

const member = readDemo(localStorage);
const force = new URLSearchParams(location.search).get('demo') === '1';
const pending = readPending();
if (!member) {
  gate(true);
  if (pending?.step === 'code' && pending.email) {
    state.email = pending.email;
    paintCode();
  } else paintEmail();
} else if (!member.disclaimer) {
  gate(true);
  paintDisclaimer();
} else if (pending?.step === 'guide' && pending.choice && !member.choice) {
  gate(true);
  state.choice = pending.choice;
  paintGuide();
} else if ((force || pending?.step === 'choice') && !member.choice) {
  gate(true);
  paintChoice();
} else {
  paintDashboard();
}
