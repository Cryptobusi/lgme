import { SEED_LISTINGS } from './exchange-listing.mjs';

export const MAINNET_CLOSED = 'Mainnet writes stay closed until the testnet review is signed off.';
export const DEFAULT_DAILY_HBAR = 1;
export const TINYBAR = 100_000_000;

const HASH = /^[0-9a-f]{64}$/;
const HASH_KEYS = new Set(['version', 'network', 'day', 'root', 'leafCount', 'hash']);
const SEED_IDS = new Set(SEED_LISTINGS.map((row) => row.id));

export function resolveHederaNetwork(env = {}) {
  const asked = String(env.HEDERA_NETWORK || 'testnet').trim().toLowerCase() || 'testnet';
  const preview = String(env.VERCEL_ENV || '') === 'preview';
  const production = String(env.VERCEL_ENV || '') === 'production';
  if (asked === 'mainnet' && production && !preview) {
    return { network: 'mainnet', open: false, reason: MAINNET_CLOSED };
  }
  return { network: 'testnet', open: true, reason: '' };
}

export function dailyHbarCap(env = {}) {
  const figure = Number(env.HEDERA_MAINNET_DAILY_HBAR_CAP);
  if (Number.isFinite(figure) && figure > 0) return figure;
  return DEFAULT_DAILY_HBAR;
}

export function spendGuard({ network, spentTinybar = 0, nextTinybar = 0, capHbar = DEFAULT_DAILY_HBAR } = {}) {
  if (network !== 'mainnet') return { ok: true, alert: '', spentTinybar: Number(spentTinybar) || 0 };
  const capTinybar = Math.round(Number(capHbar) * TINYBAR);
  const spent = Number(spentTinybar) || 0;
  const next = Number(nextTinybar) || 0;
  if (spent + next > capTinybar) {
    return {
      ok: false,
      alert: 'Mainnet fee cap reached. Writes are refused until tomorrow.',
      spentTinybar: spent,
      capTinybar
    };
  }
  return { ok: true, alert: '', spentTinybar: spent + next, capTinybar };
}

export function mainnetPayloadAllowed(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Mainnet accepts a hash only.' };
  }
  const text = JSON.stringify(body);
  if (/test item/i.test(text)) return { ok: false, error: 'Test listings are not copied to mainnet.' };
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return { ok: false, error: 'Email does not go to mainnet.' };
  if (SEED_IDS.has(String(body.id || '')) || String(body.id || '').startsWith('setup-')) {
    return { ok: false, error: 'Test listings and test receivables are not copied to mainnet.' };
  }
  const keys = Object.keys(body);
  if (keys.some((key) => !HASH_KEYS.has(key))) return { ok: false, error: 'Mainnet accepts a hash only.' };
  const hash = String(body.root || body.hash || '').toLowerCase();
  if (!HASH.test(hash)) return { ok: false, error: 'Mainnet accepts a hash only.' };
  return { ok: true, hash };
}

export function prepareMainnetListing(item = {}) {
  const status = String(item.status || '').replace(/test item\s*-?\s*/i, '').trim();
  const title = String(item.title || '').replace(/test item\s*-?\s*/i, '').trim();
  if (/test item/i.test(status) || /test item/i.test(title) || /test item/i.test(JSON.stringify(item))) {
    return { ok: false, error: 'Remove Test item before a mainnet listing.' };
  }
  if (SEED_IDS.has(String(item.id || '')) || String(item.id || '').startsWith('setup-')) {
    return { ok: false, error: 'Test listings and test receivables are not copied to mainnet.' };
  }
  return { ok: false, error: 'Mainnet accepts a hash only.' };
}

export function rollbackSwitch() {
  return {
    env: 'HEDERA_NETWORK',
    value: 'testnet',
    step: 'Set HEDERA_NETWORK=testnet and redeploy. Previews already stay on testnet. No mainnet topic is created by the rollback.'
  };
}

