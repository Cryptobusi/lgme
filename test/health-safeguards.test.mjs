import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGE_LABEL, COLLECT_LABEL, SHARE_LABEL, deleteLocalHealth, healthConsent, mayCollect, mayShare, revokeShare } from '../js/health-safeguards.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

function memory() {
  const values = new Map();
  const keys = [];
  return {
    get length() { return keys.length; },
    key(index) { return keys[index] || null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (!values.has(key)) keys.push(key);
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
      const index = keys.indexOf(key);
      if (index >= 0) keys.splice(index, 1);
    }
  };
}

test('sign-up stores only consent booleans and sharing stays off', () => {
  assert.equal(healthConsent({ adult: false, collect: true }).ok, false);
  assert.equal(healthConsent({ adult: true, collect: false }).ok, false);
  const saved = healthConsent({ adult: true, collect: true, share: false });
  assert.deepEqual(saved.consent, { adult: true, collect: true, share: false });
  assert.equal(Object.values(saved.consent).every((value) => typeof value === 'boolean'), true);
  const member = { healthConsent: saved.consent, gymProgress: { share: { miles: 'board' } } };
  assert.equal(mayCollect(member), true);
  assert.equal(mayShare(member), false);
  assert.equal(revokeShare({ ...member, healthConsent: { ...saved.consent, share: true } }).gymProgress.share.miles, 'me');
  assert.equal(mayShare({ example: true }), true);
});

test('one tap deletes local health records and discards salts', () => {
  const storage = memory();
  storage.setItem('lgme-sim:peer:ada', JSON.stringify({ id: 'ada', kyc: { salt: 'secret-salt', phone: '555' } }));
  storage.setItem('lgme.covenant.private', JSON.stringify({ ada: { legalName: 'Ada' } }));
  storage.setItem('lgme-gym-demo:peer:sam', JSON.stringify({ id: 'sam' }));
  const result = deleteLocalHealth(storage);
  assert.equal(storage.getItem('lgme-sim:peer:ada'), null);
  assert.equal(storage.getItem('lgme.covenant.private'), null);
  assert.equal(storage.getItem('lgme-gym-demo:peer:sam'), '{"id":"sam"}');
  assert.equal(result.saltsDiscarded, 1);
  assert.equal(result.removed.includes('lgme-sim:peer:ada'), true);
});

test('the notice, breach plan, and gym pages carry no ad or analytics scripts', () => {
  const pages = ['gym.html', 'gym/index.html', 'gym/covenant.html', 'gym/intake-protocol.html', 'gym/health-data.html', 'gym/breach-plan.html', 'help.html'];
  const banned = /googletagmanager|google-analytics|gtag\(|facebook\.net|doubleclick|hotjar|segment\.com|mixpanel|plausible|analytics\.js|connect\.facebook/i;
  for (const page of pages) {
    const html = text(page);
    assert.equal(html.includes('$Trust'), false, page);
    assert.equal(banned.test(html), false, page);
    const sources = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(sources.every((src) => src.startsWith('/')), true, page);
  }
  const notice = text('gym/health-data.html');
  const plan = text('gym/breach-plan.html');
  assert.equal(notice.includes('Not legal advice'), true);
  assert.equal(notice.includes('pending counsel review'), true);
  assert.equal(notice.includes('never goes on Hedera'), true);
  assert.equal(notice.includes('id="delete-health"'), true);
  assert.equal(text('js/health-safeguards.mjs').includes(AGE_LABEL), true);
  assert.equal(text('js/gym-app.mjs').includes('id: \'age-gate\''), true);
  assert.equal(plan.includes('60 days'), true);
  assert.equal(plan.includes('500'), true);
  assert.equal(plan.includes('Draft pending counsel review'), true);
  assert.equal(text('gym.html').includes('href="/gym/health-data"'), true);
  assert.equal(text('help.html').includes('/gym/health-data'), true);
  assert.equal(text('sitemap.xml').includes('https://lgme.app/gym/health-data'), true);
  assert.equal(text('sitemap.xml').includes('https://lgme.app/gym/breach-plan'), true);
  assert.equal(text('js/health-safeguards.mjs').includes(COLLECT_LABEL), true);
  assert.equal(text('js/health-safeguards.mjs').includes(SHARE_LABEL), true);
  assert.equal(text('js/gym-app.mjs').includes('COLLECT_LABEL'), true);
  assert.equal(text('js/gym-app.mjs').includes('SHARE_LABEL'), true);
  assert.equal(text('sw.js').includes('lgme-v150'), true);
  assert.equal(text('sw-gym.js').includes('lgme-gym-v60'), true);
});
