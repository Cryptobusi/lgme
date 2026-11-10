import * as sim from './p2p-exchange-sim.mjs';
import { deedCreditSplit } from './commons-split.mjs';
import { CHECK_KEY, checkState, loadExcerpts, visibleWisdom, wisdomSplit } from './wisdom.mjs';
import { PASSKEY_COPY, PASSKEY_FALLBACK, passkeySupported, unlockWithPasskey } from './passkey-unlock.mjs';
import { fetchLgmePrice } from './lgme-price.mjs';

const store = sim.createLocalStorageStore();
let passkeyOk = false;

function byId(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  const node = byId('wisdom-status');
  if (node) node.textContent = text || '';
}

function signing() {
  return {
    passphrase: byId('wisdom-pass').value,
    code: byId('wisdom-code').value,
    unixSeconds: Math.floor(Date.now() / 1000),
    passkey: passkeyOk
  };
}

function memberId() {
  return byId('wisdom-member').value;
}

function wireChecks() {
  const form = byId('wisdom-checks');
  if (!form) return;
  const boxes = [...form.querySelectorAll('input[type="checkbox"]')];
  const day = new Date().toISOString().slice(0, 10);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(CHECK_KEY) || 'null'); } catch { saved = null; }
  const state = checkState(saved, day);
  localStorage.setItem(CHECK_KEY, JSON.stringify(state));
  for (const box of boxes) {
    box.checked = state.ids.includes(box.dataset.check);
    box.addEventListener('change', () => {
      const ids = boxes.filter((item) => item.checked).map((item) => item.dataset.check);
      localStorage.setItem(CHECK_KEY, JSON.stringify({ day, ids }));
    });
  }
}

function article(item) {
  const node = document.createElement('article');
  node.className = 'card';
  const theme = document.createElement('p');
  theme.className = 'kicker';
  theme.textContent = item.theme || '';
  const body = document.createElement('p');
  body.textContent = item.text || '';
  node.append(theme, body);
  return node;
}

function sourceLine(item) {
  if (!item.source && !item.sourceUrl) return null;
  const line = document.createElement('p');
  line.className = 'muted';
  if (item.sourceUrl && /^https:\/\//i.test(item.sourceUrl)) {
    const link = document.createElement('a');
    link.href = item.sourceUrl;
    link.rel = 'noopener noreferrer';
    link.target = '_blank';
    link.textContent = item.source || item.sourceUrl;
    line.append(link);
  } else {
    line.textContent = item.source || '';
  }
  return line;
}

async function renderExcerpts() {
  const file = await loadExcerpts();
  const note = byId('excerpts-note');
  if (note) note.textContent = file.note;
  const host = byId('excerpts');
  if (!host) return;
  host.replaceChildren();
  for (const row of file.excerpts) {
    const node = article(row);
    if (row.forTheApp) {
      const use = document.createElement('p');
      use.className = 'muted';
      use.textContent = row.forTheApp;
      node.append(use);
    }
    const source = sourceLine(row);
    if (source) node.append(source);
    host.append(node);
  }
}

async function loadBooks() {
  const rows = [];
  for (const id of await store.listIds()) {
    const row = await store.get(id);
    if (row) rows.push(row);
  }
  return rows;
}

async function renderMembers() {
  const select = byId('wisdom-member');
  const rows = await loadBooks();
  if (!select) return rows;
  const current = select.value || sessionStorage.getItem('lgme-sim:ui:seat') || '';
  select.replaceChildren();
  if (!rows.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No book on this device yet';
    select.append(option);
    return rows;
  }
  for (const peer of rows) {
    const option = document.createElement('option');
    option.value = peer.id;
    option.textContent = peer.name || peer.id;
    if (peer.id === current) option.selected = true;
    select.append(option);
  }
  return rows;
}

