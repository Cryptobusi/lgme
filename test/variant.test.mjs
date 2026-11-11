import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultVariant, diffLines, validateVariant } from '../js/variant-schema.mjs';
import { ADMIN_WINDOW_MS, versionRequest } from '../js/version-flow.mjs';

function memory() {
  const bag = new Map();
  return {
    async get(key) { return bag.has(key) ? bag.get(key) : null; },
    async set(key, value) { bag.set(key, value); }
  };
}

test('a variant accepts settings and refuses code', () => {
  const base = defaultVariant();
  assert.equal(validateVariant(base).ok, true);
  assert.deepEqual(diffLines(base), ['No changes from the default yet.']);
  const gold = validateVariant({ ...base, theme: 'gold' });
  assert.equal(gold.ok, true);
  assert.match(diffLines(gold.variant).join(' '), /Theme is gold/);
  const messy = validateVariant({ ...base, extras: { ...base.extras, ididit: '<script>' } });
  assert.equal(messy.ok, false);
  const medical = validateVariant({ ...base, fieldHelp: { ...base.fieldHelp, 'version-name': 'This is a diagnosis and a cure for you.' } });
  assert.equal(medical.ok, false);
  assert.equal(ADMIN_WINDOW_MS, 72 * 60 * 60 * 1000);
});

test('three attestations wait for the administrator, then the window commits', async () => {
  const store = memory();
  const mail = [];
  const env = { OWNER_NOTIFY_EMAIL: 'owner@example.test', RESEND_API_KEY: 'k', EMAIL_FROM: 'desk@lgme.app' };
  const fetchImpl = async (_url, options) => { mail.push(JSON.parse(options.body)); return { ok: true }; };
  const variant = defaultVariant();
  const made = await versionRequest({
    method: 'POST', body: { action: 'propose', name: 'Night gold', purpose: 'A darker gold theme for night walks.', memberId: 'test-a', variant, summary: ['Theme is gold.'] }, store, env, fetchImpl, now: 1_000
  });
  assert.equal(made.body.proposal.label, '0 of 3');
  assert.equal(mail[0].text.includes('owner@example.test'), false);
  assert.match(mail[0].text, /"theme":"night"/);
  const self = await versionRequest({ method: 'POST', body: { action: 'attest', id: made.body.proposal.id, memberId: 'test-a' }, store, env, fetchImpl, now: 2_000 });
  assert.equal(self.status, 403);
  for (const memberId of ['test-b', 'test-c']) {
    const step = await versionRequest({ method: 'POST', body: { action: 'attest', id: made.body.proposal.id, memberId }, store, env, fetchImpl, now: 3_000 });
    assert.equal(step.body.ready, false);
  }
  const ready = await versionRequest({ method: 'POST', body: { action: 'attest', id: made.body.proposal.id, memberId: 'test-d' }, store, env, fetchImpl, now: 4_000 });
  assert.equal(ready.body.proposal.status, 'awaiting-admin');
  const early = await versionRequest({ method: 'GET', store, env, fetchImpl, now: 4_000 + ADMIN_WINDOW_MS - 1 });
  assert.equal(early.body.committed.length, 0);
  const later = await versionRequest({ method: 'GET', store, env, fetchImpl, now: 4_000 + ADMIN_WINDOW_MS });
  assert.equal(later.body.committed[0].name, 'Night gold');
  assert.equal(later.body.committed[0].authorId, 'test-a');
  const other = await versionRequest({
    method: 'POST', body: { action: 'propose', name: 'Paper desk', purpose: 'A paper look for daytime reading.', memberId: 'test-a', variant, summary: [] }, store, env, fetchImpl, now: 9_000
  });
  const denied = await versionRequest({ method: 'POST', body: { action: 'deny', id: other.body.proposal.id, reason: 'Not for the desk.' }, store, env, fetchImpl, now: 9_100, admin: true });
  assert.equal(denied.body.denied, true);
  const mine = await versionRequest({ method: 'GET', search: '?mine=test-a', store, env, fetchImpl, now: 9_200 });
  assert.equal(mine.body.mine.find((row) => row.name === 'Paper desk').status, 'denied');
  const hidden = await versionRequest({ method: 'GET', search: '?notices=1', store, env, fetchImpl, admin: false });
  assert.equal(hidden.status, 401);
});
