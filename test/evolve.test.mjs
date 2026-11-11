import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryRequest, countLabel, nearDuplicates, similarity } from '../js/category-evolve.mjs';

function memory() {
  const bag = new Map();
  return {
    async get(key) { return bag.has(key) ? bag.get(key) : null; },
    async set(key, value) { bag.set(key, value); },
    bag
  };
}

test('text similarity finds a near duplicate and leaves a new name alone', () => {
  assert.equal(similarity('Health club', 'Health'), 1);
  assert.equal(nearDuplicates('Health club', [{ name: 'Health' }]).length, 1);
  assert.equal(nearDuplicates('Tool library', [{ name: 'Health' }, { name: 'Campus' }]).length, 0);
  assert.equal(countLabel(1), '1 of 3');
  assert.equal(countLabel(9), '3 of 3');
});

test('a unique proposal needs three other members and tells the owner', async () => {
  const store = memory();
  const mail = [];
  const env = { OWNER_NOTIFY_EMAIL: 'owner@example.test', RESEND_API_KEY: 'k', EMAIL_FROM: 'desk@lgme.app' };
  const fetchImpl = async (_url, options) => {
    mail.push(JSON.parse(options.body));
    return { ok: true };
  };
  const close = await categoryRequest({ method: 'POST', body: { action: 'propose', kind: 'category', name: 'Health club', description: 'A second health desk.', memberId: 'test-a' }, store, env, fetchImpl });
  assert.equal(close.status, 409);
  assert.equal(close.body.matches[0].name, 'Health');
  const medical = await categoryRequest({ method: 'POST', body: { action: 'propose', kind: 'category', name: 'Clinic notes', description: 'A diagnosis and a cure.', memberId: 'test-a' }, store, env, fetchImpl });
  assert.equal(medical.status, 400);
  const made = await categoryRequest({ method: 'POST', body: { action: 'propose', kind: 'category', name: 'Tool library', description: 'A place to trade tools.', memberId: 'test-a' }, store, env, fetchImpl });
  assert.equal(made.body.proposal.label, '0 of 3');
  assert.equal(mail.length, 1);
  assert.match(mail[0].subject, /Tool library/);
  assert.equal(mail[0].text.includes('owner@example.test'), false);
  const self = await categoryRequest({ method: 'POST', body: { action: 'attest', id: made.body.proposal.id, memberId: 'test-a' }, store, env, fetchImpl });
  assert.equal(self.status, 403);
  for (const memberId of ['test-b', 'test-c']) {
    const step = await categoryRequest({ method: 'POST', body: { action: 'attest', id: made.body.proposal.id, memberId }, store, env, fetchImpl });
    assert.equal(step.body.promoted, false);
  }
  const again = await categoryRequest({ method: 'POST', body: { action: 'attest', id: made.body.proposal.id, memberId: 'test-b' }, store, env, fetchImpl });
  assert.equal(again.status, 409);
  const done = await categoryRequest({ method: 'POST', body: { action: 'attest', id: made.body.proposal.id, memberId: 'test-d' }, store, env, fetchImpl });
  assert.equal(done.body.promoted, true);
  assert.equal(done.body.proposal.label, 'Early / In development');
  assert.equal(mail.length, 2);
  const notices = await categoryRequest({ method: 'GET', search: '?notices=1', store, env, admin: true });
  assert.equal(notices.body.notices.length, 2);
  const hidden = await categoryRequest({ method: 'GET', search: '?notices=1', store, env, admin: false });
  assert.equal(hidden.status, 401);
  const listing = await categoryRequest({ method: 'POST', body: { action: 'propose', kind: 'listing', category: 'health', name: 'IhavIT', description: 'An offer already on the desk.', memberId: 'test-a' }, store, env, fetchImpl });
  assert.equal(listing.status, 409);
});
