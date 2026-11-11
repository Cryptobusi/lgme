import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendRate } from '../js/exercise-arbiter.mjs';
import { suggestThird } from '../js/high-value.mjs';
import { HEALTH_EXAMPLES, healthChainMessage, healthExamplePosts, mergeHealthExamples } from '../js/health-examples.mjs';
import { chainPayloadSafe, isMockExample, mockWriteAllowed } from '../js/hedera-network.mjs';
import { tallyExchange } from '../js/exchange-overview.mjs';

test('fifteen health examples stay test, hash-only, and off mainnet', async () => {
  assert.equal(HEALTH_EXAMPLES.length, 15);
  assert.equal(new Set(HEALTH_EXAMPLES.map((row) => row.id)).size, 15);
  assert.equal(new Set(HEALTH_EXAMPLES.map((row) => row.path)).size, 15);
  const posts = await healthExamplePosts();
  for (const row of posts) {
    assert.equal(row.chain.title, undefined);
    assert.equal(row.chain.summary, undefined);
    assert.equal(row.chain.handle, undefined);
    assert.equal(chainPayloadSafe(row.chain).ok, true);
    assert.equal(isMockExample(row.chain), true);
    assert.equal(mockWriteAllowed('mainnet'), false);
  }
  const view = tallyExchange({ listings: mergeHealthExamples([]) });
  assert.equal(view.flow.listed, 15);
  assert.equal(view.flow.matched >= 1, true);
  assert.equal(view.flow.confirmed >= 1, true);
  assert.equal(view.flow.receipt >= 1, true);
  assert.equal(view.health.testOffers + view.health.testRequests, 15);
  const rate = recommendRate({ kind: 'mental', minutes: 30 });
  assert.equal(rate.ok, true);
  const suggestion = suggestThird(
    [{ id: 'mina-vale', clubGroups: { dawn: { role: 'admin' } } }, { id: 'otto-park', clubGroups: { dawn: { role: 'member' } } }, { id: 'lila-brook', clubGroups: { dawn: { role: 'member' } } }],
    { id: 'otto-park', clubGroups: { dawn: { role: 'member' } } },
    { id: 'lila-brook', clubGroups: { dawn: { role: 'member' } } }
  );
  assert.equal(suggestion.role, 'group administrator');
});
