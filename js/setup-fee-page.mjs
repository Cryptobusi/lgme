import { createReference, rpc } from './solana-pay.mjs';
import { PRICE_UNAVAILABLE, SAMPLE_MS, averagePrice, fetchSpotPrice, lgmeForUsd, lockOpen, lockPayQuote, purchaseQuote } from './lgme-price.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import {
  PUMP_URL,
  SETUP_ADDRESS,
  SETUP_COPY,
  SETUP_OWED_TO,
  SETUP_TITLE,
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

export async function renderSetupFee({ storage, go, mine }) {
  const handle = mine?.id || 'member';
  const saved = readSetup(storage, handle);
  const samples = [];
  let latest = { ok: false, error: PRICE_UNAVAILABLE };
  let lock = null;
  let sampling = false;
  const amountLine = el('p', { id: 'setup-lgme' }, [PRICE_UNAVAILABLE]);
  const priceLine = el('p', { id: 'setup-price', class: 'muted' }, ['At current price (3-sec avg).']);
  const purchaseLine = el('p', { id: 'purchase-lgme' }, ['At my purchase price. Paste a buy signature.']);
  let purchase = null;
  const basis = el('select', { id: 'quote-basis' }, [
    el('option', { value: 'average', selected: 'selected' }, ['At current price (3-sec avg)']),
    el('option', { value: 'purchase' }, ['At my purchase price'])
  ]);
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
      return;
    }
    const amount = lockOpen(lock, now) && lock.basis !== 'purchase' ? lock.lgmeAmount : lgmeForUsd(1, latest.price);
    amountLine.textContent = `At current price (3-sec avg): ${amount} $lgme for US$1.`;
    const when = lockOpen(lock, now) ? `Locked until ${new Date(lock.expiresAt).toISOString()}.` : 'Updating.';
    priceLine.textContent = `${latest.source} · ${latest.timestamp} · ${when}`;
  }

  async function readBuy() {
    const signature = document.getElementById('buy-signature')?.value.trim();
    if (!signature) { status.textContent = 'Paste a buy signature first.'; return; }
    const tx = await rpc('mainnet-beta', 'getTransaction', [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'finalized' }]);
    if (!tx.ok || !tx.result) { status.textContent = tx.error || 'The buy could not be read.'; return; }
    const sol = await fetchSpotPrice({ mint: 'So11111111111111111111111111111111111111112' });
    purchase = purchaseQuote(tx.result, { solUsd: sol.ok ? sol.price : 0 });
    if (!purchase.ok) { purchaseLine.textContent = purchase.error; status.textContent = purchase.error; return; }
    purchase.timestamp = new Date().toISOString();
    purchaseLine.textContent = `At my purchase price: ${purchase.lgmeAmount} $lgme for US$1.`;
    status.textContent = 'Purchase price read. Current price stays the default until you choose the other option.';
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

  function showPayNow() {
    const now = Date.now();
    if (basis.value === 'purchase') {
      if (!purchase?.ok) { status.textContent = 'Paste a buy signature first.'; return; }
      lock = { ...lockPayQuote({ ok: true, price: purchase.price, source: 'purchase', timestamp: purchase.timestamp || new Date(now).toISOString() }, 1, now), basis: 'purchase', lgmeAmount: purchase.lgmeAmount };
    } else if (!lockOpen(lock, now) || lock.basis === 'purchase') {
      const avg = averagePrice(samples, now);
      lock = { ...lockPayQuote(avg, 1, now), basis: 'average' };
    }
    paintQuote();
    if (!lock?.ok) { status.textContent = PRICE_UNAVAILABLE; return; }
    const link = payNowQuote(lock.price, createReference());
    if (!link.ok) { status.textContent = PRICE_UNAVAILABLE; return; }
    const qr = el('div', { id: 'setup-qr' });
    panel.replaceChildren(
      el('p', { id: 'setup-address' }, [SETUP_ADDRESS]),
      el('button', { type: 'button', id: 'copy-setup-address', onClick: async () => {
        try { await navigator.clipboard.writeText(SETUP_ADDRESS); status.textContent = 'Address copied.'; }
        catch { status.textContent = SETUP_ADDRESS; }
      } }, ['Copy address']),
      qr,
      el('p', {}, [el('a', { id: 'setup-pump', href: PUMP_URL }, [`Buy $lgme on pump.fun (creator @${SETUP_OWED_TO})`])]),
      el('p', {}, [el('a', { id: 'setup-wallet', href: link.url }, ['Pay with my wallet'])]),
      el('p', { class: 'muted' }, ['The quote is locked for 60 seconds. Your wallet signs the payment. Nothing is taken from this app.'])
    );
    queueMicrotask(() => { if (globalThis.QRCode) new globalThis.QRCode(qr, { text: link.url, width: 180, height: 180 }); });
    status.textContent = `Locked ${lock.lgmeAmount} $lgme until ${new Date(lock.expiresAt).toISOString()}.`;
  }

  const host = el('section', { class: 'card', id: 'setup-fee' }, [
    el('h2', {}, ['Setup fee: $1 (helps cover running costs)']),
    el('p', {}, [SETUP_COPY]),
    el('p', {}, [el('a', { href: '/disclaimer' }, ['Disclaimer'])]),
    el('p', { class: 'muted' }, ['You sign in your own wallet. This app never holds funds or keys.']),
    amountLine,
    priceLine,
    basis,
    purchaseLine,
    el('input', { id: 'buy-signature', maxlength: '100', placeholder: 'Buy transaction signature' }),
    el('button', { type: 'button', id: 'read-buy', onClick: () => readBuy() }, ['Read purchase price']),
    el('button', { type: 'button', class: 'primary', id: 'pay-now', onClick: () => showPayNow() }, ['Pay']),
    el('button', { type: 'button', id: 'pay-later', onClick: () => showPayLater() }, ['Pay later']),
    panel,
    el('button', { type: 'button', id: 'setup-continue', onClick: () => go('/personalize') }, ['Continue to Health']),
    status
  ]);

  async function showPayLater() {
    const now = Date.now();
    const quote = lockOpen(lock, now) ? lock : averagePrice(samples, now);
    if (!quote.ok) { status.textContent = PRICE_UNAVAILABLE; return; }
    const built = receivableRecord({ handle, price: quote.price, at: new Date().toISOString() });
    if (!built.ok) { status.textContent = built.error; return; }
    writeSetup(storage, built.item);
    const posted = await postExchange({
      handle,
      action: 'receivable',
      category: 'exchange',
      title: SETUP_TITLE,
      owedTo: SETUP_OWED_TO,
      lgmeAmount: built.item.lgmeAmount,
      at: built.item.at
    });
    const signature = el('input', { id: 'setup-signature', maxlength: '100', placeholder: 'Paste the transaction signature' });
    panel.replaceChildren(
      el('p', { id: 'setup-receivable' }, [`${SETUP_TITLE}. Owed to ${SETUP_OWED_TO}.`]),
      el('p', { class: 'muted' }, [posted.ok ? 'The Exchange item was written.' : 'The item is on this phone. The Exchange write did not finish.']),
      signature,
      el('button', { type: 'button', id: 'setup-check', onClick: async () => {
        const body = await postExchange({
          handle,
          action: 'receivable-paid',
          category: 'exchange',
          title: SETUP_TITLE,
          owedTo: SETUP_OWED_TO,
          lgmeAmount: built.item.lgmeAmount,
          buySignature: document.getElementById('buy-signature')?.value.trim() || '',
          signature: signature.value.trim(),
          at: new Date().toISOString()
        });
        if (!body.ok) { status.textContent = body.error || 'The payment was not confirmed.'; return; }
        const paid = markReceivablePaid(readSetup(storage, handle) || built.item, { ok: true, signature: signature.value.trim() });
        if (paid.ok) writeSetup(storage, paid.item);
        status.textContent = 'Marked paid. Solana mainnet confirmed the transfer to the setup address.';
      } }, ['Check on Solana'])
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
