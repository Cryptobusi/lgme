import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEVELOPER_STATUS, EXPLAINER, HOST_STATUS, interestRecord } from '../js/community-interest.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('a community sign-up keeps the contact off the public listing', async () => {
  const contact = 'volunteer@example.com';
  const refused = await interestRecord({ kind: 'developer', handle: 'ada', contact, roles: ['code'], store: false, share: true });
  assert.equal(refused.ok, false);
  const quiet = await interestRecord({
    kind: 'developer',
    handle: 'Ada Tester',
    contact,
    roles: ['code', 'testing'],
    notes: `Reach me at ${contact}`,
    store: true,
    share: false,
    test: true
  });
  assert.equal(quiet.ok, true, quiet.error);
  assert.equal(quiet.sent, false);
  assert.equal(quiet.body.status, DEVELOPER_STATUS);
  assert.equal(quiet.body.offer, 'Developer team');
  assert.equal(quiet.body.category, 'exchange');
  assert.equal(quiet.body.network, 'testnet');
  assert.equal(quiet.body.test, true);
  assert.equal(quiet.body.roles.length, 0);
  assert.match(quiet.body.title, /Test/);
  assert.equal(JSON.stringify(quiet.body).includes(contact), false);
  assert.equal(JSON.stringify(quiet.body).includes('@'), false);
  assert.equal(/^[0-9a-f]{64}$/.test(quiet.body.hash), true);
  const shared = await interestRecord({ kind: 'host', handle: 'library-host', contact: 'front desk', roles: ['outreach'], store: true, share: true });
  assert.equal(shared.ok, true, shared.error);
  assert.equal(shared.body.status, HOST_STATUS);
  assert.equal(shared.body.title.includes('library-host'), true);
  assert.equal(JSON.stringify(shared.body).includes('front desk'), false);
  const page = readFileSync(join(root, 'js/pairing-page.mjs'), 'utf8');
  assert.equal(readFileSync(join(root, 'js/community-interest.mjs'), 'utf8').includes(EXPLAINER.slice(0, 40)), true);
  assert.equal(page.includes('upcoming-communities'), true);
  assert.equal(page.includes('Join the developer team'), true);
  assert.equal(page.includes('Host a community'), true);
  assert.equal(readFileSync(join(root, 'api/hedera/listings.mjs'), 'utf8').includes('built.body'), true);
});
