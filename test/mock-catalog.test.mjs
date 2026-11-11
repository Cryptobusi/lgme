import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHOR_STATUS, EXAMPLE_STATUS, UNCLAIMED, publicExchangeListing } from '../js/exchange-listing.mjs';
import { SEED_LISTINGS } from '../js/exchange-listing.mjs';
import { TEST_AUTHORS, examplePayloads, mockListings } from '../js/mock-catalog.mjs';

test('each open category has ten fictional unclaimed listings and six test authors', async () => {
  const rows = mockListings();
  for (const group of ['campus', 'neighbor', 'hosts', 'circles', 'stories', 'mental']) {
    assert.equal(rows.filter((row) => row.group === group).length, 10, group);
  }
  assert.equal(SEED_LISTINGS.filter((row) => (row.tags || []).includes('mental')).length < 10, true);
  assert.equal(TEST_AUTHORS.length, 6);
  assert.equal(new Set(rows.map((row) => row.authorHandle)).size, 6);
  const author = publicExchangeListing({ ...TEST_AUTHORS[0], handle: 'desk-examples', action: 'listing', category: 'exchange', title: 'Mina Vale', service: 'author', status: AUTHOR_STATUS, durationMin: 15 });
  assert.equal(author.ok, true, author.error);
  assert.equal(author.body.status, AUTHOR_STATUS);
  assert.equal(JSON.stringify(author.body).includes('@'), false);
  const sample = publicExchangeListing({ ...rows[0], action: 'listing', category: 'exchange' });
  assert.equal(sample.ok, true, sample.error);
  assert.equal(sample.body.status, UNCLAIMED);
  assert.equal(sample.body.place.length > 0, true);
  const examples = await examplePayloads();
  assert.equal(examples.length, 3);
  for (const example of examples) {
    const built = publicExchangeListing({ ...example, action: 'listing', category: 'exchange' });
    assert.equal(built.ok, true, built.error);
    assert.equal(built.body.status, EXAMPLE_STATUS);
    assert.equal(/^[0-9a-f]{64}$/.test(built.body.receiptHash), true);
    assert.equal(JSON.stringify(built.body).includes('@'), false);
    assert.equal(/diagnos|symptom|patient/i.test(JSON.stringify(built.body)), false);
  }
});
