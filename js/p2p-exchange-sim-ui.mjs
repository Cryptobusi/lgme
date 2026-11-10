import * as sim from './p2p-exchange-sim.mjs';
import { ARTICLES } from './p2p-resources.mjs';
import { buildLinks, capPicks, customSite, detectLocalAi, dueRequests, matchCriteria, presetsFor, SOURCE_KEY, SOURCE_SITES, suggestSites } from './sourcing.mjs';
import { createIndexedDbVault, deviceKeyForMigration, importNonExtractable, openJson, sealJson } from './p2p-sim-guard.mjs';
import { PASSKEY_COPY, PASSKEY_FALLBACK, enrollPasskey, passkeySupported, readCredentialId, unlockWithPasskey } from './passkey-unlock.mjs';
import { mountEmailCheck } from './email-check.mjs';
import { mountSharedListingNote } from './shared-listings.mjs';
import { EVIDENCE_UNVERIFIED, evidenceHash, locationMatched } from './exercise-record.mjs';
import { MAXIMS, loadExcerpts, memberLines, rotationFor, visibleWisdom } from './wisdom.mjs';
import { allowMotion, captureFrame, readGps } from './exercise-sensors.mjs';
import { mountHederaAnchor } from './hedera-anchor.mjs';
import { REFERENCE_LABEL, optionLabel, referenceLine } from './dc-reference.mjs';
import { DONATION_ADDRESS, MINT, buildTransferRequest, createReference, findReferencePayment, isValidPublicKey, readTokenBalance } from './solana-pay.mjs';
import { confirmServiceCredit, recommendRate, scoreSolo, soloCredit } from './exercise-arbiter.mjs';
import { loadPersonalImages, resolveImage, slotForListing, viewerId } from './personal-images.mjs';
import { fetchLgmePrice as quoteLgme } from './lgme-price.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { REPAIR_STATUSES } from './repair-follow.mjs';

const sessionKeys = new Map();
const sessionCrypto = new Map();
const metaKeys = new Map();
const rememberedSecrets = new Map();
const freshAuth = new Map();
const baseStore = sim.createLocalStorageStore();
const store = {
  async get(id) {
    const peer = await baseStore.get(id);
    if (peer && !peer.privateKeyJwk && sessionKeys.has(id)) peer.privateKeyJwk = structuredClone(sessionKeys.get(id));
    if (peer && !peer.signingKey && sessionCrypto.has(id)) peer.signingKey = sessionCrypto.get(id);
    if (peer?.migrationWrap && metaKeys.has(id) && !peer.privateKeyJwk) {
      try {
        const opened = await openJson(metaKeys.get(id), peer.migrationWrap);
        peer.privateKeyJwk = opened.privateKeyJwk;
      } catch { /* the wrap stays sealed */ }
    }
    if (peer?.kyc?.sealed && metaKeys.has(id)) {
      try {
        const opened = await openJson(metaKeys.get(id), peer.kyc.sealed);
        peer.kyc = { ...peer.kyc, ...opened };
      } catch { /* status stays readable */ }
    }
    return peer;
  },
  async set(id, value) {
    const signingKey = value?.signingKey;
    if (value) delete value.signingKey;
    const copy = structuredClone(value);
    if (signingKey) value.signingKey = signingKey;
    if (copy?.wallet?.ciphertext || copy?.keyVault) copy.privateKeyJwk = null;
    delete copy?.signingKey;
    if (copy?.kyc && metaKeys.has(id) && (copy.kyc.phone || copy.kyc.email || copy.kyc.salt)) {
      const sealed = await sealJson(metaKeys.get(id), {
        phone: copy.kyc.phone || '',
        email: copy.kyc.email || '',
        salt: copy.kyc.salt || ''
      });
      copy.kyc = { status: copy.kyc.status, displayName: copy.kyc.displayName, sealed };
    }
    await baseStore.set(id, copy);
  },
  async remove(id) {
    sessionKeys.delete(id);
    rememberedSecrets.delete(id);
    return baseStore.remove(id);
  },
  async listIds() {
    return baseStore.listIds();
  },
  async clear() {
    sessionKeys.clear();
    rememberedSecrets.clear();
    return baseStore.clear();
  }
};
const SEAT_KEY = 'lgme-sim:ui:seat';
const TABS = ['market', 'sources', 'circles', 'list', 'chats', 'wallet', 'help'];
const KNOWN = new Set([...TABS, 'books', 'exchange', 'devices', 'reconcile']);
const CATEGORIES = ['Goods', 'Services', 'Household', 'Food', 'Tools'];
const CONDITIONS = ['New', 'Good', 'Fair', 'For parts'];
const PICKUPS = ['Pickup', 'Porch', 'Meet'];
let pendingImport = '';
let carryAddress = '';
let activeCodeTimer = 0;
let windowTimer = 0;
let catalog = [];
let offerupItems = [];
let wantedMatches = [];
let thumbtackItems = [];
let dailyPicks = { updated: '', categories: [] };
let paymentMethods = {
  zelle: { recipient: '' },
  cash: { inPersonOnly: true },
  notice: 'Zelle and cash are not reversible-protected. This app does not process them.',
  loyalty: { ...sim.LOYALTY_DEFAULTS },
  peg: { band: sim.DEFAULT_CLAMP_BAND, holdDays: 7 },
  clearing: { windowDays: 7, epoch: '2026-01-01T00:00:00.000Z' }
};
let openTailored = '';
let offerupIndex = -1;
let openOfferFor = '';
let catalogMeta = { date: '', notice: '', method: '' };
let catalogNotice = `${REFERENCE_LABEL}. Reference only, not a price.`;
let busy = false;
let nameById = {};
let marketQuery = { q: '', kind: '', category: '', condition: '', pickup: '', circle: '', min: '', max: '' };
let openListingId = '';
let openThreadId = '';
let pendingChat = '';
let pendingInvoice = '';
let signedSms = null;
let matchNote = '';
let openCall = null;
let listStep = 1;
let listDraft = { photo: '', photoHash: '', title: '', category: 'Goods', condition: 'Good', pickup: 'Pickup', circle: '', area: '', amount: '', referenceId: '' };

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function setStatus(text, tone) {
  const el = document.getElementById('status');
  el.textContent = text || '';
  if (tone) el.dataset.tone = tone;
  else delete el.dataset.tone;
}

function tabName() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (raw.includes('lgme1.')) return 'devices';
  const name = raw.split('&')[0];
  if (name === 'resources' || name.startsWith('resources-')) return 'resources';
  return KNOWN.has(name) ? name : 'market';
}

function rememberSeat(id) {
  sessionStorage.setItem(SEAT_KEY, id);
}

function namesOf(peers) {
  return Object.fromEntries(peers.map((peer) => [peer.id, peer.name]));
}

function shortHash(value) {
  return value ? String(value).slice(0, 12) : '';
}

function option(value, label, selected) {
  const node = h('option', { value }, [label]);
  if (selected) node.selected = true;
  return node;
}

function peerOptions(peers, selected, placeholder) {
  const nodes = [];
  if (placeholder != null) nodes.push(option('', placeholder, !selected));
  for (const peer of peers) nodes.push(option(peer.id, peer.name, peer.id === selected));
  return nodes;
}

const CLUSTER_KEY = 'lgme-beta:cluster';

function solanaCluster() {
  return localStorage.getItem(CLUSTER_KEY) === 'devnet' ? 'devnet' : 'mainnet-beta';
}

function showSolanaPay(spec) {
  document.getElementById('solana-pay')?.remove();
  const overlay = h('div', { id: 'solana-pay', class: 'walk', role: 'dialog' });
  const recipient = h('input', { value: spec.recipient || '' });
  if (spec.donation) recipient.readOnly = true;
  const usd = h('input', { value: String(spec.amount || '') });
  usd.readOnly = true;
  const cluster = h('select', {}, [
    option('mainnet-beta', 'Mainnet', solanaCluster() === 'mainnet-beta'),
    option('devnet', 'Devnet test mode', solanaCluster() === 'devnet')
  ]);
  const preview = h('p', { class: 'legend', id: 'solana-request' }, ['Fetching the US$ price.']);
  const countdown = h('p', { id: 'quote-countdown' }, ['Price lock 15s']);
  const clampNote = h('p', { id: 'clamp-note' }, ['']);
  const link = h('a', { id: 'solana-link', href: '#', target: '_blank', rel: 'noopener noreferrer' }, ['Open in your wallet']);
  link.hidden = true;
  const chain = h('a', { id: 'solana-chain', href: '#', target: '_blank', rel: 'noopener noreferrer' }, ['View on Solscan']);
  chain.hidden = true;
  const qrHost = h('div', { id: 'solana-qr' });
  const altHost = h('div', { id: 'coin-alternatives' });
  let reference = '';
  let lock = null;
  let timer = 0;
  let lgmeAmount = 0;
  function stopClock() {
    if (timer) clearInterval(timer);
    timer = 0;
  }
  function paint() {
    if (!lock) return;
    preview.textContent = `US$ ${lock.usdAmount} · ${lock.lgmeAmount} $lgme · ${lock.priceSource} · ${lock.price} US$ per $lgme.`;
    const parts = [sim.PEG_NOTE];
    if (lock.history === 'history unavailable') parts.push('history unavailable');
    if (lock.clamped) parts.push(`Raw price ${lock.rawPrice}. Locked price ${lock.price}. Bands ${(lock.bounded || []).join(', ')}.`);
    clampNote.textContent = parts.join(' ');
  }
  function arm() {
    stopClock();
    const end = new Date(lock.expiresAt).getTime();
    const tick = async () => {
      const left = Math.max(0, end - Date.now());
      countdown.textContent = left > 0 ? `Price lock ${Math.ceil(left / 1000)}s` : 'The 15 second lock expired. Quoting again.';
      if (left > 0) return;
      stopClock();
      link.hidden = true;
      const previous = lock?.price;
      lock = null;
      lgmeAmount = 0;
      await pull(previous);
    };
    timer = setInterval(tick, 250);
    tick();
  }
  async function pull(previousPrice) {
    const priced = await quoteLgme();
    if (!priced.ok) { showBlocked(priced.error); return; }
    const opened = await sim.openQuote(store, spec.seat, {
      usdAmount: usd.value,
      price: priced.price,
      priceSource: priced.source,
      previousPrice: previousPrice || '',
      band: paymentMethods.peg?.band,
      rules: paymentMethods.peg,
      candles: priced.candles || [],
      history: priced.history || 'history unavailable',
      invoiceId: spec.invoiceId || '',
      otherId: spec.otherId || '',
      purpose: spec.purpose || 'settlement',
      navigator
    });
    if (!opened.ok) { showBlocked(opened.error); return; }
    lock = opened.lock;
    altHost.replaceChildren();
    paint();
    arm();
  }
  async function proposeAlt(choice, months) {
    const result = await sim.proposeAltSettlement(store, spec.seat, {
      choice,
      months,
      usdAmount: usd.value,
      invoiceId: spec.invoiceId || '',
      otherId: spec.otherId || '',
      navigator
    });
    preview.textContent = result.ok
      ? 'Your consent is signed. The other party still has to consent. Coin settlement stays closed.'
      : result.error;
  }
  function showBlocked(message) {
    stopClock();
    link.hidden = true;
    lock = null;
    preview.textContent = message || sim.NO_COIN;
    countdown.textContent = sim.NO_COIN;
    if (altHost.childElementCount) return;
    const months = h('select', {}, [3, 4, 5, 6].map((n) => option(String(n), `${n} month terms`, n === 3)));
    altHost.append(
      h('p', {}, ['Pay in terms is 3 to 6 month installments. Barter is an IprovIT service of the same US$ value. Both parties consent.']),
      field('Term length', months),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', id: 'pay-terms', onClick: () => proposeAlt('terms', months.value) }, ['Pay in terms']),
        h('button', { type: 'button', id: 'pay-barter', onClick: () => proposeAlt('barter') }, ['Barter'])
      ])
    );
  }
  overlay.append(h('article', { class: 'card' }, [
    h('h2', {}, ['Confirm $lgme payment']),
    h('p', {}, ['Beta. Real tokens. Irreversible. Start small. This page does not hold a Solana key.']),
    h('p', { id: 'peg-label' }, [sim.PEG_LABEL]),
    h('p', { id: 'peg-note' }, [sim.PEG_NOTE]),
    h('p', { class: 'legend' }, [`Mint ${MINT}`]),
    field('Amount in US$', usd),
    field(spec.donation ? 'Floor wallet @EgonAnon' : 'Payee Solana address', recipient),
    field('Network', cluster),
    preview,
    countdown,
    clampNote,
    chain,
    qrHost,
    altHost,
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: async () => {
        const provider = globalThis.phantom?.solana || globalThis.solflare || (globalThis.solana?.isPhantom ? globalThis.solana : null);
        if (!provider?.connect) { preview.textContent = 'Install Phantom or Solflare, or paste the public address. No seed phrase is used.'; return; }
        try {
          const connected = await withDeadline(provider.connect(), 15000, 'The wallet did not answer.');
          if (!connected.ok) { preview.textContent = 'The wallet was not connected.'; return; }
          const key = connected.value?.publicKey?.toString?.() || provider.publicKey?.toString?.() || '';
          if (!isValidPublicKey(key)) { preview.textContent = 'The wallet did not share a public address.'; return; }
          if (!spec.donation) recipient.value = key;
        } catch { preview.textContent = 'The wallet was not connected.'; }
      } }, ['Use this wallet']),
      h('button', { type: 'button', id: 'see-amount', onClick: async () => {
        if (!lock) { countdown.textContent = 'Wait for the price.'; return; }
        const seen = await sim.acknowledgeQuote(store, spec.seat, { lockId: lock.lockId, navigator });
        if (!seen.ok) {
          if (seen.requote) { await pull(lock.price); return; }
          countdown.textContent = seen.error;
          return;
        }
        countdown.textContent = 'You see this amount. The other party sees it on their seat before the wallet request.';
      } }, ['I see this amount']),
      h('button', { type: 'button', class: 'primary', id: 'solana-confirm', onClick: async () => {
        if (!lock) { countdown.textContent = 'Wait for the price.'; return; }
        localStorage.setItem(CLUSTER_KEY, cluster.value);
        const issued = await sim.issueSolanaRequest(store, spec.seat, { lockId: lock.lockId, navigator });
        if (!issued.ok) {
          if (issued.requote) {
            countdown.textContent = issued.error;
            const previous = lock.price;
            lock = null;
            link.hidden = true;
            await pull(previous);
            return;
          }
          countdown.textContent = issued.error;
          return;
        }
        reference = createReference();
        lgmeAmount = issued.lgmeAmount;
        const built = buildTransferRequest({
          recipient: recipient.value.trim(),
          amount: issued.lgmeAmount,
          reference,
          mint: MINT,
          label: 'lgme beta',
          message: `US$ ${issued.usdAmount}`
        });
        if (!built.ok) { preview.textContent = built.error; return; }
        preview.textContent = `US$ ${issued.usdAmount} is ${issued.lgmeAmount} $lgme. Your wallet signs it. Nothing is sent until then.`;
        link.href = built.url;
        link.hidden = false;
        qrHost.replaceChildren();
        if (globalThis.QRCode) new globalThis.QRCode(qrHost, { text: built.url, width: 180, height: 180 });
      } }, ['Open in wallet']),
      h('button', { type: 'button', id: 'solana-check', onClick: async (event) => {
        if (!reference || !lock) { preview.textContent = 'Open the wallet request first.'; return; }
        const button = event.currentTarget;
        if (button.disabled) return;
        button.disabled = true;
        let found;
        try {
          found = await findReferencePayment(cluster.value, reference, { mint: MINT, recipient: recipient.value.trim(), amount: lgmeAmount, tolerance: 0.02 });
        } finally {
          button.disabled = false;
        }
        if (!found.ok) { preview.textContent = found.error; return; }
        const recorded = spec.purpose === 'rebate'
          ? await sim.recordFloorRebate(store, spec.seat, {
            signature: found.signature,
            reference,
            invoiceId: spec.invoiceId,
            amount: lgmeAmount,
            lockId: lock.lockId,
            navigator
          })
          : await sim.recordSolanaTx(store, spec.seat, {
            signature: found.signature,
            reference,
            mint: MINT,
            amount: lgmeAmount,
            recipient: recipient.value.trim(),
            invoiceId: spec.invoiceId,
            otherId: spec.otherId,
            lockId: lock.lockId,
            purpose: spec.purpose || 'settlement',
            cluster: cluster.value,
            navigator
          });
        if (!recorded.ok) { preview.textContent = recorded.error; return; }
        chain.href = solscanHref(found.signature, cluster.value);
        chain.hidden = false;
        preview.textContent = spec.purpose === 'rebate'
          ? 'Floor rebate is on both tapes. Beta.'
          : 'Pending attestation. The payee still has to sign on their own seat. No invoice is paid yet.';
        setStatus(preview.textContent, 'ok');
        if (spec.purpose !== 'rebate') {
          const carried = await sim.sealSolanaHandoff(store, spec.seat, found.signature);
          if (carried.ok) {
            carryCode = carried.encoded;
            carryAddress = '';
          }
        }
        render();
      } }, ['Check payment']),
      link,
      h('button', { type: 'button', onClick: async () => {
        const owner = recipient.value.trim();
        const balance = await readTokenBalance(cluster.value, owner);
        preview.textContent = balance.ok ? `Read-only wallet balance: ${balance.amount} $lgme on ${cluster.value}.` : balance.error;
      } }, ['Read wallet balance']),
      h('button', { type: 'button', onClick: () => { stopClock(); overlay.remove(); } }, ['Close'])
    ])
  ]));
  document.body.append(overlay);
  pull();
}

function solscanHref(signature, cluster) {
  const base = `https://solscan.io/tx/${encodeURIComponent(signature)}`;
  return cluster === 'devnet' ? `${base}?cluster=devnet` : base;
}

async function attestPayment(seat, sample) {
  const found = await findReferencePayment(sample.cluster || solanaCluster(), sample.reference, {
    mint: MINT,
    recipient: sample.recipient,
    amount: sample.amount
  });
  if (!found.ok) { setStatus(found.error, 'bad'); return; }
  if (found.signature !== sample.signature) { setStatus('The finalized signature does not match this payment.', 'bad'); return; }
  const result = await sim.attestSolanaTx(store, seat, {
    ...sample,
    signature: found.signature,
    mint: MINT,
    navigator
  });
  if (!result.ok) { setStatus(result.error, 'bad'); return; }
  if (result.encoded) carryCode = result.encoded;
  setStatus(result.status === 'settled'
    ? 'Both parties signed. The invoice is paid. The Solana signature is final. Beta.'
    : 'Your attestation is signed. The other tape is final when that seat imports it. Beta.', result.status === 'settled' ? 'ok' : 'ok');
  await render();
}

async function refusePayment(seat, sample) {
  const result = await sim.refuseSolanaTx(store, seat, sample, 'REFUSAL');
  setStatus(result.ok ? 'Refusal recorded. No penalty. The invoice is not paid. Beta.' : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

async function solanaCards(seat) {
  const ids = await store.listIds();
  const full = [];
  for (const id of ids) {
    const peer = await store.get(id);
    if (peer) full.push(peer);
  }
  const grouped = new Map();
  for (const peer of full) {
    for (const entry of peer.tape || []) {
      if (entry.type !== 'SOLANA_TX' && entry.type !== 'SOLANA_REFUSAL' && entry.type !== 'SOLANA_FINAL') continue;
      const signature = entry.payload?.signature;
      if (!signature) continue;
      const rows = grouped.get(signature) || [];
      rows.push(entry.payload);
      grouped.set(signature, rows);
    }
    if (peer.id !== seat) continue;
    for (const body of Object.values(peer.solanaPending || {})) {
      if (!body?.signature) continue;
      const rows = grouped.get(body.signature) || [];
      rows.push(body);
      grouped.set(body.signature, rows);
    }
  }
  const mine = full.find((peer) => peer.id === seat);
  const cards = [];
  for (const [signature, rows] of grouped) {
    const sample = rows.find((row) => row.role === 'payer') || rows[0];
    if (sample.payerId !== seat && sample.payeeId !== seat) continue;
    const status = sim.solanaStatus(full, signature);
    const signedHere = (mine?.tape || []).some((entry) => entry.type === 'SOLANA_TX' && entry.payload?.signature === signature);
    const actions = [h('a', { href: solscanHref(signature, sample.cluster), target: '_blank', rel: 'noopener noreferrer' }, ['View on Solscan'])];
    if (sample.payeeId === seat && !signedHere && status === 'pending-attestation') {
      actions.push(h('button', { type: 'button', class: 'primary', id: 'solana-attest', onClick: () => attestPayment(seat, sample) }, ['Attest']));
      actions.push(h('button', { type: 'button', id: 'solana-refuse', onClick: () => refusePayment(seat, sample) }, ['Refuse']));
    }
    if (sample.payerId === seat && status === 'pending-attestation') {
      actions.push(h('button', { type: 'button', onClick: async () => {
        const carried = await sim.sealSolanaHandoff(store, seat, signature);
        if (!carried.ok) { setStatus(carried.error, 'bad'); return; }
        carryCode = carried.encoded;
        location.hash = 'devices';
      } }, ['Carry attestation']));
    }
    const sentence = status === 'settled'
      ? 'Both parties signed. The invoice is paid.'
      : status === 'refused'
        ? 'Refusal recorded. No penalty. The invoice is not paid.'
        : 'Pending attestation. Each party signs on their own seat.';
    cards.push(h('article', { class: 'card', id: 'solana-payment' }, [
      h('h3', {}, [`$lgme ${status}`]),
      h('p', {}, [`${sample.amount} $lgme to ${sample.recipient}. ${sentence}`]),
      h('div', { class: 'actions' }, actions)
    ]));
  }
  return cards;
}

function zelleLine() {
  const recipient = String(paymentMethods.zelle?.recipient || '').trim();
  return recipient ? `Zelle recipient: ${recipient}` : 'Zelle details: ask the recipient in chat / provided on request';
}

function showOffchainPay(spec) {
  document.getElementById('offchain-pay')?.remove();
  const overlay = h('div', { id: 'offchain-pay', class: 'walk', role: 'dialog' });
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', inputmode: 'decimal', value: String(spec.amount || '') });
  const paidAt = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });
  const confirmation = h('input', { maxlength: '80', autocomplete: 'off', placeholder: 'Zelle confirmation number' });
  const note = h('input', { maxlength: '240', placeholder: 'Handoff note' });
  const fees = h('input', { maxlength: '240', placeholder: 'Optional. No fee is calculated.' });
  const file = h('input', { type: 'file', accept: 'image/*,.pdf' });
  const preview = h('p', { class: 'legend' }, [spec.method === 'cash'
    ? 'Cash is in person only. Do not mail cash.'
    : zelleLine()]);
  const form = h('form', {}, [
    h('h2', {}, [spec.method === 'cash' ? 'Pay with cash' : 'Pay with Zelle']),
    h('p', {}, [paymentMethods.notice || 'Zelle and cash are not reversible-protected. This app does not process them.']),
    h('p', {}, [sim.FIAT_FEE_NOTE]),
    h('p', {}, ['The file stays on this device. The tape stores only its SHA-256 fingerprint. Nothing is uploaded.']),
    field('Amount', amount),
    field('Date', paidAt),
    field('Statutory fees / notes', fees),
    spec.method === 'zelle' ? field('Zelle confirmation number', confirmation) : null,
    field(spec.method === 'cash' ? 'Handoff note' : 'Note, optional', note),
    field(spec.method === 'cash' ? 'Receipt photo, optional' : 'Screenshot, optional', file),
    preview,
    h('div', { class: 'actions' }, [
      h('button', { class: 'primary', type: 'submit' }, ['Record proof']),
      h('button', { type: 'button', onClick: () => overlay.remove() }, ['Close'])
    ])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    let proofHash = '';
    const chosen = file.files && file.files[0];
    if (chosen) {
      proofHash = await sim.hashBytes(new Uint8Array(await chosen.arrayBuffer()));
    }
    const recorded = await sim.recordOffchainPayment(store, spec.seat, {
      method: spec.method,
      amount: amount.value,
      paidAt: paidAt.value,
      confirmation: confirmation.value,
      note: note.value,
      statutoryFees: fees.value,
      proofHash,
      invoiceId: spec.invoiceId || '',
      offerId: spec.offerId || '',
      otherId: spec.otherId || '',
      navigator
    });
    if (!recorded.ok) { preview.textContent = recorded.error; return; }
    const carried = await sim.sealOffchainHandoff(store, spec.seat, recorded.payload.paymentId);
    if (carried.ok) carryCode = carried.encoded;
    setStatus('Pending attestation. The payee still has to sign. Nothing is counted yet. Beta.', 'ok');
    overlay.remove();
    render();
  });
  overlay.append(h('article', { class: 'card' }, [form]));
  document.body.append(overlay);
}

function pendingCountFor(peer, id) {
  const row = (peer?.highValue || []).find((item) => item.id === id && item.status === 'pending');
  return row ? (row.attestations || []).length : (peer?.highValue || []).filter((item) => item.status === 'pending').length;
}

function printReceipt(receipt) {
  const view = window.open('', 'lgme-receipt');
  if (!view) { setStatus('Allow a window to print the receipt. Beta.', 'bad'); return; }
  const doc = view.document;
  doc.title = 'IdidIt (verified receipt)';
  const add = (tag, text) => {
    const node = doc.createElement(tag);
    node.textContent = text;
    doc.body.append(node);
  };
  add('h1', 'IdidIt (verified receipt)');
  add('p', receipt.thanks);
  add('p', `${receipt.method} ${receipt.amount} on ${receipt.paidAt}`);
  add('p', receipt.confirmation ? `Confirmation ${receipt.confirmation}` : 'No Zelle confirmation on this receipt.');
  add('p', receipt.proofHash ? `Proof fingerprint ${receipt.proofHash}` : 'No file fingerprint on this receipt.');
  add('p', `Payer signature ${receipt.payerSig}`);
  add('p', `Payee signature ${receipt.payeeSig}`);
  add('p', `Statutory fees / notes: ${receipt.statutoryFees || ''}`);
  add('p', sim.FIAT_FEE_NOTE);
  add('p', 'Zelle and cash are not reversible-protected. This app does not process them.');
  if (Number(receipt.amount) > 100) add('p', 'Needs 3 attestations (over $100).');
  view.focus();
  view.print();
}

async function floorRebateSection(seat) {
  const ids = await store.listIds();
  const full = [];
  for (const id of ids) {
    const peer = await store.get(id);
    if (peer) full.push(peer);
  }
  const paid = new Set();
  const dues = [];
  for (const peer of full) {
    for (const entry of peer.tape || []) {
      if (entry.type === 'FLOOR_REBATE_PAID') paid.add(entry.payload?.invoiceId);
      if (entry.type === 'FLOOR_REBATE_DUE') dues.push(entry.payload);
    }
  }
  const seen = new Set();
  const cards = [];
  for (const row of dues) {
    if (!row?.invoiceId || seen.has(row.invoiceId) || paid.has(row.invoiceId)) continue;
    seen.add(row.invoiceId);
    const wallet = h('input', { value: row.payerWallet || '', maxlength: '64', placeholder: 'Payer Solana address' });
    const preview = h('p', { class: 'legend' }, [sim.FLOOR_REBATE_LABEL]);
    cards.push(h('article', { class: 'card', id: 'floor-rebate-due' }, [
      h('h3', {}, [`Rebate due US$ ${row.usdAmount || row.amount}`]),
      h('p', {}, [sim.FLOOR_REBATE_LABEL]),
      h('p', { class: 'legend' }, ['From @EgonAnon 6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY. This desk holds no floor key.']),
      field('Payer address', wallet),
      preview,
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', onClick: async () => {
          const priced = await quoteLgme();
          const balance = await readTokenBalance(solanaCluster(), DONATION_ADDRESS);
          if (!balance.ok) { preview.textContent = balance.error; return; }
          const review = await sim.reviewFloorRebate(store, seat, {
            invoiceId: row.invoiceId,
            balance: balance.amount,
            price: priced.ok ? priced.price : 0,
            payerWallet: wallet.value.trim(),
            navigator
          });
          if (!review.ok) { preview.textContent = review.error; return; }
          if (review.status === 'deferred') {
            preview.textContent = 'Deferred. The floor reserve stays in place. No penalty.';
            render();
            return;
          }
          if (!priced.ok) { preview.textContent = priced.error; return; }
          if (!isValidPublicKey(wallet.value.trim())) { preview.textContent = 'Enter the payer Solana address.'; return; }
          preview.textContent = `Floor balance ${balance.amount} $lgme. Rebate US$ ${review.amount}. ${sim.PEG_NOTE}`;
          showSolanaPay({
            seat,
            amount: review.amount,
            invoiceId: row.invoiceId,
            otherId: row.payerId,
            recipient: wallet.value.trim(),
            purpose: 'rebate'
          });
        } }, ['Read floor balance'])
      ])
    ]));
  }
  return [
    h('h3', {}, ['Floor rebates due']),
    h('p', { class: 'legend' }, [sim.FLOOR_REBATE_LABEL]),
    ...cards,
    cards.length ? null : h('p', { class: 'empty' }, ['No floor rebate is waiting.'])
  ];
}

