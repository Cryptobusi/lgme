import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitLeaves, submitPaidListing } from '../js/hedera-submit.mjs';
import { SEED_LISTINGS } from '../js/exchange-listing.mjs';
import {
  MAINNET_CLOSED,
  dailyHbarCap,
  mainnetPayloadAllowed,
  prepareMainnetListing,
  resolveHederaNetwork,
  rollbackSwitch,
  spendGuard
} from '../js/hedera-network.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('mainnet stays closed, previews stay on testnet, and the key is never read', async () => {
  assert.equal(resolveHederaNetwork({}).network, 'testnet');
  assert.equal(resolveHederaNetwork({ HEDERA_NETWORK: 'mainnet', VERCEL_ENV: 'preview' }).network, 'testnet');
  assert.equal(resolveHederaNetwork({ HEDERA_NETWORK: 'mainnet', VERCEL_ENV: 'production' }).open, false);
  assert.equal(resolveHederaNetwork({ HEDERA_NETWORK: 'mainnet', VERCEL_ENV: 'production' }).reason, MAINNET_CLOSED);
  const refused = await submitLeaves({ HEDERA_NETWORK: 'mainnet', VERCEL_ENV: 'production', HEDERA_MAINNET_OPERATOR_KEY: 'do-not-read' }, ['a'.repeat(64)], '2026-11-11');
  assert.equal(refused.ok, false);
  assert.equal(refused.error, MAINNET_CLOSED);
  const listing = await submitPaidListing({ HEDERA_NETWORK: 'mainnet', VERCEL_ENV: 'production' }, { id: 'ex-strength', status: 'Test item - unclaimed', title: 'Beginner' });
  assert.equal(listing.ok, false);
  assert.match(listing.error, /Test item|hash only|not copied/);
  const source = readFileSync(join(root, 'js/hedera-submit.mjs'), 'utf8') + readFileSync(join(root, 'js/hedera-network.mjs'), 'utf8');
  assert.equal(source.includes('HEDERA_MAINNET_OPERATOR_KEY'), false);
  assert.equal(source.includes('forMainnet'), false);
  assert.equal(dailyHbarCap({}), 1);
  assert.equal(dailyHbarCap({ HEDERA_MAINNET_DAILY_HBAR_CAP: '2' }), 2);
  const room = spendGuard({ network: 'mainnet', spentTinybar: 0, nextTinybar: 50_000_000, capHbar: 1 });
  assert.equal(room.ok, true);
  const capped = spendGuard({ network: 'mainnet', spentTinybar: 90_000_000, nextTinybar: 20_000_000, capHbar: 1 });
  assert.equal(capped.ok, false);
  assert.match(capped.alert, /refused/);
  assert.equal(spendGuard({ network: 'testnet', spentTinybar: 9e12, nextTinybar: 1 }).ok, true);
  const hash = 'a'.repeat(64);
  assert.equal(mainnetPayloadAllowed({ version: 1, network: 'mainnet', day: '2026-11-11', root: hash, leafCount: 1 }).ok, true);
  assert.equal(mainnetPayloadAllowed({ root: hash, email: 'a@b.co' }).ok, false);
  assert.equal(mainnetPayloadAllowed({ id: SEED_LISTINGS[0].id, hash }).ok, false);
  assert.equal(prepareMainnetListing({ id: 'setup-mina', status: 'due', title: 'Setup fee' }).ok, false);
  assert.match(prepareMainnetListing({ id: 'fresh', status: 'Test item - unclaimed', title: 'Session' }).error, /Test item/);
  assert.equal(rollbackSwitch().value, 'testnet');
  const ignore = readFileSync(join(root, '.vercelignore'), 'utf8');
  assert.match(ignore, /docs-internal/);
  assert.equal(readFileSync(join(root, 'index.html'), 'utf8').includes('docs-internal'), false);
});
