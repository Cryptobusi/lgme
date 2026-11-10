import { createReference } from './solana-pay.mjs';
import { PRICE_UNAVAILABLE, SAMPLE_MS, averagePrice, fetchSpotPrice, lgmeForUsd, lockOpen, lockPayQuote } from './lgme-price.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { feePreset } from './health-invite.mjs';
import { mountPoolUse } from './membership-pool-page.mjs';
import {
  PUMP_URL,
  SETUP_ADDRESS,
  SETUP_MINT,
  SETUP_COPY,
  SETUP_OWED_TO,
  SETUP_TITLE,
  findSetupPayment,
  markReceivablePaid,
  payNowQuote,
  readSetup,
  receivableRecord,
  writeSetup
} from './setup-fee.mjs';

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

async function postExchange(payload) {
  const key = await ensureDeviceKey(localStorage);
  const response = await fetch('/api/hedera/listings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: payload.handle, publicJwk: key.publicJwk, payload, sig: await signDevice(key.privateJwk, payload) })
  });
  return response.json().catch(() => ({}));
}

export async function renderSetupFee({ storage, go, mine, invite } = {}) {
  const handle = mine?.id || 'member';
  const saved = readSetup(storage, handle);
  const samples = [];
  let latest = { ok: false, error: PRICE_UNAVAILABLE };
  let lock = null;
  let sent = null;
  let sampling = false;
  const amountLine = el('p', { id: 'setup-lgme' }, [PRICE_UNAVAILABLE]);
  const priceLine = el('p', { id: 'setup-price', class: 'muted' }, ['At current price (3-sec avg).']);
  const wallet = el('a', { id: 'setup-wallet', href: '#' }, ['Pay with my wallet']);
  const reference = createReference();
  const status = el('p', { id: 'setup-status', role: 'status' });
  const panel = el('div', { id: 'setup-choice' });

  function paintQuote() {
    const now = Date.now();
    if (lock && !lockOpen(lock, now)) lock = null;
    const quote = lockOpen(lock, now) ? lock : averagePrice(samples, now);
    latest = quote.ok ? quote : { ok: false, error: PRICE_UNAVAILABLE };
    if (!latest.ok) {
      amountLine.textContent = PRICE_UNAVAILABLE;
      priceLine.textContent = 'At current price (3-sec avg).';
      wallet.setAttribute('href', '#');
      return;
    }
    const amount = lockOpen(lock, now) ? lock.lgmeAmount : lgmeForUsd(1, latest.price);
    const price = lockOpen(lock, now) ? lock.price : latest.price;
    amountLine.textContent = `At current price (3-sec avg): ${amount} $lgme for US$1.`;
    const when = lockOpen(lock, now) ? `Locked until ${new Date(lock.expiresAt).toISOString()}.` : 'Updating.';
    priceLine.textContent = `${latest.source} · ${latest.timestamp} · ${when}`;
    const link = payNowQuote(price, reference);
    if (link.ok) wallet.setAttribute('href', link.url);
  }

  async function sample() {
    if (sampling) return;
    sampling = true;
    try {
      const spot = await fetchSpotPrice();
      if (spot.ok) samples.push({ t: Date.now(), price: spot.price, source: spot.source });
      while (samples.length > 6) samples.shift();
      paintQuote();
    } finally {
      sampling = false;
    }
  }

  function holdQuote() {
    const now = Date.now();
    if (!lockOpen(lock, now)) lock = lockPayQuote(averagePrice(samples, now), 1, now);
    if (lock?.ok) sent = lock;
    paintQuote();
    return lock;
  }

  wallet.addEventListener('click', (event) => {
    const held = holdQuote();
    if (!held?.ok) {
      event.preventDefault();
      status.textContent = PRICE_UNAVAILABLE;
    }
  });

  function showPayNow() {
    const held = holdQuote();
    if (!held?.ok) { status.textContent = PRICE_UNAVAILABLE; return; }
    const link = payNowQuote(held.price, reference);
    if (!link.ok) { status.textContent = PRICE_UNAVAILABLE; return; }
    const qr = el('div', { id: 'setup-qr' });
    panel.replaceChildren(
      el('p', { id: 'setup-address', class: 'hash' }, [SETUP_ADDRESS]),
      el('button', { type: 'button', id: 'copy-setup-address', onClick: async () => {
        try { await navigator.clipboard.writeText(SETUP_ADDRESS); status.textContent = 'Address copied.'; }
        catch { status.textContent = SETUP_ADDRESS; }
      } }, ['Copy address']),
      qr,
      el('p', {}, [el('a', { id: 'setup-pump', href: PUMP_URL }, [`Buy $lgme on pump.fun (creator @${SETUP_OWED_TO})`])]),
      el('p', {}, [el('a', { href: link.url }, ['Pay with my wallet'])]),
      el('p', { class: 'muted' }, ['The quote is locked for 60 seconds. Your wallet signs the payment. Nothing is taken from this app.'])
    );
    queueMicrotask(() => { if (globalThis.QRCode) new globalThis.QRCode(qr, { text: link.url, width: 180, height: 180 }); });
    status.textContent = `Locked ${held.lgmeAmount} $lgme until ${new Date(held.expiresAt).toISOString()}.`;
  }

  const preset = feePreset(invite, {});
  const inviteNote = el('p', { id: 'invite-fee' }, [preset.note || '']);
  const host = el('section', { class: 'card', id: 'setup-fee' }, [
    el('h2', {}, ['Setup fee: $1 (helps cover running costs)']),
    el('p', {}, [SETUP_COPY]),
    el('p', {}, [el('a', { href: '/disclaimer' }, ['Disclaimer'])]),
    el('p', { class: 'muted' }, ['You sign in your own wallet. This app never holds funds or keys.']),
    amountLine,
    priceLine,
    el('p', { id: 'setup-address', class: 'hash' }, [SETUP_ADDRESS]),
    el('p', { id: 'setup-mint', class: 'hash' }, [SETUP_MINT]),
    wallet,
    invite ? inviteNote : null,
    el('button', { type: 'button', class: preset.selected === 'pay-now' ? 'primary' : '', id: 'pay-now', onClick: () => showPayNow() }, ['Pay now']),
    el('button', { type: 'button', id: 'pay-later', onClick: () => showPayLater() }, ['Pay later']),
    mountPoolUse({ handle, storage, status, invite, note: invite ? inviteNote : null }),
    panel,
    el('button', { type: 'button', id: 'setup-continue', onClick: () => go('/personalize') }, ['Continue to Health']),
    status
  ]);

  async function showPayLater() {
    const held = holdQuote();
    if (!held?.ok) { status.textContent = PRICE_UNAVAILABLE; return; }
    const built = receivableRecord({ handle, price: held.price, at: new Date().toISOString() });
    if (!built.ok) { status.textContent = built.error; return; }
    built.item.reference = reference;
    built.item.lgmeAmount = held.lgmeAmount;
    writeSetup(storage, built.item);
    const posted = await postExchange({
      handle,
      action: 'receivable',
      category: 'exchange',
      title: SETUP_TITLE,
      owedTo: SETUP_OWED_TO,
      lgmeAmount: held.lgmeAmount,
      reference,
      at: built.item.at
    });
    async function look() {
      const quote = sent || held;
      const found = await findSetupPayment(reference, { amount: quote.lgmeAmount, tolerance: 0.02 });
      if (!found.ok) { status.textContent = found.error; return; }
      const body = await postExchange({
        handle,
        action: 'receivable-paid',
        category: 'exchange',
        title: SETUP_TITLE,
        owedTo: SETUP_OWED_TO,
        lgmeAmount: quote.lgmeAmount,
        reference,
        at: new Date().toISOString()
      });
      if (!body.ok) { status.textContent = body.error || 'The payment was not confirmed.'; return; }
      const paid = markReceivablePaid(readSetup(storage, handle) || built.item, found);
      if (paid.ok) writeSetup(storage, paid.item);
      status.textContent = 'Marked paid. The reference payment matched the locked quote.';
    }
    panel.replaceChildren(
      el('p', { id: 'setup-receivable' }, [`${SETUP_TITLE}. Owed to ${SETUP_OWED_TO}.`]),
      el('p', { class: 'muted' }, [posted.ok ? 'The Exchange item was written. Send from the wallet link. No receipt is needed.' : 'The item is on this phone. Send from the wallet link.']),
      el('button', { type: 'button', id: 'setup-check', onClick: () => look() }, ['Look for the payment'])
    );
    status.textContent = 'Pay whenever you are inclined. Health stays open.';
  }

  if (saved?.status === 'paid') status.textContent = 'The setup fee is already marked paid.';
  else if (saved?.status === 'due') status.textContent = 'A setup fee item is already open. Health stays open.';
  if (globalThis.__lgmePrice) clearInterval(globalThis.__lgmePrice);
  await sample();
  globalThis.__lgmePrice = setInterval(() => { sample().catch(() => paintQuote()); }, SAMPLE_MS);
  return host;
}
