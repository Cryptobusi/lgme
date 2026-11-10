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
    step: 'Set HEDERA_NETWORK=testnet and redeploy. Previews already stay on testnet.'
  };
}
