import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptableInvite } from '../js/device-sign.mjs';
import {
  draftHealthInvite,
  feePreset,
  inviteEnrollment,
  inviteShares,
  parseJoinSearch,
  readJoin,
  rememberJoin
} from '../js/health-invite.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

function memory() {
  const bag = {};
  return {
    getItem(key) { return bag[key] || null; },
    setItem(key, value) { bag[key] = String(value); }
  };
}

test('an invite ask drafts a 10-character Health link and four share actions', () => {
  const self = draftHealthInvite({ question: 'Please send an invite', inviter: 'mina' });
  assert.equal(self.ok, true, self.error);
  assert.equal(self.sent, false);
  assert.equal(self.contacts, false);
  assert.equal(self.fee, 'self');
  assert.equal(self.invite.length, 10);
  assert.equal(acceptableInvite(self.invite), true);
  assert.match(self.url, new RegExp(`^https://lgme\\.app/join\\?invite=${self.invite}&fee=self&from=mina$`));

  const pool = draftHealthInvite({ question: 'send an invite from the pool', inviter: 'mina', code: 'abcdefghij', poolCovers: 1 });
  assert.equal(pool.fee, 'pool');
  assert.equal(pool.url, 'https://lgme.app/join?invite=abcdefghij&fee=pool&from=mina');
  const shares = inviteShares(pool);
  const mail = new URL(shares.email);
  assert.equal(mail.protocol, 'mailto:');
  assert.equal(mail.searchParams.get('subject'), pool.subject);
  assert.match(mail.searchParams.get('body'), /https:\/\/lgme\.app\/join\?invite=abcdefghij&fee=pool&from=mina/);
  assert.equal(shares.text.startsWith('sms:?&body='), true);
  assert.match(decodeURIComponent(shares.text), /https:\/\/lgme\.app\/join\?invite=abcdefghij&fee=pool/);
  assert.equal(shares.share.url, pool.url);
  assert.match(shares.share.text, /pool/);
  assert.equal(shares.copy, pool.url);

  const sponsor = draftHealthInvite({ question: 'send an invite and I will cover it', inviter: 'Mina', code: 'abcdefghij', credit: 2 });
  assert.equal(sponsor.ok, true, sponsor.error);
  assert.equal(sponsor.fee, 'sponsor');
  assert.equal(sponsor.reserve, true);
  assert.equal(sponsor.note, 'Sponsored by mina.');
  assert.match(sponsor.url, /fee=sponsor&from=mina/);
  const broke = draftHealthInvite({ question: 'send an invite and I will cover it', inviter: 'mina', credit: 0 });
  assert.equal(broke.ok, false);
  const quiet = draftHealthInvite({ question: 'What is the floor?' });
  assert.equal(quiet.ok, false);

  const parsed = parseJoinSearch('?invite=abcdefghij&fee=pool&from=mina');
  assert.equal(parsed.ok, true);
  const storage = memory();
  rememberJoin(storage, parsed);
  assert.deepEqual(readJoin(storage), { invite: 'abcdefghij', fee: 'pool', from: 'mina' });
  assert.equal(feePreset(readJoin(storage), { covers: 1 }).selected, 'use-pool');
  assert.equal(feePreset(readJoin(storage), { covers: 1 }).label, 'Use the pool');
  const sponsored = parseJoinSearch(sponsor.url.slice(sponsor.url.indexOf('?')));
  assert.equal(feePreset(sponsored, { offers: 1 }).label, 'Sponsored by mina');
  assert.equal(feePreset(sponsored, { offers: 1 }).selected, 'accept-cover');

  let walk = inviteEnrollment({});
  assert.equal(walk.step, 'email');
  walk = inviteEnrollment({ emailVerified: true });
  assert.equal(walk.step, 'consents');
  walk = inviteEnrollment({ emailVerified: true, adult: true, collect: true });
  assert.equal(walk.step, 'fee');
  walk = inviteEnrollment({ emailVerified: true, adult: true, collect: true, feePaid: true });
  assert.equal(walk.done, true);
  assert.equal(walk.next, '/personalize');

  const app = text('js/gym-app.mjs');
  const page = text('js/health-invite.mjs');
  assert.equal(app.includes('id: \'invite-email\''), true);
  assert.equal(app.includes('id: \'invite-text\''), true);
  assert.equal(app.includes('id: \'invite-share\''), true);
  assert.equal(app.includes('id: \'invite-copy\''), true);
  assert.equal(app.includes('navigator.share'), true);
  assert.equal(app.includes('navigator.contacts'), false);
  assert.equal(page.includes('fetch('), false);
  assert.equal(text('join.html').includes('/js/join-page.js'), true);
  assert.equal(text('js/setup-fee-page.mjs').includes('Pay now'), true);
  assert.equal(text('js/setup-fee-page.mjs').includes('Pay later'), true);
});