export function networkDryRun(env = {}) {
  const picked = resolveHederaNetwork(env);
  return {
    asked: String(env.HEDERA_NETWORK || 'testnet').trim().toLowerCase() || 'testnet',
    network: picked.network,
    open: picked.open,
    mainnetWrites: false,
    rollback: rollbackSwitch(),
    dailyCapHbar: dailyHbarCap(env)
  };
}

export const MAINNET_OPERATOR = '0.0.1273453';
export const BALANCE_ALERT_HBAR = 100;

export async function operatorBalanceAlert(fetchImpl = globalThis.fetch, account = MAINNET_OPERATOR) {
  let response;
  try {
    response = await fetchImpl(`https://mainnet.mirrornode.hedera.com/api/v1/accounts/${account}`);
  } catch {
    return { ok: false, account, hbar: null, alert: 'The mainnet operator balance could not be read.' };
  }
  if (!response?.ok) return { ok: false, account, hbar: null, alert: 'The mainnet operator balance could not be read.' };
  const body = await response.json();
  const tiny = Number(body?.balance?.balance ?? body?.balance);
  if (!Number.isFinite(tiny)) return { ok: false, account, hbar: null, alert: 'The mainnet operator balance could not be read.' };
  const hbar = tiny / TINYBAR;
  const low = hbar < BALANCE_ALERT_HBAR;
  return {
    ok: true,
    account,
    hbar,
    alert: low ? `Operator balance is below ${BALANCE_ALERT_HBAR} HBAR.` : ''
  };
}

const PRIVATE_KEYS = new Set(['email', 'name', 'legalname', 'contact', 'phone', 'handle', 'applicantname', 'trackrecord', 'symptom', 'diagnosis', 'health']);

export function chainPayloadSafe(value) {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return { ok: true };
  if (typeof value === 'string') {
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) return { ok: false, error: 'Email does not go on chain.' };
    if (/\b(diagnosis|symptom|prescription)\b/i.test(value)) return { ok: false, error: 'Health data does not go on chain.' };
    return { ok: true };
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = chainPayloadSafe(item);
      if (!result.ok) return result;
    }
    return { ok: true };
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (PRIVATE_KEYS.has(String(key).toLowerCase())) return { ok: false, error: 'Names, contacts, and health fields do not go on chain.' };
      const result = chainPayloadSafe(item);
      if (!result.ok) return result;
    }
    return { ok: true };
  }
  return { ok: false, error: 'On-chain payloads are hashes or ids only.' };
}

export function isMockExample(item = {}) {
  const status = String(item.status || '');
  if (/test item|test author|example transaction/i.test(status)) return true;
  if (item.service === 'author' || item.service === 'example' || item.test === true) return true;
  const id = String(item.id || '');
  return id.startsWith('example-') || id.startsWith('author-');
}

export function mockWriteAllowed(network) {
  return String(network || 'testnet').toLowerCase() !== 'mainnet';
}

export function visibleTestExamples(rows = [], snapshot = []) {
  const live = [];
  for (const row of rows) {
    const item = row?.item || row;
    if (isMockExample(item)) live.push({ ...item, record: 'testnet', test: true });
  }
  if (live.length) return live;
  return snapshot.map((item) => ({ ...item, record: 'testnet-snapshot', test: true }));
}

export function mainnetTopicReady(env = {}) {
  if (String(env.HEDERA_NETWORK || '').trim().toLowerCase() !== 'mainnet') {
    return { ok: false, error: 'Mainnet topic creation is off. Nothing was created.' };
  }
  if (env.HEDERA_MAINNET_CONFIRM !== 'create-topics') {
    return { ok: false, error: 'Set HEDERA_MAINNET_CONFIRM=create-topics for this one command. Nothing was created.' };
  }
  if (!String(env.HEDERA_MAINNET_OPERATOR_ID || '').trim() || !String(env.HEDERA_MAINNET_OPERATOR_KEY || '').trim()) {
    return { ok: false, error: 'The mainnet operator is not configured. Nothing was created.' };
  }
  return { ok: true };
}
