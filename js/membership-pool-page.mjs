import { createReference } from './solana-pay.mjs';
import { PRICE_UNAVAILABLE, SAMPLE_MS, averagePrice, fetchSpotPrice, lockOpen, lockPayQuote } from './lgme-price.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { memberStats } from './gym-charts.mjs';
import { feePreset } from './health-invite.mjs';
import { POOL_ADDRESS, POOL_MEMO, POOL_MINT, POOL_TITLE, POOL_USD, poolPayLink } from './membership-pool.mjs';
import { SETUP_TITLE, readSetup, writeSetup } from './setup-fee.mjs';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value != null && value !== false) node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export async function sendPoolAction(payload) {
  const key = await ensureDeviceKey(localStorage);
  const response = await fetch('/api/hedera/listings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: payload.handle, publicJwk: key.publicJwk, payload, sig: await signDevice(key.privateJwk, payload) })
  });
  return response.json().catch(() => ({}));
}

export function deedCreditOf(handle) {
  try {
    const peer = JSON.parse(localStorage.getItem(`lgme-sim:peer:${handle}`) || 'null');
    return memberStats(peer || {}).deedCredits || 0;
  } catch {
    return 0;
  }
}

export async function fetchPool() {
  const response = await fetch('/api/hedera/listings');
  const body = await response.json().catch(() => ({}));
  return body.pool || { title: POOL_TITLE, inUsd: 0, outUsd: 0, covers: 0, offers: 0, anonymous: true };
}

function totals(pool) {
  const fees = Number(pool.covers) === 1 ? '1 setup fee' : `${pool.covers || 0} setup fees`;
  return `In US$${Number(pool.inUsd || 0).toFixed(2)}. Out US$${Number(pool.outUsd || 0).toFixed(2)}. Covers ${fees}. Direct covers waiting: ${pool.offers || 0}.`;
}

function stamp() {
  return { at: new Date().toISOString(), nonce: crypto.randomUUID() };
}

