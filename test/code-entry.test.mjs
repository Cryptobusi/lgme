import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { codeKey, hashCode, hashEmail } from '../js/email-check-core.mjs';
import { confirmCode } from '../api/lib/email-flow.mjs';
import { generateTotpSecret, matchTotp, otpauthUri, totpAt } from '../js/totp.mjs';

function memory() {
  const data = new Map();
  return {
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async set(key, value) { data.set(key, value); },
    async del(key) { data.delete(key); }
  };
}

test('the authenticator entry is named lgme.app and spaced codes match', async () => {
  const uri = otpauthUri('ABCDEFGHIJKLMNOP', 'ada@example.com');
  assert.equal(uri.includes('issuer=lgme.app'), true);
  assert.equal(uri.includes(encodeURIComponent('lgme.app:ada@example.com')), true);
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = await totpAt(secret, now);
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const dashed = `${code.slice(0, 3)}-${code.slice(3)}`;
  assert.equal((await matchTotp(secret, spaced, now)).ok, true);
  assert.equal((await matchTotp(secret, dashed, now)).ok, true);
  const store = memory();
  const pepper = 'pepper';
  const email = 'ada@example.com';
  const emailHash = await hashEmail(email, pepper);
  await store.set(codeKey(emailHash), { hash: await hashCode(code, pepper), attempts: 0, exp: now + 60_000 });
  const emailSpace = await confirmCode(store, { email, code: spaced, pepper, now });
  assert.equal(emailSpace.ok, true, emailSpace.error);
  await store.set(codeKey(emailHash), { hash: await hashCode(code, pepper), attempts: 0, exp: now + 60_000 });
  const emailDash = await confirmCode(store, { email, code: dashed, pepper, now });
  assert.equal(emailDash.ok, true, emailDash.error);
  const home = readFileSync(new URL('../js/thumb-home.mjs', import.meta.url), 'utf8');
  assert.equal(home.includes('>Email code</label>'), false);
  assert.equal(home.includes('Google Authenticator code'), true);
  assert.equal(home.includes('id="access-send"'), true);
  assert.equal(home.includes('id="access-totp"'), true);
  assert.equal(home.includes("code: compactCode(board.querySelector('#access-totp').value)"), true);
  assert.equal(home.includes('The entry will be named lgme.app.'), true);
});