function supportControls(item) {
  const wrap = document.createElement('div');
  const kind = document.createElement('select');
  for (const [value, label] of [['credit', 'Deed credit'], ['lgme', '$lgme'], ['usd', 'US$'], ['barter', 'Barter']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    kind.append(option);
  }
  const amount = document.createElement('input');
  amount.type = 'number';
  amount.min = '0.1';
  amount.step = '0.01';
  amount.value = '1';
  const terms = document.createElement('input');
  terms.maxLength = 80;
  terms.placeholder = 'Terms or barter, if there is no $lgme quote';
  const preview = document.createElement('p');
  const show = document.createElement('button');
  show.type = 'button';
  show.textContent = 'Show split';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'primary';
  confirm.textContent = 'Confirm support';
  confirm.hidden = true;
  let ready = null;
  show.addEventListener('click', async () => {
    confirm.hidden = true;
    ready = null;
    const selected = kind.value;
    if (selected === 'barter') {
      preview.textContent = 'Barter moves no $lgme. Deed credit keeps the 1% Health and fitness skim. The 10% split applies only to $lgme or US$ support. Confirm to sign it.';
      ready = { kind: 'barter', barter: terms.value };
      confirm.hidden = false;
      return;
    }
    const split = selected === 'credit' ? deedCreditSplit(amount.value) : wisdomSplit(amount.value);
    if (!split.ok) {
      preview.textContent = split.error;
      return;
    }
    if (selected === 'credit') {
      preview.textContent = `${split.skim} deed credit skim to Health and fitness. ${split.author} to the author. No $lgme moves. Confirm to sign.`;
      ready = { kind: 'credit', amount: split.amount };
    } else if (selected === 'lgme') {
      preview.textContent = `${split.floor} $lgme to the Floor. ${split.app} $lgme to the App development fund. ${split.author} $lgme to the author. You pay ${split.amount}. Confirm to sign.`;
      ready = { kind: 'lgme', amount: split.amount };
    } else {
      let price = 0;
      try {
        const quote = await fetchLgmePrice();
        if (quote?.ok && quote.price > 0) price = quote.price;
      } catch { price = 0; }
      if (!(price > 0)) {
        preview.textContent = `No $lgme quote. ${split.floor} US$ is noted for the Floor and ${split.app} US$ for the App development fund. ${split.author} US$ is noted for the author. This is pay-in-terms or barter. No $lgme moves. Confirm to sign.`;
        ready = { kind: 'usd', amount: split.amount, terms: terms.value, barter: terms.value };
      } else {
        const settled = wisdomSplit(Math.round((split.amount / price) * 100) / 100);
        if (!settled.ok) {
          preview.textContent = settled.error;
          return;
        }
        preview.textContent = `${settled.floor} $lgme to the Floor. ${settled.app} $lgme to the App development fund. ${settled.author} $lgme to the author. That is 5%, 5%, and 90% of ${split.amount} US$ at the current quote. Confirm to sign.`;
        ready = { kind: 'usd', amount: split.amount, lgmePrice: price };
      }
    }
    confirm.hidden = false;
  });
  confirm.addEventListener('click', async () => {
    if (!ready) return;
    const result = await sim.supportWisdom(store, memberId(), item.submissionId, { ...signing(), ...ready, authorId: item.authorId });
    setStatus(result.ok ? 'Support is on the tape. The split is recorded. No credit was minted by the excerpt.' : result.error);
    if (result.ok) await renderDesk();
  });
  wrap.append(kind, amount, terms, show, confirm, preview);
  return wrap;
}

async function renderDesk() {
  const rows = await renderMembers();
  const viewer = rows.find((peer) => peer.id === memberId()) || null;
  const pending = byId('pending-list');
  const published = byId('member-list');
  if (!pending || !published) return;
  pending.replaceChildren();
  published.replaceChildren();
  for (const item of visibleWisdom(rows, viewer)) {
    const node = article(item);
    const source = sourceLine(item);
    if (item.status === 'published') {
      const by = document.createElement('p');
      by.className = 'muted';
      const who = item.anonymous ? 'anonymous' : (item.handle || 'member');
      by.textContent = `${who} · ${item.concurrences?.length || 0} concurred`;
      node.append(by);
      if (source) node.append(source);
      if (viewer && viewer.id !== item.authorId) node.append(supportControls(item));
      published.append(node);
    } else {
      const concur = document.createElement('button');
      concur.type = 'button';
      concur.textContent = 'Concur';
      const no = document.createElement('button');
      no.type = 'button';
      no.textContent = 'No';
      concur.addEventListener('click', async () => {
        const result = await sim.concurWisdom(store, memberId(), item.submissionId, { ...signing(), authorId: item.authorId });
        setStatus(result.ok ? (result.status === 'published' ? 'Published. Two other members concurred. No credit was minted.' : 'Concurrence signed. No credit was minted.') : result.error);
        if (result.ok) await renderDesk();
      });
      no.addEventListener('click', async () => {
        const result = await sim.declineWisdom(store, memberId(), item.submissionId, { ...signing(), authorId: item.authorId });
        setStatus(result.ok ? 'No. Nothing moved.' : result.error);
        if (result.ok) await renderDesk();
      });
      node.append(concur, no);
      pending.append(node);
    }
  }
  if (!pending.childElementCount) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = rows.length ? 'Nothing is waiting.' : 'Set up a book on the exchange first. Contributions stay on this device.';
    pending.append(empty);
  }
  if (!published.childElementCount) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No member wisdom is published on this device yet.';
    published.append(empty);
  }
}

function bindForm() {
  const note = byId('wisdom-key-note');
  if (note) note.textContent = passkeySupported() ? PASSKEY_COPY : PASSKEY_FALLBACK;
  byId('wisdom-passkey')?.addEventListener('click', async () => {
    const result = await unlockWithPasskey();
    passkeyOk = result.ok === true;
    setStatus(result.ok ? 'Passkey checked. The passphrase still signs the tape.' : result.error);
  });
  byId('wisdom-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await sim.submitWisdom(store, memberId(), {
      ...signing(),
      text: byId('wisdom-text').value,
      theme: byId('wisdom-theme').value,
      kind: byId('wisdom-kind').value,
      source: byId('wisdom-source').value,
      sourceUrl: byId('wisdom-url').value,
      anonymous: byId('wisdom-anon').checked,
      groupCode: byId('wisdom-group').value
    });
    setStatus(result.ok ? 'Submitted. It stays pending until two other members concur. No credit was minted.' : result.error);
    if (result.ok) {
      byId('wisdom-text').value = '';
      await renderDesk();
    }
  });
  byId('wisdom-member')?.addEventListener('change', () => { renderDesk(); });
}

wireChecks();
bindForm();
renderExcerpts();
renderDesk();
