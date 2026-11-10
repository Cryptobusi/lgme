import { createReference } from './solana-pay.mjs';
import { fetchLgmePrice } from './lgme-price.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import {
  PUMP_URL,
  SETUP_ADDRESS,
  SETUP_COPY,
  SETUP_OWED_TO,
  SETUP_TITLE,
  lgmeForUsd,
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
  const mock = Number(storage.getItem('lgme.setup.mockPrice'));
  let price = mock > 0 ? mock : 0;
  let priceNote = mock > 0 ? 'Example price for this screen.' : '';
  if (!(price > 0)) {
    const live = await fetchLgmePrice();
    if (live.ok) {
      price = live.price;
      priceNote = `Live price ${live.price}.`;
    } else priceNote = 'The live price is not available yet. The address is still shown.';
  }
  const quote = price > 0 ? lgmeForUsd(1, price) : { ok: false, amount: null };
  const reference = createReference();
  const pay = quote.ok ? payNowQuote(price, reference) : null;
  const status = el('p', { id: 'setup-status', role: 'status' });
  const panel = el('div', { id: 'setup-choice' });
  const host = el('section', { class: 'card', id: 'setup-fee' }, [
    el('h2', {}, ['Setup fee: $1 (helps cover running costs)']),
    el('p', {}, [SETUP_COPY]),
    el('p', {}, [el('a', { href: '/disclaimer' }, ['Disclaimer'])]),
    el('p', { class: 'muted' }, ['You sign in your own wallet. This app never holds funds or keys.']),
    el('p', { id: 'setup-price', class: 'muted' }, [priceNote]),
    el('button', { type: 'button', class: 'primary', id: 'pay-now', onClick: () => showPayNow() }, ['Pay now in $lgme']),
    el('button', { type: 'button', id: 'pay-later', onClick: () => showPayLater() }, ['Pay later']),
    panel,
    el('button', { type: 'button', id: 'setup-continue', onClick: () => go('/personalize') }, ['Continue to Health']),
    status
  ]);

  function showPayNow() {
    if (!pay?.ok) { status.textContent = 'The live price is not available yet. You can continue to Health.'; return; }
    const qr = el('div', { id: 'setup-qr' });
    const address = el('p', { id: 'setup-address' }, [SETUP_ADDRESS]);
    panel.replaceChildren(
      el('p', { id: 'setup-lgme' }, [`${pay.amount} $lgme at this price, equal to US$1.`]),
      address,
      el('button', { type: 'button', id: 'copy-setup-address', onClick: async () => {
        try { await navigator.clipboard.writeText(SETUP_ADDRESS); status.textContent = 'Address copied.'; }
        catch { status.textContent = SETUP_ADDRESS; }
      } }, ['Copy address']),
      qr,
      el('p', {}, [el('a', { id: 'setup-pump', href: PUMP_URL }, [`Buy $lgme on pump.fun (creator @${SETUP_OWED_TO})`])]),
      el('p', {}, [el('a', { id: 'setup-wallet', href: pay.url }, ['Pay with my wallet'])]),
      el('p', { class: 'muted' }, ['The wallet link is a Solana Pay request. Your wallet signs it. Nothing is taken from this app.'])
    );
    queueMicrotask(() => { if (globalThis.QRCode) new globalThis.QRCode(qr, { text: pay.url, width: 180, height: 180 }); });
  }

  async function showPayLater() {
    const built = receivableRecord({ handle, price: price || 0, at: new Date().toISOString() });
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
  return host;
}
