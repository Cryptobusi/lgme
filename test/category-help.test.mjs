import test from 'node:test';
import assert from 'node:assert/strict';
import { closedTrade, helpMail } from '../js/category-help.mjs';
import { publicExchangeListing, seedPayload, SEED_LISTINGS } from '../js/exchange-listing.mjs';
import { VIEW_ONLY_MESSAGE } from '../js/view-only-api.mjs';

test('only Health trades stay open and the mail link is not sent', () => {
  const link = new URL(helpMail('Campus'));
  assert.equal(link.protocol, 'mailto:');
  assert.equal(link.pathname, 'cryptovanities@gmail.com');
  assert.equal(link.searchParams.get('subject'), 'Help develop lgme.app: Campus');
  assert.match(link.searchParams.get('body'), /Campus/);
  assert.equal(closedTrade({ category: 'health', service: 'strength' }), false);
  assert.equal(closedTrade({ category: 'exchange', service: 'walk' }), false);
  assert.equal(closedTrade({ category: 'campus' }), true);
  assert.equal(closedTrade({ category: 'exchange', group: 'stories' }), true);
  assert.equal(closedTrade({ service: 'goods' }), true);
  const health = publicExchangeListing(seedPayload(SEED_LISTINGS[0]));
  assert.equal(health.ok, true, health.error);
  const campus = publicExchangeListing({ ...seedPayload(SEED_LISTINGS[0]), group: 'campus' });
  assert.equal(campus.ok, false);
  assert.equal(campus.error, VIEW_ONLY_MESSAGE);
});
