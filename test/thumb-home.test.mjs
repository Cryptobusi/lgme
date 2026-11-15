import test from 'node:test';
import assert from 'node:assert/strict';
import { gateDecision, nextAccess, signinAllowed } from '../js/confirm-gate.mjs';

test('sign-in codes are rate limited and a person must confirm', () => {
  const first = signinAllowed([], 1_000);
  assert.equal(first.ok, true);
  const soon = signinAllowed(first.stamps, 1_000 + 1000);
  assert.equal(soon.ok, false);
  assert.equal(nextAccess({}), 'email');
  assert.equal(nextAccess({ email: 'a@b.co', codeOk: true, memberId: 'abc', aiTested: true }), 'grant');
  assert.equal(gateDecision({ human: false, method: 'passkey' }).ok, false);
  assert.equal(gateDecision({ human: true, method: 'passkey' }).ok, false);
  assert.equal(gateDecision({ human: true, method: 'passkey', verified: true }).ok, true);
  assert.equal(gateDecision({ human: true, method: 'totp', code: '123456' }).ok, false);
  assert.equal(gateDecision({ human: true, method: 'totp', verified: true }).ok, true);
  assert.equal(gateDecision({ method: 'passkey' }).ok, false);
});
