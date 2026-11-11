import test from 'node:test';
import assert from 'node:assert/strict';
import { tallyExchange } from '../js/exchange-overview.mjs';

test('the overview counts only what the mirror sent', () => {
  const view = tallyExchange({
    network: 'testnet',
    topicId: '0.0.11397293',
    pool: { inUsd: 2, outUsd: 1, covers: 1 },
    listings: [
      { sequenceNumber: 27, consensusTimestamp: '1.1', item: { kind: 'listing', group: 'campus', side: 'offer', status: 'Test item - unclaimed', title: 'Intro graphs hour' } },
      { sequenceNumber: 28, consensusTimestamp: '1.2', item: { kind: 'listing', group: 'campus', side: 'request', status: 'Test item - unclaimed', title: 'Lab report reading' } },
      { sequenceNumber: 21, consensusTimestamp: '1.0', item: { kind: 'listing', service: 'author', status: 'Test author - unclaimed', title: 'Mina Vale' } },
      { sequenceNumber: 87, consensusTimestamp: '2', item: { kind: 'listing', service: 'example', status: 'Example transaction - test, until claimed', title: 'Tutoring for yard help', summary: 'IdidIt verified receipt.' } },
      { sequenceNumber: 19, consensusTimestamp: '0.9', item: { kind: 'interest', offer: 'Developer team', status: 'Volunteer - pending review' } },
      { sequenceNumber: 20, consensusTimestamp: '0.95', item: { kind: 'interest', offer: 'Host a community', status: 'Host interest - pending review' } }
    ]
  });
  assert.equal(view.network, 'testnet');
  assert.equal(view.latest.sequence, 87);
  assert.equal(view.groups.campus.offers, 1);
  assert.equal(view.groups.campus.requests, 1);
  assert.equal(view.groups.campus.testUnclaimed, 2);
  assert.equal(view.groups.campus.real, 0);
  assert.equal(view.flow.listed, 2);
  assert.equal(view.flow.receipt, 1);
  assert.equal(view.developers, 1);
  assert.equal(view.hosts, 1);
  assert.equal(view.examples.length, 1);
  assert.equal(view.pool.inUsd, 2);
  assert.equal(JSON.stringify(view).includes('Mina'), false);
});

test('a later message replaces the earlier status for the same id', () => {
  const view = tallyExchange({
    listings: [
      { sequenceNumber: 1, item: { id: 'bike-tune', kind: 'listing', group: 'neighbor', side: 'offer', status: 'Test item - unclaimed' } },
      { sequenceNumber: 4, item: { id: 'bike-tune', kind: 'update', group: 'neighbor', side: 'offer', status: 'Claimed by ada' } },
      { sequenceNumber: 3, item: { id: 'setup-ada', kind: 'receivable', usd: 5, handle: 'ada', status: 'due' } }
    ]
  });
  assert.equal(view.groups.neighbor.testUnclaimed, 0);
  assert.equal(view.groups.neighbor.claimed, 1);
  assert.equal(view.flow.listed, 1);
  assert.equal(view.flow.matched, 1);
  assert.equal(view.setup.due, 1);
  assert.equal(view.setup.usd, 5);
  assert.equal(JSON.stringify(view).includes('ada'), false);
});
