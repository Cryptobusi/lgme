import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { draftExchangeListing, LISTINGS_OPERATOR, LISTINGS_TOPIC, publicExchangeListing, SEED_LISTINGS, seedPayload, UNCLAIMED } from '../js/exchange-listing.mjs';
import { withinRate } from '../js/shared-listings.mjs';
import { VIEW_ONLY_MESSAGE } from '../js/view-only-api.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('Exchange listings stay on the confirmed topic and other categories are refused', () => {
  assert.equal(LISTINGS_TOPIC, '0.0.11397293');
  assert.equal(LISTINGS_OPERATOR, '0.0.11281203');
  assert.equal(SEED_LISTINGS.length, 10);
  assert.equal(SEED_LISTINGS[9].title, 'The Repair Extraordinaire equipment repair');
  const repair = publicExchangeListing(seedPayload(SEED_LISTINGS[9]));
  assert.equal(repair.ok, true, repair.error);
  assert.equal(repair.body.status, 'Claimed by repair-extraordinaire');
  assert.equal(JSON.stringify(repair.body).includes('@'), false);
  assert.equal(repair.body.topic, LISTINGS_TOPIC);
  assert.equal(repair.body.payer, LISTINGS_OPERATOR);
  const open = publicExchangeListing(seedPayload(SEED_LISTINGS[0]));
  assert.equal(open.body.status, UNCLAIMED);
  const campus = publicExchangeListing({ ...seedPayload(SEED_LISTINGS[0]), category: 'campus' });
  assert.equal(campus.ok, true, campus.error);
  assert.equal(campus.body.category, 'campus');
  const closed = publicExchangeListing({ ...seedPayload(SEED_LISTINGS[0]), category: 'secret' });
  assert.equal(closed.ok, false);
  assert.equal(closed.error, VIEW_ONLY_MESSAGE);
  const leaked = publicExchangeListing({ ...seedPayload(SEED_LISTINGS[0]), title: 'Call tcare4me@gmail.com' });
  assert.equal(leaked.ok, false);
  const claim = publicExchangeListing({
    handle: 'trainer', action: 'update', category: 'exchange', role: 'trainer', id: 'ex-strength', title: open.body.title, service: 'strength', durationMin: 45
  });
  assert.equal(claim.ok, true, claim.error);
  assert.equal(claim.body.status, 'Claimed by trainer');
  const member = publicExchangeListing({
    handle: 'member', action: 'update', category: 'exchange', role: 'member', id: 'ex-strength', title: open.body.title
  });
  assert.equal(member.ok, false);
  const draft = draftExchangeListing('A 30 minute beginner strength session for new members.');
  assert.equal(draft.sent, false);
  assert.equal(draft.category, 'exchange');
  assert.equal(draft.durationMin, 30);
  assert.equal(draftExchangeListing('How is my mood?').sent, false);
  assert.equal(withinRate([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 11, 10).ok, false);
  assert.equal(withinRate([1, 2, 3, 4, 5, 6, 7, 8, 9], 11, 10).ok, true);
  const api = readFileSync(join(root, 'api/hedera/listings.mjs'), 'utf8');
  assert.equal(api.includes('submitPaidListing'), true);
  assert.equal(api.includes('Only Health is written to the test network.'), true);
  assert.equal(readFileSync(join(root, 'js/exchange-listing.mjs'), 'utf8').includes(LISTINGS_TOPIC), true);
  assert.equal(readFileSync(join(root, 'js/hedera-submit.mjs'), 'utf8').includes('LISTINGS_OPERATOR'), true);
  assert.equal(readFileSync(join(root, 'exchange.html'), 'utf8').includes('/js/view-only.js'), false);
});