async function offchainCards(seat) {
  const ids = await store.listIds();
  const full = [];
  for (const id of ids) {
    const peer = await store.get(id);
    if (peer) full.push(peer);
  }
  const grouped = new Map();
  for (const peer of full) {
    for (const entry of peer.tape || []) {
      if (entry.type !== 'OFFCHAIN_TX' && entry.type !== 'OFFCHAIN_REFUSAL' && entry.type !== 'OFFCHAIN_FINAL') continue;
      const paymentId = entry.payload?.paymentId;
      if (!paymentId) continue;
      grouped.set(paymentId, entry.payload);
    }
    if (peer.id !== seat) continue;
    for (const body of Object.values(peer.offchainPending || {})) {
      if (body?.paymentId) grouped.set(body.paymentId, body);
    }
  }
  const mine = full.find((peer) => peer.id === seat);
  const cards = [];
  for (const [paymentId, sample] of grouped) {
    if (sample.payerId !== seat && sample.payeeId !== seat) continue;
    const status = sim.offchainStatus(full, paymentId);
    const signedHere = (mine?.tape || []).some((entry) => entry.type === 'OFFCHAIN_TX' && entry.payload?.paymentId === paymentId);
    const actions = [];
    if (sample.payeeId === seat && !signedHere && status === 'pending-attestation') {
      actions.push(h('button', { type: 'button', class: 'primary', id: 'offchain-attest', onClick: async () => {
        const result = await sim.attestOffchainPayment(store, seat, { ...sample, navigator });
        setStatus(result.ok && result.status === 'settled'
          ? 'Both parties signed. The invoice is paid. Beta.'
          : result.ok ? 'Your attestation is signed. Beta.' : result.error, result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Attest']));
      actions.push(h('button', { type: 'button', id: 'offchain-refuse', onClick: async () => {
        const result = await sim.refuseOffchainPayment(store, seat, sample, 'REFUSAL');
        setStatus(result.ok ? 'Refusal recorded. No penalty. The invoice is not paid. Beta.' : result.error, result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Refuse']));
    }
    if (status === 'settled') {
      actions.push(h('button', { type: 'button', onClick: () => {
        const receipt = sim.offchainReceipt(full, paymentId);
        if (!receipt.ok) { setStatus(receipt.error, 'bad'); return; }
        download(`offchain-${paymentId.slice(0, 12)}.json`, JSON.stringify(receipt, null, 2), 'application/json');
      } }, ['Download receipt']));
      actions.push(h('button', { type: 'button', onClick: () => {
        const receipt = sim.offchainReceipt(full, paymentId);
        if (!receipt.ok) { setStatus(receipt.error, 'bad'); return; }
        printReceipt(receipt);
      } }, ['Print receipt']));
    }
    const verify = h('input', { type: 'file', accept: 'image/*,.pdf' });
    verify.addEventListener('change', async () => {
      const chosen = verify.files && verify.files[0];
      if (!chosen || !sample.proofHash) { setStatus('There is no file fingerprint on this proof. Beta.', 'bad'); return; }
      const hash = await sim.hashBytes(new Uint8Array(await chosen.arrayBuffer()));
      setStatus(hash === sample.proofHash ? 'The fingerprint matches. Nothing was uploaded. Beta.' : 'Not authentic. Beta.', hash === sample.proofHash ? 'ok' : 'bad');
    });
    cards.push(h('article', { class: 'card', id: 'offchain-payment' }, [
      h('h3', {}, [`${sample.method} ${status}`]),
      h('p', {}, [`${sample.amount} on ${sample.paidAt}. ${status === 'settled' ? 'Both parties signed.' : status === 'refused' ? 'Refusal recorded. No penalty.' : 'Pending attestation. The payee still has to sign.'}`]),
      sample.proofHash ? h('p', { class: 'legend' }, [`Fingerprint ${sample.proofHash.slice(0, 12)}`]) : null,
      sample.proofHash ? field('Verify the file again', verify) : null,
      h('div', { class: 'actions' }, actions)
    ]));
  }
  return cards;
}

function field(label, control) {
  const id = control.id || `f-${Math.random().toString(36).slice(2, 8)}`;
  control.id = id;
  return h('div', {}, [h('label', { for: id }, [label]), control]);
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function ensureBooks() {
  const peers = await sim.listPeers(store);
  if (peers.length) return peers;
  await sim.resetAndSeed(store);
  return sim.listPeers(store);
}

function currentSeat(peers) {
  const saved = sessionStorage.getItem(SEAT_KEY);
  if (peers.some((peer) => peer.id === saved)) return saved;
  return peers[0] ? peers[0].id : '';
}

function formatBalances(balances) {
  return Object.entries(balances).map(([id, balance]) => `${nameById[id] || id} ${balance}`).join(' · ');
}

let rendering = false;
let renderQueued = false;

async function render() {
  if (rendering) {
    renderQueued = true;
    return;
  }
  rendering = true;
  try {
    do {
      renderQueued = false;
      await renderNow();
    } while (renderQueued);
  } finally {
    rendering = false;
  }
}

function clearingRulesNow() {
  return {
    windowDays: Number(paymentMethods.clearing?.windowDays || paymentMethods.peg?.holdDays || 7),
    epoch: paymentMethods.clearing?.epoch || '2026-01-01T00:00:00.000Z'
  };
}

function windowBanner() {
  const host = h('p', { class: 'legend', id: 'clearing-window' }, ['']);
  const tick = () => {
    const window = sim.clearingWindow(new Date().toISOString(), clearingRulesNow());
    const ms = window.remainingMs;
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    host.textContent = `Clearing window ${window.windowId} · closes ${window.closesAt.slice(0, 16).replace('T', ' ')} UTC · ${days}d ${hours}h ${mins}m left.`;
  };
  tick();
  windowTimer = setInterval(tick, 30000);
  return host;
}

async function renderNow() {
  if (activeCodeTimer) {
    clearInterval(activeCodeTimer);
    activeCodeTimer = 0;
  }
  if (windowTimer) {
    clearInterval(windowTimer);
    windowTimer = 0;
  }
  const peers = await ensureBooks();
  if (renderQueued) return;
  nameById = namesOf(peers);
  const seat = currentSeat(peers);
  renderSeats(peers, seat);
  renderTabs();
  const tab = tabName();
  if (tab === 'market') await renderMarket(peers, seat);
  else if (tab === 'sources') await renderSources();
  else if (tab === 'circles') await renderCircles();
  else if (tab === 'list') await renderList(seat);
  else if (tab === 'chats') await renderChats(seat);
  else if (tab === 'books') await renderBooks(peers, seat);
  else if (tab === 'reconcile') await renderReconcile(peers, seat);
  else if (tab === 'wallet') await renderWallet(peers, seat);
  else if (tab === 'devices') await renderDevices(peers, seat);
  else if (tab === 'help') renderHelp();
  else if (tab === 'resources') renderResources();
  else await renderExchange(peers, seat);
}

function renderSeats(peers, seat) {
  const bar = document.getElementById('seatbar');
  bar.replaceChildren();
  for (const peer of peers) {
    const button = h('button', {
      type: 'button',
      class: 'seat',
      'aria-pressed': peer.id === seat ? 'true' : 'false'
    }, [
      peer.name,
      h('small', {}, [`${peer.balance} $lgme · floor ${peer.floor}${peer.locked ? ' · locked' : ''}`]),
      h('span', { class: peer.kyc === 'VERIFIED' ? 'badge badge-verified' : 'badge badge-unverified' }, [peer.kyc === 'VERIFIED' ? 'Verified' : 'Unverified'])
    ]);
    button.addEventListener('click', () => {
      rememberSeat(peer.id);
      setStatus(`Acting as ${peer.name}. This is ${peer.name}'s book only.`);
      render();
    });
    bar.append(button);
  }
  bar.append(h('button', { type: 'button', class: 'seat', onClick: () => renderAddPeer(peers) }, ['Register', h('small', {}, ['Opening grant of 100 $lgme'])]));
  bar.append(h('button', { type: 'button', class: 'seat', onClick: resetDemo }, ['Reset', h('small', {}, ['Clears local books on this device'])]));
}

function selectTab(name) {
  if (location.hash.includes('lgme1.')) pendingImport = location.hash.slice(location.hash.indexOf('lgme1.'));
  if (name === 'market') openListingId = '';
  if (name === 'chats') openThreadId = '';
  if (location.hash.replace(/^#/, '') === name) render();
  else location.hash = name;
}

function renderTabs() {
  const tab = tabName();
  const phoneTab = ['reconcile', 'books', 'devices', 'exchange'].includes(tab) ? 'wallet' : tab === 'resources' ? 'help' : tab;
  const due = dueRequests(sourceBook().requests, Date.now()).length;
  const badge = document.getElementById('source-badge');
  if (badge) {
    badge.hidden = due === 0;
    badge.textContent = String(due);
  }
  for (const name of TABS) {
    const button = document.getElementById(`tab-${name}`);
    button.setAttribute('aria-selected', name === tab ? 'true' : 'false');
    button.onclick = () => selectTab(name);
  }
  document.querySelectorAll('.tabbar button').forEach((button) => {
    button.setAttribute('aria-selected', button.dataset.tab === phoneTab ? 'true' : 'false');
  });
}

function renderAddPeer(peers) {
  const panel = document.getElementById('panel');
  const name = h('input', { required: true, maxlength: '48', autocomplete: 'off' });
  const floor = h('input', { type: 'number', step: '0.01', value: '40' });
  const limit = h('input', { type: 'number', step: '0.01', value: '-200' });
  const passphrase = h('input', { type: 'password', minlength: '8', autocomplete: 'new-password', required: true });
  const form = h('form', { class: 'grid two' }, [
    field('Name', name),
    field('Floor', floor),
    field('Credit limit', limit),
    field('Passphrase, at least 8 characters', passphrase),
    h('div', { class: 'actions' }, [
      h('button', { type: 'submit', class: 'primary' }, ['Register']),
      h('button', { type: 'button', class: 'quiet', onClick: () => render() }, ['Cancel'])
    ])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const id = sim.slugPeerId(name.value, peers.map((peer) => peer.id));
      const created = await sim.registerPeer(store, {
        id,
        name: name.value.trim(),
        floor: floor.value,
        creditLimit: limit.value
      });
      if (!created.ok) {
        setStatus(created.error, 'bad');
        return;
      }
      const setup = await sim.setupWallet(store, id, passphrase.value);
      if (!setup.ok) {
        setStatus(setup.error, 'bad');
        return;
      }
      rememberedSecrets.set(id, setup.secretBase32);
      const code = await liveCode(setup.secretBase32);
      const stored = await baseStore.get(id);
      const opened = await sim.unlockWallet(stored, passphrase.value, code, Math.floor(Date.now() / 1000));
      if (opened.ok) sessionKeys.set(id, opened.privateKeyJwk);
      rememberSeat(id);
      setStatus(`${name.value.trim()} has an opening grant of 100 $lgme on a GENESIS line. The key is locked. Scan the wallet code, then unlock with the passphrase and the 6-digit code.`, 'ok');
      location.hash = 'wallet';
      await render();
    } finally {
      busy = false;
    }
  });
  panel.replaceChildren(
    h('h2', {}, ['Register']),
    h('p', { class: 'muted' }, ['A new peer receives a local grant of 100 on this book. It is written as a GENESIS line. It is not Solana $lgme. The book key is then encrypted with the passphrase.']),
    form
  );
}

async function resetDemo() {
  if (busy) return;
  if (!confirm('Reset? This clears the local books on this device. It does not move Solana $lgme.')) return;
  busy = true;
  try {
    await sim.resetAndSeed(store);
    rememberSeat('alice');
    setStatus('Local books restored on this device. The market has a few listings, one open counter, and one pending handoff. Nothing in the market has settled.', 'ok');
    openListingId = '';
    openThreadId = '';
    if (location.hash && location.hash !== '#market') location.hash = 'market';
    else await render();
  } finally {
    busy = false;
  }
}

function basisOptions(item) {
  const nodes = [];
  if (item.hourly_avg != null) nodes.push(option('hour', 'Per hour', false));
  if (item.job_avg != null) nodes.push(option('job', item.unit === 'visit' ? 'Per visit' : 'Per job', false));
  if (!nodes.length && item.avg_value_usd != null) nodes.push(option('unit', `Per ${item.unit}`, true));
  if (item.job_avg != null) nodes.find((node) => node.value === 'job').selected = true;
  else if (nodes[0]) nodes[0].selected = true;
  return nodes;
}

function activeAvg(item, basis) {
  if (!item) return null;
  if (basis === 'hour') return item.hourly_avg;
  if (basis === 'job') return item.job_avg;
  return item.avg_value_usd;
}

function referenceDetail(item) {
  if (!item) return catalogNotice;
  const line = referenceLine(item, catalogMeta);
  const note = item.note ? ` ${item.note}` : '';
  return `${line.text} Reference only, not a price.${note}`;
}

function referenceCatalogCard() {
  const rows = catalog.map((item) => {
    const line = referenceLine(item, catalogMeta);
    return h('li', {}, [
      h('strong', {}, [`${line.name}: ${line.value}`]),
      h('span', { class: 'legend' }, [` As of ${line.asOf}. Sources: ${line.sources}.`])
    ]);
  });
  return h('details', { id: 'dc-reference', open: true, class: 'card' }, [
    h('summary', {}, [REFERENCE_LABEL]),
    h('p', { class: 'legend' }, [catalogNotice]),
    rows.length ? h('ul', {}, rows) : h('p', {}, ['pending'])
  ]);
}

function campusGroup() {
  try { return localStorage.getItem('lgme.exchange.group') || ''; } catch { return ''; }
}

async function goodDeedPanel(peers, me) {
  const books = [];
  for (const row of peers) {
    const full = await store.get(row.id);
    if (full) books.push(full);
  }
  const ranked = sim.rankCategories(sim.projectSubfloors(books));
  const category = h('select', {}, ['tutoring', 'repair', 'cleanup', 'gear', 'health-fitness'].map((name, index) => option(name, name === 'health-fitness' ? 'Health & fitness' : name, index === 0)));
  const postType = h('select', {}, [
    option('IwantIT', 'IwantIT · request', false),
    option('IhavIT', 'IhavIT · offer', false),
    option('IselIT', 'IselIT · priced sale', true),
    option('soBeIT', 'soBeIT · donation', false)
  ]);
  const list = h('input', { type: 'number', min: '0', step: '0.01', value: '10' });
  const price = h('input', { type: 'number', min: '0', step: '0.000001', value: '1' });
  const discount = h('input', { type: 'number', min: '0', step: '0.01', value: '0' });
  const who = h('input', { value: '', placeholder: 'Their handle', maxlength: '32' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password' });
  const code = h('input', { inputmode: 'numeric', maxlength: '8', autocomplete: 'one-time-code' });
  const form = h('form', { id: 'good-deed', class: 'grid two' }, [
    field('Category', category),
    field('Post', postType),
    field('US$ value', list),
    field('$lgme price in US$', price),
    field('Discount US$', discount),
    field('Their handle', who),
    field('Passphrase', pass),
    field('6-digit code', code),
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Post deed'])])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await sim.postDeed(store, me.id, {
      category: category.value,
      postType: postType.value,
      listUsd: list.value,
      priceUsd: postType.value === 'soBeIT' && Number(list.value) === 0 ? 0 : list.value,
      unitValueUsd: list.value,
      priceUsdPerLgme: price.value,
      discountUsd: discount.value,
      counterpartyId: who.value.trim(),
      passphrase: pass.value,
      code: code.value,
      unixSeconds: Math.floor(Date.now() / 1000)
    });
    if (!result.ok) { setStatus(result.error, 'bad'); return; }
    const over = Number(list.value) > 100;
    const note = result.donationRequest
      ? 'A zero price became a donation request for the locked unit.'
      : result.discountPaused
        ? 'Discount paused. The category pool is empty, so the main floor is not used.'
        : over
          ? 'Deed posted. Needs 3 attestations (over $100). Suggested third attester: group administrator. A payout waits for both parties and those three signatures.'
          : 'Deed posted. The unit US$ is locked. A payout waits for both signatures.';
    setStatus(note, 'ok');
    await render();
  });
  const rows = ranked.length
    ? ranked.map((row) => h('p', { class: 'legend' }, [`${row.category}: ${row.requests} requests, ${row.completed} deeds, pool ${row.balance} $lgme`]))
    : [h('p', { class: 'legend' }, ['No category pool yet. A sale skims 1%. Donations fill the rest.'])];
  return h('section', { id: 'good-deeds-desk' }, [
    h('h3', {}, ['Good deeds']),
    h('p', { class: 'legend', id: 'attestation-rule' }, ['Needs 3 attestations (over $100). At or below that, both parties still confirm. Suggested third attester: group administrator. Pending attestations are counted, not ranked.']),
    h('p', { class: 'legend' }, ['Each deed locks its own US$ value. The buyer pays the price. The provider receives 99%. One percent fills that category’s pool, under the main floor. Not written to Hedera.']),
    h('p', {}, [h('a', { href: '/good-deeds' }, ['Every good deed deserves another'])]),
    ...rows,
    form
  ]);
}

function hederaHost(peer) {
  const day = new Date().toISOString().slice(0, 10);
  const leaves = (peer.tape || []).filter((entry) => String(entry.at || '').slice(0, 10) === day).map((entry) => entry.hash);
  const host = h('div', { id: 'hedera-anchor' });
  queueMicrotask(() => { mountHederaAnchor(host, { leaves, day }); });
  return host;
}

function emailHost() {
  const host = h('div', { id: 'email-check' });
  queueMicrotask(() => { mountEmailCheck(host); });
  return host;
}

function campusDeedPanel(peers, me, full) {
  const params = new URLSearchParams(location.search);
  const asked = (params.get('what') || '').toLowerCase();
  const startKind = asked.includes('clean') ? 'cleanup' : asked.includes('gear') || asked.includes('tool') ? 'gear' : 'tutoring';
  const kind = h('select', {}, [
    option('tutoring', 'Tutoring', startKind === 'tutoring'),
    option('cleanup', 'Campus cleanup', startKind === 'cleanup'),
    option('gear', 'Gear share', startKind === 'gear')
  ]);
  const receiver = h('input', { value: params.get('who') || '', placeholder: 'Their handle', maxlength: '32' });
  const hours = h('input', { type: 'number', min: '0.25', step: '0.25', value: '1' });
  const third = h('select', {}, peerOptions(peers, '', 'No third seat'));
  const pass = h('input', { type: 'password', autocomplete: 'current-password' });
  const code = h('input', { inputmode: 'numeric', maxlength: '8', autocomplete: 'one-time-code' });
  const form = h('form', { id: 'deed-log', class: 'grid two' }, [
    field('Deed', kind),
    field('Their handle', receiver),
    field('Hours', hours),
    field('Third Seat · your seat', third),
    field('Passphrase', pass),
    field('6-digit code', code),
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Log deed'])])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await sim.logCampusDeed(store, me.id, {
      group: 'campus',
      kind: kind.value,
      receiverId: receiver.value.trim(),
      hours: hours.value,
      thirdSeatId: third.value || null,
      capMax: 100,
      passphrase: pass.value,
      code: code.value,
      unixSeconds: Math.floor(Date.now() / 1000)
    });
    if (!result.ok) { setStatus(result.error, 'bad'); return; }
    setStatus('Deed logged. It becomes an IdidIt (verified receipt) when they attest. No coin. Not on Hedera.', 'ok');
    await render();
  });
  const deeds = Object.values(full?.campusDeeds || {});
  const rows = deeds.map((deed) => {
    const actions = [];
    if (deed.status === 'pending' && deed.receiverId === me.id) {
      actions.push(h('button', { type: 'button', class: 'primary', onClick: async () => {
        const result = await sim.attestCampusDeed(store, me.id, deed.deedId, { passphrase: pass.value, code: code.value, unixSeconds: Math.floor(Date.now() / 1000) });
        setStatus(result.ok ? 'IdidIt (verified receipt). 1 campus credit. Not $lgme. Not on Hedera.' : result.error, result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Attest']));
    }
    if (deed.status !== 'vetoed' && deed.thirdSeatId === me.id) {
      actions.push(h('button', { type: 'button', onClick: async () => {
        const result = await sim.vetoCampusDeed(store, me.id, deed.deedId, 'Skipped the order', { passphrase: pass.value, code: code.value, unixSeconds: Math.floor(Date.now() / 1000) });
        setStatus(result.ok ? 'Veto recorded. No credit moves.' : result.error, result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Veto']));
    }
    return h('article', { class: 'row' }, [
      h('p', {}, [`${deed.kind} · ${deed.hours} h · ${deed.giverId} → ${deed.receiverId}`]),
      h('p', { class: 'legend' }, [deed.status === 'verified' ? 'IdidIt (verified receipt)' : (deed.status || 'pending')]),
      actions.length ? h('div', { class: 'actions' }, actions) : null
    ]);
  });
  const credits = Object.values(full?.campusCredits || {}).filter((row) => row.holderId === me.id && row.status === 'open');
  const redeemOffer = h('select', {}, [
    option('tutoring', 'Tutoring hour', true),
    option('cleanup', 'Campus cleanup', false),
    option('gear', 'Gear / tool loan', false)
  ]);
  const redeem = credits.map((row) => h('div', { class: 'actions' }, [
    h('button', { type: 'button', onClick: async () => {
      const result = await sim.redeemCampusCredit(store, me.id, row.creditId, {
        offerId: redeemOffer.value,
        offers: ['tutoring', 'cleanup', 'gear'],
        passphrase: pass.value,
        code: code.value,
        unixSeconds: Math.floor(Date.now() / 1000)
      });
      setStatus(result.ok ? '1 campus credit used once. Not $lgme.' : result.error, result.ok ? 'ok' : 'bad');
      if (result.ok) await render();
    } }, [`Redeem 1 credit · ${row.kind}`])
  ]));
  return h('section', { id: 'campus-deed' }, [
    h('h3', {}, ['Campus deed']),
    h('p', { class: 'legend' }, [campusGroup() === 'health-club' ? 'You are in the health club community. One verified deed is one club credit. Not $lgme. Not on Hedera.' : campusGroup() === 'campus' ? 'You are in the campus pilot. One verified deed is one campus credit. Not $lgme. Not on Hedera.' : 'Log a deed for the health club, or open the campus pilot from Other pilots.']),
    emailHost(),
    form,
    h('p', { class: 'legend' }, ['Redeem inside the pilot']),
    redeemOffer,
    ...redeem,
    ...rows
  ]);
}

async function renderExchange(peers, seat) {
  const panel = document.getElementById('panel');
  const me = peers.find((peer) => peer.id === seat);
  const full = await store.get(seat);
  const kind = h('select', {}, [option('bilateral', 'Bilateral', true), option('cycle', 'Multi-party cycle', false)]);
  const bilateral = renderBilateral(peers, me);
  const cycle = renderCycle(peers, me);
  cycle.hidden = true;
  kind.addEventListener('change', () => {
    bilateral.hidden = kind.value !== 'bilateral';
    cycle.hidden = kind.value !== 'cycle';
  });
  const open = Object.values(full.exchanges || {}).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
  const goodDeeds = await goodDeedPanel(peers, me);
  panel.replaceChildren(
    h('h2', {}, [`Exchange · ${me.name}`]),
    goodDeeds,
    campusDeedPanel(peers, me, full),
    windowBanner(),
    h('p', { class: 'muted' }, ['You are acting as this peer. Switch seats to countersign, to refuse, or to veto as the named third seat. A proposal is not a debt until the other parties countersign.']),
    referenceCatalogCard(),
    h('h3', {}, ['Lines on this book']),
    open.length ? h('div', {}, open.map((ex) => exchangeCard(ex, full, peers))) : h('p', { class: 'muted' }, ['No exchanges on this book yet.']),
    h('h3', {}, ['Propose a line']),
    field('Kind of line', kind),
    bilateral,
    cycle
  );
}

function renderBilateral(peers, me) {
  const debtor = h('select', {}, peerOptions(peers, me.id));
  const creditor = h('select', {}, peerOptions(peers, peers.find((peer) => peer.id !== me.id)?.id || ''));
  const third = h('select', {}, peerOptions(peers, '', 'None'));
  const reference = h('input', { required: true, maxlength: '160', value: '' });
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', value: '10', required: true, inputmode: 'decimal' });
  const charge = h('input', { type: 'number', min: '0', step: '0.01', value: '0' });
  const refItem = h('select', {}, [option('', 'None', true)]);
  for (const item of catalog) {
    refItem.append(option(item.id, optionLabel(item, catalogMeta), false));
  }
  const refBasis = h('select', {});
  const refQty = h('input', { type: 'number', min: '0.01', step: '0.01', value: '1' });
  const refDetail = h('p', { class: 'legend' }, [catalogNotice]);
  const refWrap = h('div', { class: 'grid three' }, [
    field('Basis', refBasis),
    field('Hours or quantity', refQty)
  ]);
  refWrap.hidden = true;
  const preview = h('p', { class: 'legend' }, ['']);
  const form = h('form', {}, [
    h('div', { class: 'grid three' }, [
      field('Debtor', debtor),
      field('Creditor', creditor),
      field('Third Seat · your seat', third)
    ]),
    field('Work', reference),
    h('div', { class: 'grid three' }, [
      field('Amount', amount),
      field('Named charge, before any signature', charge)
    ]),
    field('Reference value (optional)', refItem),
    h('p', { class: 'legend' }, [`${REFERENCE_LABEL}. Reference only, not a price. The amount on the line is what would settle.`]),
    refWrap,
    refDetail,
    preview,
    h('div', { class: 'actions' }, [h('button', { type: 'submit', class: 'primary' }, ['Propose'])])
  ]);

  async function refreshPreview() {
    const debtorPeer = await store.get(debtor.value);
    const figure = sim.round2(amount.value);
    if (!debtorPeer || !Number.isFinite(figure)) {
      preview.textContent = '';
      return;
    }
    const current = sim.replay(debtorPeer).balance;
    const next = sim.applyLegs(current, debtorPeer.id, [{ debtorId: debtor.value, creditorId: creditor.value, amount: figure }]).balance;
    const reason = sim.floorBlockReason(debtorPeer, next);
    const rule = sim.terms(debtorPeer);
    preview.textContent = reason
      ? `${reason}. ${debtorPeer.name} would go from ${current} to ${next}. Floor ${rule.floor} stays senior.`
      : `${debtorPeer.name} would go from ${current} to ${next}. Floor ${rule.floor}. This is a preview, not a settlement.`;
    preview.className = reason ? 'bad' : 'legend';
  }

  function applyReference() {
    const item = catalog.find((row) => row.id === refItem.value);
    refBasis.replaceChildren();
    if (!item || item.avg_value_usd == null) {
      refWrap.hidden = true;
      refDetail.textContent = item ? referenceDetail(item) : catalogNotice;
      return;
    }
    refWrap.hidden = false;
    refBasis.replaceChildren(...basisOptions(item));
    const avg = activeAvg(item, refBasis.value);
    const qty = Number(refQty.value);
    if (avg == null || !Number.isFinite(qty) || qty <= 0) {
      refDetail.textContent = 'Reference only, not a price. Enter a quantity.';
      return;
    }
    const suggested = sim.round2(avg * qty);
    amount.value = String(suggested);
    if (!reference.value.trim()) reference.value = item.name;
    const line = referenceLine(item, catalogMeta);
    refDetail.textContent = `${line.text} Reference only, not a price. ${avg} × ${qty} = ${suggested}. The line amount can still be edited.`;
    refreshPreview();
  }

  refItem.addEventListener('change', applyReference);
  refBasis.addEventListener('change', applyReference);
  refQty.addEventListener('input', applyReference);
  debtor.addEventListener('change', refreshPreview);
  creditor.addEventListener('change', refreshPreview);
  amount.addEventListener('input', refreshPreview);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const item = catalog.find((row) => row.id === refItem.value);
    const avg = item ? activeAvg(item, refBasis.value) : null;
    busy = true;
    const result = await sim.proposeBilateral(store, {
      proposerId: me.id,
      debtorId: debtor.value,
      creditorId: creditor.value,
      thirdSeatId: third.value || null,
      amount: amount.value,
      reference: reference.value,
      charge: charge.value,
      referenceId: item && avg != null ? item.id : null,
      referenceAvg: item && avg != null ? avg : null
    });
    busy = false;
    if (!result.ok) {
      setStatus(result.error, 'bad');
      return;
    }
    setStatus('Proposed. The other party still has to countersign. Nothing has settled.', 'ok');
    render();
  });
  refreshPreview();
  return form;
}

function renderCycle(peers, me) {
  const third = h('select', {}, peerOptions(peers, '', 'None'));
  const charge = h('input', { type: 'number', min: '0', step: '0.01', value: '0' });
  const legs = h('div', {});
  const rows = [];

  function addRow(seed = {}) {
    const debtor = h('select', {}, peerOptions(peers, seed.debtorId || me.id));
    const creditor = h('select', {}, peerOptions(peers, seed.creditorId || ''));
    const amount = h('input', { type: 'number', min: '0.01', step: '0.01', value: seed.amount || '10' });
    const reference = h('input', { maxlength: '160', value: seed.reference || '' });
    const row = h('div', { class: 'row grid two' }, [
      field('Debtor', debtor),
      field('Creditor', creditor),
      field('Amount', amount),
      field('Work', reference)
    ]);
    const remove = h('button', { type: 'button', class: 'quiet' }, ['Remove line']);
    remove.addEventListener('click', () => {
      row.remove();
      const index = rows.indexOf(record);
      if (index >= 0) rows.splice(index, 1);
    });
    row.append(remove);
    const record = { debtor, creditor, amount, reference, row };
    rows.push(record);
    legs.append(row);
  }

  addRow();
  addRow();
  addRow();
  const preview = h('p', { class: 'legend' }, ['Preview the floor before anyone signs. A preview writes nothing.']);
  async function previewCycle() {
    const legs = rows.map((row) => ({
      debtorId: row.debtor.value,
      creditorId: row.creditor.value,
      amount: sim.round2(row.amount.value)
    }));
    const ids = [...new Set(legs.flatMap((leg) => [leg.debtorId, leg.creditorId]).filter(Boolean))];
    const bits = [];
    let blocked = '';
    for (const id of ids) {
      const peer = await store.get(id);
      if (!peer || !legs.every((leg) => Number.isFinite(leg.amount))) continue;
      const current = sim.replay(peer).balance;
      const next = sim.applyLegs(current, id, legs).balance;
      const reason = sim.floorBlockReason(peer, next);
      if (reason) blocked = reason;
      bits.push(`${peer.name} ${current} → ${next}`);
    }
    preview.className = blocked ? 'bad' : 'legend';
    preview.textContent = bits.length
      ? `${blocked || 'Floor holds on these nets.'} ${bits.join(' · ')}. Preview only.`
      : 'Add peers and amounts to preview the floor.';
  }
  const form = h('form', {}, [
    field('Third Seat · your seat, if someone outside the cycle is reading it', third),
    field('Named charge, before any signature', charge),
    h('p', { class: 'legend' }, ['Every party countersigns. The floor is tested on the net of the whole cycle. One leg that takes a floor blocks every leg.']),
    legs,
    preview,
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: () => addRow() }, ['Add a line']),
      h('button', {
        type: 'button',
        onClick: () => {
          legs.replaceChildren();
          rows.splice(0, rows.length);
          const ids = ['alice', 'bob', 'charlie'];
          if (ids.every((id) => peers.some((peer) => peer.id === id))) {
            addRow({ debtorId: 'alice', creditorId: 'bob', amount: '10', reference: 'Walkway clearing' });
            addRow({ debtorId: 'bob', creditorId: 'charlie', amount: '10', reference: 'Soil credits' });
            addRow({ debtorId: 'charlie', creditorId: 'alice', amount: '10', reference: 'Logistics run' });
          } else {
            addRow();
            addRow();
            addRow();
          }
          previewCycle();
        }
      }, ['Sketch a three-line cycle']),
      h('button', { type: 'button', onClick: () => previewCycle() }, ['Preview the floor']),
      h('button', { type: 'submit', class: 'primary' }, ['Propose cycle'])
    ])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const result = await sim.proposeCycle(store, {
      proposerId: me.id,
      thirdSeatId: third.value || null,
      charge: charge.value,
      legs: rows.map((row) => ({
        debtorId: row.debtor.value,
        creditorId: row.creditor.value,
        amount: row.amount.value,
        reference: row.reference.value
      }))
    });
    busy = false;
    if (!result.ok) {
      setStatus(result.error, 'bad');
      return;
    }
    setStatus('Cycle proposed. Each other party still has to countersign. Nothing has settled.', 'ok');
    render();
  });
  return form;
}

function exchangeCard(ex, me, peers) {
  const names = namesOf(peers);
  const needed = sim.requiredSigners(ex);
  const signed = needed.filter((id) => ex.signatures?.[id]);
  const waiting = needed.filter((id) => !ex.signatures?.[id]);
  const legText = (ex.legs || []).map((leg) => {
    const ref = leg.referenceId ? ` · reference ${leg.referenceAvg} (not a price)` : '';
    const work = leg.ididit ? ` · Legacy receipt ${leg.ididit.work}` : '';
    return `${names[leg.debtorId] || leg.debtorId} → ${names[leg.creditorId] || leg.creditorId} ${leg.amount} ${leg.reference || ''}${work}${ref}`;
  }).join(' · ');
  const mine = sim.applyLegs(0, me.id, ex.legs);
  const effect = ex.status === 'settled'
    ? (mine.debit || mine.credit ? `Your book: debit ${mine.debit}, credit ${mine.credit}.` : 'This line does not move your balance.')
    : 'Not settled.';
  const actions = [];
  const refusalBox = h('div', {}, []);
  refusalBox.hidden = true;
  if ((ex.status === 'proposed' || ex.status === 'countersigned') && needed.includes(me.id) && !ex.signatures?.[me.id]) {
    actions.push(h('button', { type: 'button', class: 'primary', onClick: () => run(() => sim.countersign(store, me.id, ex.id), 'Countersigned. Settlement still waits for every signature and the floor.') }, ['Countersign']));
  }
  if ((ex.status === 'proposed' || ex.status === 'countersigned') && ex.thirdSeatId === me.id) {
    const reason = h('input', { maxlength: '240', placeholder: 'Reason for the veto', required: true });
    actions.push(field('Veto reason. It stays on both tapes.', reason));
    actions.push(h('button', {
      type: 'button',
      class: 'primary',
      onClick: () => {
        if (!reason.value.trim()) {
          setStatus('A veto needs a reason.', 'bad');
          return;
        }
        run(() => sim.thirdSeatVeto(store, me.id, ex.id, reason.value), 'Veto recorded. No balance moves. No penalty.');
      }
    }, ['Veto']));
  }
  if ((ex.status === 'proposed' || ex.status === 'countersigned') && (needed.includes(me.id) || ex.thirdSeatId === me.id)) {
    const statement = h('input', { value: 'REFUSAL', maxlength: '240' });
    refusalBox.append(
      field('Refusal statement. It stays on the tape.', statement),
      h('button', {
        type: 'button',
        class: 'primary',
        onClick: () => run(() => sim.refuse(store, me.id, ex.id, statement.value), 'REFUSAL recorded. No balance moves. No penalty.')
      }, ['Record the refusal'])
    );
    actions.push(h('button', {
      type: 'button',
      onClick: () => { refusalBox.hidden = !refusalBox.hidden; }
    }, [ex.thirdSeatId === me.id ? 'Refuse as third seat' : 'Refuse']));
  }
  if ((ex.status === 'proposed' || ex.status === 'countersigned') && needed.includes(me.id)) {
    actions.push(h('button', { type: 'button', onClick: () => run(() => sim.settle(store, me.id, ex.id), null) }, ['Settle']));
  }
  actions.push(h('button', { type: 'button', class: 'quiet', onClick: () => shareExchange(me, ex) }, ['Share signed copy']));
  const note = ex.status === 'refused'
    ? 'REFUSAL recorded. No balance moves. No penalty.'
    : ex.status === 'blocked'
      ? ex.block?.message || sim.FLOOR_BLOCK
      : `Signed ${signed.map((id) => names[id] || id).join(', ') || 'nobody'}. ${waiting.length ? 'Waiting on ' + waiting.map((id) => names[id] || id).join(', ') + '.' : 'Every party has signed.'}`;
  const seatName = ex.thirdSeatId ? (names[ex.thirdSeatId] || ex.thirdSeatId) : 'none named';
  return h('article', { class: 'row' }, [
    h('header', {}, [
      h('span', { class: 'pill' }, [`${ex.kind} · ${ex.status}`]),
      h('a', { class: 'pill', href: 'https://www.egonomicanonymous.live/' }, [`Third Seat · your seat · ${seatName}`]),
      h('span', { class: 'meta' }, [shortHash(ex.id)])
    ]),
    h('p', {}, [legText]),
    h('p', { class: ex.status === 'blocked' || ex.status === 'refused' ? 'bad' : 'muted' }, [
      `${note} Named charge ${ex.charge}. ${ex.thirdSeatId ? 'Third seat ' + (names[ex.thirdSeatId] || ex.thirdSeatId) + '. ' : ''}${effect}`
    ]),
    actions.length ? h('div', { class: 'actions' }, actions) : null,
    refusalBox
  ]);
}

async function run(action, okMessage) {
  if (busy) return;
  busy = true;
  try {
    const result = await action();
    if (!result.ok) {
      setStatus(result.error, 'bad');
      await render();
      return;
    }
    const tail = result.balances ? ` ${formatBalances(result.balances)}` : '';
    if (result.status === 'settled') {
      setStatus(`Settled.${tail}`, 'ok');
    } else {
      setStatus(`${okMessage || 'Recorded.'}${tail}`, 'ok');
    }
    await render();
  } finally {
    busy = false;
  }
}

async function renderBooks(peers, seat) {
  if (pendingInvoice) {
    const token = pendingInvoice;
    pendingInvoice = '';
    const saved = await sim.acceptInvoice(store, seat, token);
    setStatus(saved.ok ? 'IdidIt (verified receipt) recorded on this book. The balance did not move. Beta.' : saved.error, saved.ok ? 'ok' : 'bad');
  }
  const panel = document.getElementById('panel');
  const peer = await store.get(seat);
  const names = namesOf(peers);
  const view = sim.replay(peer);
  const rule = sim.terms(peer);
  const above = sim.round2(view.balance - rule.floor);
  const finger = (await sim.sha256(sim.canonicalJSON(peer.publicKeyJwk))).slice(0, 16);
  const search = h('input', { type: 'search', placeholder: 'Filter by work, type, or hash' });
  const typeNames = ['all', 'genesis', 'ididit', 'INVOICE', 'INVOICE_PAID', 'INVOICE_REFUSED', 'REWARD', 'proposal', 'countersign', 'refusal', 'block', 'settlement', 'transfer', 'iou', 'attested', 'THIRD_SEAT_VETO', 'WINDOW_OPEN', 'WINDOW_CLOSE', 'NETTING', 'PRICE_LOCK'];
  const typeLabels = { all: 'All types', ididit: 'Legacy receipt', INVOICE: 'IdidIt (verified receipt)', INVOICE_PAID: 'IdidIt (verified receipt)' };
  const type = h('select', {}, typeNames.map((name, index) => option(name, typeLabels[name] || name, index === 0)));
  const list = h('div', {});
  const rows = view.rows.slice().reverse();
  for (const row of rows) {
    const detail = sim.entryDetail(row, names);
    const status = row.type === 'iou' || row.type === 'KYC_STARTED' ? 'pending' : row.type === 'attested' || row.type === 'KYC_VOUCHED' || row.type === 'VERIFIED' || row.type === 'KYC_2FA_OK' ? 'done' : row.type === 'refusal' ? 'refused' : row.type === 'block' ? 'blocked' : (row.type === 'transfer' || row.type === 'settlement') ? 'done' : row.type;
    const item = h('article', { class: 'tx' }, [
      h('span', { class: `mark mark-${status}`, 'aria-hidden': 'true' }, [status.slice(0, 1).toUpperCase()]),
      h('div', {}, [
        h('div', {}, [detail || row.type]),
        h('div', { class: 'meta' }, [`#${row.index} · ${row.at}`])
      ]),
      h('div', { class: 'tx-side' }, [
        h('span', { class: `pill pill-${status}` }, [status]),
        h('span', {}, [row.debit ? `−${row.debit}` : row.credit ? `+${row.credit}` : '']),
        h('span', { class: 'meta' }, [`Bal ${row.balance}`])
      ])
    ]);
    item.dataset.search = `${row.type} ${detail} ${row.hash} ${row.prev}`.toLowerCase();
    item.dataset.type = row.type;
    list.append(item);
  }
  function applyFilter() {
    const query = search.value.trim().toLowerCase();
    const wanted = type.value;
    let shown = 0;
    for (const item of list.children) {
      const hide = (wanted !== 'all' && item.dataset.type !== wanted) || (query && !item.dataset.search.includes(query));
      item.hidden = hide;
      if (!hide) shown += 1;
    }
    empty.hidden = shown !== 0;
  }
  const empty = h('p', { class: 'muted' }, ['No lines match.']);
  empty.hidden = rows.length !== 0;
  search.addEventListener('input', applyFilter);
  type.addEventListener('change', applyFilter);
  const payer = h('select', {}, peerOptions(peers.filter((item) => item.id !== seat), ''));
  const invoiceAmount = h('input', { type: 'number', min: '0.01', step: '0.01', inputmode: 'decimal', id: 'invoice-amount' });
  const due = h('input', { type: 'date', id: 'invoice-due', value: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) });
  const reference = h('select', {}, [option('', 'No dollar reference', true), ...catalog.map((item) => option(item.id, optionLabel(item, catalogMeta), false))]);
  const mediaHashes = h('input', { placeholder: 'Optional media hashes' });
  const extra = h('div', { id: 'invoice-fields' }, [
    field('Payer', payer),
    field('Amount in US$', invoiceAmount),
    field('Due date', due),
    field('Optional $ reference', reference),
    h('p', { class: 'legend' }, [`${REFERENCE_LABEL}. Reference only, not a price.`]),
    field('Linked media hashes', mediaHashes)
  ]);
  const receiptForm = h('form', { id: 'invoice-form' }, [
    extra,
    h('div', { class: 'actions' }, [h('button', { type: 'submit', class: 'primary' }, ['Send invoice'])])
  ]);
  receiptForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const item = catalog.find((row) => row.id === reference.value);
      const hashes = mediaHashes.value.split(/[\s,]+/).filter((hash) => /^[0-9a-f]{64}$/i.test(hash));
      const created = await sim.createInvoice(store, seat, {
        payerId: payer.value,
        amount: invoiceAmount.value,
        dueAt: due.value ? new Date(`${due.value}T00:00:00.000Z`).toISOString() : '',
        referenceId: item ? item.id : null,
        referenceAvg: item ? item.avg_value_usd : null,
        mediaHashes: hashes
      });
      if (!created.ok) { setStatus(created.error, 'bad'); return; }
      setStatus('IdidIt (verified receipt) signed. The balance did not move. Open SMS from the ledger to remind. Beta.', 'ok');
      await render();
    } finally {
      busy = false;
    }
  });
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const dayRoot = await sim.merkleRootOf((peer.tape || []).filter((entry) => String(entry.at || '').slice(0, 10) === day).map((entry) => entry.hash));
  const invoices = sim.sortInvoices(sim.readInvoices(peer, now), now);
  const buckets = sim.invoiceBuckets(peer, now);
  const invoiceCards = invoices.map((row) => {
    const payAmount = h('input', { type: 'number', min: '0.01', step: '0.01', inputmode: 'decimal', value: String(row.remaining || '') });
    const pass = h('input', { type: 'password', autocomplete: 'current-password' });
    const code = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8' });
    const note = h('input', { maxlength: '160', placeholder: 'REFUSAL' });
    const actions = [];
    if (row.remaining > 0 && row.status !== 'refused' && row.status !== 'donated') {
      actions.push(h('button', { type: 'button', onClick: async () => {
        const result = await sim.remindInvoice(store, seat, row.invoiceId);
        setStatus(result.ok ? 'Reminder recorded on the tapes. Nothing was sent. No penalty. Beta.' : result.error, result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Remind']));
      actions.push(h('button', { type: 'button', id: 'donate-floor', onClick: async () => {
        const result = await sim.consentFloorDonation(store, seat, row.invoiceId);
        setStatus(result.closed ? result.message : 'Your consent is signed. The other party still has to consent. No penalty. Beta.', result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Reconcile as donation to the floor']));
    }
    if (row.role === 'AR' && row.remaining > 0 && row.status !== 'refused' && row.status !== 'donated') {
      actions.push(h('a', { class: 'btn', href: '#', onClick: async (event) => {
        event.preventDefault();
        const payload = (await store.get(seat)).tape.find((entry) => entry.type === 'INVOICE' && entry.payload?.invoiceId === row.invoiceId)?.payload;
        const sealed = await sim.sealMessage(await store.get(seat), 'invoice', payload);
        if (!sealed.ok) { setStatus(sealed.error, 'bad'); return; }
        const href = sim.shareHrefs(row.payerPhone, `Beta lgme. Invoice ${row.amount} $lgme. This page does not send it.\n${sim.encodeMessage(sealed.message)}`).sms;
        event.currentTarget.href = href;
        window.location.href = href;
      } }, ['Remind by SMS']));
      actions.push(h('button', { type: 'button', id: 'loyalty-agree', onClick: () => consentInvoiceLoyalty(seat, row, false) }, ['Agree loyalty discount']));
      actions.push(h('button', { type: 'button', id: 'loyalty-decline', onClick: () => consentInvoiceLoyalty(seat, row, true) }, ['Decline discount']));
    }
    if (row.role === 'AP' && row.remaining > 0 && row.status !== 'refused') {
      actions.push(h('button', { type: 'button', class: 'primary', id: 'pay-solana', onClick: () => showSolanaPay({
        seat,
        amount: payAmount.value || row.remaining,
        invoiceId: row.invoiceId,
        otherId: row.workerId,
        recipient: '',
        donation: false
      }) }, ['Settle in $lgme']));
      actions.push(h('button', { type: 'button', id: 'loyalty-agree', onClick: () => consentInvoiceLoyalty(seat, row, false) }, ['Agree loyalty discount']));
      actions.push(h('button', { type: 'button', id: 'loyalty-decline', onClick: () => consentInvoiceLoyalty(seat, row, true) }, ['Decline discount']));
      actions.push(h('button', { type: 'button', onClick: () => showSolanaPay({
        seat,
        amount: payAmount.value || row.remaining,
        invoiceId: row.invoiceId,
        otherId: '',
        recipient: DONATION_ADDRESS,
        donation: true
      }) }, ['Pay donation in $lgme']));
      actions.push(h('button', { type: 'button', id: 'pay-zelle', onClick: () => showOffchainPay({
        seat, method: 'zelle', amount: payAmount.value || row.remaining, invoiceId: row.invoiceId, otherId: row.workerId
      }) }, ['Pay with Zelle']));
      actions.push(h('button', { type: 'button', id: 'pay-cash', onClick: () => showOffchainPay({
        seat, method: 'cash', amount: payAmount.value || row.remaining, invoiceId: row.invoiceId, otherId: row.workerId
      }) }, ['Pay with cash']));
      actions.push(h('button', { type: 'button', class: 'primary', id: 'pay-invoice', onClick: async () => {
        const result = await sim.payInvoice(store, seat, row.invoiceId, { amount: payAmount.value, passphrase: pass.value, code: code.value });
        setStatus(result.ok ? `Paid ${result.amount} $lgme. Remaining ${result.remaining}. Reward ${result.reward}. Beta.` : result.error, result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Pay with code']));
      actions.push(h('button', { type: 'button', onClick: async () => {
        const result = await sim.refuseInvoice(store, seat, row.invoiceId, note.value || 'REFUSAL');
        setStatus(result.ok ? 'REFUSAL recorded. No balance moves. No penalty. No reward. Beta.' : result.error, result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Refuse']));
    }
    return h('article', { class: 'card', id: row.role === 'AR' ? 'invoice-ar' : 'invoice-ap' }, [
      h('h3', {}, [`IdidIt (verified receipt) · ${row.role} · ${row.status} · ${row.amount} $lgme`]),
      Number(row.amount) > 100 ? h('p', { id: 'attestation-count' }, [`Needs 3 attestations (over $100). Pending attestations: ${pendingCountFor(peer, row.invoiceId)}.`]) : null,
      Number(row.amount) > 100 ? h('p', {}, ['Suggested third attester: group administrator']) : null,
      h('p', { class: 'muted' }, [`Paid ${row.paid}. Remaining ${row.remaining}. Bucket ${row.bucket}. Due ${String(row.dueAt).slice(0, 10)}. Phone ${row.payerPhone}. Hash ${String(row.payerKycHash || '').slice(0, 12)}.`]),
      h('p', { class: 'legend' }, [`Day root ${dayRoot.slice(0, 16)}. Not written to Hedera.`]),
      row.thanks ? h('p', { class: 'legend' }, [row.thanks]) : null,
      row.role === 'AP' && row.remaining > 0 ? h('div', {}, [field('Amount', payAmount), field('Passphrase', pass), field('6-digit code', code), field('Refusal note', note), field('Solana address for a floor rebate', h('input', { id: `rebate-wallet-${row.invoiceId}`, maxlength: '64', placeholder: 'Your address, not a seed phrase' }))]) : null,
      h('div', { class: 'actions' }, actions)
    ]);
  });
  const solana = await solanaCards(seat);
  const offchain = await offchainCards(seat);
  const proveHash = h('input', { placeholder: 'entry hash' });
  const proofOut = h('textarea', { class: 'codebox', readonly: true });
  const verifyIn = h('textarea', { class: 'codebox', placeholder: 'Paste an inclusion proof' });
  const verifyNote = h('p', { class: 'legend' }, ['']);
  const disposition = h('select', {}, [option('roll', 'Roll to the next window', true), option('terms', 'Pay in terms', false)]);
  const months = h('input', { type: 'number', min: '3', max: '6', step: '1', value: '3' });
  panel.replaceChildren(
    h('h2', {}, [`${peer.name}'s book`]),
    windowBanner(),
    h('p', { class: 'legend' }, [`Today's tape root ${dayRoot.slice(0, 16)}. A future Hedera anchor would publish this root. Not written to Hedera.`]),
    hederaHost(peer),
    h('p', { class: 'muted' }, [`Tape · public ledger. Every line below is on this peer’s book. Credits and debits come only from settlements, payments, and rewards. The running balance is a replay. Key ${finger}. Limit ${rule.creditLimit}.`]),
    h('div', { class: 'nums' }, [
      h('div', {}, [coinMark(), h('strong', {}, [String(view.balance)]), 'Balance']),
      h('div', {}, [h('strong', {}, [String(rule.floor)]), `Floor · basic needs reserve · ${rule.floorNote}`]),
      h('div', {}, [h('strong', {}, [above >= 0 ? String(above) : 'below']), above >= 0 ? 'Above the floor' : 'Below the floor']),
      h('div', {}, [h('strong', {}, [String(sim.rewardTotal(peer))]), 'Rewards']),
      h('div', {}, [h('strong', {}, [String(view.credits)]), 'Credits']),
      h('div', {}, [h('strong', {}, [String(view.debits)]), 'Debits'])
    ]),
    h('section', { id: 'offers' }, offerCards(peer, seat)),
    h('section', { id: 'solana-payments' }, [
      h('h3', {}, ['Solana attestation']),
      ...solana,
      solana.length ? null : h('p', { class: 'empty' }, ['No Solana payment is waiting on this seat.'])
    ]),
    h('section', { id: 'offchain-payments' }, [
      h('h3', {}, ['Cash and Zelle']),
      h('p', { class: 'legend' }, [zelleLine()]),
      h('p', { class: 'legend' }, ['Cash is in person only. Do not mail cash. Zelle and cash are not reversible-protected. This app does not process them. A payment is pending-attestation until the payee signs.']),
      h('p', { class: 'legend' }, [sim.FIAT_FEE_NOTE]),
      ...offchain
    ]),
    h('section', { id: 'floor-rebates' }, await floorRebateSection(seat)),
    h('section', { id: 'invoices' }, [
      h('h3', {}, ['Receivable and payable']),
      h('p', { class: 'muted' }, [`Open, due, and overdue stay off the balance until a coded payment. Ageing ${buckets['0-30']} in 0-30, ${buckets['31-60']} in 31-60, ${buckets['60+']} in 60+.`]),
      ...invoiceCards,
      invoices.length ? null : h('p', { class: 'empty' }, ['No IdidIt (verified receipt) on this book.']),
      h('div', { class: 'actions' }, [h('button', { type: 'button', onClick: () => download(`${peer.id}-ar-ap.csv`, sim.invoicesToCsv(peer, now), 'text/csv') }, ['Export AR/AP'])])
    ]),
    h('h3', {}, ['Send an IdidIt (verified receipt)']),
    h('p', { class: 'legend' }, ['An IdidIt (verified receipt) names the amount in US$. It does not change the balance until it is paid.']),
    receiptForm,
    h('h3', {}, ['Clearing window']),
    h('p', { class: 'legend' }, ['Open IOUs accrue until the window closes. Close nets them, locks one US$ price when a quote is available, and rolls what is left or turns it into pay-in-terms. The payer chooses.']),
    h('div', { class: 'grid two' }, [field('Unresolved balances', disposition), field('Terms, months', months)]),
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: async () => {
        const result = await sim.closeClearingWindow(store, peer.id, {
          disposition: disposition.value,
          months: months.value,
          navigator: navigator,
          rules: clearingRulesNow()
        });
        if (!result.ok) { setStatus(result.error, 'bad'); return; }
        setStatus(`Window ${result.windowId} closed. Root ${String(result.merkleRoot).slice(0, 12)}.`, 'ok');
        await render();
      } }, ['Close window'])
    ]),
    h('h3', {}, ['Prove entry']),
    field('Tape hash', proveHash),
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: async () => {
        const result = await sim.proveEntry(peer, { hash: proveHash.value.trim(), day });
        if (!result.ok) { setStatus(result.error, 'bad'); return; }
        proofOut.value = JSON.stringify(result.proof, null, 2);
        download(`${peer.id}-proof.json`, proofOut.value, 'application/json');
      } }, ['Prove entry'])
    ]),
    proofOut,
    field('Check a proof', verifyIn),
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: async () => {
        let proof;
        try { proof = JSON.parse(verifyIn.value); } catch { verifyNote.textContent = 'invalid'; return; }
        const result = await sim.verifyInclusion(proof);
        verifyNote.textContent = result.valid ? 'valid' : 'invalid';
      } }, ['Check proof'])
    ]),
    verifyNote,
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: () => verify(peer) }, ['Verify tape']),
      h('button', { type: 'button', onClick: () => download(`${peer.id}-tape.csv`, sim.toCsv(peer, names), 'text/csv') }, ['Export CSV']),
      h('button', { type: 'button', onClick: async () => download(`${peer.id}-tape.json`, JSON.stringify(await sim.exportRecords(peer, clearingRulesNow()), null, 2), 'application/json') }, ['Export JSON'])
    ]),
    h('div', { class: 'grid two' }, [field('Search', search), field('Type', type)]),
    list,
    empty
  );
}

async function verify(peer) {
  const result = await sim.verifyBook(peer);
  if (result.ok) setStatus(`Verify tape: ok. ${result.entries} entries. Hashes linked. Signatures match. Balance ${result.balance}.`, 'ok');
  else setStatus(`Verify tape: ${result.reason}.`, 'bad');
}

async function renderReconcile(peers, seat) {
  const panel = document.getElementById('panel');
  const left = h('select', {}, peerOptions(peers, peers[0]?.id || ''));
  const right = h('select', {}, peerOptions(peers, peers[1]?.id || peers[0]?.id || ''));
  const out = h('div', {});
  const form = h('form', {}, [
    h('div', { class: 'grid two' }, [field('First book', left), field('Second book', right)]),
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Compare copies'])])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (left.value === right.value) {
      setStatus('Choose two different peers.', 'bad');
      return;
    }
    const report = await sim.reconcilePeers(store, left.value, right.value);
    out.replaceChildren();
    if (report.ok) {
      setStatus(`Reconcile: the shared lines match. ${report.matches.length} exchange${report.matches.length === 1 ? '' : 's'}.`, 'ok');
    } else {
      setStatus(`Reconcile: ${report.mismatches.length} mismatch${report.mismatches.length === 1 ? '' : 'es'}.`, 'bad');
    }
    for (const row of report.mismatches) {
      out.append(h('article', { class: 'row' }, [
        h('p', { class: 'pill' }, ['Mismatch']),
        h('p', {}, [`${shortHash(row.exchangeId) || 'book'} · ${row.field}`]),
        h('p', { class: 'bad' }, [row.detail])
      ]));
    }
    for (const row of report.matches || []) {
      out.append(h('article', { class: 'row' }, [
        h('p', { class: 'pill' }, ['Match']),
        h('p', { class: 'ok' }, [`${shortHash(row.exchangeId)} · ${row.status}`])
      ]));
    }
    if (!report.mismatches.length && !(report.matches || []).length) {
      out.append(h('p', { class: 'muted' }, ['These two books share no exchanges.']));
    }
  });
  const imported = h('textarea', { placeholder: 'Paste a tape JSON or an lgme1. code' });
  const file = h('input', { type: 'file', accept: 'application/json,.json' });
  const importOut = h('div', {});
  file.addEventListener('change', async () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    imported.value = await chosen.text();
  });
  const importForm = h('form', {}, [
    field(`Compare ${peers.find((peer) => peer.id === seat)?.name || 'this book'} with an imported tape`, imported),
    field('Or choose a .json file', file),
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Verify and compare'])])
  ]);
  importForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const opened = await sim.openTape(imported.value);
    importOut.replaceChildren();
    if (!opened.ok) {
      setStatus(opened.error, 'bad');
      importOut.append(h('p', { class: 'bad' }, [opened.error]));
      return;
    }
    const local = await store.get(seat);
    const report = sim.reconcile(local, opened.peer);
    paintReport(importOut, report);
    setStatus(report.ok ? `Imported tape verified. Shared lines match. ${report.matches.length}.` : `Imported tape verified. ${report.mismatches.length} mismatch${report.mismatches.length === 1 ? '' : 'es'}.`, report.ok ? 'ok' : 'bad');
  });
  panel.replaceChildren(
    h('h2', {}, ['Reconcile']),
    h('p', { class: 'muted' }, ['Compare the signed copies two peers stored. A difference in amount, status, signature, refusal, or settlement is a mismatch. An imported tape is checked for its hash links and signatures before it is compared. Neither book is corrected from the other.']),
    form,
    out,
    h('h3', {}, ['Imported tape']),
    importForm,
    importOut
  );
}

function paintReport(out, report) {
  out.replaceChildren();
  for (const row of report.mismatches || []) {
    out.append(h('article', { class: 'row' }, [
      h('p', { class: 'pill' }, ['Mismatch']),
      h('p', {}, [`${shortHash(row.exchangeId) || 'book'} · ${row.field}`]),
      h('p', { class: 'bad' }, [row.detail])
    ]));
  }
  for (const row of report.matches || []) {
    out.append(h('article', { class: 'row' }, [
      h('p', { class: 'pill' }, ['Match']),
      h('p', { class: 'ok' }, [`${shortHash(row.exchangeId)} · ${row.status}`])
    ]));
  }
  if (!(report.mismatches || []).length && !(report.matches || []).length) {
    out.append(h('p', { class: 'muted' }, ['These two books share no exchanges.']));
  }
}

let carryCode = '';
let stopCamera = () => {};

function pageUrl(encoded) {
  return `${location.origin}${location.pathname}#${encoded}`;
}

function drawQr(host, text) {
  host.replaceChildren();
  if (!text) return;
  const QR = globalThis.QRCode;
  if (!QR || text.length > 2800) {
    host.append(h('p', { class: 'legend' }, ['This message is too long for a QR code. Use copy or a .json file.']));
    return;
  }
  const holder = h('div', { class: 'qr' });
  host.append(holder);
  const long = text.length > 700;
  try {
    new QR(holder, { text, width: long ? 360 : 220, height: long ? 360 : 220, correctLevel: long ? QR.CorrectLevel.L : QR.CorrectLevel.M });
  } catch {
    host.replaceChildren(h('p', { class: 'legend' }, ['This message is too long for a QR code. Use copy or a .json file.']));
  }
}

async function liveCode(secret) {
  const now = Math.floor(Date.now() / 1000);
  return sim.totp(sim.base32Decode(secret), now, { digits: 6, period: 30, algorithm: 'SHA-1' });
}

function stopAnyCamera() {
  stopCamera();
  stopCamera = () => {};
}

async function renderWallet(peers, seat) {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const summary = peers.find((peer) => peer.id === seat);
  const peer = await store.get(seat);
  const locked = Boolean(peer.wallet?.ciphertext) && !peer.privateKeyJwk;
  const secret = rememberedSecrets.get(seat) || '';
  const codeLine = h('p', { class: 'nums' }, ['']);
  async function paintCode() {
    if (!secret) return;
    const code = await liveCode(secret);
    const left = 30 - (Math.floor(Date.now() / 1000) % 30);
    codeLine.textContent = `Authenticator code on this page: ${code}. It changes in ${left}s. An authenticator app that scanned the code shows the same number.`;
  }
  if (secret) {
    await paintCode();
    activeCodeTimer = window.setInterval(paintCode, 1000);
  }
  const blocks = [
    h('h2', {}, [`Wallet · ${summary.name} `, h('span', { class: sim.kycStatus(peer) === 'VERIFIED' ? 'badge badge-verified' : 'badge badge-unverified' }, [sim.kycStatus(peer) === 'VERIFIED' ? 'Verified' : 'Unverified'])]),
    h('p', { class: 'muted' }, ['Beta. The book key is local. The passphrase and the 6-digit code unlock that book. They are not a Solana seed. A $lgme payment is signed by your wallet.']),
    h('div', { class: 'balance-hero' }, [
      coinMark(),
      h('div', {}, [h('strong', {}, [String(sim.replay(peer).balance)]), 'Book balance']),
      h('div', {}, [h('strong', {}, [String(sim.terms(peer).floor)]), 'Floor · basic needs reserve']),
      h('div', {}, [h('strong', {}, [locked ? 'Locked' : 'Open']), 'Key'])
    ])
  ];
  if (secret) blocks.push(codeLine, h('div', { id: 'setup-qr' }));
  blocks.push(profileCard(sim.peerProfile(peer)), passkeyCard(), coinPanel(), soBeItCard(peers, seat), kycCard(peer, peers));
  if (!peer.wallet?.ciphertext) {
    const passphrase = h('input', { type: 'password', minlength: '8', autocomplete: 'new-password', required: true });
    const form = h('form', {}, [
      h('p', { class: 'legend' }, ['This book is unlocked. Set a passphrase to encrypt the key at rest.']),
      field('Passphrase', passphrase),
      h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Encrypt and lock'])])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const setup = await sim.setupWallet(store, seat, passphrase.value);
      if (!setup.ok) { setStatus(setup.error, 'bad'); return; }
      rememberedSecrets.set(seat, setup.secretBase32);
      sessionKeys.delete(seat);
      setStatus('Key encrypted. Scan the code before you reload. Beta.', 'ok');
      await render();
    });
    blocks.push(form, iouSection(peer));
  } else if (locked) {
    const passphrase = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const code = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', required: true });
    const form = h('form', { class: 'grid two' }, [
      field('Passphrase', passphrase),
      field('6-digit code', code),
      h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Unlock'])])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const stored = await baseStore.get(seat);
      const opened = await sim.unlockWallet(stored, passphrase.value, code.value, Math.floor(Date.now() / 1000));
      if (!opened.ok) { setStatus(opened.error, 'bad'); return; }
      sessionKeys.set(seat, opened.privateKeyJwk);
      rememberedSecrets.set(seat, opened.secretBase32);
      setStatus('Wallet unlocked for this page session. The key stays encrypted in storage. Beta.', 'ok');
      await render();
    });
    blocks.push(h('p', { class: 'legend' }, ['Unlock asks for the passphrase and the current code. A wrong code leaves the key locked.']), form);
  } else {
    blocks.push(h('div', { class: 'actions' }, [h('button', { type: 'button', onClick: () => { sessionKeys.delete(seat); setStatus('Wallet locked. Beta.', 'ok'); render(); } }, ['Lock'])]));
    blocks.push(iouSection(peer));
  }
  blocks.push(deskLinks());
  panel.replaceChildren(...blocks);
  const qrHost = document.getElementById('setup-qr');
  if (qrHost && secret) {
    const label = encodeURIComponent(`lgme-sim:${peer.name}`);
    drawQr(qrHost, `otpauth://totp/${label}?secret=${secret}&issuer=lgme-sim&algorithm=SHA1&digits=6&period=30`);
  }
}

function kycCard(peer, peers) {
  const status = sim.kycStatus(peer);
  const started = (peer.tape || []).some((entry) => entry.type === 'KYC_STARTED');
  const twoFa = (peer.tape || []).some((entry) => entry.type === 'KYC_2FA_OK');
  const steps = h('ol', { class: 'legend' }, [
    h('li', {}, ['Your name. Phone and email stay on this device.']),
    h('li', {}, ['Confirm your 6-digit code.']),
    h('li', {}, ['A verified member vouches, with their own code.'])
  ]);
  if (status === 'VERIFIED') {
    return h('article', { class: 'card', id: 'kyc' }, [
      h('h3', {}, ['You are verified']),
      h('p', { class: 'muted' }, ['A member vouched for this book. You can send. Beta.']),
      steps
    ]);
  }
  const body = [
    h('h3', {}, ['Become verified']),
    h('p', { class: 'muted' }, ['Unverified members can receive, and can send up to 20 $lgme. This check stays on this device.']),
    steps
  ];
  if (!started) {
    const displayName = h('input', { value: peer.kyc?.displayName || peer.name, maxlength: '48', autocomplete: 'name' });
    const phone = h('input', { value: '', placeholder: 'optional', inputmode: 'tel', autocomplete: 'tel' });
    const email = h('input', { value: '', placeholder: 'optional', inputmode: 'email', autocomplete: 'email' });
    const form = h('form', {}, [
      field('Display name', displayName),
      field('Phone, optional', phone),
      field('Email, optional', email),
      h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Save details'])])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = await sim.startKyc(store, peer.id, { displayName: displayName.value, phone: phone.value, email: email.value });
      if (!result.ok) { setStatus(result.error, 'bad'); return; }
      setStatus('Details saved on this device. Next, confirm your code. Beta.', 'ok');
      await render();
    });
    body.push(form);
  } else if (!twoFa) {
    const pass = h('input', { type: 'password', minlength: '8', autocomplete: 'new-password', required: true });
    const code = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8' });
    const form = h('form', {}, [
      field(peer.wallet?.ciphertext ? 'Passphrase' : 'Choose a passphrase', pass),
      peer.wallet?.ciphertext ? field('6-digit code', code) : null,
      h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, [peer.wallet?.ciphertext ? 'Confirm code' : 'Set up the code'])])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!peer.wallet?.ciphertext) {
        const setup = await sim.setupWallet(store, peer.id, pass.value);
        if (!setup.ok) { setStatus(setup.error, 'bad'); return; }
        rememberedSecrets.set(peer.id, setup.secretBase32);
        setStatus('Code is ready. Enter it to finish this step. Beta.', 'ok');
        await render();
        return;
      }
      const result = await sim.confirmKyc2fa(store, peer.id, { passphrase: pass.value, code: code.value, unixSeconds: Math.floor(Date.now() / 1000) });
      if (!result.ok) { setStatus(result.error, 'bad'); return; }
      setStatus('Code confirmed. A verified member still has to vouch. Beta.', 'ok');
      await render();
    });
    body.push(form);
  } else {
    const verified = peers.filter((item) => item.kyc === 'VERIFIED' && item.id !== peer.id);
    const voucher = h('select', {}, verified.map((item) => option(item.id, item.name, false)));
    const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const code = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', required: true });
    const form = h('form', {}, [
      verified.length ? field('Verified member', voucher) : h('p', { class: 'legend' }, ['No other verified member is on this device yet.']),
      field('Their passphrase', pass),
      field('Their 6-digit code', code),
      h('div', { class: 'actions' }, [
        h('button', { class: 'primary', type: 'submit' }, ['Vouch']),
        h('button', { type: 'button', onClick: async () => {
          const result = await sim.refuseVouch(store, voucher.value || peer.id, peer.id, 'REFUSAL');
          if (!result.ok) { setStatus(result.error, 'bad'); return; }
          setStatus('REFUSAL recorded. No balance moves. No penalty. Still unverified.', 'ok');
          await render();
        } }, ['Refuse'])
      ])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = await sim.vouchMember(store, voucher.value, peer.id, { passphrase: pass.value, code: code.value, unixSeconds: Math.floor(Date.now() / 1000) });
      if (!result.ok) { setStatus(result.error, 'bad'); return; }
      setStatus('Verified. A member vouched. Beta.', 'ok');
      await render();
    });
    body.push(form, selfieStep(peer));
  }
  return h('article', { class: 'card', id: 'kyc' }, body);
}

function selfieStep(peer) {
  const video = h('video', { class: 'cam', playsinline: true, muted: true });
  video.hidden = true;
  const note = h('p', { class: 'legend' }, ['Optional. The preview stays on this screen. Only a hash is kept. The picture is not stored and not sent.']);
  const start = h('button', { type: 'button', onClick: async () => {
    stopAnyCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.hidden = false;
      video.srcObject = stream;
      await video.play();
      stopCamera = () => { stream.getTracks().forEach((track) => track.stop()); video.hidden = true; };
    } catch {
      setStatus('The camera preview did not open. Nothing was stored. Beta.', 'bad');
    }
  } }, ['Preview a selfie']);
  const hashBtn = h('button', { type: 'button', class: 'primary', onClick: async () => {
    if (video.readyState < 2) { setStatus('Open the preview first. Beta.', 'bad'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hash = await sim.hashCameraPreview(bytes);
    const kept = await sim.keepSelfieHash(store, peer.id, hash);
    stopAnyCamera();
    if (!kept.ok) { setStatus(kept.error, 'bad'); return; }
    note.textContent = `Picture discarded. Hash ${hash.slice(0, 12)} stays on this device.`;
  } }, ['Keep only the hash']);
  return h('div', {}, [h('h3', {}, ['Selfie check']), note, video, h('div', { class: 'actions' }, [start, hashBtn])]);
}

function iouSection(peer) {
  const debtor = h('input', { value: peer.id });
  const creditor = h('input', { placeholder: 'peer id' });
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', value: '25' });
  const reference = h('input', { maxlength: '160', placeholder: 'What the dollars are for' });
  const form = h('form', { class: 'grid two' }, [
    field('Debtor', debtor),
    field('Creditor', creditor),
    field('Dollars', amount),
    field('What for', reference),
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Record pending IOU'])])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await sim.recordIou(store, peer.id, {
      debtorId: debtor.value.trim(),
      creditorId: creditor.value.trim(),
      amount: amount.value,
      reference: reference.value
    });
    if (!result.ok) { setStatus(result.error, 'bad'); return; }
    carryCode = result.encoded;
    setStatus('IOU recorded as pending. The balance did not change. The named attester still has to sign.', 'ok');
    await render();
  });
  const rows = Object.values(peer.ious || {});
  const list = rows.map((iou) => {
    const actions = [];
    if (iou.status === 'pending' && iou.attesterId === peer.id) {
      actions.push(h('button', { type: 'button', class: 'primary', onClick: () => run(() => sim.attestIou(store, peer.id, iou.iouId), 'Attested. The book moved.') }, ['Attest']));
      actions.push(h('button', { type: 'button', onClick: () => run(() => sim.refuseAttestation(store, peer.id, iou.iouId, 'REFUSAL'), 'REFUSAL recorded. No balance moves. No penalty.') }, ['Refuse']));
    }
    return h('article', { class: 'row' }, [
      h('p', { class: 'pill' }, [iou.status || 'pending']),
      h('p', {}, [`${iou.debtorId} owes ${iou.creditorId} ${iou.amount} · ${iou.reference}`]),
      h('p', { class: 'legend' }, [`Window ${iou.windowId || 'open'}. Unattested IOUs do not change the balance.`]),
      actions.length ? h('div', { class: 'actions' }, actions) : null
    ]);
  });
  const other = h('input', { placeholder: 'peer id' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password' });
  const code = h('input', { inputmode: 'numeric', maxlength: '8', autocomplete: 'one-time-code' });
  const netForm = h('form', { class: 'grid two' }, [
    field('Other party', other),
    field('Passphrase', pass),
    field('6-digit code', code),
    h('div', { class: 'actions' }, [
      h('button', { class: 'primary', type: 'submit' }, ['Net out']),
      h('button', { type: 'button', onClick: async () => {
        const pending = Object.values(peer.nettings || {}).find((row) => row.status === 'proposed' && (row.parties || []).includes(peer.id));
        if (!pending) { setStatus('No netting is waiting on this book.', 'bad'); return; }
        const result = await sim.refuseNetting(store, peer.id, pending.nettingId, {
          passphrase: pass.value,
          code: code.value,
          statement: 'REFUSAL',
          unixSeconds: Math.floor(Date.now() / 1000)
        });
        if (!result.ok) { setStatus(result.error, 'bad'); return; }
        setStatus('Netting refused. Nothing was netted. No penalty.', 'ok');
        await render();
      } }, ['Refuse netting'])
    ])
  ]);
  netForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pending = Object.values(peer.nettings || {}).find((row) => row.status === 'proposed' && row.signatures && !row.signatures[peer.id] && (row.parties || []).includes(peer.id));
    const result = pending
      ? await sim.attestNetting(store, peer.id, pending.nettingId, { passphrase: pass.value, code: code.value, unixSeconds: Math.floor(Date.now() / 1000) })
      : await sim.proposeNetting(store, peer.id, { otherId: other.value.trim(), passphrase: pass.value, code: code.value, unixSeconds: Math.floor(Date.now() / 1000) });
    if (!result.ok) { setStatus(result.error, 'bad'); return; }
    setStatus(result.status === 'attested' ? `Netted ${result.offset}. Both attested. Balances already showed the net.` : 'Net out proposed. The other party still has to attest.', 'ok');
    await render();
  });
  return h('div', {}, [
    h('h3', {}, ['Issue · peer promise']),
    h('p', { class: 'legend' }, ['A non-cash IOU directly tied to human effort, not speculative debt. It stays pending until the named counterparty attests it. Open IOUs accrue in the current 7-day window. Refusal is recorded and carries no penalty. The floor still blocks a debit that would spend the basic needs reserve.']),
    form,
    h('h3', {}, ['Net out']),
    h('p', { class: 'legend' }, ['When you owe each other, Net out proposes the smaller amount as an offset. Both attest with the 6-digit code. Either can refuse. A 3-party cycle waits for a later window close.']),
    netForm,
    ...list
  ]);
}

async function renderDevices(peers, seat) {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const peer = await store.get(seat);
  const toId = h('input', { placeholder: 'peer id on the other device' });
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', value: '10', inputmode: 'decimal' });
  const note = h('input', { maxlength: '160', value: '$lgme' });
  const address = h('input', { placeholder: 'phone or email, optional', autocomplete: 'off' });
  const pass = peer.wallet?.ciphertext ? h('input', { type: 'password', autocomplete: 'current-password', required: true }) : null;
  const code = peer.wallet?.ciphertext ? h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', required: true }) : null;
  const shareHost = h('div', {});
  const form = h('form', { class: 'grid two' }, [
    field('Send $lgme to peer id', toId),
    field('Amount', amount),
    pass ? field('Passphrase', pass) : null,
    code ? field('6-digit code', code) : null,
    h('div', { class: 'actions sticky-action' }, [h('button', { class: 'primary', type: 'submit' }, [peer.wallet?.ciphertext ? 'Confirm and deliver' : 'Sign the transfer'])]),
    field('Note', note),
    field('Their phone or email, if you want a draft', address),
    h('p', { class: 'legend' }, [peer.wallet?.ciphertext
      ? 'Auto-send stays on this device. A valid code delivers the signed note into the other book. A wrong code sends nothing. Solana $lgme still needs your wallet.'
      : 'This book has no authenticator yet. Signing prepares a code you can carry. Set up 2FA on the wallet to auto-deliver on this device.']),
    sim.kycStatus(peer) === 'VERIFIED' ? null : h('p', { class: 'legend' }, ['Unverified members can send up to 20 $lgme. Receiving is open.'])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (peer.wallet?.ciphertext) {
      const result = await sim.autoDeliverTransfer(store, seat, {
        toId: toId.value.trim(),
        amount: amount.value,
        note: note.value,
        passphrase: pass.value,
        code: code.value,
        unixSeconds: Math.floor(Date.now() / 1000)
      });
      if (!result.ok) {
        setStatus(result.error || 'Nothing was sent.', 'bad');
        toast(result.error || 'Nothing was sent.');
        return;
      }
      carryCode = result.encoded || '';
      carryAddress = address.value.trim();
      if (result.encoded && deliveryChannel) deliveryChannel.postMessage({ encoded: result.encoded });
      const line = result.delivered
        ? `Delivered. ${peer.name} is at ${result.balance}. The other book appended it. Beta.`
        : `Signed. ${peer.name} is at ${result.balance}. Carry the code to the other device. Beta.`;
      setStatus(line, 'ok');
      toast(line);
      await render();
      return;
    }
    if (!peer.privateKeyJwk) { setStatus('Unlock the wallet before signing.', 'bad'); return; }
    const result = await sim.createTransfer(store, seat, { toId: toId.value.trim(), amount: amount.value, note: note.value });
    if (!result.ok) { setStatus(result.error, 'bad'); return; }
    carryCode = result.encoded;
    carryAddress = address.value.trim();
    setStatus(`Signed. ${peer.name} is at ${result.balance}. Nothing was sent. Use copy, the QR, or your own text or mail app.`, 'ok');
    await render();
  });
  const incoming = h('textarea', { class: 'codebox', placeholder: 'Paste an lgme1. code, a share link, or tape JSON' });
  if (pendingImport) incoming.value = pendingImport;
  const file = h('input', { type: 'file', accept: 'application/json,.json' });
  file.addEventListener('change', async () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    incoming.value = await chosen.text();
  });
  const preview = h('div', {});
  const video = h('video', { class: 'cam', playsinline: true, muted: true });
  video.hidden = true;
  const importForm = h('form', {}, [
    field('Incoming signed message', incoming),
    field('.json file', file),
    h('div', { class: 'actions' }, [
      h('button', { type: 'submit', class: 'primary' }, ['Verify']),
      h('button', { type: 'button', class: 'primary scan-prominent', onClick: () => startScan(video, incoming, preview) }, ['Scan QR'])
    ]),
    video,
    preview
  ]);
  importForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await previewIncoming(seat, incoming.value, preview);
  });
  const outbox = (peer.outbox || []).slice().reverse().map((item) => h('p', { class: 'legend' }, [`Outbox ${item.channel || 'local'} · ${item.kind} · ${item.amount || ''} ${item.toId || ''}`]));
  const inbox = (peer.inbox || []).slice().reverse().map((item) => h('p', { class: 'legend' }, [`Inbox ${item.kind} from ${item.fromId}`]));
  panel.replaceChildren(
    h('h2', {}, [`Another device · ${peer.name}`]),
    h('p', { class: 'muted' }, ['There is no server. Copy the code, open the share link, scan the QR, or save a .json file. On the other device, verify the signature and the hash before anything is appended. sms: and mailto: only open your own app. This page never sends the message.']),
    h('div', { class: 'actions' }, [h('button', { type: 'button', onClick: async () => download(`${seat}-tape.json`, JSON.stringify(await sim.exportRecords(peer, clearingRulesNow()), null, 2), 'application/json') }, ['Export tape JSON'])]),
    h('h3', {}, ['Send $lgme']),
    form,
    shareHost,
    h('h3', {}, ['Receive']),
    importForm,
    h('h3', {}, ['Log']),
    outbox.length ? h('div', {}, outbox) : h('p', { class: 'legend' }, ['Outbox is empty.']),
    inbox.length ? h('div', {}, inbox) : h('p', { class: 'legend' }, ['Inbox is empty.'])
  );
  if (carryCode) showShare(shareHost, seat, carryCode, carryAddress, 'signed lgme message');
  if (pendingImport) previewIncoming(seat, pendingImport, preview);
}

function showShare(host, seat, encoded, address, summary) {
  const link = pageUrl(encoded);
  const text = sim.shareText(summary, link);
  const hrefs = sim.shareHrefs(address, text);
  const qr = h('div', {});
  const box = h('textarea', { class: 'codebox', readonly: true }, [encoded]);
  const copy = h('button', { type: 'button', onClick: async () => {
    try { await navigator.clipboard.writeText(encoded); setStatus('Code copied. Beta.', 'ok'); }
    catch { setStatus('Select the code and copy it yourself. Beta.', 'bad'); }
  } }, ['Copy code']);
  const sms = h('a', { class: 'btn', href: hrefs.sms }, ['Open text app']);
  const mail = h('a', { class: 'btn', href: hrefs.mailto }, ['Open mail app']);
  const log = (channel) => () => { sim.logDispatch(store, seat, { kind: 'share', channel, simulated: true }); };
  sms.addEventListener('click', log('sms'));
  mail.addEventListener('click', log('mailto'));
  host.replaceChildren(
    h('p', { class: 'legend' }, ['Beta. Nothing has been sent.']),
    box,
    h('div', { class: 'actions' }, [copy, sms, mail]),
    h('p', { class: 'codebox' }, [link]),
    qr
  );
  drawQr(qr, link);
}

async function previewIncoming(seat, raw, host) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return;
  if (trimmed.startsWith('{') && trimmed.includes('"tape"')) {
    const opened = await sim.openTape(trimmed);
    if (!opened.ok) { setStatus(opened.error, 'bad'); host.replaceChildren(h('p', { class: 'bad' }, [opened.error])); return; }
    const clash = sim.solanaDoubleSpend(await store.get(seat), opened.peer);
    if (!clash.ok) { setStatus(clash.error, 'bad'); host.replaceChildren(h('p', { class: 'bad' }, [clash.error])); return; }
    const offchainClash = sim.offchainDoubleSpend(await store.get(seat), opened.peer);
    if (!offchainClash.ok) { setStatus(offchainClash.error, 'bad'); host.replaceChildren(h('p', { class: 'bad' }, [offchainClash.error])); return; }
    host.replaceChildren(
      h('p', { class: 'ok' }, [`Tape verified for ${opened.peer.name}. Hash links and signatures match.`]),
      h('div', { class: 'actions' }, [h('button', { type: 'button', class: 'primary', onClick: () => { pendingImport = trimmed; location.hash = 'reconcile'; } }, ['Compare in reconcile'])])
    );
    setStatus('Tape verified. It has not been appended to your book.', 'ok');
    return;
  }
  const opened = await sim.openMessage(trimmed);
  if (!opened.ok) { setStatus(opened.error, 'bad'); host.replaceChildren(h('p', { class: 'bad' }, [opened.error])); return; }
  const body = opened.message.body || {};
  host.replaceChildren(
    h('p', { class: 'ok' }, [`Signature and hash verified. ${opened.message.kind} from ${opened.message.fromId}.`]),
    h('p', {}, [body.amount ? `${body.amount} ${body.unit || ''} ${body.note || body.reference || ''}` : opened.message.kind]),
    h('div', { class: 'actions' }, [h('button', { type: 'button', class: 'primary', onClick: () => acceptIncoming(seat, trimmed) }, ['Append to this book'])])
  );
  setStatus('Verified. Nothing is appended until you confirm.', 'ok');
}

async function acceptIncoming(seat, raw) {
  const peer = await store.get(seat);
  if (!peer.privateKeyJwk) { setStatus('Unlock the wallet before appending.', 'bad'); return; }
  const result = await sim.importMessage(store, seat, raw);
  if (!result.ok) { setStatus(result.error, 'bad'); return; }
  pendingImport = '';
  setStatus(result.status === 'pending-attestation'
    ? 'Pending attestation. Verify the signature on Solana, then tap Attest. Nothing is settled yet. Beta.'
    : result.status === 'settled'
      ? 'Both parties signed. The invoice is paid. Beta.'
      : result.balance == null ? 'Imported. Beta.' : `Imported. Balance ${result.balance}. Beta.`, 'ok');
  await render();
}

async function startScan(video, incoming, preview, onFound) {
  stopAnyCamera();
  if (!navigator.mediaDevices?.getUserMedia || !globalThis.jsQR) {
    setStatus('This browser has no camera reader. Paste the code instead. Beta.', 'bad');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.hidden = false;
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let stopped = false;
    stopCamera = () => {
      stopped = true;
      stream.getTracks().forEach((track) => track.stop());
      video.hidden = true;
    };
    const tick = () => {
      if (stopped) return;
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = globalThis.jsQR(image.data, image.width, image.height);
        if (found?.data) {
          incoming.value = found.data;
          stopAnyCamera();
          if (onFound) onFound(found.data);
          else previewIncoming(currentSeatId(), incoming.value, preview);
          return;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch {
    setStatus('The camera was not opened. Paste the code instead. Beta.', 'bad');
  }
}

function currentSeatId() {
  return sessionStorage.getItem(SEAT_KEY) || '';
}

function profileCard(profile) {
  return h('article', { class: 'card' }, [
    h('h3', {}, [`${profile.name} · Peer standing ${profile.standing}`]),
    h('p', { class: 'muted' }, [
      `${profile.status === 'VERIFIED' ? 'Verified' : 'Unverified'}. Account age ${profile.ageDays} day${profile.ageDays === 1 ? '' : 's'}. Clearing history ${profile.clearingCount}. Vetoes ${profile.vetoCount || 0}.`
    ]),
    h('p', { class: 'legend' }, ['The third seat can veto a line that skipped the order. ', h('a', { href: 'https://www.egonomicanonymous.live/' }, ['Egonomic Anonymous']), '.']),
    h('p', { class: 'muted' }, [
      `${profile.balance} $lgme · floor ${profile.floor} · ${profile.aboveFloor} above the floor. Credit use versus the floor ${Math.round(profile.utilization * 100)}%. Rewards ${profile.rewards || 0} $lgme.${profile.held ? ` Held ${profile.held} $lgme.` : ''}`
    ])
  ]);
}

function coinMark() {
  const img = h('img', { class: 'coin', src: '/icons/icon-192.png', alt: '', width: '48', height: '48' });
  return h('picture', {}, [h('source', { srcset: '/icons/lgme-coin-192.webp', type: 'image/webp' }), img]);
}

const DONATE_ADDRESS = '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY';

function contributionMethods() {
  const copy = h('button', { type: 'button' }, ['Copy address']);
  copy.addEventListener('click', () => {
    copy.textContent = 'Copied';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(DONATE_ADDRESS).catch(() => {});
    }
  });
  const qrHost = h('div', {});
  drawQr(qrHost, DONATE_ADDRESS);
  const payUrl = `solana:${DONATE_ADDRESS}?spl-token=${MINT}&label=soBeIT&message=THANK+YOU+FOR+YOUR+SUPPORT.`;
  drawQr(qrHost, payUrl);
  return h('section', { class: 'contrib', id: 'sobeit-give' }, [
    h('h3', {}, ['soBeIT contributions']),
    h('p', {}, [h('a', { class: 'btn primary', href: '/lgme-coin#give' }, ['Give via soBeIT'])]),
    h('p', { class: 'legend' }, ['Real token on Solana. Not financial advice. High risk; you may lose everything. Always verify the mint address. Transfers are irreversible. Never share a seed phrase. This page never asks for one. A wallet balance is read from Solana. The local tape records signatures and is not a second mint.']),
    h('p', {}, ['THANK YOU FOR YOUR SUPPORT.']),
    h('article', { class: 'card pump-wallet' }, [
      h('h3', {}, ['Option A. $lgme or SOL']),
      h('p', {}, ['Pump.fun wallet. Wallet name ', h('span', { class: 'wallet-name' }, ['@EgonAnon'])]),
      h('ol', {}, [
        h('li', {}, ['Install Phantom or Solflare.']),
        h('li', {}, ['Buy or hold $lgme. Mint ', MINT, '. ', h('a', { href: `https://pump.fun/coin/${MINT}` }, ['Open the coin on pump.fun']), '.']),
        h('li', {}, ['Tap Send, or scan the QR.']),
        h('li', {}, ['Check the address. It starts with 6SYz and ends with okLY.']),
        h('li', {}, ['Confirm. The transfer is irreversible.'])
      ]),
      h('p', {}, ['Solana address']),
      h('p', { class: 'addr donate-address' }, [DONATE_ADDRESS]),
      h('div', { class: 'actions' }, [
        copy,
        h('a', { class: 'btn primary', href: payUrl }, ['Open in your wallet'])
      ]),
      qrHost
    ]),
    h('article', { class: 'card x-money' }, [
      h('h3', {}, ['Option B. X Money']),
      h('p', {}, ['Send via X Money to ', h('a', { href: 'https://x.com/Trancesage' }, ['@Trancesage'])]),
      h('p', {}, ['This is a separate account from the Solana wallet.']),
      h('ol', {}, [
        h('li', {}, ['Open the X app.']),
        h('li', {}, ['Open Money.']),
        h('li', {}, ['Tap Send.']),
        h('li', {}, ['Choose @Trancesage.']),
        h('li', {}, ['Enter the amount.']),
        h('li', {}, ['Confirm.'])
      ])
    ])
  ]);
}

function coinPanel() {
  return h('article', { class: 'card', id: 'coin-panel' }, [
    h('div', { class: 'balance-hero' }, [coinMark(), h('div', {}, [h('strong', {}, ['$lgme']), 'Real token, separate from this book'])]),
    h('p', {}, [h('a', { href: '/lgme-coin' }, ['Mint and buy steps are on the coin page.'])]),
    contributionMethods()
  ]);
}

function passkeyCard() {
  const saved = readCredentialId(localStorage);
  const supported = passkeySupported();
  const button = supported
    ? h('button', { type: 'button', id: 'passkey-unlock', onClick: () => startPasskey(Boolean(saved)) }, [saved ? 'Unlock with passkey' : 'Save a passkey'])
    : null;
  return h('article', { class: 'card', id: 'passkey' }, [
    h('h3', {}, ['Passkey']),
    h('p', {}, [PASSKEY_COPY]),
    supported ? null : h('p', { id: 'passkey-fallback' }, [PASSKEY_FALLBACK]),
    h('p', { class: 'muted' }, ['The passphrase is still required for the book key, and it is not a short PIN. The 6-digit code stays optional. Recovery codes are shown once.']),
    button
  ]);
}

async function startPasskey(saved) {
  const result = saved ? await unlockWithPasskey() : await enrollPasskey();
  if (!result.ok) { setStatus(result.error, 'bad'); return; }
  freshAuth.set(sessionStorage.getItem(SEAT_KEY) || '', Date.now());
  try { sessionStorage.setItem('lgme.passkey.unlockedAt', new Date().toISOString()); } catch { /* the visit note stays on screen */ }
  setStatus(saved ? 'This device unlocked. The book key still needs the passphrase.' : 'Passkey saved on this device. Only the credential id is stored.', 'ok');
  await render();
}

function soBeItCard(peers, seat) {
  const member = h('select', {}, peerOptions(peers.filter((item) => item.id !== seat), ''));
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', inputmode: 'decimal', value: '5' });
  const reason = h('input', { maxlength: '160', placeholder: 'Why this grant' });
  const form = h('form', { id: 'sobeit-form' }, [
    field('Member', member),
    field('Amount in $lgme', amount),
    field('Reason', reason),
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['soBeIT'])])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await sim.soBeItGrant(store, seat, member.value, { amount: amount.value, reason: reason.value });
    setStatus(result.ok ? `Grant recorded on this book. Balance ${result.balance}. Solana $lgme did not move.` : result.error, result.ok ? 'ok' : 'bad');
    if (result.ok) await render();
  });
  return h('article', { class: 'card', id: 'sobeit' }, [
    h('h3', {}, ['soBeIT']),
    h('p', { class: 'muted' }, ['A local grant on this tape. The grantor signs it. It is attested on the member book. It is not the Solana token.']),
    form,
    contributionMethods()
  ]);
}

