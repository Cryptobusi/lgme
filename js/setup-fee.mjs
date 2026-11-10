import { DONATION_ADDRESS, MINT, buildTransferRequest, parseSplTransfer, rpc } from './solana-pay.mjs';
import { matchesPeg } from './lgme-price.mjs';
import { VIEW_ONLY_MESSAGE } from './view-only-api.mjs';
import { LISTINGS_OPERATOR, LISTINGS_TOPIC } from './exchange-listing.mjs';

export const SETUP_USD = 1;
export const SETUP_TITLE = 'Setup fee $1 - due when inclined';
export const SETUP_OWED_TO = 'EgonAnon';
export const SETUP_ADDRESS = DONATION_ADDRESS;
export const SETUP_MINT = MINT;
export const PUMP_URL = `https://pump.fun/coin/${MINT}`;
export const REMINDER_MS = 30 * 24 * 60 * 60 * 1000;
export const SETUP_COPY = 'The fee is voluntary. Use of the app stays 100% voluntary. The fee never blocks access to Health. It is non-refundable and not an investment.';

const BANNED = /@|https?:|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\blatitude\b|\blongitude\b/i;
const HANDLE = /^[a-z0-9-]{1,32}$/;

function round6(value) {
  return Math.round(Number(value) * 1e6) / 1e6;
}

export function lgmeForUsd(usd = SETUP_USD, price) {
  const figure = Number(price);
  const dollars = Number(usd);
  if (!(figure > 0) || !(dollars > 0)) return { ok: false, error: 'The live price is not available.' };
  return { ok: true, usd: dollars, price: figure, amount: round6(dollars / figure) };
}

export function payNowQuote(price, reference) {
  const quote = lgmeForUsd(SETUP_USD, price);
  if (!quote.ok) return quote;
  const link = buildTransferRequest({
    recipient: SETUP_ADDRESS,
    amount: quote.amount,
    reference,
    label: 'lgme setup fee',
    message: 'Voluntary setup fee. You sign in your own wallet.'
  });
  if (!link.ok) return link;
  return {
    ...quote,
    url: link.url,
    recipient: SETUP_ADDRESS,
    mint: SETUP_MINT,
    pump: PUMP_URL,
    creator: SETUP_OWED_TO,
    custodial: false
  };
}

export function readSetup(storage, handle) {
  try { return JSON.parse(storage.getItem(`lgme.setup.fee:${handle}`) || 'null'); } catch { return null; }
}

export function writeSetup(storage, record) {
  storage.setItem(`lgme.setup.fee:${record.handle}`, JSON.stringify(record));
  return record;
}

export function receivableRecord({ handle, price, at }) {
  const id = String(handle || '').trim().toLowerCase();
  if (!HANDLE.test(id)) return { ok: false, error: 'Use a short handle.' };
  const quote = lgmeForUsd(SETUP_USD, price);
  return {
    ok: true,
    item: {
      id: `setup-${id}`,
      handle: id,
      title: SETUP_TITLE,
      owedTo: SETUP_OWED_TO,
      usd: SETUP_USD,
      price: quote.ok ? quote.price : null,
      lgmeAmount: quote.ok ? quote.amount : null,
      recipient: SETUP_ADDRESS,
      status: 'due',
      category: 'exchange',
      at: at || new Date().toISOString(),
      remindedAt: at || new Date().toISOString(),
      optOut: false,
      hedera: false
    }
  };
}

export function publicSetupReceivable(spec = {}) {
  if (String(spec.category || '').trim().toLowerCase() !== 'exchange') {
    return { ok: false, status: 403, viewOnly: true, error: VIEW_ONLY_MESSAGE };
  }
  const action = spec.action === 'receivable-paid' ? 'receivable-paid' : spec.action === 'receivable' ? 'receivable' : '';
  if (!action) return { ok: false, status: 400, error: 'That Exchange write is not a setup fee.' };
  const handle = String(spec.handle || '').trim().toLowerCase();
  if (!HANDLE.test(handle)) return { ok: false, status: 400, error: 'Use a short handle.' };
  if (spec.title && spec.title !== SETUP_TITLE) return { ok: false, status: 400, error: 'The receivable title is fixed.' };
  if (spec.owedTo && spec.owedTo !== SETUP_OWED_TO) return { ok: false, status: 400, error: 'The fee is owed to the app.' };
  const lgmeAmount = round6(spec.lgmeAmount);
  if (action === 'receivable-paid') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(String(spec.signature || ''))) {
      return { ok: false, status: 400, error: 'The payment was not confirmed.' };
    }
    if (!(lgmeAmount > 0)) return { ok: false, status: 400, error: 'The quoted amount is missing.' };
  }
  const body = {
    v: 1,
    network: 'testnet',
    kind: action,
    category: 'exchange',
    id: `setup-${handle}`,
    title: SETUP_TITLE,
    owedTo: SETUP_OWED_TO,
    handle,
    usd: SETUP_USD,
    lgmeAmount: lgmeAmount > 0 ? lgmeAmount : null,
    recipient: SETUP_ADDRESS,
    status: action === 'receivable-paid' ? 'paid' : 'due',
    signature: action === 'receivable-paid' ? String(spec.signature) : '',
    topic: LISTINGS_TOPIC,
    payer: LISTINGS_OPERATOR
  };
  if (BANNED.test(JSON.stringify({ ...body, signature: '' }))) {
    return { ok: false, status: 400, error: 'A listing cannot carry personal data.' };
  }
  return { ok: true, body };
}

