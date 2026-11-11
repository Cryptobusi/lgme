import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anchorMessage } from '../js/hedera-anchor-core.mjs';
import { submitPaidListing } from '../js/hedera-submit.mjs';
import { TEST_EXAMPLE_SNAPSHOT } from '../js/test-example-snapshot.mjs';
import {
  chainPayloadSafe,
  isMockExample,
  mainnetTopicReady,
  mockWriteAllowed,
  networkDryRun,
  operatorBalanceAlert,
  visibleTestExamples
} from '../js/hedera-network.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function runTopicScript(env) {
  return spawnSync(process.execPath, ['scripts/create-mainnet-topics.mjs'], {
    cwd: root,
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8'
  });
}

test('the mainnet topic command stays off unless both flags are set, and tests never set them', () => {
  assert.match(mainnetTopicReady({}).error, /Nothing was created/);
  assert.match(mainnetTopicReady({ HEDERA_NETWORK: 'mainnet' }).error, /Nothing was created/);
  assert.match(mainnetTopicReady({ HEDERA_NETWORK: 'testnet', HEDERA_MAINNET_CONFIRM: 'create-topics' }).error, /Nothing was created/);
  assert.equal(mainnetTopicReady({ HEDERA_NETWORK: 'mainnet', HEDERA_MAINNET_CONFIRM: 'create-topics' }).ok, false);
  for (const env of [{}, { HEDERA_NETWORK: 'testnet' }, { HEDERA_NETWORK: 'mainnet' }, { HEDERA_NETWORK: 'dry-run' }]) {
    const result = runTopicScript(env);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Nothing was created/);
    assert.equal(result.stdout.includes('Created topic'), false);
  }
});

test('a low operator balance alerts from the mirror balance and does not spend', async () => {
  const low = await operatorBalanceAlert(async () => ({ ok: true, json: async () => ({ balance: { balance: 50 * 1e8 } }) }));
  assert.match(low.alert, /below 100 HBAR/);
  const fine = await operatorBalanceAlert(async () => ({ ok: true, json: async () => ({ balance: { balance: 250 * 1e8 } }) }));
  assert.equal(fine.alert, '');
  assert.equal(fine.hbar, 250);
});

test('on-chain payloads reject names, email, and health fields', () => {
  const anchor = JSON.parse(anchorMessage({ root: 'a'.repeat(64), day: '2026-11-11', leafCount: 1 }));
  assert.equal(chainPayloadSafe(anchor).ok, true);
  assert.equal(chainPayloadSafe({ root: 'ab', email: 'a@b.co' }).ok, false);
  assert.equal(chainPayloadSafe({ id: 'ex-1', symptom: 'knee pain' }).ok, false);
  assert.equal(chainPayloadSafe({ title: 'A diagnosis of flu' }).ok, false);
});

test('test examples stay visible from the testnet record and are never a mainnet write', async () => {
  assert.equal(mockWriteAllowed('testnet'), true);
  assert.equal(mockWriteAllowed('mainnet'), false);
  const shown = visibleTestExamples([
    { item: { id: 'example-hour-trade', service: 'example', status: 'Example transaction - test, until claimed', title: 'Tutoring for yard help' } },
    { item: { id: 'campus-01', group: 'campus', status: 'Test item - unclaimed', title: 'Intro graphs hour' } }
  ], TEST_EXAMPLE_SNAPSHOT);
  assert.equal(shown.length >= 2, true);
  assert.equal(shown.every((row) => row.record === 'testnet' && row.test === true), true);
  const fallback = visibleTestExamples([], TEST_EXAMPLE_SNAPSHOT);
  assert.equal(fallback.length, TEST_EXAMPLE_SNAPSHOT.length);
  assert.equal(fallback.every((row) => row.record === 'testnet-snapshot'), true);
  assert.equal(isMockExample(TEST_EXAMPLE_SNAPSHOT[0]), true);
  const refused = await submitPaidListing(
    { HEDERA_NETWORK: 'mainnet', VERCEL_ENV: 'production' },
    { id: 'example-hour-trade', service: 'example', status: 'Example transaction - test, until claimed', title: 'Tutoring for yard help' }
  );
  assert.equal(refused.ok, false);
  assert.match(refused.error, /testnet record/);
  const poster = readFileSync(join(root, 'scripts/post-mock-listings.mjs'), 'utf8');
  assert.equal(poster.includes('mockWriteAllowed'), true);
  const dry = networkDryRun({ HEDERA_NETWORK: 'dry-run', VERCEL_ENV: 'preview' });
  assert.equal(dry.network, 'testnet');
  assert.equal(dry.mainnetWrites, false);
  assert.equal(dry.rollback.value, 'testnet');
  const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  const ignore = readFileSync(join(root, '.vercelignore'), 'utf8');
  assert.equal(sitemap.includes('mainnet-rollback'), false);
  assert.match(ignore, /^docs$/m);
});