function deskLinks() {
  const go = (name, label) => h('button', { type: 'button', onClick: () => { location.hash = name; } }, [label]);
  return h('div', { class: 'actions' }, [
    go('books', 'Ledger'),
    go('devices', 'Send'),
    go('exchange', 'Exchange'),
    go('reconcile', 'Reconcile'),
    go('help', 'Help'),
    go('resources', 'Resources')
  ]);
}

function openMediaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lgme-sim-media', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('files')) request.result.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveMediaFile(ownerId, privateKeyJwk, hash, bytes, mime) {
  const sealed = await sim.sealMediaBytes(privateKeyJwk, bytes);
  const db = await openMediaDb();
  const tx = db.transaction('files', 'readwrite');
  tx.objectStore('files').put({ iv: sealed.iv, ciphertext: sealed.ciphertext, mime, ownerId }, `${ownerId}:${hash}`);
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  db.close();
}

async function loadMediaFile(ownerId, privateKeyJwk, hash) {
  if (!privateKeyJwk) return null;
  const db = await openMediaDb();
  const tx = db.transaction('files', 'readonly');
  const row = await idbRequest(tx.objectStore('files').get(`${ownerId}:${hash}`));
  db.close();
  if (!row) return null;
  return sim.openMediaBytes(privateKeyJwk, row);
}