function transferDelta(tx, recipient, mint) {
  if (tx?.meta?.err) return { ok: false, error: 'The transaction failed on Solana.' };
  const post = (tx?.meta?.postTokenBalances || []).find((row) => row.mint === mint && row.owner === recipient);
  if (!post?.uiTokenAmount?.amount) return { ok: false, error: 'The recipient did not receive this mint.' };
  const before = (tx?.meta?.preTokenBalances || []).find((row) => row.accountIndex === post.accountIndex);
  const decimals = Number(post.uiTokenAmount.decimals ?? before?.uiTokenAmount?.decimals ?? 6);
  const scale = 10 ** decimals;
  const preRaw = before?.uiTokenAmount?.amount != null ? BigInt(before.uiTokenAmount.amount) : 0n;
  const delta = Number(BigInt(post.uiTokenAmount.amount) - preRaw) / scale;
  return delta > 0 ? { ok: true, delta } : { ok: false, error: 'The recipient did not receive this mint.' };
}

export function confirmSetupTransfer(tx, expected = {}) {
  const recipient = expected.recipient || SETUP_ADDRESS;
  const mint = expected.mint || SETUP_MINT;
  const tolerance = Number(expected.tolerance) || 0;
  if (tolerance > 0) {
    const got = transferDelta(tx, recipient, mint);
    if (!got.ok) return got;
    const quotes = [expected.amount].filter((value) => Number(value) > 0);
    if (!matchesPeg(got.delta, quotes, tolerance)) {
      return { ok: false, error: 'The amount is outside the locked quote.' };
    }
    if (expected.reference) {
      const keys = (tx?.transaction?.message?.accountKeys || []).map((key) => (typeof key === 'string' ? key : key?.pubkey));
      if (!keys.includes(expected.reference)) return { ok: false, error: 'The reference is not on this transaction.' };
    }
    const signature = tx?.transaction?.signatures?.[0] || '';
    if (expected.signature && signature !== expected.signature) {
      return { ok: false, error: 'The signature does not match this transaction.' };
    }
    if (expected.recipient && expected.recipient !== SETUP_ADDRESS) {
      return { ok: false, error: 'The payment did not go to the setup address.' };
    }
    return { ok: true, signature, delta: got.delta, cluster: 'mainnet-beta' };
  }
  const parsed = parseSplTransfer(tx, {
    recipient,
    mint,
    amount: expected.amount
  });
  if (!parsed.ok) return parsed;
  const signature = tx?.transaction?.signatures?.[0] || '';
  if (expected.signature && signature !== expected.signature) {
    return { ok: false, error: 'The signature does not match this transaction.' };
  }
  if (expected.recipient && expected.recipient !== SETUP_ADDRESS) {
    return { ok: false, error: 'The payment did not go to the setup address.' };
  }
  return { ok: true, signature, delta: parsed.delta, cluster: 'mainnet-beta' };
}

export async function findSetupPayment(reference, expected = {}) {
  const signatures = await rpc('mainnet-beta', 'getSignaturesForAddress', [reference, { limit: 5, commitment: 'finalized' }]);
  if (!signatures.ok) return signatures;
  const list = signatures.result || [];
  if (!list.length) return { ok: false, error: 'No payment is on chain for this reference yet.' };
  for (const row of list) {
    if (row?.confirmationStatus && row.confirmationStatus !== 'finalized') continue;
    if (row?.err) continue;
    const tx = await rpc('mainnet-beta', 'getTransaction', [row.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'finalized' }]);
    if (!tx.ok || !tx.result) continue;
    const matched = confirmSetupTransfer(tx.result, { ...expected, reference, signature: row.signature, tolerance: expected.tolerance || 0.02 });
    if (matched.ok) return matched;
  }
  return { ok: false, error: 'No payment is on chain for this reference yet.' };
}

export function markReceivablePaid(record, confirmation) {
  if (!record || record.title !== SETUP_TITLE) return { ok: false, error: 'No setup fee is waiting.' };
  if (!confirmation?.ok) return { ok: false, error: confirmation?.error || 'The payment was not confirmed.' };
  if (record.status === 'paid') return { ok: true, item: record, duplicate: true };
  return {
    ok: true,
    item: { ...record, status: 'paid', signature: confirmation.signature, paidAt: confirmation.at || new Date().toISOString() }
  };
}

export function reminderDue(record, now = Date.now()) {
  if (!record || record.status === 'paid' || record.optOut === true) return false;
  const start = Date.parse(record.at || '');
  const last = Date.parse(record.remindedAt || record.at || '');
  if (!Number.isFinite(start) || !Number.isFinite(last)) return false;
  if (now - start < REMINDER_MS) return false;
  return now - last >= REMINDER_MS;
}

export function noteReminder(record, now = new Date().toISOString()) {
  return { ...record, remindedAt: now };
}

export function optOutReminder(record) {
  return { ...record, optOut: true };
}