export async function renderMembershipPool(host, handle) {
  const status = el('p', { id: 'pool-status', role: 'status' });
  const balance = el('p', { id: 'pool-balance' }, ['In US$0.00. Out US$0.00. Covers 0 setup fees. Direct covers waiting: 0.']);
  const wallet = el('a', { id: 'pool-donate', href: '#' }, ['Donate']);
  const creditButton = el('button', { type: 'button', id: 'pool-donate-credit' }, ['Donate credit']);
  const sponsor = el('button', { type: 'button', id: 'pool-sponsor' }, ['Help the next member']);
  const samples = [];
  let lock = null;
  let sampling = false;
  const reference = createReference();
  const credit = deedCreditOf(handle);
  if (credit < 1) {
    creditButton.hidden = true;
    sponsor.hidden = true;
  }

  function paint() {
    const now = Date.now();
    if (lock && !lockOpen(lock, now)) lock = null;
    const quote = lockOpen(lock, now) ? lock : averagePrice(samples, now);
    if (!quote.ok) {
      wallet.setAttribute('href', '#');
      return;
    }
    const price = lockOpen(lock, now) ? lock.price : quote.price;
    const link = poolPayLink(price, POOL_USD, reference);
    if (link.ok) wallet.setAttribute('href', link.url);
  }

  async function sample() {
    if (sampling) return;
    sampling = true;
    try {
      const spot = await fetchSpotPrice();
      if (spot.ok) samples.push({ t: Date.now(), price: spot.price, source: spot.source });
      while (samples.length > 6) samples.shift();
      paint();
    } finally {
      sampling = false;
    }
  }

  wallet.addEventListener('click', (event) => {
    const now = Date.now();
    if (!lockOpen(lock, now)) lock = lockPayQuote(averagePrice(samples, now), POOL_USD, now);
    paint();
    if (!lock?.ok) {
      event.preventDefault();
      status.textContent = PRICE_UNAVAILABLE;
    }
  });

  async function look() {
    if (!lock?.ok) {
      status.textContent = PRICE_UNAVAILABLE;
      return;
    }
    const body = await sendPoolAction({
      handle,
      action: 'pool-lgme',
      category: 'exchange',
      usd: POOL_USD,
      price: lock.price,
      lgmeAmount: lock.lgmeAmount,
      reference,
      ...stamp()
    });
    status.textContent = body.ok
      ? (body.pending ? body.note : 'The donation is in the pool. Donors stay anonymous.')
      : (body.error || 'The payment was not confirmed.');
    if (body.ok) await refresh();
  }

  async function giveCredit(action) {
    const body = await sendPoolAction({
      handle,
      action,
      category: 'exchange',
      amount: action === 'pool-credit' ? Math.min(POOL_USD, credit) : undefined,
      credit,
      ...stamp()
    });
    status.textContent = body.ok
      ? (body.pending ? body.note : (action === 'pool-sponsor' ? 'The next member can accept this cover.' : 'The credit is in the pool.'))
      : (body.error || 'The pool did not record that.');
    if (body.pool) balance.textContent = totals(body.pool);
    else if (body.ok) await refresh();
  }

  creditButton.addEventListener('click', () => giveCredit('pool-credit'));
  sponsor.addEventListener('click', () => giveCredit('pool-sponsor'));
  const check = el('button', { type: 'button', id: 'pool-check', onClick: () => look() }, ['Look for the payment']);

  async function refresh() {
    const pool = await fetchPool();
    balance.textContent = totals(pool);
  }

  host.replaceChildren(
    el('h2', {}, [POOL_TITLE]),
    el('p', {}, ['Anyone can donate $lgme. Members can donate deed credit or cover the next member. Donors are anonymous.']),
    balance,
    el('p', { id: 'pool-address', class: 'hash', style: 'overflow-wrap:anywhere' }, [POOL_ADDRESS]),
    el('p', { id: 'pool-mint', class: 'hash', style: 'overflow-wrap:anywhere' }, [POOL_MINT]),
    el('p', { class: 'muted' }, [`Memo: ${POOL_MEMO}. The coins stay at that address. A draw records that the fee is covered.`]),
    wallet,
    check,
    creditButton,
    sponsor,
    status
  );
  await refresh();
  await sample();
  if (globalThis.__lgmePoolPrice) clearInterval(globalThis.__lgmePoolPrice);
  globalThis.__lgmePoolPrice = setInterval(() => { sample().catch(() => paint()); }, SAMPLE_MS);
}

export function mountPoolUse({ handle, storage, status, invite, note }) {
  const button = el('button', { type: 'button', id: 'use-pool', hidden: true }, ['Use the pool']);
  const offer = el('button', { type: 'button', id: 'accept-cover', hidden: true }, ['Accept the next-member cover']);
  async function refresh() {
    const saved = readSetup(storage, handle);
    if (saved?.status === 'paid') {
      button.hidden = true;
      offer.hidden = true;
      return;
    }
    const pool = await fetchPool();
    const preset = feePreset(invite, pool);
    if (note) note.textContent = preset.note || '';
    button.hidden = !(pool.covers >= 1);
    button.classList.toggle('primary', preset.selected === 'use-pool');
    offer.hidden = !(pool.offers >= 1 || preset.selected === 'accept-cover');
    offer.classList.toggle('primary', preset.selected === 'accept-cover');
    if (preset.selected === 'accept-cover') offer.textContent = preset.label;
    const pay = document.getElementById('pay-now');
    if (pay) pay.classList.toggle('primary', preset.selected === 'pay-now');
  }
  async function take(action, done) {
    const body = await sendPoolAction({ handle, action, category: 'exchange', ...stamp() });
    if (!body.ok) {
      status.textContent = body.error || 'The pool did not record that.';
      await refresh();
      return;
    }
    writeSetup(storage, {
      handle,
      title: SETUP_TITLE,
      status: 'paid',
      source: action === 'pool-draw' ? 'pool' : 'sponsor',
      hash: body.item?.hash || '',
      at: new Date().toISOString(),
      hedera: true,
      optOut: true
    });
    status.textContent = done;
    await refresh();
  }
  button.addEventListener('click', () => take('pool-draw', 'The setup fee is covered.'));
  offer.addEventListener('click', () => take('pool-accept', 'The setup fee is covered.'));
  refresh().catch(() => {});
  return el('div', { id: 'pool-use' }, [button, offer]);
}