function jpegFromCanvas(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      resolve({ bytes, dataUrl: canvas.toDataURL('image/jpeg', 0.7), mime: 'image/jpeg', duration: 0 });
    }, 'image/jpeg', 0.7);
  });
}

function drawFrame(source, max) {
  const width = source.videoWidth || source.naturalWidth || source.width || 640;
  const height = source.videoHeight || source.naturalHeight || source.height || 480;
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return jpegFromCanvas(canvas);
}

function recorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function showCapture(seat, link = {}) {
  stopAnyCamera();
  document.getElementById('capture')?.remove();
  const live = h('video', { class: 'cam', playsinline: true, muted: true, autoplay: true });
  const still = h('img', { class: 'preview', alt: 'Preview' });
  still.hidden = true;
  const clip = h('video', { class: 'preview', playsinline: true, controls: true });
  clip.hidden = true;
  const clock = h('p', { class: 'legend' }, ['']);
  const file = h('input', { type: 'file', accept: 'image/*,video/*', capture: 'environment' });
  let stream = null;
  let recorder = null;
  let facing = 'environment';
  let held = null;
  let urls = [];
  const overlay = h('div', { id: 'capture', class: 'capture', role: 'dialog', 'aria-label': 'Camera' });
  const shutter = h('button', { type: 'button', class: 'primary', id: 'shutter' }, ['Shutter']);
  const retake = h('button', { type: 'button', id: 'retake' }, ['Retake']);
  const save = h('button', { type: 'button', class: 'primary', id: 'save-media' }, ['Save']);
  retake.hidden = true;
  save.hidden = true;
  function stopStream() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (recorder && recorder.state === 'recording') recorder.stop();
  }
  async function openLens() {
    stopStream();
    held = null;
    still.hidden = true;
    clip.hidden = true;
    live.hidden = false;
    retake.hidden = true;
    save.hidden = true;
    shutter.hidden = false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      live.srcObject = stream;
      await live.play();
      stopCamera = stopStream;
      clock.textContent = 'Nothing is uploaded. Photos are compressed. Video stays under 30 seconds.';
    } catch {
      clock.textContent = 'The camera did not open. Pick a file instead. Nothing was uploaded.';
    }
  }
  function hold(next) {
    held = next;
    live.hidden = true;
    shutter.hidden = true;
    retake.hidden = false;
    save.hidden = false;
    stopStream();
    if (next.mime.startsWith('video')) {
      const url = URL.createObjectURL(new Blob([next.bytes], { type: next.mime }));
      urls.push(url);
      clip.src = url;
      clip.hidden = false;
      still.hidden = true;
    } else {
      still.src = next.dataUrl;
      still.hidden = false;
      clip.hidden = true;
    }
  }
  shutter.addEventListener('click', async () => {
    if (shutter.textContent === 'Stop') {
      if (recorder && recorder.state === 'recording') recorder.stop();
      return;
    }
    if (shutter.dataset.mode === 'video') {
      const mime = recorderMime();
      if (!stream || !mime) { setStatus('This browser cannot record video. Take a photo instead.', 'bad'); return; }
      const chunks = [];
      const started = Date.now();
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 500000 });
      recorder.ondataavailable = (event) => { if (event.data && event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        const duration = Math.min(30, Math.round((Date.now() - started) / 100) / 10);
        const bytes = new Uint8Array(await new Blob(chunks, { type: mime }).arrayBuffer());
        shutter.textContent = 'Record';
        hold({ bytes, mime, duration, dataUrl: '' });
      };
      recorder.start();
      shutter.textContent = 'Stop';
      const tick = setInterval(() => {
        const left = Math.max(0, 30 - Math.floor((Date.now() - started) / 1000));
        clock.textContent = `${left}s left. Nothing is uploaded.`;
        if (left <= 0 && recorder && recorder.state === 'recording') recorder.stop();
        if (!recorder || recorder.state !== 'recording') clearInterval(tick);
      }, 250);
      return;
    }
    if (live.readyState < 2) { setStatus('The camera is not ready.', 'bad'); return; }
    hold(await drawFrame(live, 960));
  });
  file.addEventListener('change', async () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    if (chosen.type.startsWith('video')) {
      if (chosen.size > 8 * 1024 * 1024) { setStatus('That video is too large to keep on this phone.', 'bad'); return; }
      const url = URL.createObjectURL(chosen);
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.src = url;
      const duration = await new Promise((resolve) => { probe.onloadedmetadata = () => resolve(probe.duration); probe.onerror = () => resolve(0); });
      URL.revokeObjectURL(url);
      if (duration > 30.5) { setStatus('Keep the video under 30 seconds.', 'bad'); return; }
      hold({ bytes: new Uint8Array(await chosen.arrayBuffer()), mime: chosen.type || 'video/webm', duration: Math.round(duration * 10) / 10, dataUrl: '' });
      return;
    }
    const bitmap = await createImageBitmap(chosen);
    hold(await drawFrame(bitmap, 960));
    bitmap.close?.();
  });
  retake.addEventListener('click', () => openLens());
  save.addEventListener('click', async () => {
    if (!held) return;
    const peer = await store.get(seat);
    if (!peer?.privateKeyJwk) { setStatus('Unlock the wallet before saving.', 'bad'); return; }
    const made = link.defer ? null : await sim.recordMedia(store, seat, {
      bytes: held.bytes,
      mime: held.mime,
      size: held.bytes.byteLength,
      duration: held.duration,
      listingId: link.listingId || null,
      threadId: link.threadId || null
    });
    if (made && !made.ok) { setStatus(made.error, 'bad'); return; }
    if (made?.ok) await saveMediaFile(seat, peer.privateKeyJwk, made.hash, held.bytes, held.mime);
    if (link.threadId && made?.ok && link.toId) {
      const sent = await sim.composeChat(store, seat, {
        toId: link.toId,
        toPhone: link.toPhone || '',
        threadId: link.threadId,
        text: held.mime.startsWith('video') ? 'Video' : 'Photo',
        media: { ...made.core, sig: made.sig, ownerId: seat }
      });
      if (!sent.ok) setStatus(sent.error, 'bad');
    }
    if (link.onDraft) link.onDraft({ ...held, hash: made?.hash || await sim.hashBytes(held.bytes) });
    urls.forEach((url) => URL.revokeObjectURL(url));
    stopStream();
    overlay.remove();
    setStatus('Saved on this phone, encrypted. Only the hash is on the tape. Nothing was uploaded. Beta.', 'ok');
    if (link.onSaved) await link.onSaved();
  });
  overlay.append(
    live, still, clip, clock,
    h('div', { class: 'bar' }, [
      h('button', { type: 'button', onClick: () => { shutter.dataset.mode = 'photo'; shutter.textContent = 'Shutter'; } }, ['Photo']),
      h('button', { type: 'button', onClick: () => { shutter.dataset.mode = 'video'; shutter.textContent = 'Record'; } }, ['Video']),
      h('button', { type: 'button', onClick: () => { facing = facing === 'environment' ? 'user' : 'environment'; openLens(); } }, ['Switch']),
      shutter, retake, save,
      file,
      h('button', { type: 'button', onClick: () => { urls.forEach((url) => URL.revokeObjectURL(url)); stopStream(); overlay.remove(); } }, ['Close'])
    ])
  );
  document.body.append(overlay);
  openLens();
}

