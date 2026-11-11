import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

test('the testnet review stays unlisted, on the device, and unsent', () => {
  const page = text('testnet-review.html');
  const script = text('js/testnet-review.mjs');
  const plan = text('docs/testnet-review-plan.md');
  assert.equal(page.includes('noindex'), true);
  assert.equal(page.includes('testnetrev'), false);
  assert.equal(script.includes('testnetrev'), true);
  assert.equal(script.includes('lgme.testnet.review'), true);
  assert.equal(script.includes('fetch('), false);
  assert.equal(script.includes('Export my results'), true);
  assert.equal(script.includes('showSaveFilePicker'), true);
  for (const id of ['install', 'email', 'fee-pool', 'fee-self', 'offer', 'request', 'match', 'trainer', 'confirm', 'receipt', 'high', 'sponsor', 'dispute', 'rsvp', 'checkin', 'board', 'offline']) {
    assert.equal(script.includes(`id: '${id}'`), true, id);
  }
  assert.equal(text('robots.txt').includes('Disallow: /testnet-review'), true);
  assert.equal(text('sitemap.xml').includes('testnet-review'), false);
  assert.equal(plan.includes('Mainnet writes stay off'), true);
  assert.equal(plan.includes('three attestations'), true);
  assert.equal(text('sw.js').includes('lgme-v173'), true);
});
