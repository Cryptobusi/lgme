export const MINT = '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump';
export const DONATION_ADDRESS = '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY';
export const RPC = Object.freeze({
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com'
});

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function encodeBase58(bytes) {
  const source = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  let zeros = 0;
  while (zeros < source.length && source[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < source.length; i += 1) {
    let carry = source[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPHABET[digits[i]];
  return out;
}

export function decodeBase58(text) {
  const str = String(text || '').trim();
  if (!str || [...str].some((char) => !ALPHABET.includes(char))) return null;
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros += 1;
  const bytes = [0];
  for (let i = zeros; i < str.length; i += 1) {
    let carry = ALPHABET.indexOf(str[i]);
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) out[out.length - 1 - i] = bytes[i];
  return out;
}

export function isValidPublicKey(text) {
  const bytes = decodeBase58(text);
  return Boolean(bytes && bytes.length === 32);
}

export function createReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return encodeBase58(bytes);
}

export function buildTransferRequest({ recipient, amount, reference, mint = MINT, label = 'lgme beta', message = '' } = {}) {
  if (!isValidPublicKey(recipient)) return { ok: false, error: 'The recipient address is not a Solana address.' };
  if (!isValidPublicKey(reference)) return { ok: false, error: 'The reference is not a Solana address.' };
  if (!isValidPublicKey(mint)) return { ok: false, error: 'The mint address is not a Solana address.' };
  const figure = Number(amount);
  if (!Number.isFinite(figure) || figure <= 0) return { ok: false, error: 'Enter an amount greater than zero.' };
  const params = new URLSearchParams();
  params.set('amount', String(figure));
  params.set('spl-token', mint);
  params.set('reference', reference);
  if (label) params.set('label', label);
  if (message) params.set('message', message);
  return { ok: true, url: `solana:${recipient}?${params.toString()}` };
}

function tokenAmount(row) {
  const raw = row?.uiTokenAmount?.uiAmountString ?? row?.uiTokenAmount?.uiAmount;
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

export function parseSplTransfer(tx, expected = {}) {
  const keys = tx?.transaction?.message?.accountKeys || [];
  const listed = keys.map((key) => (typeof key === 'string' ? key : key?.pubkey)).filter(Boolean);
  if (expected.reference && !listed.includes(expected.reference)) {
    return { ok: false, error: 'The reference is not on this transaction.' };
  }
  const post = (tx?.meta?.postTokenBalances || []).find((row) => row.mint === expected.mint && row.owner === expected.recipient);
  if (!post) return { ok: false, error: 'The recipient did not receive this mint.' };
  const before = (tx?.meta?.preTokenBalances || []).find((row) => row.accountIndex === post.accountIndex);
  const delta = Math.round((tokenAmount(post) - tokenAmount(before)) * 1e6) / 1e6;
  const wanted = Number(expected.amount);
  if (!Number.isFinite(wanted) || Math.abs(delta - wanted) > 1e-6) {
    return { ok: false, error: 'The amount does not match.' };
  }
  return { ok: true, delta, signature: tx?.transaction?.signatures?.[0] || '' };
}

export function rpcUrl(cluster) {
  return RPC[cluster] || '';
}

export async function rpc(cluster, method, params) {
  const url = rpcUrl(cluster);
  if (!url) return { ok: false, error: 'Choose mainnet or devnet.' };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  if (!response.ok) return { ok: false, error: `The RPC returned ${response.status}.` };
  const body = await response.json();
  if (body.error) return { ok: false, error: body.error.message || 'The RPC rejected the request.' };
  return { ok: true, result: body.result };
}

export async function findReferencePayment(cluster, reference, expected) {
  const signatures = await rpc(cluster, 'getSignaturesForAddress', [reference, { limit: 5 }]);
  if (!signatures.ok) return signatures;
  const list = signatures.result || [];
  if (!list.length) return { ok: false, error: 'No payment is on chain for this reference yet.' };
  for (const row of list) {
    const tx = await rpc(cluster, 'getTransaction', [row.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);
    if (!tx.ok || !tx.result) continue;
    const parsed = parseSplTransfer(tx.result, { ...expected, reference });
    if (parsed.ok) return { ok: true, signature: row.signature, delta: parsed.delta };
  }
  return { ok: false, error: 'A transaction was found, but the mint, amount, or recipient did not match.' };
}

export async function readTokenBalance(cluster, owner, mint = MINT) {
  if (!isValidPublicKey(owner)) return { ok: false, error: 'The wallet address is not a Solana address.' };
  const found = await rpc(cluster, 'getTokenAccountsByOwner', [owner, { mint }, { encoding: 'jsonParsed' }]);
  if (!found.ok) return found;
  const accounts = found.result?.value || [];
  const total = accounts.reduce((sum, account) => {
    const amount = Number(account?.account?.data?.parsed?.info?.tokenAmount?.uiAmountString || 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  return { ok: true, amount: Math.round(total * 1e6) / 1e6 };
}