async function mediaSlides(ownerId, records) {
  const owner = await store.get(ownerId);
  const slides = [];
  for (const record of records) {
    if (!owner?.privateKeyJwk || record.ownerId && record.ownerId !== ownerId) continue;
    const bytes = await loadMediaFile(ownerId, owner.privateKeyJwk, record.hash);
    if (!bytes) continue;
    const url = URL.createObjectURL(new Blob([bytes], { type: record.mime || 'image/jpeg' }));
    const view = String(record.mime || '').startsWith('video')
      ? h('video', { controls: true, playsinline: true, src: url })
      : h('img', { alt: '', src: url, width: '288', height: '288', loading: 'lazy' });
    slides.push(h('div', { class: 'slide' }, [
      view,
      h('button', { type: 'button', onClick: async () => {
        const checked = await sim.verifyMedia(owner, { ...record, publicKeyJwk: owner.publicKeyJwk }, bytes);
        setStatus(checked.authentic ? 'Verified. The file matches the tape.' : 'Not authentic', checked.authentic ? 'ok' : 'bad');
      } }, ['Verify'])
    ]));
  }
  return slides;
}

async function chatMediaBubble(seat, line) {
  const who = line.senderId === seat ? 'You' : (nameById[line.senderId] || 'Member');
  const nodes = [h('div', {}, [`${who}: ${line.text}`])];
  if (line.media?.hash) {
    const owner = await store.get(line.senderId);
    const bytes = owner?.privateKeyJwk ? await loadMediaFile(line.senderId, owner.privateKeyJwk, line.media.hash) : null;
    if (bytes) {
      const url = URL.createObjectURL(new Blob([bytes], { type: line.media.mime || 'image/jpeg' }));
      nodes.push(String(line.media.mime).startsWith('video')
        ? h('video', { controls: true, playsinline: true, src: url })
        : h('img', { alt: '', src: url, width: '288', height: '288', loading: 'lazy' }));
    }
    nodes.push(h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: async () => {
        if (!bytes || !owner) { setStatus('Not authentic', 'bad'); return; }
        const checked = await sim.verifyMedia(owner, { ...line.media, publicKeyJwk: owner.publicKeyJwk }, bytes);
        setStatus(checked.authentic ? 'Verified. The file matches the tape.' : 'Not authentic', checked.authentic ? 'ok' : 'bad');
      } }, ['Verify']),
      bytes ? h('button', { type: 'button', onClick: () => shareMediaFile(bytes, line.media.mime, `Beta lgme. Media ${line.media.hash.slice(0, 12)}. This page does not upload it.`) }, ['Share']) : null
    ]));
  }
  return h('div', { class: 'bubble media-bubble', id: line.media?.hash ? 'chat-media' : undefined }, nodes.filter(Boolean));
}

async function shareMediaFile(bytes, mime, text) {
  const file = new File([bytes], mime.startsWith('video') ? 'lgme-video.webm' : 'lgme-photo.jpg', { type: mime || 'image/jpeg' });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ files: [file], text, title: 'Beta lgme' });
      setStatus('Handed to your phone’s share sheet. This page did not upload it. Beta.', 'ok');
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }
  setStatus('This browser will not hand the file to another app. Send the signed text, then save the file on the other phone. Nothing was uploaded.', 'ok');
}

async function compressPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const max = 480;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const photo = canvas.toDataURL('image/jpeg', 0.72);
  return { photo, photoHash: await sim.sha256(photo) };
}

function chip(label, on, click) {
  return h('button', { type: 'button', class: 'chip', 'aria-pressed': on ? 'true' : 'false', onClick: click }, [label]);
}

async function consentInvoiceLoyalty(seat, row, decline) {
  const wallet = document.getElementById(`rebate-wallet-${row.invoiceId}`);
  const rules = paymentMethods.loyalty || sim.LOYALTY_DEFAULTS;
  const result = await sim.consentLoyalty(store, seat, {
    invoiceId: row.invoiceId,
    decline,
    percent: rules.defaultPercent,
    rules,
    payerWallet: wallet ? wallet.value : '',
    navigator
  });
  setStatus(result.ok
    ? (result.declined ? 'Discount declined. The full price stays. No penalty. Beta.' : `Loyalty ${result.percent}% is signed. The other party still has to sign. Beta.`)
    : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

async function signOfferConsent(seat, offer, declineLoyalty) {
  const result = await sim.countersignOffer(store, seat, offer.id, { automate: true, declineLoyalty });
  const loyalty = result.offer ? sim.loyaltyStanding(result.offer) : null;
  const note = loyalty?.agreed ? ` Loyalty discount ${loyalty.percent}% is agreed.` : declineLoyalty ? ' No loyalty discount.' : '';
  setStatus(result.ok ? (result.contract ? `Both signed. The contract is on both tapes. Nothing was sent.${note} Beta.` : result.error || 'Signed.') : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

function offerCards(peer, seat) {
  const rows = Object.values(peer.offers || {});
  if (!rows.length) return [];
  return [
    h('h3', {}, ['Offers']),
    h('p', { class: 'legend' }, ['A contract waits for both signatures. Collection is a reminder and a reconciliation. There is no penalty. Beta.']),
    ...rows.map((offer) => h('article', { class: 'card', id: `offer-${offer.id.slice(0, 8)}` }, [
      h('h3', {}, [`${offer.title} · ${offer.status}`]),
      offer.thanks ? h('p', {}, [offer.thanks]) : null,
      offer.external ? h('p', { class: 'legend' }, [sim.offerupDraft(offer)]) : null,
      offer.status === 'awaiting' && !offer.consents?.[seat]
        ? h('div', { class: 'actions' }, [
          h('button', { type: 'button', class: 'primary', onClick: () => signOfferConsent(seat, offer, false) }, [offer.loyalty ? 'Agree discount and sign' : 'Sign consent']),
          offer.loyalty ? h('button', { type: 'button', onClick: () => signOfferConsent(seat, offer, true) }, ['Decline discount and sign']) : null
        ])
        : null,
      offer.status === 'contract'
        ? h('button', { type: 'button', onClick: async () => {
          const result = await sim.consentContractDonation(store, seat, offer.id);
          setStatus(result.closed ? result.message : 'Your consent is signed. The other party still has to consent. No penalty. Beta.', result.ok ? 'ok' : 'bad');
          if (result.ok) await render();
        } }, ['Reconcile as donation to the floor'])
        : null
    ]))
  ];
}

function offerForm(seat, target, serviceList = []) {
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', value: target.amount != null ? String(target.amount) : '' });
  const mode = h('select', {}, [
    option('full', 'Cash in full', true),
    option('3', 'Term payments, 3 months', false),
    option('4', 'Term payments, 4 months', false),
    option('5', 'Term payments, 5 months', false),
    option('6', 'Term payments, 6 months', false),
    option('service', 'IprovIT service only', false),
    option('zelle', 'Zelle', false),
    option('cash', 'Cash in person', false),
    option('lgme', 'Pay in $lgme', false)
  ]);
  const preview = h('p', { class: 'legend' }, ['']);
  const rules = paymentMethods.loyalty || sim.LOYALTY_DEFAULTS;
  const percent = h('input', { type: 'number', min: '0', max: String(rules.maxPercentPerDeal || 15), step: '0.1', value: String(rules.defaultPercent ?? 5) });
  const loyaltyBox = h('input', { type: 'checkbox' });
  const services = catalogServices(serviceList);
  function paint() {
    const choice = mode.value;
    if (choice === '3' || choice === '4' || choice === '5' || choice === '6') {
      const built = sim.termSchedule(amount.value, Number(choice), new Date().toISOString());
      preview.textContent = built.ok
        ? built.installments.map((row) => `${row.n}. ${row.amount} due ${row.dueAt.slice(0, 10)}`).join(' · ')
        : built.error;
      return;
    }
    preview.textContent = choice === 'full'
      ? 'Cash in full. No installment is written until both parties sign.'
      : choice === 'zelle'
        ? `Zelle is not counted until the payee attests the confirmation. This app does not process it. Zelle details: ask the recipient in chat / provided on request. ${sim.FIAT_FEE_NOTE}`
        : choice === 'cash'
          ? `Cash is in person only. Do not mail cash. It is not counted until the payee attests the receipt. This app does not process it. ${sim.FIAT_FEE_NOTE} Cash and Zelle get no loyalty discount.`
          : choice === 'lgme'
            ? `Pay the full price in $lgme. Suggested loyalty discount ${percent.value || rules.defaultPercent}%. Both parties sign it, or either can decline. ${sim.FLOOR_REBATE_LABEL}`
            : `Pick one or more IprovIT services. A $lgme payment is signed by your wallet. ${loyaltyBox.checked ? `Suggested loyalty discount ${percent.value || rules.defaultPercent}%. ${sim.FLOOR_REBATE_LABEL}` : 'Cash and Zelle get no loyalty discount.'}`;
  }
  mode.addEventListener('change', paint);
  amount.addEventListener('input', paint);
  paint();
  const form = h('form', { id: 'offer-form' }, [
    h('h3', {}, ['Offer on this item']),
    h('p', { class: 'legend' }, ['Beta. Both parties sign before a contract exists. An OfferUp draft is copied by hand. Nothing is sent.']),
    field('Amount', amount),
    field('How to pay', mode),
    field('Loyalty discount percent', percent),
    h('label', { class: 'row' }, [loyaltyBox, ' Suggest the $lgme loyalty discount on this IprovIT deal']),
    services.box,
    preview,
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, [target.external ? 'Copy draft offer' : 'Sign consent'])])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const choice = mode.value;
      const result = await sim.signOffer(store, seat, {
        listingId: target.listingId || '',
        external: target.external || null,
        toId: target.toId || '',
        cashMode: choice === 'service' ? '' : choice === 'full' ? 'full' : choice === 'zelle' ? 'zelle' : choice === 'cash' ? 'cash' : choice === 'lgme' ? 'lgme' : 'terms',
        loyalty: choice === 'lgme' || (choice === 'service' && loyaltyBox.checked),
        loyaltyPercent: percent.value,
        rules,
        months: ['3', '4', '5', '6'].includes(choice) ? Number(choice) : 0,
        amount: amount.value,
        serviceIds: services.selected(),
        automate: choice !== 'full' && choice !== 'service'
      });
      if (!result.ok) { setStatus(result.error, 'bad'); return; }
      if (result.draft) {
        try { await navigator.clipboard.writeText(result.draft); } catch { /* the draft stays on screen */ }
        setStatus('Draft offer copied. Nothing was sent. Paste it on OfferUp yourself. Beta.', 'ok');
      } else {
        setStatus(result.contract ? 'Both signed. Beta.' : 'Your consent is signed. The other party still has to sign. Nothing was sent. Beta.', 'ok');
      }
      openOfferFor = '';
      offerupIndex = -1;
      await render();
    } finally {
      busy = false;
    }
  });
  return form;
}

function catalogServices(list) {
  const boxes = (list || []).map((item) => {
    const box = h('input', { type: 'checkbox', value: item.id });
    return { box, id: item.id, title: `${item.title} · ${item.amount} $lgme` };
  });
  return {
    selected: () => boxes.filter((row) => row.box.checked).map((row) => row.id),
    box: h('fieldset', {}, [
      h('legend', {}, ['IprovIT services']),
      boxes.length
        ? h('p', { class: 'legend', id: 'iprov-services' }, ['Services listed as IprovIT can be offered in place of cash. A $lgme payment is signed by your wallet.'])
        : h('p', { class: 'legend', id: 'iprov-services' }, ['No IprovIT services are listed yet.']),
      ...boxes.map((row) => h('label', { class: 'row' }, [row.box, ` ${row.title}`]))
    ])
  };
}

const WANTED_TRACK = 'lgme-sim:wanted-tracker';

function readWantedTracker() {
  try { return JSON.parse(localStorage.getItem(WANTED_TRACK) || '{}'); } catch { return {}; }
}

function wantedTrack(url) {
  const row = readWantedTracker()[url];
  return {
    status: sim.WANTED_STATUSES.includes(row?.status) ? row.status : 'Available',
    notes: Array.isArray(row?.notes) ? row.notes : [],
    concluded: Boolean(row?.concluded),
    receiptId: row?.receiptId || ''
  };
}

function patchWanted(url, patch) {
  const all = readWantedTracker();
  const next = { ...wantedTrack(url), ...patch };
  all[url] = next;
  localStorage.setItem(WANTED_TRACK, JSON.stringify(all));
  return next;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

const TAILORED_KEY = 'lgme-sim:tailored-drafts';

function readTailored() {
  try { return JSON.parse(localStorage.getItem(TAILORED_KEY) || '{}'); } catch { return {}; }
}

function tailoredOf(url) {
  return readTailored()[url] || null;
}

function saveTailored(url, row) {
  const all = readTailored();
  all[url] = row;
  localStorage.setItem(TAILORED_KEY, JSON.stringify(all));
}

function tailoredActions(item, channel, openLabel) {
  const saved = tailoredOf(item.url);
  const approved = sim.tailoredOpenEnabled(saved?.status);
  const shown = openTailored === item.url;
  const amount = h('input', { value: saved?.amount || item.price || '' });
  const pay = h('select', {}, [
    option('full', 'Pay in full', (saved?.pay || 'full') === 'full'),
    option('3', '3 month terms', saved?.pay === '3'),
    option('4', '4 month terms', saved?.pay === '4'),
    option('5', '5 month terms', saved?.pay === '5'),
    option('6', '6 month terms', saved?.pay === '6'),
    option('service', '$lgme services (IprovIT)', saved?.pay === 'service'),
    option('zelle', 'Zelle', saved?.pay === 'zelle'),
    option('cash', 'Cash in person', saved?.pay === 'cash')
  ]);
  const handoff = h('select', {}, [
    option('pickup', 'Pickup', (saved?.handoff || 'pickup') === 'pickup'),
    option('delivery', 'Delivery', saved?.handoff === 'delivery')
  ]);
  const ask = h('input', { type: 'checkbox' });
  ask.checked = saved ? saved.askWorking !== false : true;
  const note = h('input', { maxlength: '240', value: saved?.note || '', placeholder: 'Custom note' });
  const statusLine = h('p', { class: 'legend' }, [saved?.status || sim.TAILORED_AWAITING]);
  const preview = h('p', { class: 'legend' }, [saved?.draft || '']);
  const copy = h('button', { type: 'button', disabled: !approved }, ['Copy']);
  const open = h('a', {
    class: 'btn primary',
    href: approved ? item.url : '#',
    target: '_blank',
    rel: 'noopener noreferrer',
    'aria-disabled': approved ? 'false' : 'true'
  }, [openLabel]);
  open.addEventListener('click', (event) => {
    if (open.getAttribute('aria-disabled') === 'true') event.preventDefault();
  });
  function spec() {
    return { amount: amount.value, pay: pay.value, handoff: handoff.value, askWorking: ask.checked, note: note.value, channel };
  }
  function lock() {
    const body = spec();
    const draft = sim.tailoredDraft(item, body);
    saveTailored(item.url, { ...body, status: sim.TAILORED_AWAITING, draft });
    statusLine.textContent = sim.TAILORED_AWAITING;
    preview.textContent = draft;
    copy.disabled = true;
    open.setAttribute('aria-disabled', 'true');
    open.href = '#';
  }
  [pay, handoff, ask].forEach((el) => el.addEventListener('change', lock));
  amount.addEventListener('input', lock);
  note.addEventListener('input', lock);
  copy.addEventListener('click', async () => {
    const row = tailoredOf(item.url);
    if (!sim.tailoredOpenEnabled(row?.status)) return;
    await copyText(row.draft);
    setStatus('Draft copied. Nothing was sent. Beta.', 'ok');
  });
  const form = h('div', {}, [
    field('Offer amount', amount),
    field('How to pay', pay),
    field('Pickup or delivery', handoff),
    h('label', { class: 'row' }, [ask, ' Ask if it is fully working']),
    field('Custom note', note),
    statusLine,
    preview,
    h('button', { type: 'button', onClick: () => {
      const body = spec();
      const draft = sim.tailoredDraft(item, body);
      saveTailored(item.url, { ...body, status: 'Approved', draft });
      statusLine.textContent = 'Approved';
      preview.textContent = draft;
      copy.disabled = false;
      open.setAttribute('aria-disabled', 'false');
      open.href = item.url;
    } }, ['Approve'])
  ]);
  return h('div', { class: 'tailored' }, [
    h('button', { type: 'button', onClick: () => {
      if (!tailoredOf(item.url)) {
        const body = { amount: item.price || '', pay: 'full', handoff: 'pickup', askWorking: true, note: '', channel };
        saveTailored(item.url, { ...body, status: sim.TAILORED_AWAITING, draft: sim.tailoredDraft(item, body) });
      }
      openTailored = openTailored === item.url ? '' : item.url;
      render();
    } }, ['Continue with tailored options']),
    shown ? form : null,
    h('div', { class: 'actions' }, [copy, open])
  ]);
}

function wantedMatchSection(seat) {
  const cards = wantedMatches.map((item, index) => {
    const track = wantedTrack(item.url);
    const status = h('select', {}, sim.WANTED_STATUSES.map((name) => option(name, name, track.status === name)));
    status.addEventListener('change', () => { patchWanted(item.url, { status: status.value }); render(); });
    const reply = h('input', { maxlength: '240', placeholder: 'Seller reply' });
    return h('article', { class: 'card', id: `wanted-match-${index}` }, [
      offerupImage(item),
      h('h3', {}, [item.title || 'Match']),
      h('p', { class: 'price' }, [item.price || '']),
      h('p', {}, [`${item.type ? item.type[0].toUpperCase() + item.type.slice(1) : 'Listing'} · ${track.status} · ${item.city || 'DC area'}`]),
      h('p', { class: item.sellerSaysWorking ? 'badge badge-verified' : 'badge' }, [sim.workingBadge(item)]),
      item.note ? h('p', { class: 'legend' }, [item.note]) : null,
      h('p', { class: 'legend' }, [item.inquiry || sim.wantedInquiry(item)]),
      h('p', { class: 'legend' }, [sim.OFFERUP_CAVEAT]),
      field('Availability', status),
      track.notes.length ? h('ul', {}, track.notes.map((note) => h('li', {}, [`${note.at.slice(0, 16)} ${note.text}`]))) : null,
      field('Log a reply', reply),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', onClick: () => {
          const text = reply.value.trim();
          if (!text) return;
          const notes = wantedTrack(item.url).notes.concat([{ at: new Date().toISOString(), text }]);
          patchWanted(item.url, { notes, status: wantedTrack(item.url).status === 'Available' ? 'Pending reply' : wantedTrack(item.url).status });
          render();
        } }, ['Log reply']),
        h('button', { type: 'button', onClick: async () => {
          const row = tailoredOf(item.url);
          if (!sim.tailoredOpenEnabled(row?.status)) { setStatus('Approve the draft first. Nothing was sent. Beta.', 'bad'); return; }
          await copyText(row.draft);
          patchWanted(item.url, { status: 'Offer made' });
          setStatus('Draft offer copied. Nothing was sent. Paste it on OfferUp yourself. Beta.', 'ok');
          render();
        } }, ['Make an offer']),
        tailoredActions(item, 'offerup', 'Continue on OfferUp'),
        h('button', { type: 'button', onClick: async () => {
          const text = sim.inviteSellerText(item);
          await copyText(text);
          if (navigator.share) {
            try { await navigator.share({ title: 'lgme.app', text, url: sim.INVITE_URL }); } catch (error) { if (error && error.name === 'AbortError') return; }
          }
          patchWanted(item.url, { status: 'Pending reply' });
          setStatus('Invite copied. Nothing was sent. Beta.', 'ok');
          render();
        } }, ['Invite seller to lgme.app']),
        h('button', { type: 'button', onClick: async () => {
          const result = await sim.concludeWantedMatch(store, seat, item);
          if (!result.ok) { setStatus(result.error, 'bad'); return; }
          patchWanted(item.url, { status: 'Closed', concluded: true, receiptId: result.receiptId });
          setStatus('Concluded. The match is closed on this book. Reconcile as donation to the floor if both consent. Beta. Nothing was sent.', 'ok');
          location.hash = 'books';
        } }, ['Mark concluded'])
      ])
    ]);
  });
  return h('section', { id: 'wanted-matches' }, [
    h('h3', {}, ['Matches from OfferUp']),
    h('p', { class: 'legend' }, [`For “${sim.STANDING_WANTED.title}”. Beta. Nothing is sent.`]),
    sim.suggestedWantedPair(wantedMatches) ? h('p', { id: 'wanted-pair' }, [sim.suggestedWantedPair(wantedMatches)]) : null,
    cards.length ? h('div', { class: 'grid' }, cards) : h('p', { class: 'empty', id: 'wanted-matches-empty' }, ['No OfferUp matches in this file yet.'])
  ]);
}

