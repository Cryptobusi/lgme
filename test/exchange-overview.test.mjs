import test from 'node:test';
import assert from 'node:assert/strict';
import { isHealthListing, tallyExchange } from '../js/exchange-overview.mjs';

test('the board counts Health only and keeps test apart from a real claim', () => {
  const view = tallyExchange({
    network: 'testnet',
    topicId: '0.0.11397293',
    pool: { inUsd: 2 },
    listings: [
      { sequenceNumber: 2, consensusTimestamp: '1', item: { id: 'ex-strength', kind: 'listing', service: 'strength', side: 'offer', status: 'Test item - unclaimed', title: 'Beginner strength' } },
      { sequenceNumber: 3, consensusTimestamp: '1.1', item: { id: 'ex-walk', kind: 'listing', service: 'walk', side: 'request', status: 'Test item - unclaimed' } },
      { sequenceNumber: 4, consensusTimestamp: '1.2', item: { id: 'ex-repair', kind: 'update', service: 'repair', side: 'offer', status: 'Claimed by trainer' } },
      { sequenceNumber: 5, consensusTimestamp: '1.3', item: { id: 'ex-done', kind: 'listing', service: 'mobility', side: 'offer', status: 'Finished', summary: 'IdidIt verified receipt.' } },
      { sequenceNumber: 27, consensusTimestamp: '2', item: { kind: 'listing', group: 'campus', side: 'offer', status: 'Test item - unclaimed', title: 'Intro graphs hour' } },
      { sequenceNumber: 77, consensusTimestamp: '3', item: { kind: 'listing', group: 'mental', service: 'mental', side: 'offer', status: 'Test item - unclaimed', title: 'Quiet half hour' } },
      { sequenceNumber: 21, consensusTimestamp: '0.5', item: { kind: 'listing', service: 'author', status: 'Test author - unclaimed', title: 'Mina Vale' } },
      { sequenceNumber: 87, consensusTimestamp: '4', item: { kind: 'listing', service: 'example', status: 'Example transaction - test, until claimed', title: 'Tutoring for yard help', summary: 'IdidIt verified receipt.' } },
      { sequenceNumber: 18, consensusTimestamp: '0.4', item: { kind: 'pool', id: 'membership-fee-pool', inUsd: 2 } },
      { sequenceNumber: 19, consensusTimestamp: '0.3', item: { kind: 'interest', offer: 'Developer team', status: 'Volunteer - pending review' } }
    ]
  });
  assert.equal(view.health.testOffers, 1);
  assert.equal(view.health.testRequests, 1);
  assert.equal(view.health.realOffers, 2);
  assert.equal(view.health.realClaimed, 1);
  assert.equal(view.health.testClaimed, 0);
  assert.equal(view.health.realFinished, 1);
  assert.equal(view.flow.listed, 4);
  assert.equal(view.flow.matched, 1);
  assert.equal(view.flow.receipt, 1);
  assert.equal(view.groups, undefined);
  assert.equal(view.examples, undefined);
  assert.equal(view.pool, undefined);
  assert.equal(isHealthListing({ group: 'campus', service: 'campus', status: 'Test item - unclaimed' }), false);
  assert.equal(JSON.stringify(view).includes('Mina'), false);
  assert.equal(JSON.stringify(view).includes('Intro graphs'), false);
});

test('a claim replaces the test label for the same Health id', () => {
  const view = tallyExchange({
    listings: [
      { sequenceNumber: 1, item: { id: 'ex-bike', kind: 'listing', service: 'bike', side: 'offer', status: 'Test item - unclaimed' } },
      { sequenceNumber: 2, item: { id: 'ex-bike', kind: 'update', service: 'bike', side: 'offer', status: 'Claimed by ada' } }
    ]
  });
  assert.equal(view.health.testOffers, 0);
  assert.equal(view.health.realOffers, 1);
  assert.equal(view.health.realClaimed, 1);
  assert.equal(JSON.stringify(view).includes('ada'), false);
});