function thumbtackCard(item, seat) {
  const track = wantedTrack(item.url);
  const status = h('select', {}, sim.WANTED_STATUSES.map((name) => option(name, name, track.status === name)));
  status.addEventListener('change', () => { patchWanted(item.url, { status: status.value }); render(); });
  const reply = h('input', { maxlength: '240', placeholder: 'Seller reply' });
  return h('article', { class: 'card' }, [
    offerupImage(item),
    h('h3', {}, [item.title || 'Pro']),
    item.role ? h('p', {}, [item.role]) : null,
    item.isIprovIT ? h('p', { class: 'badge' }, ['Listed from Thumbtack (not affiliated)']) : null,
    item.rating ? h('p', { class: 'rating' }, [item.rating]) : null,
    item.service ? h('p', {}, [item.service]) : null,
    item.price ? h('p', { class: 'price' }, [item.price]) : null,
    h('p', {}, [`${track.status} · ${item.city || 'DC area'}`]),
    h('p', { class: 'legend' }, [tailoredOf(item.url)?.status || sim.TAILORED_AWAITING]),
    item.inquiry ? h('p', { class: 'legend' }, [item.inquiry]) : null,
    h('p', { class: 'legend' }, [sim.THUMBTACK_CAVEAT]),
    item.note ? h('p', { class: 'legend' }, [item.note]) : null,
    field('Availability', status),
    track.notes.length ? h('ul', {}, track.notes.map((note) => h('li', {}, [`${note.at.slice(0, 16)} ${note.text}`]))) : null,
    field('Log a reply', reply),
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: () => {
        const text = reply.value.trim();
        if (!text) return;
        const notes = wantedTrack(item.url).notes.concat([{ at: new Date().toISOString(), text }]);
        patchWanted(item.url, { notes });
        render();
      } }, ['Log reply']),
      h('button', { type: 'button', onClick: async () => {
        const row = tailoredOf(item.url);
        if (!sim.tailoredOpenEnabled(row?.status)) { setStatus('Approve the draft first. Nothing was sent. Beta.', 'bad'); return; }
        await copyText(item.inquiry || sim.wantedInquiry(item));
        setStatus('Inquiry copied. Nothing was sent. Beta.', 'ok');
      } }, ['Copy inquiry']),
      h('button', { type: 'button', onClick: async () => {
        const row = tailoredOf(item.url);
        if (!sim.tailoredOpenEnabled(row?.status)) { setStatus('Approve the draft first. Nothing was sent. Beta.', 'bad'); return; }
        await copyText(row.draft);
        patchWanted(item.url, { status: 'Offer made' });
        setStatus('Draft offer copied. Nothing was sent. Paste it on Thumbtack yourself. Beta.', 'ok');
        render();
      } }, ['Make an offer']),
      h('button', { type: 'button', onClick: async () => {
        const text = sim.inviteSellerText(item);
        await copyText(text);
        if (navigator.share) {
          try { await navigator.share({ title: 'lgme.app', text, url: sim.INVITE_URL }); } catch (error) { if (error && error.name === 'AbortError') return; }
        }
        setStatus('Invite copied. Nothing was sent. Beta.', 'ok');
      } }, ['Invite seller to lgme.app'])
    ]),
    tailoredActions(item, 'thumbtack', 'Continue on Thumbtack'),
    seat ? null : null
  ]);
}

async function repairFollowSection() {
  const host = h('section', { id: 'repair-follow', class: 'card' }, [
    h('h3', {}, ['Repair follow-through']),
    h('p', { class: 'legend' }, ['Exchange stays view only. A Health request is the exception. Nothing is emailed from here.'])
  ]);
  let body = { items: [] };
  try {
    const response = await fetch('/api/exchange/repair');
    body = await response.json();
  } catch { body = { items: [] }; }
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) host.append(h('div', { id: 'repair-follow-empty' }, [
    h('img', { src: '/assets/img/repair-extraordinaire.webp', alt: 'Person exercising on a treadmill: The Repair Extraordinaire, equipment repair', width: '356', height: '480', loading: 'lazy', style: 'width:100%;max-height:180px;object-fit:contain;border-radius:10px' }),
    h('p', { class: 'muted' }, ['No Health repair request yet.'])
  ]));
  for (const item of items) {
    const status = h('select', { 'data-view-ok': '1', id: `repair-status-${String(item.id).slice(0, 8)}` }, REPAIR_STATUSES.map((name) => h('option', { value: name }, [name])));
    status.value = REPAIR_STATUSES.includes(item.status) ? item.status : 'requested';
    host.append(h('article', { id: `repair-item-${String(item.id).slice(0, 8)}` }, [
      h('p', {}, [`${item.details?.item || 'Equipment'} · ${item.details?.brandModel || ''} · ${item.status}`]),
      h('p', { class: 'muted' }, [item.details?.symptom || '']),
      item.suggestion?.note ? h('p', { class: 'muted' }, [item.suggestion.note]) : null,
      status,
      h('button', { type: 'button', 'data-view-ok': '1', onClick: async () => {
        const key = await ensureDeviceKey(localStorage);
        const payload = { handle: item.handle, action: 'repair-status', origin: 'health', id: item.id, status: status.value, at: new Date().toISOString() };
        const response = await fetch('/api/exchange/repair', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ handle: item.handle, publicJwk: key.publicJwk, payload, sig: await signDevice(key.privateJwk, payload) })
        });
        const saved = await response.json().catch(() => ({}));
        setStatus(saved.ok ? `Status ${saved.item?.status || status.value}.` : (saved.error || 'The status stayed as it was.'), saved.ok ? 'ok' : 'bad');
        if (saved.ok) render();
      } }, ['Update status'])
    ]));
  }
  return host;
}

function thumbtackSection(seat) {
  const pros = thumbtackItems.filter((item) => item.isIprovIT);
  const rest = thumbtackItems.filter((item) => !item.isIprovIT);
  return h('section', { id: 'thumbtack-matches' }, [
    h('h3', {}, ['Matches from Thumbtack']),
    h('p', { class: 'legend' }, [`For “${sim.STANDING_REPAIR.title}”. ${sim.THUMBTACK_CAVEAT} Beta. Nothing is sent.`]),
    h('p', { class: 'legend' }, ['Ratings are shown as listed on Thumbtack. Not an endorsement by lgme.']),
    rest.length ? h('div', { class: 'grid' }, rest.map((item) => thumbtackCard(item, seat))) : pros.length ? null : h('p', { class: 'empty', id: 'thumbtack-empty' }, ['No Thumbtack pros in this file yet.']),
    h('h3', {}, ['Listed from Thumbtack (not affiliated)']),
    pros.length ? h('div', { class: 'grid', id: 'thumbtack-iprov' }, pros.map((item) => thumbtackCard(item, seat))) : h('p', { class: 'empty', id: 'thumbtack-iprov-empty' }, ['No external IprovIT listings in this file yet.'])
  ]);
}

function offerupImage(item) {
  const img = h('img', { class: 'listing-photo', alt: '', src: item.image || '/icons/icon-192.png', width: '224', height: '224', loading: 'lazy' });
  img.addEventListener('error', () => {
    if (img.dataset.fallback === '1') return;
    img.dataset.fallback = '1';
    img.src = '/icons/icon-192.png';
  });
  return img;
}

function offerupSection(seat, serviceList) {
  const cards = offerupItems.map((item, index) => h('article', { class: 'card', id: `offerup-${index}` }, [
    offerupImage(item),
    h('h3', {}, [item.title]),
    h('p', { class: 'price' }, [item.price]),
    h('p', {}, [`${sim.offerupKindLabel(item.kind)} · ${item.city || 'DC area'}`]),
    h('p', { class: 'legend' }, [sim.OFFERUP_CAVEAT]),
    h('p', { class: 'muted' }, [`As of ${item.sourcedAt || 'pending'}`]),
    h('div', { class: 'actions' }, [
      h('span', {}, ['Buy']),
      h('button', { type: 'button', onClick: async () => {
        const row = tailoredOf(item.url);
        if (!sim.tailoredOpenEnabled(row?.status)) { setStatus('Approve the draft first. Nothing was sent. Beta.', 'bad'); return; }
        await copyText(row.draft);
        setStatus('Draft offer copied. Nothing was sent. Paste it on OfferUp yourself. Beta.', 'ok');
      } }, ['Make an offer'])
    ]),
    tailoredActions(item, 'offerup', 'Continue on OfferUp')
  ]));
  return h('section', { id: 'offerup-dc' }, [
    h('h3', {}, ['Found on OfferUp (DC area)']),
    cards.length ? h('div', { class: 'grid' }, cards) : h('p', { class: 'empty', id: 'offerup-empty' }, ['No OfferUp listings in this file yet.'])
  ]);
}

async function renderMarket(peers, seat) {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const me = peers.find((peer) => peer.id === seat);
  if (openListingId) {
    const cards = await sim.marketFeed(store, {}, new Date().toISOString());
    const card = cards.find((item) => item.id === openListingId);
    if (!card) {
      openListingId = '';
    } else {
      const seller = await store.get(card.sellerId);
      const serviceList = await sim.marketFeed(store, { kind: 'IprovIT' });
      const profile = sim.peerProfile(seller);
      const slides = await mediaSlides(card.sellerId, sim.listMedia(seller, { listingId: card.id }).filter((record) => !record.ownerId || record.ownerId === card.sellerId));
      const gallery = h('div', { class: 'carousel', id: 'listing-gallery' }, [
        ...slides,
        card.photo ? h('div', { class: 'slide' }, [h('img', { class: 'shot', alt: '', src: card.photo, width: '288', height: '288', loading: 'lazy' })]) : null
      ].filter(Boolean));
      const actions = [];
      const wantedPin = card.title === sim.STANDING_WANTED.title;
      const repairPin = card.title === sim.STANDING_REPAIR.title;
      if (card.pinned && !wantedPin && !repairPin) {
        actions.push(h('a', { class: 'btn primary', id: 'donation-link', href: card.href || '/lgme-coin' }, [card.action || 'Receive / send $lgme']));
      } else if (card.sellerId === seat && !wantedPin && !repairPin) {
        actions.push(h('button', { type: 'button', class: 'primary', onClick: async () => {
          const refreshed = await sim.refreshListing(store, seat, card.id);
          setStatus(refreshed.ok ? 'Listing refreshed with a signed heartbeat. Beta.' : refreshed.error, refreshed.ok ? 'ok' : 'bad');
          if (refreshed.ok) await render();
        } }, ['Refresh']));
      } else if (!wantedPin && !repairPin) {
        actions.push(h('button', { type: 'button', class: 'primary', onClick: async () => {
          const chat = await sim.openChat(store, seat, card.id);
          if (!chat.ok) { setStatus(chat.error, 'bad'); return; }
          openThreadId = chat.thread.id;
          location.hash = 'chats';
        } }, ['Chat']));
        actions.push(h('button', { type: 'button', id: 'offer-on-item', onClick: () => { offerupIndex = -1; openOfferFor = card.id; render(); } }, ['Offer on this item']));
      }
      panel.replaceChildren(...[
        h('button', { type: 'button', class: 'quiet', onClick: () => { openListingId = ''; render(); } }, ['Back to the market']),
        h('h2', {}, [card.title]),
        gallery,
        card.sellerId === seat ? h('div', { class: 'actions' }, [h('button', { type: 'button', id: 'listing-camera', onClick: () => showCapture(seat, { listingId: card.id, onSaved: () => render() }) }, ['Camera'])]) : null,
        card.pinned && !wantedPin ? h('p', { id: 'donation-copy' }, [card.description]) : null,
        wantedPin || repairPin ? h('p', { id: wantedPin ? 'wanted-copy' : 'repair-copy' }, [card.description]) : null,
        wantedPin || repairPin ? h('ul', { id: wantedPin ? 'wanted-payments' : 'repair-payments' }, (wantedPin ? sim.STANDING_WANTED : sim.STANDING_REPAIR).payments.map((item) => h('li', {}, [item]))) : null,
        !card.pinned ? h('p', { class: 'price' }, [`${card.amount} $lgme`]) : null,
        card.pinned && !wantedPin ? h('p', { class: 'legend' }, ['Beta. A soBeIT grant below stays on this tape. The link above is the real token page.']) : null,
        wantedPin || repairPin ? h('p', { class: 'legend' }, ['Beta. A concluded match is closed on this book. A $lgme payment is signed by your wallet. Reconcile as donation to the floor needs both consents.']) : null,
        card.pinned && !wantedPin && !repairPin ? soBeItCard(peers, seat) : null,
        wantedPin ? wantedMatchSection(seat) : null,
        repairPin ? thumbtackSection(seat) : null,
        h('p', {}, [
          h('span', { class: card.verified ? 'badge badge-verified' : 'badge badge-unverified' }, [card.verified ? 'Verified' : 'Unverified']),
          ` ${card.sellerName} · ${card.circle} · Peer standing ${card.standing}`
        ]),
        h('p', { class: 'muted' }, [`${card.condition} · ${card.pickup}${card.area ? ' · ' + card.area : ''}`]),
        card.referenceAvg == null ? null : h('p', { class: 'legend' }, [`Reference only, not a price. About ${card.referenceAvg}.`]),
        h('p', { class: 'legend' }, [card.signatureOk ? `Origin ${shortHash(card.originHash)} verifies.` : 'Origin hash does not verify.']),
        profileCard(profile),
        openOfferFor === card.id ? offerForm(seat, { listingId: card.id, title: card.title, amount: card.amount, toId: card.sellerId === seat ? '' : card.sellerId }, serviceList) : null,
        h('div', { class: 'actions' }, actions)
      ].filter(Boolean));
      return;
    }
  }
  await sim.ensureStandingDonation(store);
  await sim.ensureStandingWanted(store);
  await sim.ensureStandingRepair(store);
  await sim.ensureStandingRepairPro(store);
  const feed = await sim.marketFeed(store, marketQuery);
  const serviceList = await sim.marketFeed(store, { kind: 'IprovIT' });
  const search = h('input', { type: 'search', placeholder: 'Search', value: marketQuery.q, autocomplete: 'off' });
  const condition = h('select', {}, [option('', 'Any condition', !marketQuery.condition), ...CONDITIONS.map((item) => option(item, item, marketQuery.condition === item))]);
  const pickup = h('select', {}, [option('', 'Any pickup', !marketQuery.pickup), ...PICKUPS.map((item) => option(item, item, marketQuery.pickup === item))]);
  const circle = h('select', {}, [option('', 'Any circle', !marketQuery.circle), ...['Walkway', 'Soil', 'Logistics'].map((item) => option(item, item, marketQuery.circle === item))]);
  const min = h('input', { inputmode: 'decimal', placeholder: 'Min', value: marketQuery.min });
  const max = h('input', { inputmode: 'decimal', placeholder: 'Max', value: marketQuery.max });
  const form = h('form', { class: 'grid two' }, [
    field('Search', search),
    field('Condition', condition),
    field('Pickup', pickup),
    field('Circle', circle),
    field('Min $lgme', min),
    field('Max $lgme', max),
    h('div', { class: 'actions' }, [
      h('button', { class: 'primary', type: 'submit' }, ['Filter']),
      h('button', { type: 'button', onClick: () => { marketQuery = { q: '', kind: '', category: '', condition: '', pickup: '', circle: '', min: '', max: '' }; render(); } }, ['Clear'])
    ])
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    marketQuery = { ...marketQuery, q: search.value, condition: condition.value, pickup: pickup.value, circle: circle.value, min: min.value, max: max.value };
    render();
  });
  const kinds = h('div', { class: 'chips', id: 'kind-pills' }, [
    chip('All', !marketQuery.kind, () => { marketQuery.kind = ''; render(); }),
    chip('ihavIT', marketQuery.kind === 'ihavIT', () => { marketQuery.kind = 'ihavIT'; render(); }),
    chip('IwanIT', marketQuery.kind === 'IwanIT', () => { marketQuery.kind = 'IwanIT'; render(); }),
    chip('IprovIT', marketQuery.kind === 'IprovIT', () => { marketQuery.kind = 'IprovIT'; render(); })
  ]);
  const pills = h('div', { class: 'chips' }, [
    chip('All', !marketQuery.category, () => { marketQuery.category = ''; render(); }),
    ...CATEGORIES.map((item) => chip(item, marketQuery.category === item, () => { marketQuery.category = item; render(); }))
  ]);
  const viewer = viewerId(localStorage);
  const personal = viewer ? await loadPersonalImages(viewer, localStorage) : null;
  function myThumb(card, fallback) {
    const slot = slotForListing(card);
    if (!slot || !personal) return fallback;
    const shown = resolveImage(slot, personal.images, personal.memberId, viewer);
    return shown.custom ? shown.src : fallback;
  }
  const grid = h('div', { class: 'market-grid', id: 'market-grid' }, feed.map((card) => h('button', {
    type: 'button',
    class: 'card market-card',
    id: card.title === sim.STANDING_DONATION.title ? 'donation-card' : card.title === sim.STANDING_WANTED.title ? 'wanted-card' : card.title === sim.STANDING_REPAIR.title ? 'repair-card' : card.title === sim.STANDING_REPAIR_PRO.title ? 'repair-pro-card' : undefined,
    onClick: () => { openListingId = card.id; render(); }
  }, [
    h('img', { alt: card.title === sim.STANDING_REPAIR_PRO.title ? 'Person exercising on a treadmill: The Repair Extraordinaire, equipment repair' : '', src: myThumb(card, card.title === sim.STANDING_REPAIR_PRO.title ? '/assets/img/repair-extraordinaire.webp' : (card.photo || '')), width: '224', height: '224', loading: 'lazy' }),
    h('h3', {}, [card.title]),
    card.pinned ? h('p', { class: 'muted' }, [card.description]) : h('div', { class: 'price' }, [`${card.amount} $lgme`]),
    card.title === sim.STANDING_WANTED.title || card.title === sim.STANDING_REPAIR.title ? h('p', { class: 'legend' }, [(card.title === sim.STANDING_REPAIR.title ? sim.STANDING_REPAIR : sim.STANDING_WANTED).payments.join(' · ')]) : null,
    card.pinned ? h('span', { class: 'badge badge-verified' }, [card.action || 'Receive / send $lgme']) : null,
    h('div', {}, [h('span', { class: card.verified ? 'badge badge-verified' : 'badge badge-unverified' }, [card.verified ? 'Verified' : 'Unverified'])]),
    h('small', { class: 'meta' }, [`${card.circle} · Peer standing ${card.standing}`])
  ])));
  if (!feed.some((card) => card.title === sim.STANDING_REPAIR_PRO.title)) {
    grid.prepend(h('article', { class: 'card market-card', id: 'repair-pro-card' }, [
      h('img', { src: '/assets/img/repair-extraordinaire.webp', alt: 'Person exercising on a treadmill: The Repair Extraordinaire, equipment repair', width: '356', height: '480', loading: 'lazy' }),
      h('h3', {}, [sim.STANDING_REPAIR_PRO.title]),
      h('p', { class: 'muted' }, [sim.STANDING_REPAIR_PRO.description]),
      h('span', { class: 'badge badge-verified' }, ['Service offer'])
    ]));
  }
  const follow = await repairFollowSection();
  const mine = await store.get(seat);
  const standing = mine ? sim.peerProfile(mine) : null;
  const filters = h('details', {}, [h('summary', {}, ['Filters']), form]);
  panel.replaceChildren(
    h('h2', {}, ['Market']),
    h('p', { class: 'muted' }, [`Ad-free. ${me ? me.name : 'You'} · Peer standing ${standing ? standing.standing : ''}. Nothing here is a paid placement. Beta.`]),
    kinds,
    pills,
    filters,
    feed.length || grid.childElementCount ? grid : h('div', { class: 'empty', id: 'listings-empty' }, [
      h('img', { src: '/images/photos/neighborhood-640.webp', alt: 'A quiet path, waiting for a listing', width: '640', height: '420', loading: 'lazy', style: 'width:100%;max-height:140px;object-fit:cover;border-radius:10px' }),
      h('p', {}, ['No listings match. List one, or clear the filters.'])
    ]),
    follow,
    !marketQuery.kind || marketQuery.kind === 'IwanIT' ? wantedMatchSection(seat) : null,
    !marketQuery.kind || marketQuery.kind === 'IwanIT' ? thumbtackSection(seat) : null,
    offerupSection(seat, serviceList),
    referenceCatalogCard(),
    standing ? profileCard(standing) : null
  );
}

async function renderCircles() {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const circles = await sim.circlesOf(store);
  panel.replaceChildren(
    h('h2', {}, ['Circles']),
    h('p', { class: 'muted' }, ['A circle is a mutual-credit ring or a peer group. It is not a map. An area phrase is only text.']),
    circles.length ? h('div', { class: 'grid' }, circles.map((circle) => h('button', {
      type: 'button',
      class: 'card',
      onClick: () => { marketQuery = { ...marketQuery, circle: circle.name, category: '' }; openListingId = ''; location.hash = 'market'; }
    }, [
      h('h3', {}, [circle.name]),
      h('p', { class: 'muted' }, [`${circle.listings} listing${circle.listings === 1 ? '' : 's'} · ${circle.members.length} member${circle.members.length === 1 ? '' : 's'}`]),
      circle.area ? h('p', { class: 'legend' }, [circle.area]) : null
    ]))) : h('p', { class: 'empty' }, ['No circles yet. A listing names one.'])
  );
}

async function supportExercise(peer, session, kind, pass, code) {
  const amount = kind === 'contribute-credit' ? 1 : kind === 'barter' ? 0 : 1;
  const barter = kind === 'barter' ? 'A deed in return' : '';
  const result = await sim.offerExerciseSupport(store, peer.id, session.sessionId, {
    authorId: session.authorId,
    kind,
    amount,
    barter,
    passphrase: pass.value,
    code: code.value,
    unixSeconds: Math.floor(Date.now() / 1000)
  });
  setStatus(result.ok ? 'Terms are on the record. Nothing moves until they accept. A no is one tap.' : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

async function answerExercise(peer, offer, accept, pass, code) {
  const spec = { passphrase: pass.value, code: code.value, unixSeconds: Math.floor(Date.now() / 1000) };
  const result = accept
    ? await sim.acceptExerciseSupport(store, peer.id, offer.supportId, spec)
    : await sim.refuseExerciseSupport(store, peer.id, offer.supportId, spec);
  setStatus(result.ok ? (accept ? 'Support accepted. The session itself minted no credit.' : 'No. Nothing moved.') : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

async function exerciseBoard(seat) {
  const peer = await store.get(seat);
  const books = [];
  for (const id of await store.listIds()) {
    const row = await store.get(id);
    if (row) books.push(row);
  }
  const file = await loadExcerpts();
  return exerciseCard(peer, books, file);
}

const workout = { startedAt: '', points: [], photos: [], samples: 0, stop: null };

async function beginWorkout(ui) {
  if (workout.startedAt) { setStatus('A session is already running.', 'bad'); return; }
  workout.startedAt = new Date().toISOString();
  workout.points = [];
  workout.photos = [];
  workout.samples = 0;
  const used = [];
  if (ui.useGps.checked) {
    const point = await readGps(navigator.geolocation);
    if (point) { workout.points.push(point); used.push('gps'); }
  }
  if (ui.useCamera.checked) {
    const photo = await captureFrame();
    if (photo) { workout.photos.push(photo); used.push('camera'); }
  }
  if (ui.useMotion.checked) {
    const allowed = await allowMotion();
    if (allowed) {
      used.push('motion');
      const onMotion = () => { workout.samples += 1; };
      window.addEventListener('devicemotion', onMotion);
      workout.stop = () => window.removeEventListener('devicemotion', onMotion);
    }
  }
  ui.sensorsNote.textContent = used.length ? `Started. Sensors so far: ${used.join(', ')}.` : 'Started. No sensor was used.';
  setStatus(`Session started. ${ui.lineTitle ? ui.lineTitle + '. ' : ''}Tap Finish when you are done.`, 'ok');
}

async function finishWorkout(peer, ui) {
  if (!workout.startedAt) { setStatus('Tap Start first.', 'bad'); return; }
  const finishedAt = new Date().toISOString();
  if (ui.useGps.checked) {
    const point = await readGps(navigator.geolocation);
    if (point) workout.points.push(point);
  }
  if (ui.useCamera.checked) {
    const photo = await captureFrame();
    if (photo) workout.photos.push(photo);
  }
  workout.stop?.();
  workout.stop = null;
  const sensors = [];
  if (workout.points.length) sensors.push('gps');
  if (workout.photos.length) sensors.push('camera');
  if (workout.samples > 0) sensors.push('motion');
  const fence = {
    lat: Number(ui.fenceLat.value),
    lon: Number(ui.fenceLon.value),
    radiusM: Number(ui.fenceRadius.value)
  };
  const matched = locationMatched(workout.points, fence);
  const bundle = { startedAt: workout.startedAt, finishedAt, points: workout.points, photos: workout.photos, samples: workout.samples };
  const hash = await evidenceHash(bundle);
  const durationSec = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(workout.startedAt)) / 1000));
  const result = await sim.recordExerciseSession(store, peer.id, {
    day: finishedAt.slice(0, 10),
    category: ui.category.value,
    evidence: EVIDENCE_UNVERIFIED,
    terms: ui.terms.value,
    durationSec,
    sensors,
    locationMatched: matched,
    intent: ui.intent.value,
    allowedIntents: ui.allowedIntents,
    privateNote: ui.note.value,
    evidenceHash: hash,
    bundle,
    groupCode: ui.groupCode.value,
    passphrase: ui.pass.value,
    code: ui.code.value,
    unixSeconds: Math.floor(Date.now() / 1000)
  });
  workout.startedAt = '';
  const intentNote = result.ok && result.publicItem?.intent ? ` Intent: ${result.publicItem.intent}.` : '';
  setStatus(result.ok ? `IdidIt (verified receipt). ${EVIDENCE_UNVERIFIED}. No credit was minted. Location matched club: ${matched}.${intentNote}` : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

function exerciseCard(peer, books = [], file = { excerpts: [] }) {
  const category = h('select', {}, [
    option('strength', 'Strength', true),
    option('cardio', 'Cardio', false),
    option('mobility', 'Mobility', false),
    option('mixed', 'Mixed', false)
  ]);
  const exerciseKind = h('select', { id: 'exercise-kind' }, [
    option('physical', 'Physical', true),
    option('mental', 'Mental', false)
  ]);
  const duration = h('input', { id: 'exercise-minutes', type: 'number', min: '15', max: '240', value: '30' });
  const arbiter = h('p', { id: 'exercise-arbiter' }, ['The suggestion appears here. It is not recorded until both people confirm.']);
  const giverBox = h('input', { id: 'arbiter-giver', type: 'checkbox' });
  const receiverBox = h('input', { id: 'arbiter-receiver', type: 'checkbox' });
  let suggested = null;
  function showRate() {
    suggested = recommendRate({ kind: exerciseKind.value, minutes: duration.value });
    arbiter.textContent = suggested.text;
  }
  function confirmBoth() {
    if (!suggested) showRate();
    const result = confirmServiceCredit({ giver: giverBox.checked === true, receiver: receiverBox.checked === true, amount: suggested.author });
    arbiter.textContent = result.text || result.error;
  }
  function confirmSolo() {
    if (!suggested) showRate();
    const scored = scoreSolo({ minutes: duration.value, note: note.value });
    let prior = [];
    try { prior = JSON.parse(localStorage.getItem('lgme.solo.credits') || '[]'); } catch { prior = []; }
    const result = soloCredit({ confidence: scored.confidence, amount: suggested.author, prior });
    if (result.credit > 0) localStorage.setItem('lgme.solo.credits', JSON.stringify([...prior, Date.now()]));
    arbiter.textContent = result.text || result.error;
  }
  const terms = h('input', { maxlength: '160', value: 'Contribution or barter', placeholder: 'Support terms' });
  const note = h('input', { maxlength: '160', placeholder: 'Private note, stays on this device' });
  const groupCode = h('input', { maxlength: '24', placeholder: 'Invite code, optional' });
  const clubName = h('input', { maxlength: '60', placeholder: 'Club or crew name' });
  const useGps = h('input', { type: 'checkbox' });
  const useCamera = h('input', { type: 'checkbox' });
  const useMotion = h('input', { type: 'checkbox' });
  const fenceLat = h('input', { type: 'number', step: '0.000001', placeholder: 'Club latitude' });
  const fenceLon = h('input', { type: 'number', step: '0.000001', placeholder: 'Club longitude' });
  const fenceRadius = h('input', { type: 'number', min: '10', step: '1', value: '150' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password' });
  const code = h('input', { inputmode: 'numeric', maxlength: '8', autocomplete: 'one-time-code' });
  const sensorsNote = h('p', { class: 'legend' }, ['No sensors yet. Each one is optional.']);
  const day = new Date().toISOString().slice(0, 10);
  const published = memberLines(visibleWisdom(books, peer).filter((item) => item.status === 'published'));
  const excerptLines = (file.excerpts || []).filter((row) => row.theme && row.text).map((row) => ({ kind: row.kind, title: row.theme, text: row.text, source: row.source || '' }));
  const line = rotationFor(day, [...excerptLines, ...published]);
  const allowedIntents = [...MAXIMS.map((maxim) => maxim.title), ...published.map((item) => item.title)];
  const intent = h('select', {}, [option('', 'No intent on the receipt', true), ...allowedIntents.map((title) => option(title, title, false))]);
  const shared = h('div', { id: 'shared-listings' });
  queueMicrotask(() => { mountSharedListingNote(shared); });
  const start = h('button', { type: 'button', onClick: () => beginWorkout({ useGps, useCamera, useMotion, sensorsNote, lineTitle: line.title }) }, ['Start']);
  const finish = h('button', { type: 'button', class: 'primary', onClick: () => finishWorkout(peer, { category, terms, note, groupCode, useGps, useCamera, useMotion, fenceLat, fenceLon, fenceRadius, pass, code, sensorsNote, intent, allowedIntents }) }, ['Finish']);
  const form = h('form', { id: 'exercise-session', onSubmit: (event) => event.preventDefault() }, [
    h('p', { class: 'legend' }, ['Exercise session (IdidIt / verified receipt). Start, then Finish. A workout alone mints no credit. Raw GPS, photos, and motion stay on this phone. Rewards come from another member or the front desk.']),
    h('p', { class: 'legend' }, ["Today's line"]),
    h('p', {}, [line.title]),
    h('p', {}, [line.text]),
    h('p', { class: 'legend' }, [line.source || '']),
    field('Category', category),
    field('Physical or mental', exerciseKind),
    field('Minutes', duration),
    arbiter,
    h('label', {}, [giverBox, ' I confirm this rate']),
    h('label', {}, [receiverBox, ' The other member confirms this rate']),
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', id: 'show-arbiter', onClick: () => showRate() }, ['Show the suggested rate']),
      h('button', { type: 'button', id: 'confirm-arbiter', onClick: () => confirmBoth() }, ['Confirm both']),
      h('button', { type: 'button', id: 'confirm-solo', onClick: () => confirmSolo() }, ['Confirm solo credit'])
    ]),
    field('Support terms', terms),
    field('Private note', note),
    field('Club or crew name', clubName),
    field('Club invite code', groupCode),
    h('label', {}, [useGps, ' Use GPS at start and finish']),
    h('label', {}, [useCamera, ' Use camera at start and finish']),
    h('label', {}, [useMotion, ' Use motion sensors']),
    field('Club latitude, stays on this device', fenceLat),
    field('Club longitude, stays on this device', fenceLon),
    field('Club radius, meters', fenceRadius),
    field('Intent on the receipt, optional', intent),
    sensorsNote,
    field('Passphrase', pass),
    field('6-digit code', code),
    h('div', { class: 'actions' }, [
      start,
      finish,
      h('button', { type: 'button', onClick: async () => {
        const result = await sim.createClubGroup(store, peer.id, { name: clubName.value, invite: groupCode.value, passphrase: pass.value, code: code.value, unixSeconds: Math.floor(Date.now() / 1000) });
        setStatus(result.ok ? `Private club invite ${result.code}. Share the code. It is not a public listing.` : result.error, result.ok ? 'ok' : 'bad');
      } }, ['Create club']),
      h('button', { type: 'button', onClick: async () => {
        const result = await sim.joinClubGroup(store, peer.id, { invite: groupCode.value, passphrase: pass.value, code: code.value, unixSeconds: Math.floor(Date.now() / 1000) });
        setStatus(result.ok ? `Joined ${result.name}.` : result.error, result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Join club'])
    ]),
    shared
  ]);
  const sessions = books.flatMap((book) => Object.values(book.exerciseSessions || {}));
  const rows = sessions.map((session) => {
    const owner = books.find((book) => book.id === session.authorId);
    const club = owner?.exercisePrivate?.[session.sessionId]?.groupCode || '';
    if (club && session.authorId !== peer.id && !peer.clubGroups?.[club]) return null;
    const mine = session.authorId === peer.id;
    const offers = Object.values((books.find((book) => book.id === session.authorId)?.exerciseSupports) || {}).filter((offer) => offer.sessionId === session.sessionId && offer.status === 'offered');
    const actions = [];
    if (!mine) {
      actions.push(h('button', { type: 'button', onClick: () => supportExercise(peer, session, 'contribute-lgme', pass, code) }, ['Contribute']));
      actions.push(h('button', { type: 'button', onClick: () => supportExercise(peer, session, 'contribute-credit', pass, code) }, ['Deed credit']));
      actions.push(h('button', { type: 'button', onClick: () => supportExercise(peer, session, 'barter', pass, code) }, ['Barter']));
    }
    for (const offer of offers.filter(() => mine)) {
      actions.push(h('button', { type: 'button', onClick: () => answerExercise(peer, offer, false, pass, code) }, ['No']));
      actions.push(h('button', { type: 'button', class: 'primary', onClick: () => answerExercise(peer, offer, true, pass, code) }, ['Accept']));
    }
    return h('article', { class: 'row' }, [
      h('p', {}, [`Session completed · ${session.day} · ${session.category} · ${session.evidence} · ${session.durationSec || 0}s · location matched club: ${session.locationMatched || 'no'}${session.intent ? ` · intent: ${session.intent}` : ''}`]),
      h('p', { class: 'legend' }, [`Terms: ${session.terms || 'Contribution or barter'}`]),
      actions.length ? h('div', { class: 'actions' }, actions) : null
    ]);
  });
  return h('section', { id: 'exercise-record' }, [
    h('h3', {}, ['Exercise session (IdidIt / verified receipt)']),
    form,
    ...rows.filter(Boolean)
  ]);
}

async function renderList(seat) {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const peer = await store.get(seat);
  if (!peer?.privateKeyJwk) {
    panel.replaceChildren(h('h2', {}, ['List']), h('p', { class: 'muted' }, ['Unlock the wallet before signing a listing.']));
    return;
  }
  const steps = h('p', { class: 'kicker' }, [`Step ${listStep} of 3`]);
  if (listStep === 1) {
    const file = h('input', { type: 'file', accept: 'image/*,video/*', capture: 'environment' });
    const video = h('video', { class: 'cam', playsinline: true, muted: true });
    video.hidden = true;
    file.addEventListener('change', async () => {
      const chosen = file.files && file.files[0];
      if (!chosen) return;
      try {
        const packed = await compressPhoto(chosen);
        listDraft = { ...listDraft, ...packed };
        setStatus('Photo compressed on this device. It is not uploaded. Beta.', 'ok');
        await render();
      } catch {
        setStatus('That photo could not be read. Nothing was stored.', 'bad');
      }
    });
    panel.replaceChildren(
      h('h2', {}, ['List']),
      await exerciseBoard(seat),
      steps,
      h('p', { class: 'muted' }, ['Take a photo or choose one. It is scaled down in this browser and kept on the listing locally.']),
      listDraft.photo ? h('img', { class: 'shot', alt: '', src: listDraft.photo, width: '224', height: '224', loading: 'lazy' }) : null,
      field('Photo', file),
      video,
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', id: 'list-camera', onClick: () => showCapture(seat, {
          defer: true,
          onDraft: (held) => { listDraft = { ...listDraft, photo: held.dataUrl || listDraft.photo, photoHash: held.hash, mediaBytes: held.bytes, mediaMime: held.mime, mediaDuration: held.duration }; },
          onSaved: () => render()
        }) }, ['Camera']),
        h('button', { type: 'button', class: 'primary', onClick: async () => {
          if (video.readyState >= 2) {
            const canvas = document.createElement('canvas');
            const max = 480;
            const scale = Math.min(1, max / Math.max(video.videoWidth || 320, video.videoHeight || 240));
            canvas.width = Math.max(1, Math.round((video.videoWidth || 320) * scale));
            canvas.height = Math.max(1, Math.round((video.videoHeight || 240) * scale));
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            const photo = canvas.toDataURL('image/jpeg', 0.72);
            listDraft = { ...listDraft, photo, photoHash: await sim.sha256(photo) };
            stopAnyCamera();
          }
          if (!listDraft.photoHash) { setStatus('Add a photo first.', 'bad'); return; }
          listStep = 2;
          await render();
        } }, ['Next'])
      ])
    );
    return;
  }
  if (listStep === 2) {
    const title = h('input', { required: true, maxlength: '80', value: listDraft.title });
    const kind = h('select', {}, sim.LISTING_KINDS.map((item) => option(item, item === 'ihavIT' ? 'ihavIT · I have it' : item === 'IwanIT' ? 'IwanIT · I want it' : 'IprovIT · I provide it', (listDraft.kind || 'ihavIT') === item)));
    const category = h('select', {}, CATEGORIES.map((item) => option(item, item, listDraft.category === item)));
    const condition = h('select', {}, CONDITIONS.map((item) => option(item, item, listDraft.condition === item)));
    const pickup = h('select', {}, PICKUPS.map((item) => option(item, item, listDraft.pickup === item)));
    const circle = h('input', { required: true, maxlength: '40', value: listDraft.circle, placeholder: 'Walkway, Soil, Logistics…' });
    const area = h('input', { maxlength: '80', value: listDraft.area, placeholder: 'Optional area phrase' });
    const form = h('form', {}, [
      field('Title', title),
      field('Kind', kind),
      field('Category', category),
      field('Condition', condition),
      field('Pickup', pickup),
      field('Circle', circle),
      field('Area, optional', area),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', onClick: () => { listStep = 1; render(); } }, ['Back']),
        h('button', { class: 'primary', type: 'submit' }, ['Next'])
      ])
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      listDraft = { ...listDraft, title: title.value.trim(), kind: kind.value, category: category.value, condition: condition.value, pickup: pickup.value, circle: circle.value.trim(), area: area.value.trim() };
      if (!listDraft.title || !listDraft.circle) { setStatus('Add a title and a circle.', 'bad'); return; }
      listStep = 3;
      render();
    });
    panel.replaceChildren(h('h2', {}, ['List']), steps, h('p', { class: 'muted' }, ['Name the item, its condition, how it changes hands, and which circle it belongs to.']), form);
    return;
  }
  const amount = h('input', { inputmode: 'decimal', required: true, value: listDraft.amount, placeholder: '0.00' });
  const reference = h('select', {}, [option('', 'No dollar reference', !listDraft.referenceId), ...catalog.map((item) => option(item.id, optionLabel(item, catalogMeta), listDraft.referenceId === item.id))]);
  const hint = h('p', { class: 'legend' }, [catalogNotice]);
  function paintHint() {
    const item = catalog.find((row) => row.id === reference.value);
    hint.textContent = item ? referenceDetail(item) : catalogNotice;
  }
  reference.addEventListener('change', paintHint);
  paintHint();
  const form = h('form', {}, [
    field('Value in $lgme', amount),
    field('Optional $ reference', reference),
    hint,
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: () => {
        const item = catalog.find((row) => row.id === reference.value);
        if (item && item.avg_value_usd != null) amount.value = String(item.avg_value_usd);
      } }, ['Use the reference number']),
      h('button', { type: 'button', onClick: () => { listStep = 2; render(); } }, ['Back']),
      h('button', { class: 'primary', type: 'submit' }, ['Sign and list'])
    ])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const item = catalog.find((row) => row.id === reference.value);
      const created = await sim.createListing(store, seat, {
        ...listDraft,
        amount: amount.value,
        referenceId: item ? item.id : null,
        referenceAvg: item ? item.avg_value_usd : null
      });
      if (!created.ok) { setStatus(created.error, 'bad'); return; }
      if (listDraft.mediaBytes) {
        const made = await sim.recordMedia(store, seat, { bytes: listDraft.mediaBytes, mime: listDraft.mediaMime, duration: listDraft.mediaDuration || 0, listingId: created.listing.id });
        const peer = await store.get(seat);
        if (made.ok && peer?.privateKeyJwk) await saveMediaFile(seat, peer.privateKeyJwk, made.hash, listDraft.mediaBytes, listDraft.mediaMime);
      }
      listDraft = { photo: '', photoHash: '', title: '', category: 'Goods', condition: 'Good', pickup: 'Pickup', circle: '', area: '', amount: '', referenceId: '' };
      listStep = 1;
      openListingId = created.listing.id;
      setStatus('Listed and signed. The photo stayed on this device. Beta.', 'ok');
      location.hash = 'market';
    } finally {
      busy = false;
    }
  });
  panel.replaceChildren(h('h2', {}, ['List']), steps, h('p', { class: 'muted' }, ['The value is in $lgme. A dollar figure is only a suggestion from the reference list.']), referenceCatalogCard(), form);
}

async function takeChatToken(seat, raw) {
  const opened = await sim.openMessage(String(raw || '').trim());
  if (!opened.ok) return opened;
  if (opened.message.kind === 'chat-match') {
    const result = await sim.acceptMatch(store, seat, opened.message);
    if (!result.ok) return result;
    matchNote = result.matched ? 'Matched' : `Diverges at message ${result.index + 1}${result.divergent?.[0]?.text ? ': ' + result.divergent[0].text : ''}`;
    if (opened.message.body?.threadId) openThreadId = opened.message.body.threadId;
    return { ok: true, matched: result.matched };
  }
  if (opened.message.kind !== 'chat') return { ok: false, error: 'This is not a signed text.' };
  const result = await sim.acceptChatToken(store, seat, opened.message);
  if (result.ok && result.threadId) openThreadId = result.threadId;
  return result;
}

async function phoneCard(seat, otherId, threadId) {
  const other = otherId ? await store.get(otherId) : null;
  const phone = sim.normalizePhone(other?.kyc?.phone || '');
  const identity = other?.kyc?.salt ? await sim.memberKycHash(other) : null;
  const mine = await sim.memberKycHash(await store.get(seat));
  const messages = await sim.readChat(store, seat, threadId);
  const text = h('textarea', { maxlength: '400', placeholder: 'Write a text' });
  const paste = h('textarea', { class: 'codebox', placeholder: 'Paste a signed text or a root' });
  const note = h('input', { maxlength: '160', placeholder: 'Note about the call' });
  const sms = signedSms && signedSms.threadId === threadId ? signedSms : null;
  const form = h('form', {}, [
    field('Text', text),
    h('div', { class: 'actions' }, [
      h('button', { class: 'primary', type: 'submit' }, ['Sign']),
      phone ? h('a', { class: 'btn', href: sim.telHref(phone), onClick: (event) => { event.preventDefault(); openCall = { phone, hash: identity?.hash || '', start: new Date().toISOString(), threadId }; render(); } }, ['Call']) : null
    ])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const sent = await sim.composeChat(store, seat, { toId: otherId, toPhone: phone, threadId, text: text.value, negotiation: null });
    if (!sent.ok) { setStatus(sent.error, 'bad'); return; }
    signedSms = { threadId, sms: sent.sms, encoded: sent.encoded };
    matchNote = '';
    setStatus('Signed. Open SMS to hand it to your phone. This page did not send it. Beta.', 'ok');
    await render();
  });
  const kids = [
    h('h3', {}, ['Text and call']),
    h('p', { class: 'legend' }, [
      phone && identity?.ok
        ? `Phone ${phone}. Member hash ${identity.hash.slice(0, 12)}. The signup details stay on their phone.`
        : 'Add a phone on the member check before texting.'
    ]),
    mine.ok ? h('p', { class: 'legend' }, [`Your member hash ${mine.hash.slice(0, 12)}. It is bound to your signing key.`]) : null,
    form
  ];
  if (sms) {
    kids.push(h('div', { class: 'actions' }, [
      h('a', { class: 'btn primary', href: sms.sms }, ['Open SMS']),
      otherId ? h('button', { type: 'button', onClick: async () => {
        const saved = await sim.acceptChatToken(store, otherId, sms.encoded);
        setStatus(saved.ok ? 'Recorded on the other book on this device. No SMS was sent. Beta.' : saved.error, saved.ok ? 'ok' : 'bad');
        if (saved.ok) await render();
      } }, ['Record on the other book']) : null,
      h('button', { type: 'button', onClick: async () => {
        const token = await sim.composeMatch(store, seat, threadId, phone);
        if (!token.ok) { setStatus(token.error, 'bad'); return; }
        signedSms = { threadId, sms: token.sms, encoded: token.encoded, match: true };
        if (otherId) {
          const result = await sim.acceptMatch(store, otherId, token.encoded);
          matchNote = result.ok && result.matched ? 'Matched' : result.ok ? `Diverges at message ${result.index + 1}${result.divergent?.[0]?.text ? ': ' + result.divergent[0].text : ''}` : result.error;
        } else matchNote = 'The root is ready in Open SMS.';
        await render();
      } }, ['Match'])
    ]));
  }
  if (matchNote) kids.push(h('p', { id: 'chat-match', class: matchNote === 'Matched' ? 'ok' : 'bad' }, [matchNote]));
  if (openCall && openCall.threadId === threadId) {
    const endForm = h('form', {}, [
      field('Call note', note),
      h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Record the call'])])
    ]);
    endForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const saved = await sim.recordCall(store, seat, { phone: openCall.phone, peerKycHash: openCall.hash, start: openCall.start, end: new Date().toISOString(), note: note.value });
      setStatus(saved.ok ? 'Call noted. No audio was stored. This page did not place the call. Beta.' : saved.error, saved.ok ? 'ok' : 'bad');
      if (saved.ok) openCall = null;
      await render();
    });
    kids.push(h('p', { class: 'legend' }, ['The dialer opened if your phone allowed it. Record the start and end here. No audio is kept.']), endForm);
  }
  kids.push(h('div', { class: 'actions' }, [h('button', { type: 'button', id: 'chat-camera', onClick: () => showCapture(seat, { threadId, toId: otherId, toPhone: phone, onSaved: () => render() }) }, ['Camera'])]));
  const seen = new Set();
  for (const line of messages) {
    if (line.media?.hash) seen.add(line.media.hash);
    kids.push(await chatMediaBubble(seat, line));
  }
  const localMedia = sim.listMedia(await store.get(seat), { threadId }).filter((record) => record.ownerId === seat && !seen.has(record.hash));
  for (const record of localMedia) kids.push(await chatMediaBubble(seat, { senderId: seat, text: String(record.mime).startsWith('video') ? 'Video' : 'Photo', threadId, media: record }));
  const received = h('input', { type: 'file', accept: 'image/*,video/*', capture: 'environment' });
  received.addEventListener('change', async () => {
    const chosen = received.files && received.files[0];
    if (!chosen) return;
    const bytes = new Uint8Array(await chosen.arrayBuffer());
    const hash = await sim.hashBytes(bytes);
    const claim = messages.find((line) => line.media?.hash === hash) || messages.find((line) => line.media);
    if (!claim?.media) { setStatus('Not authentic', 'bad'); return; }
    const owner = await store.get(claim.senderId);
    const saved = await sim.receiveMedia(store, seat, { bytes, ...claim.media, ownerId: claim.senderId, publicKeyJwk: owner?.publicKeyJwk || claim.publicKeyJwk });
    if (!saved.ok) { setStatus(saved.error || 'Not authentic', 'bad'); return; }
    const peer = await store.get(seat);
    if (peer?.privateKeyJwk) await saveMediaFile(seat, peer.privateKeyJwk, hash, bytes, claim.media.mime);
    setStatus('Verified and saved on this phone. Beta.', 'ok');
    await render();
  });
  kids.push(field('Save a received file', received));
  const pasteForm = h('form', {}, [
    field('Paste a token', paste),
    h('div', { class: 'actions' }, [h('button', { type: 'submit' }, ['Record token'])])
  ]);
  pasteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const saved = await takeChatToken(seat, paste.value);
    setStatus(saved.ok ? (saved.matched ? 'Matched' : 'Token recorded. Beta.') : saved.error, saved.ok ? 'ok' : 'bad');
    if (saved.ok) await render();
  });
  kids.push(pasteForm);
  return h('article', { class: 'card', id: 'chat-phone' }, kids);
}

async function renderChats(seat) {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  if (pendingChat) {
    const token = pendingChat;
    pendingChat = '';
    const saved = await takeChatToken(seat, token);
    setStatus(saved.ok ? 'Opened the signed token. Beta.' : saved.error, saved.ok ? 'ok' : 'bad');
  }
  const threads = await sim.listThreads(store, seat);
  const extras = await sim.listChatThreads(store, seat);
  const known = new Set(threads.map((thread) => thread.id));
  if (!openThreadId || (!known.has(openThreadId) && !extras.some((item) => item.id === openThreadId))) {
    panel.replaceChildren(...[
      h('h2', {}, ['Chats']),
      h('p', { class: 'muted' }, ['Texts open in your own SMS app. Calls open in your phone. This page does not send them. A QR is only for an in-person handoff.']),
      threads.length ? h('div', { class: 'grid' }, threads.map((thread) => h('button', {
        type: 'button',
        class: 'card',
        onClick: () => { openThreadId = thread.id; matchNote = ''; render(); }
      }, [
        h('h3', {}, [thread.title || 'Listing']),
        h('p', { class: 'muted' }, [`${thread.amount} $lgme · ${thread.status}`])
      ]))) : null,
      ...extras.filter((item) => !known.has(item.id)).map((item) => h('button', {
        type: 'button',
        class: 'card',
        onClick: () => { openThreadId = item.id; matchNote = ''; render(); }
      }, [
        h('h3', {}, [item.preview || 'Text']),
        h('p', { class: 'muted' }, [`${item.length} signed`])
      ])),
      !threads.length && !extras.length ? h('p', { class: 'empty' }, ['No chats yet. Open a listing and start one.']) : null
    ].filter(Boolean));
    return;
  }
  if (!known.has(openThreadId)) {
    const card = await phoneCard(seat, '', openThreadId);
    panel.replaceChildren(
      h('button', { type: 'button', class: 'quiet', onClick: () => { openThreadId = ''; render(); } }, ['All chats']),
      h('h2', {}, ['Text']),
      card
    );
    return;
  }
  const thread = threads.find((item) => item.id === openThreadId);
  const mine = thread.buyerId === seat;
  const offer = h('input', { inputmode: 'decimal', value: String(thread.amount || ''), 'aria-label': 'Amount in $lgme' });
  const note = h('input', { maxlength: '160', placeholder: 'Note' });
  const paste = h('textarea', { class: 'codebox', placeholder: 'Paste a handoff code' });
  const video = h('video', { class: 'cam', playsinline: true, muted: true });
  video.hidden = true;
  const qrHost = h('div', {});
  const nodes = [
    h('button', { type: 'button', class: 'quiet', onClick: () => { openThreadId = ''; render(); } }, ['All chats']),
    h('h2', {}, [thread.title || 'Chat']),
    h('p', { class: 'muted' }, [`${thread.amount} $lgme · ${thread.status}. Beta.`]),
    await phoneCard(seat, mine ? thread.sellerId : thread.buyerId, thread.id),
    ...thread.messages.map((line) => h('div', { class: 'bubble' }, [`${nameById[line.fromId] || line.fromId}: ${line.text}`]))
  ];
  if (!['settled', 'refused', 'cancelled', 'pending'].includes(thread.status)) {
    nodes.push(h('div', { class: 'chips' }, [
      chip('Is this available?', false, async () => {
        const posted = await sim.postChat(store, seat, thread.id, 'Is this available?');
        setStatus(posted.ok ? 'Asked. Nothing was sent off this device. Beta.' : posted.error, posted.ok ? 'ok' : 'bad');
        if (posted.ok) await render();
      }),
      chip('Make an offer', false, () => { offer.focus(); })
    ]));
    const form = h('form', {}, [
      field(mine ? 'Offer in $lgme' : 'Counter in $lgme', offer),
      field('Note', note),
      h('div', { class: 'actions' }, [
        h('button', { class: 'primary', type: 'submit' }, [mine ? 'Offer' : 'Counter']),
        h('button', { type: 'button', onClick: () => signDeal(seat, thread.id) }, ['Accept & Sign']),
        h('button', { type: 'button', onClick: () => refuseDeal(seat, thread.id, note.value) }, ['Refuse']),
        h('button', { type: 'button', onClick: () => cancelDeal(seat, thread.id) }, ['Cancel'])
      ])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = mine
        ? await sim.makeOffer(store, seat, thread.id, offer.value)
        : await sim.counterOffer(store, seat, thread.id, offer.value);
      setStatus(result.ok ? 'Signed the amount. Final balances have not moved. Beta.' : result.error, result.ok ? 'ok' : 'bad');
      if (result.ok) await render();
    });
    nodes.push(form);
  }
  if (thread.status === 'pending' && mine) {
    const shown = await sim.buyerHandoff(store, seat, thread.id);
    if (shown.ok) {
      nodes.push(h('h3', {}, ['Handoff QR']), h('p', { class: 'legend' }, ['Single use. The seller scans or pastes this, then countersigns. Settlement posts to both tapes.']));
      nodes.push(qrHost);
      nodes.push(h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'primary', onClick: () => settleHandoff(thread.sellerId, shown.encoded) }, ['Settle on this device']),
        h('button', { type: 'button', onClick: async () => {
          try { await navigator.clipboard.writeText(shown.encoded); setStatus('Copied. This page did not send it. Beta.', 'ok'); }
          catch { setStatus('Copy did not run. The code is on screen. Beta.', 'bad'); }
        } }, ['Copy']),
        h('button', { type: 'button', onClick: () => download(`handoff-${thread.id.slice(0, 8)}.json`, shown.encoded, 'application/json') }, ['File'])
      ]));
      queueMicrotask(() => drawQr(qrHost, shown.qr || shown.encoded));
    } else nodes.push(h('p', { class: 'bad' }, [shown.error]));
  }
  if (thread.status === 'pending' && !mine) {
    nodes.push(
      h('h3', {}, ['Countersign the handoff']),
      h('p', { class: 'legend' }, ['Scan the buyer’s QR, or paste the code. One use settles both books.']),
      video,
      field('Handoff code', paste),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'primary scan-prominent', onClick: () => startScan(video, paste, null, (raw) => settleHandoff(seat, raw)) }, ['Scan QR']),
        h('button', { type: 'button', class: 'primary', onClick: () => settleHandoff(seat, paste.value) }, ['Countersign'])
      ])
    );
  }
  panel.replaceChildren(...nodes.filter(Boolean));
}

async function signDeal(seat, threadId) {
  const result = await sim.acceptAndSign(store, seat, threadId);
  setStatus(result.ok ? (result.thread.status === 'pending' ? 'Pending hold. Final balances have not moved. Beta.' : 'Signed. Waiting for the other signature. Beta.') : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

async function refuseDeal(seat, threadId, statement) {
  const result = await sim.refuseDeal(store, seat, threadId, statement || 'REFUSAL');
  setStatus(result.ok ? 'REFUSAL recorded. No balance moves. No penalty. Beta.' : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

async function cancelDeal(seat, threadId) {
  const result = await sim.cancelDeal(store, seat, threadId);
  setStatus(result.ok ? 'Hold released. Final balances stay put. Beta.' : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

async function settleHandoff(sellerId, encoded) {
  const result = await sim.sellerHandoff(store, sellerId, String(encoded || '').trim());
  if (!result.ok) { setStatus(result.error, 'bad'); return; }
  setStatus(`Settled. Buyer ${result.buyerBalance} · seller ${result.sellerBalance}. Beta.`, 'ok');
  toast('Handoff settled on both books. Beta.');
  await render();
}

function sourceBook() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SOURCE_KEY) || '');
    if (parsed && Array.isArray(parsed.requests)) return parsed;
  } catch { /* a new book */ }
  return { requests: [] };
}

function saveSourceBook(book) {
  try { localStorage.setItem(SOURCE_KEY, JSON.stringify(book)); } catch { /* the screen still shows the links */ }
}

function localSourcePool() {
  return [
    ...offerupItems.map((item) => ({ ...item, category: 'exercise equipment', site: 'Already on lgme' })),
    ...thumbtackItems.map((item) => ({ ...item, category: item.isIprovIT ? 'exercise-equipment repair' : 'services', site: 'Already on lgme' }))
  ];
}

async function renderSources() {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const detected = await detectLocalAi(globalThis);
  const book = sourceBook();
  const category = h('select', {}, [
    option('exercise equipment', 'Exercise equipment', true),
    option('exercise-equipment repair', 'Exercise-equipment repair', false),
    option('goods', 'Goods', false),
    option('services', 'Services', false)
  ]);
  const keywords = h('input', { value: 'treadmill elliptical', maxlength: '120' });
  const location = h('input', { value: 'Washington DC', maxlength: '80' });
  const radius = h('input', { type: 'number', min: '0', step: '1', value: '25' });
  const maxPrice = h('input', { type: 'number', min: '0', step: '1', value: '500' });
  const frequency = h('select', {}, [
    option('off', 'Off', true),
    option('daily', 'Daily', false),
    option('weekly', 'Weekly', false)
  ]);
  const notify = h('input', { type: 'checkbox' });
  const useAi = h('input', { type: 'checkbox' });
  const customName = h('input', { maxlength: '60', placeholder: 'Site name' });
  const customTemplate = h('input', { maxlength: '240', placeholder: 'https://example.com/search?q={query}' });
  const siteBox = h('div', { id: 'source-sites' });
  const results = h('div', { id: 'source-results' });
  function paintSites() {
    const selected = new Set(presetsFor(category.value).map((site) => site.id));
    siteBox.replaceChildren(...SOURCE_SITES.map((site) => {
      const box = h('input', { type: 'checkbox' });
      box.checked = selected.has(site.id);
      box.dataset.site = site.id;
      return h('label', { class: 'row' }, [box, site.name]);
    }));
  }
  category.addEventListener('change', paintSites);
  paintSites();
  const picks = (dailyPicks.categories || []).map((row) => h('article', { class: 'card', id: 'daily-picks' }, [
    h('h3', {}, [`Today's top 3 · ${row.category}`]),
    h('p', { class: 'legend' }, [`${dailyPicks.updated || 'undated'} · ${row.request || ''}`]),
    h('p', { class: 'legend' }, ['Curated, verify before contacting. Nothing is sent.']),
    ...(row.picks || []).slice(0, 3).map((pick) => h('div', { class: 'row' }, [
      pick.image ? h('img', { class: 'listing-photo', alt: '', src: pick.image, width: '224', height: '224', loading: 'lazy' }) : null,
      h('p', {}, [pick.title]),
      h('p', { class: 'price' }, [`${pick.price || ''} · ${pick.location || ''} · ${pick.site || ''}`]),
      h('p', { class: 'legend' }, [pick.note || '']),
      h('p', {}, [h('a', { href: pick.url, rel: 'noopener noreferrer' }, ['Open this listing'])])
    ]))
  ]));
  const form = h('form', { id: 'source-finder' }, [
    h('div', { class: 'grid two' }, [
      field('Category', category),
      field('Keywords', keywords),
      field('Location', location),
      field('Radius, miles', radius),
      field('Max price, US$', maxPrice),
      field('Look again', frequency)
    ]),
    h('p', { class: 'legend' }, ['Pick the sites to open. A link is only a search. This desk does not contact anyone.']),
    siteBox,
    h('div', { class: 'grid two' }, [
      field('Custom site name', customName),
      field('Custom search link', customTemplate)
    ]),
    h('label', { class: 'row' }, [notify, 'In-app badge when this search is due']),
    h('label', { class: 'row' }, [useAi, 'Use on-device AI to suggest sites and search terms']),
    h('p', { class: 'legend', id: 'source-ai-status' }, [
      detected.labels.length ? `On this device: ${detected.labels.join(', ')}. ${detected.note}` : detected.note
    ]),
    h('div', { class: 'actions' }, [
      h('button', { class: 'primary', type: 'submit' }, ['Build search links']),
      h('button', { type: 'button', id: 'allow-notifications', onClick: async () => {
        if (!('Notification' in window)) {
          setStatus('This browser has no notification setting. The badge still works.', 'bad');
          return;
        }
        const choice = await Notification.requestPermission();
        setStatus(choice === 'granted' ? 'Notifications allowed on this device. Nothing was contacted.' : 'Notifications stay off. The badge still works.', choice === 'granted' ? 'ok' : 'bad');
      } }, ['Allow notifications'])
    ])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const criteria = {
      category: category.value,
      keywords: keywords.value.trim(),
      location: location.value.trim(),
      radius: radius.value,
      maxPrice: maxPrice.value
    };
    const custom = customName.value.trim() || customTemplate.value.trim()
      ? customSite(customName.value, customTemplate.value)
      : { ok: true, site: null };
    if (!custom.ok) { setStatus(custom.error, 'bad'); return; }
    const chosen = [...siteBox.querySelectorAll('input[data-site]')].filter((box) => box.checked).map((box) => box.dataset.site);
    const customSites = custom.site ? [custom.site] : [];
    if (custom.site) chosen.push(custom.site.id);
    let siteIds = chosen;
    let note = 'Preset lists.';
    if (useAi.checked) {
      const suggested = await suggestSites(criteria, {
        optedIn: true,
        detected,
        prompt: detected.canSuggest && globalThis.LanguageModel?.create ? async (text) => {
          const session = await globalThis.LanguageModel.create();
          try { return await session.prompt(text); } finally { session.destroy?.(); }
        } : undefined
      });
      siteIds = [...new Set([...chosen, ...suggested.siteIds])];
      note = suggested.note;
    }
    const locals = matchCriteria(localSourcePool(), criteria);
    const links = buildLinks(criteria, siteIds, customSites);
    const saved = {
      ...criteria,
      sites: siteIds,
      customSites,
      frequency: frequency.value,
      notify: notify.checked,
      useAi: useAi.checked,
      lastSeen: new Date().toISOString()
    };
    saveSourceBook({ requests: [saved, ...book.requests.filter((row) => row.category !== saved.category)].slice(0, 12) });
    results.replaceChildren(
      h('h3', {}, ['Already on lgme']),
      locals.length ? h('div', {}, locals.map((item) => h('article', { class: 'row' }, [
        h('p', {}, [item.title]),
        h('p', { class: 'legend' }, [`${item.price || ''} · ${item.city || item.location || ''} · listed here first`])
      ]))) : h('p', { class: 'legend' }, ['No listing already on lgme fits this request.']),
      h('h3', {}, ['Search links']),
      h('p', { class: 'legend' }, [`${note} Nothing is contacted. You open a site yourself.`]),
      ...links.map((link) => h('p', {}, [h('a', { href: link.url, rel: 'noopener noreferrer' }, [link.name])]))
    );
    setStatus('Links are ready. Nothing was sent.', 'ok');
    renderTabs();
  });
  panel.replaceChildren(
    h('h2', {}, ['Sources']),
    h('p', { class: 'muted' }, ['Find a wanted item on the sites you name. Matches already on lgme come first. Drafts are not sent.']),
    ...picks,
    form,
    results
  );
}

function glossaryTable() {
  const rows = [
    ['Tape / Constitutive Record', 'Public Ledger / Verified Receipt', 'An immutable proof of completed work everyone can inspect.'],
    ['Third Seat', 'The person's seat', 'The Third Seat is your seat, held by you alone, with equal standing beside the state and the firm. You may decline any exchange at no cost, no unpublished rule can bind you, and any hold on your exchange must give a reason and can be challenged, decided within 7 days or it lapses. Holds the law requires are cited, recorded, and kept no broader or longer than the law demands.'],
    ['Quiet Print', 'Hidden Issuance / Shadow Dilution', 'Creating money or promises off-schedule behind closed doors.'],
    ['Floor', 'Basic Needs Reserve', 'Food, shelter, and essentials secured prior to speculative spending.'],
    ['Issue / Named Bill', 'Peer Promise / Mutual Credit', 'A non-cash IOU directly tied to human effort, not speculative debt.']
  ];
  return h('table', { class: 'gloss' }, [
    h('thead', {}, [h('tr', {}, ['Framework term', 'Front-end human primitive', 'Practical everyday function'].map((label) => h('th', {}, [label])))]),
    h('tbody', {}, rows.map((row) => h('tr', {}, row.map((cell, index) => h('td', { 'data-label': ['Framework term', 'Front-end human primitive', 'Practical everyday function'][index] }, [cell])))))
  ]);
}

function renderHelp() {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const sections = [
    ['Floor · basic needs reserve', 'Food, shelter, and essentials secured prior to speculative spending. A settlement, a transfer, or an attested IOU that would spend that reserve is not applied. The tape records Blocked: Floor stays senior.'],
    ['Third Seat · your seat', 'The Third Seat is your seat, held by you alone, with equal standing beside the state and the firm. You may decline any exchange at no cost, no unpublished rule can bind you, and any hold on your exchange must give a reason and can be challenged, decided within 7 days or it lapses. Holds the law requires are cited, recorded, and kept no broader or longer than the law demands. The veto stays on the tape. Nothing moves. There is no penalty.'],
    ['Tape · public ledger', 'An immutable proof of completed work everyone can inspect. Each book is append-only. Every entry names the previous hash and is signed with that peer’s key. Export the JSON and verify it.'],
    ['Issue · peer promise', 'A non-cash IOU directly tied to human effort, not speculative debt. It is recorded as pending. The balance moves only when the named counterparty signs. A refusal leaves the balance put.'],
    ['Local book', 'Registration writes a GENESIS entry for a local grant of 100. It is not Solana $lgme. Your wallet signs a real payment.'],
    ['Authenticator', 'A passphrase encrypts the key at rest with AES-GCM and PBKDF2. A 6-digit TOTP, RFC 6238, is checked with WebCrypto HMAC. The setup QR can be scanned by an authenticator app. This page generates the same code while the secret is still on screen. It never sends the code. A wrong code leaves the wallet locked.'],
    ['Another device', 'There is no server. Sign a proposal, countersign, refusal, transfer, attestation, or handoff, then carry the lgme1. code by copy, by a link whose data sits in the URL fragment, by a QR, or by a .json file. On the other device, verification runs before anything is appended. A QR is for an in-person handoff. To text or email a draft, the page opens sms: or mailto: so you send it from your own app. The outbox and inbox are a local log of that.'],
    ['Phone chat', 'A text is signed here, then Open SMS hands it to your phone’s own messages app. The link or the pasted token is checked for the sender’s signature and the member hash. A call button opens tel: on your phone. The tape records the start, the end, the other member’s hash, and a note you type. No audio is stored. Match sends the chat root by SMS and says Matched, or names the first message that differs. This page does not send the text and does not place the call. The other person’s signup details stay on their phone. You keep the phone number and the hash.'],
    ['Photos and video', 'The camera and the gallery stay on this phone. Photos are compressed and video is kept short. The file is encrypted in this browser. The tape stores only the signed hash, the type, the size, and the length. Share hands the file to your own apps. The signed text carries the hash. A file that does not match says Not authentic. Nothing is uploaded.'],
    ['IdidIt (verified receipt)', 'An IdidIt (verified receipt) in US$ is optional on a work record. An unpaid receipt does not change a balance. A reminder opens your own SMS app. The payer pays with the 6-digit code when the wallet is locked. Floors still hold. A refusal is recorded and carries no penalty. A paid receipt can earn a small reward, capped each period. Unpaid and refused receipts earn none.'],
    ['Market', 'Listings are signed with the peer key. The origin hash names the listing. A photo stays on this device. Offer, counter, and Accept & Sign create a pending hold. Final balances move only when the seller countersigns the buyer’s single-use handoff. A refusal is recorded and carries no penalty. Peer standing is read from the local book.']
  ];
  const install = h('div', { class: 'card' }, [
    h('h3', {}, ['Install']),
    h('p', { class: 'muted' }, ['Installed, this beta opens straight into the desk. The browser does the install. This page does not send a message for you.']),
    h('button', { type: 'button', class: 'primary', 'data-install': '1', hidden: true, onClick: promptInstall }, ['Install']),
    h('p', { id: 'ios-install', class: 'legend', hidden: true }, ['On iPhone or iPad, open Share, then Add to Home Screen. The icon opens this beta.'])
  ]);
  panel.replaceChildren(
    h('h2', {}, ['Help']),
    h('p', { class: 'muted' }, ['Beta. Real $lgme moves only when your Solana wallet signs. This page does not send a message for you and does not write to Hedera.']),
    h('p', {}, [h('a', { href: '/marketing' }, ['Marketing & Adoption'])]),
    h('p', {}, [h('a', { href: '/good-deeds' }, ['Every good deed deserves another'])]),
    h('p', {}, [h('a', { href: '/examine' }, ['Examine'])]),
    h('button', { type: 'button', class: 'card mag-card', onClick: () => { location.hash = 'resources'; } }, [
      h('span', { class: 'kicker' }, ['Magazine']),
      h('h3', {}, ['Resources']),
      h('p', { class: 'muted' }, ['Alice, Bob, and Charlie. The market. The fifteen exchanges. The refusal. The third seat and the story.'])
    ]),
    install,
    h('h3', {}, ['Glossary']),
    glossaryTable(),
    ...sections.map(([title, body]) => h('article', { class: 'card' }, [h('h3', {}, [title]), h('p', { class: 'muted' }, [body])])),
    h('div', { class: 'actions' }, [h('button', { type: 'button', class: 'quiet', onClick: () => showWalk(0) }, ['Show intro'])])
  );
  syncInstall();
}

function renderBlock(block) {
  if (block.type === 'pre') return h('pre', { class: 'exch' }, [block.text]);
  if (block.type === 'list') return h('ol', {}, block.items.map((item) => h('li', {}, [item])));
  if (block.type === 'link') return h('p', {}, [h('a', { href: block.href }, [block.text])]);
  if (block.type === 'table') {
    return h('table', {}, [
      h('thead', {}, [h('tr', {}, block.headers.map((cell) => h('th', {}, [cell])))]),
      h('tbody', {}, block.rows.map((row) => h('tr', {}, row.map((cell) => h('td', {}, [cell])))))
    ]);
  }
  return h('p', {}, [block.text]);
}

function renderResources() {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const id = decodeURIComponent(location.hash.replace(/^#/, ''));
  const article = ARTICLES.find((item) => item.id === id);
  if (!article) {
    panel.replaceChildren(
      h('p', { class: 'kicker' }, ['Beta · Resources']),
      h('h2', {}, ['The magazine']),
      h('p', { class: 'muted' }, ['How it works, mutual credit, and the third-seat story, kept in this app so they can be read offline.']),
      h('div', { class: 'mag' }, ARTICLES.map((item) => h('button', {
        type: 'button',
        class: 'card mag-card',
        onClick: () => { location.hash = item.id; }
      }, [
        h('span', { class: 'kicker' }, [item.kicker]),
        h('h3', {}, [item.title]),
        h('p', { class: 'muted' }, [item.deck])
      ]))),
      h('button', { type: 'button', class: 'quiet', onClick: () => showWalk(0) }, ['Show intro']),
      h('button', { type: 'button', class: 'quiet', onClick: () => { location.hash = 'help'; } }, ['Back to Help'])
    );
    return;
  }
  panel.replaceChildren(
    h('button', { type: 'button', class: 'quiet', onClick: () => { location.hash = 'resources'; } }, ['All articles']),
    h('p', { class: 'kicker' }, [`Beta · ${article.kicker}`]),
    h('h2', {}, [article.title]),
    h('p', { class: 'muted' }, [article.deck]),
    ...article.blocks.map(renderBlock)
  );
}

let deferredInstall = null;

function syncInstall() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  document.querySelectorAll('[data-install]').forEach((button) => {
    button.hidden = standalone || !deferredInstall;
  });
  const ios = document.getElementById('ios-install');
  if (ios) {
    const apple = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    ios.hidden = !(apple && !standalone);
  }
}

async function promptInstall() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  syncInstall();
}

const INTRO_SEEN = 'lgme.exchange.introSeen';
const SPLASH_SEEN = 'lgme.exchange.splashSeen';

function storedFlag(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

function storeFlag(key) {
  try { localStorage.setItem(key, '1'); } catch { /* a private window can still close the note */ }
}

function showSplash() {
  const splash = document.getElementById('splash');
  const video = document.getElementById('splash-video');
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (installed) {
    if (splash) splash.hidden = true;
    return Promise.resolve();
  }
  if (!splash || storedFlag(SPLASH_SEEN)) {
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.querySelectorAll('source').forEach((source) => source.remove());
    }
    return Promise.resolve();
  }
  storeFlag(SPLASH_SEEN);
  splash.hidden = false;
  const coin = splash.querySelector('.splash-coin');
  if (coin) coin.classList.add('is-growing');
  return new Promise((resolve) => {
    let closed = false;
    const done = () => {
      if (closed) return;
      closed = true;
      splash.hidden = true;
      if (video) video.pause();
      resolve();
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce && video) video.remove();
    if (!reduce && video) video.play().catch(() => {});
    setTimeout(done, reduce ? 700 : 3000);
  });
}

const WALK = [
  ['Beta', 'This desk settles agreed $lgme from your own Solana wallet. It does not hold a seed phrase or send email. Exchange test listings are written to Hedera testnet topic 0.0.11397293 and paid by 0.0.11281203. You confirm a draft before it is posted.'],
  ['Separate books', 'Alice, Bob, and Charlie each keep their own tape. On one device you switch seats. On two devices you carry a signed message. There is no central ledger.'],
  ['Floor · basic needs reserve', 'Food, shelter, and essentials secured prior to speculative spending. A line that would spend that reserve is blocked and the block stays on the tape.'],
  ['Third Seat · your seat', 'The Third Seat is your seat, held by you alone, with equal standing beside the state and the firm. You may decline any exchange at no cost, no unpublished rule can bind you, and any hold on your exchange must give a reason and can be challenged, decided within 7 days or it lapses. Holds the law requires are cited, recorded, and kept no broader or longer than the law demands. Nothing moves. There is no penalty.'],
  ['100 $lgme', 'Register a new peer and the GENESIS line grants 100 $lgme on this book. Then the key is locked behind a passphrase and a 6-digit code.'],
  ['Carry the signature', 'Copy the code, open the share link, scan the QR, or save the JSON. The other device checks the signature and the hash link before it appends.']
];

function showWalk(step) {
  storeFlag(INTRO_SEEN);
  let overlay = document.getElementById('walk');
  if (!overlay) {
    overlay = h('div', { class: 'walk', id: 'walk', role: 'dialog', 'aria-modal': 'true' });
    document.body.append(overlay);
  }
  overlay.hidden = false;
  const [title, body] = WALK[step];
  const card = h('article', { class: 'card' }, [
    h('p', { class: 'kicker' }, [`Beta · ${step + 1} of ${WALK.length}`]),
    h('h2', {}, [title]),
    h('p', {}, [body]),
    h('div', { class: 'actions' }, [
      step > 0 ? h('button', { type: 'button', onClick: () => showWalk(step - 1) }, ['Back']) : null,
      step < WALK.length - 1
        ? h('button', { type: 'button', class: 'primary', onClick: () => showWalk(step + 1) }, ['Next'])
        : h('button', { type: 'button', class: 'primary', onClick: () => { overlay.hidden = true; storeFlag(INTRO_SEEN); } }, ['Start'])
    ])
  ]);
  overlay.replaceChildren(card);
}

async function shareExchange(me, ex) {
  const peer = await store.get(me.id);
  if (!peer?.privateKeyJwk) { setStatus('Unlock the wallet before signing a copy to carry.', 'bad'); return; }
  const kind = ex.signatures?.[peer.id] ? 'countersign' : 'proposal';
  const sealed = await sim.sealMessage(peer, kind, { exchange: ex });
  if (!sealed.ok) { setStatus(sealed.error, 'bad'); return; }
  carryCode = sim.encodeMessage(sealed.message);
  location.hash = 'devices';
  setStatus('Signed copy is ready. Nothing has been sent. Beta.', 'ok');
}

function withDeadline(promise, ms, message) {
  const settled = Promise.resolve(promise).then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }));
  let timer = 0;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: new Error(message || 'This took too long.') }), ms);
  });
  return Promise.race([settled, deadline]).finally(() => clearTimeout(timer));
}

function fetchSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, stop() { clearTimeout(timer); } };
}

async function loadReferences() {
  const gate = fetchSignal(8000);
  try {
    const response = await fetch('/data/dc-reference-values-v0.json', { signal: gate.signal });
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json();
    catalog = Array.isArray(body.items) ? body.items : [];
    catalogMeta = { date: body.date || '', notice: body.notice || '', method: body.method || '' };
    catalogNotice = `${REFERENCE_LABEL}. Reference only, not a price. As of ${catalogMeta.date || 'pending'}. ${catalogMeta.notice}`.trim();
  } catch {
    catalog = [];
    catalogMeta = { date: '', notice: '', method: '' };
    catalogNotice = `Reference list did not load. You can still name the work yourself. ${REFERENCE_LABEL}. Reference only, not a price.`;
  }
  try {
    const response = await fetch('/data/offerup-dc-v0.json', { signal: gate.signal });
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json();
    offerupItems = sim.offerupFeed(body);
  } catch {
    offerupItems = [];
  }
  try {
    const response = await fetch('/data/offerup-wanted-v0.json', { signal: gate.signal });
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json();
    wantedMatches = sim.wantedFeed(body);
  } catch {
    wantedMatches = [];
  }
  try {
    const response = await fetch('/data/thumbtack-wanted-v0.json', { signal: gate.signal });
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json();
    thumbtackItems = sim.thumbtackFeed(body);
  } catch {
    thumbtackItems = [];
  }
  try {
    const response = await fetch('/data/sourcing-daily.json', { signal: gate.signal });
    if (!response.ok) throw new Error(String(response.status));
    dailyPicks = capPicks(await response.json());
  } catch {
    dailyPicks = { updated: '', categories: [] };
  }
  try {
    const response = await fetch('/data/payment-methods.json', { signal: gate.signal });
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json();
    paymentMethods = {
      zelle: { recipient: String(body?.zelle?.recipient || '').trim() },
      cash: { inPersonOnly: body?.cash?.inPersonOnly !== false },
      notice: String(body?.notice || paymentMethods.notice),
      loyalty: {
        defaultPercent: Number(body?.loyalty?.defaultPercent ?? sim.LOYALTY_DEFAULTS.defaultPercent),
        maxPercentPerDeal: Number(body?.loyalty?.maxPercentPerDeal ?? sim.LOYALTY_DEFAULTS.maxPercentPerDeal),
        capUsdPerPeriod: Number(body?.loyalty?.capUsdPerPeriod ?? body?.loyalty?.capAmountPerPeriod ?? sim.LOYALTY_DEFAULTS.capUsdPerPeriod),
        capAmountPerPeriod: Number(body?.loyalty?.capUsdPerPeriod ?? body?.loyalty?.capAmountPerPeriod ?? sim.LOYALTY_DEFAULTS.capUsdPerPeriod),
        periodDays: Number(body?.loyalty?.periodDays ?? sim.LOYALTY_DEFAULTS.periodDays),
        reserveUsd: Number(body?.loyalty?.reserveUsd ?? body?.loyalty?.reserve ?? sim.LOYALTY_DEFAULTS.reserveUsd),
        reserve: Number(body?.loyalty?.reserveUsd ?? body?.loyalty?.reserve ?? sim.LOYALTY_DEFAULTS.reserveUsd)
      },
      peg: {
        band: Number(body?.peg?.band ?? sim.DEFAULT_CLAMP_BAND),
        holdDays: Number(body?.peg?.holdDays ?? 7),
        quoteSeconds: Number(body?.peg?.quoteSeconds ?? 15)
      },
      clearing: {
        windowDays: Number(body?.clearing?.windowDays ?? body?.peg?.holdDays ?? 7),
        epoch: String(body?.clearing?.epoch || '2026-01-01T00:00:00.000Z')
      }
    };
  } catch {
    paymentMethods = {
      zelle: { recipient: '' },
      cash: { inPersonOnly: true },
      notice: 'Zelle and cash are not reversible-protected. This app does not process them.',
      loyalty: { ...sim.LOYALTY_DEFAULTS },
      peg: { band: sim.DEFAULT_CLAMP_BAND, holdDays: 7, quoteSeconds: 15 },
      clearing: { windowDays: 7, epoch: '2026-01-01T00:00:00.000Z' }
    };
  } finally {
    gate.stop();
  }
}

function captureFragment() {
  const raw = location.hash;
  const at = raw.indexOf('lgme1.');
  if (at < 0) return;
  const encoded = decodeURIComponent(raw.slice(at));
  let kind = '';
  try { kind = sim.decodeMessage(encoded).kind; } catch { kind = ''; }
  if (kind === 'chat' || kind === 'chat-match') {
    pendingChat = encoded;
    history.replaceState(null, '', `${location.pathname}${location.search}#chats`);
    return;
  }
  if (kind === 'invoice') {
    pendingInvoice = encoded;
    history.replaceState(null, '', `${location.pathname}${location.search}#books`);
    return;
  }
  pendingImport = encoded;
  history.replaceState(null, '', `${location.pathname}${location.search}#devices`);
}

let toastTimer = 0;
function toast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}

function applyLayout() {
  const uaMobile = navigator.userAgentData?.mobile === true;
  const mode = sim.layoutMode({
    width: window.innerWidth,
    coarse: window.matchMedia('(pointer: coarse)').matches,
    uaMobile
  });
  document.documentElement.classList.toggle('phone', mode === 'phone');
  document.documentElement.classList.toggle('desk', mode !== 'phone');
  document.body.dataset.layout = mode;
}

const deliveryChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('lgme-sim:delivery') : null;
deliveryChannel?.addEventListener('message', async (event) => {
  const encoded = event.data?.encoded;
  if (!encoded) return;
  const opened = await sim.openMessage(encoded);
  if (!opened.ok) return;
  if (opened.message.kind === 'handoff') {
    const settled = await sim.sellerHandoff(store, opened.message.body.sellerId, encoded);
    if (!settled.ok || settled.thread?.status !== 'settled') return;
    toast('Handoff settled on both books. Beta.');
    await render();
    return;
  }
  if (opened.message.kind !== 'transfer') return;
  const result = await sim.acceptAutoDelivery(store, opened.message.body.toId, encoded);
  if (!result.ok || result.duplicate) return;
  toast(`Received ${opened.message.body.amount} $lgme. Beta.`);
  await render();
});

captureFragment();
try {
  const group = new URLSearchParams(location.search).get('group');
  if (group === 'campus' || group === 'health-club') localStorage.setItem('lgme.exchange.group', group);
} catch { /* the group stays unset */ }
applyLayout();
window.addEventListener('resize', applyLayout);
for (const name of TABS) {
  document.getElementById(`tab-${name}`).addEventListener('click', () => selectTab(name));
}
document.querySelectorAll('.tabbar button').forEach((button) => {
  button.addEventListener('click', () => selectTab(button.dataset.tab));
});
window.addEventListener('hashchange', () => {
  captureFragment();
  render();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstall = event;
  syncInstall();
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sessionKeys.clear();
});
let idleTimer = 0;
function bumpIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => sessionKeys.clear(), 5 * 60 * 1000);
}
['pointerdown', 'keydown'].forEach((name) => document.addEventListener(name, bumpIdle));
bumpIdle();

async function bootVault() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch { /* persistence is optional */ }
  if (!globalThis.indexedDB) return;
  const vault = createIndexedDbVault();
  for (const id of await baseStore.listIds()) {
    const peer = await baseStore.get(id);
    if (!peer) continue;
    if (peer.privateKeyJwk && !peer.keyVault) {
      const existingDek = await vault.getMeta(id);
      const dek = deviceKeyForMigration(existingDek);
      const signing = await importNonExtractable(peer.privateKeyJwk);
      const wrap = await sealJson(dek, { privateKeyJwk: peer.privateKeyJwk });
      await vault.put(id, signing);
      if (dek !== existingDek) await vault.putMeta(id, dek);
      const current = await baseStore.get(id);
      if (!current?.privateKeyJwk || current.keyVault) {
        sessionCrypto.set(id, signing);
        metaKeys.set(id, dek);
        continue;
      }
      const sameKey = JSON.stringify(current.privateKeyJwk) === JSON.stringify(peer.privateKeyJwk);
      const signingNow = sameKey ? signing : await importNonExtractable(current.privateKeyJwk);
      const wrapNow = sameKey ? wrap : await sealJson(dek, { privateKeyJwk: current.privateKeyJwk });
      if (!sameKey) await vault.put(id, signingNow);
      current.migrationWrap = wrapNow;
      current.keyVault = true;
      sessionKeys.set(id, current.privateKeyJwk);
      sessionCrypto.set(id, signingNow);
      metaKeys.set(id, dek);
      current.privateKeyJwk = null;
      await baseStore.set(id, current);
    } else {
      const signing = await vault.get(id);
      const dek = await vault.getMeta(id);
      if (signing) sessionCrypto.set(id, signing);
      if (dek) metaKeys.set(id, dek);
    }
  }
}

bootVault().catch(() => {});

Promise.all([loadReferences(), showSplash()]).then(async () => {
  await render();
  const installedApp = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!storedFlag(INTRO_SEEN) && !installedApp) showWalk(0);
}).catch((error) => {
  setStatus(error && error.message ? error.message : 'The books did not open.', 'bad');
});
