import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sim from '../js/p2p-exchange-sim.mjs';
import { projectSubfloors } from '../js/subfloor.mjs';
import { CHECKLIST, EXCERPT_FIELDS, EXCERPT_NOTE, MAXIMS, checkState, memberLines, publicWisdom, rotationFor, wisdomSplit, wisdomVisible } from '../js/wisdom.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');
const at = '2026-11-10T15:00:00.000Z';
const unix = 1700000000;

async function people() {
  const store = sim.createMemoryStore();
  await sim.createPeer(store, { id: 'alice', name: 'Alice', balance: 100, floor: 40, creditLimit: -200, at });
  await sim.createPeer(store, { id: 'bob', name: 'Bob', balance: 50, floor: 40, creditLimit: -200, at });
  await sim.createPeer(store, { id: 'charlie', name: 'Charlie', balance: 80, floor: 20, creditLimit: -200, at });
  return store;
}

async function codeFor(store, id) {
  const setup = await sim.setupWallet(store, id, 'correct horse', { iterations: 2000 });
  return sim.totp(sim.base32Decode(setup.secretBase32), unix, { digits: 6, period: 30, algorithm: 'SHA-1' });
}

async function reopen(store, id, code) {
  const peer = await store.get(id);
  peer.privateKeyJwk = (await sim.unlockWallet(peer, 'correct horse', code, unix)).privateKeyJwk;
  await store.set(id, peer);
}

async function signed(store) {
  const codes = {
    alice: await codeFor(store, 'alice'),
    bob: await codeFor(store, 'bob'),
    charlie: await codeFor(store, 'charlie')
  };
  for (const id of Object.keys(codes)) await reopen(store, id, codes[id]);
  return codes;
}

function quote(extra = {}) {
  return {
    text: 'Keep the tool that does the work.',
    theme: 'tools',
    kind: 'quote',
    source: 'A maker',
    sourceUrl: 'https://egonomicanonymous.live',
    ...extra
  };
}

test('the wisdom page carries the maxims, the checklist, and the empty daily file', () => {
  const page = text('wisdom.html').replace(/&amp;/g, '&');
  const home = text('index.html');
  const help = text('help.html');
  const glossary = text('glossary.html');
  const map = text('sitemap.xml');
  const worker = text('sw.js');
  assert.equal(page.startsWith('<!doctype html>'), true);
  assert.equal(page.trimEnd().endsWith('</html>'), true);
  assert.equal(page.includes('CONTENT_FROM_FILE'), false);
  assert.equal(page.includes('$Trust'), false);
  assert.equal(help.includes('$Trust'), false);
  assert.equal(glossary.includes('$Trust'), false);
  for (const maxim of MAXIMS) {
    assert.equal(page.includes(maxim.title), true, maxim.title);
    assert.equal(page.includes(maxim.practice), true, maxim.practice);
    assert.equal(page.includes(maxim.clearance), true, maxim.clearance);
  }
  for (const phase of CHECKLIST) {
    assert.equal(page.includes(phase.phase), true, phase.phase);
    for (const item of phase.items) assert.equal(page.includes(item), true, item);
  }
  assert.equal(MAXIMS.length, 12);
  assert.equal(page.includes('https://egonomicanonymous.live'), true);
  assert.equal(page.includes('Not medical advice.'), true);
  assert.equal(page.includes('The gift clears its own ledger'), true);
  assert.equal(page.includes('Submissions stay on this device until shared listings are switched on.'), true);
  assert.equal(page.includes('<script type="module" src="/js/wisdom-page.mjs"></script>'), true);
  assert.equal(/<script(?![^>]*\bsrc=)/i.test(page), false);
  const file = JSON.parse(text('data/wisdom-excerpts.json'));
  assert.equal(file.note, EXCERPT_NOTE);
  assert.deepEqual(file.excerpts, []);
  assert.deepEqual(EXCERPT_FIELDS, ['date', 'text', 'theme', 'forTheApp', 'source', 'sourceUrl', 'kind']);
  const navStart = home.indexOf('id="main-nav"');
  const nav = home.slice(navStart, home.indexOf('</nav>', navStart));
  assert.equal(nav.includes('href="/wisdom">Wisdom</a>'), true);
  assert.equal(nav.includes('href="/health-club"'), true);
  assert.equal(map.includes('<loc>https://lgme.app/wisdom</loc>'), true);
  assert.equal(help.includes('5% to the Floor and 5% to the App development fund'), true);
  assert.equal(glossary.includes('Sober Poverty'), true);
  assert.equal(glossary.includes('App development fund'), true);
  assert.equal(worker.includes('lgme-v111'), true);
  assert.equal(worker.includes('/data/wisdom-excerpts.json'), true);
  assert.equal(text('js/p2p-exchange-sim-ui.mjs').match(/fetch\(/g).length, 8);
  assert.equal(text('health-club.html').includes('The gift clears its own ledger'), true);
});

test('a quote needs a source and an https URL, and the checklist does not keep yesterday', () => {
  assert.equal(publicWisdom({ text: 'Mine', theme: 'work', kind: 'original' }).ok, true);
  assert.equal(publicWisdom(quote()).ok, true);
  assert.equal(publicWisdom({ ...quote(), sourceUrl: '' }).ok, false);
  assert.equal(publicWisdom({ text: 'x'.repeat(281), theme: 'work', kind: 'original' }).ok, false);
  assert.equal(publicWisdom({ text: 'email me a@b.co', theme: 'work', kind: 'original' }).ok, false);
  assert.equal(checkState({ day: '2026-11-09', ids: ['morning-0'] }, '2026-11-10').ids.length, 0);
  assert.deepEqual(checkState({ day: '2026-11-10', ids: ['morning-0', 4] }, '2026-11-10').ids, ['morning-0']);
  const line = rotationFor('2026-11-10', []);
  assert.equal(rotationFor('2026-11-10', []).title, line.title);
  assert.equal(MAXIMS.some((maxim) => maxim.title === line.title), true);
});

test('wisdom is published only after two other members concur', async () => {
  const store = await people();
  const codes = await signed(store);
  const submitted = await sim.submitWisdom(store, 'alice', { ...quote(), anonymous: true, passphrase: 'correct horse', code: codes.alice, unixSeconds: unix, at });
  assert.equal(submitted.ok, true, submitted.error);
  assert.equal(submitted.creditMinted, false);
  assert.equal(submitted.unchanged, true);
  const alice = await store.get('alice');
  assert.equal(alice.wisdomSubmissions[submitted.submissionId].handle, '');
  assert.equal(alice.wisdomSubmissions[submitted.submissionId].status, 'pending');
  assert.equal(memberLines([alice.wisdomSubmissions[submitted.submissionId]]).length, 0);
  const self = await sim.concurWisdom(store, 'alice', submitted.submissionId, { authorId: 'alice', passphrase: 'correct horse', code: codes.alice, unixSeconds: unix, at });
  assert.equal(self.ok, false);
  await reopen(store, 'bob', codes.bob);
  const first = await sim.concurWisdom(store, 'bob', submitted.submissionId, { authorId: 'alice', passphrase: 'correct horse', code: codes.bob, unixSeconds: unix, at });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.status, 'pending');
  assert.equal(first.creditMinted, false);
  assert.equal(first.unchanged, true);
  await reopen(store, 'bob', codes.bob);
  const again = await sim.concurWisdom(store, 'bob', submitted.submissionId, { authorId: 'alice', passphrase: 'correct horse', code: codes.bob, unixSeconds: unix, at });
  assert.equal(again.ok, false);
  await reopen(store, 'charlie', codes.charlie);
  const before = sim.replay(await store.get('charlie')).balance;
  const no = await sim.declineWisdom(store, 'charlie', submitted.submissionId, { authorId: 'alice', passphrase: 'correct horse', code: codes.charlie, unixSeconds: unix, at });
  assert.equal(no.ok, true, no.error);
  assert.equal(no.status, 'pending');
  assert.equal(sim.replay(await store.get('charlie')).balance, before);
  const daveStore = store;
  await sim.createPeer(daveStore, { id: 'dora', name: 'Dora', balance: 30, floor: 10, creditLimit: -50, at });
  const doraCode = await codeFor(daveStore, 'dora');
  await reopen(daveStore, 'dora', doraCode);
  const second = await sim.concurWisdom(daveStore, 'dora', submitted.submissionId, { authorId: 'alice', passphrase: 'correct horse', code: doraCode, unixSeconds: unix, at });
  assert.equal(second.ok, true, second.error);
  assert.equal(second.status, 'published');
  assert.equal(second.count, 2);
  const published = (await store.get('alice')).wisdomSubmissions[submitted.submissionId];
  assert.equal(published.anonymous, true);
  assert.equal(memberLines([published])[0].source, 'anonymous');
  assert.equal(memberLines([published])[0].title, 'tools');
  assert.equal(JSON.stringify(published).includes('https://'), true);
});

test('support splits 10 percent to the Floor and refuses a gift that spends the floor', async () => {
  const store = await people();
  const codes = await signed(store);
  const submitted = await sim.submitWisdom(store, 'alice', { ...quote(), passphrase: 'correct horse', code: codes.alice, unixSeconds: unix, at });
  await reopen(store, 'bob', codes.bob);
  await sim.concurWisdom(store, 'bob', submitted.submissionId, { authorId: 'alice', passphrase: 'correct horse', code: codes.bob, unixSeconds: unix, at });
  await reopen(store, 'charlie', codes.charlie);
  await sim.concurWisdom(store, 'charlie', submitted.submissionId, { authorId: 'alice', passphrase: 'correct horse', code: codes.charlie, unixSeconds: unix, at });
  await reopen(store, 'alice', codes.alice);
  await reopen(store, 'bob', codes.bob);
  const tooMuch = await sim.supportWisdom(store, 'bob', submitted.submissionId, {
    authorId: 'alice', kind: 'lgme', amount: 20, passphrase: 'correct horse', code: codes.bob, unixSeconds: unix, at
  });
  assert.equal(tooMuch.ok, false);
  assert.equal(sim.replay(await store.get('bob')).balance, 50);
  await reopen(store, 'bob', codes.bob);
  await reopen(store, 'alice', codes.alice);
  const paid = await sim.supportWisdom(store, 'bob', submitted.submissionId, {
    authorId: 'alice', kind: 'lgme', amount: 5, passphrase: 'correct horse', code: codes.bob, unixSeconds: unix, at
  });
  assert.equal(paid.ok, true, paid.error);
  assert.equal(paid.floorShare, 0.25);
  assert.equal(paid.appShare, 0.25);
  assert.equal(paid.authorShare, 4.5);
  assert.equal(paid.creditMinted, false);
  assert.equal(sim.replay(await store.get('bob')).balance, 45);
  assert.equal(sim.replay(await store.get('alice')).balance, 104.5);
  const snapshot = projectSubfloors([await store.get('alice'), await store.get('bob')]);
  assert.equal(snapshot.floorReserve, 0.25);
  assert.equal(snapshot.appFund, 0.25);
  await reopen(store, 'charlie', codes.charlie);
  const credit = await sim.supportWisdom(store, 'charlie', submitted.submissionId, {
    authorId: 'alice', kind: 'credit', amount: 1, passphrase: 'correct horse', code: codes.charlie, unixSeconds: unix, at
  });
  assert.equal(credit.ok, true, credit.error);
  assert.equal(credit.unchanged, true);
  assert.equal(credit.floorShare, 0);
  assert.equal(credit.skim, 0.01);
  assert.equal(credit.authorShare, 0.99);
  assert.equal(sim.replay(await store.get('charlie')).balance, 80);
  await reopen(store, 'charlie', codes.charlie);
  const terms = await sim.supportWisdom(store, 'charlie', submitted.submissionId, {
    authorId: 'alice', kind: 'usd', amount: 2, terms: 'A walk together', passphrase: 'correct horse', code: codes.charlie, unixSeconds: unix, at
  });
  assert.equal(terms.ok, true, terms.error);
  assert.equal(terms.unit, 'USD');
  assert.equal(terms.fallback, 'pay-in-terms');
  assert.equal(terms.unchanged, true);
  const own = await sim.supportWisdom(store, 'alice', submitted.submissionId, {
    authorId: 'alice', kind: 'credit', amount: 1, passphrase: 'correct horse', code: codes.alice, unixSeconds: unix, at
  });
  assert.equal(own.ok, false);
  const early = wisdomSplit(5);
  assert.equal(early.floor, 0.25);
  assert.equal(early.app, 0.25);
  assert.equal(early.author, 4.5);
});

test('a private group excerpt stays with that group', () => {
  const item = { authorId: 'alice', groupCode: 'crew1', status: 'pending' };
  assert.equal(wisdomVisible(item, { id: 'bob' }), false);
  assert.equal(wisdomVisible(item, { id: 'alice' }), true);
  assert.equal(wisdomVisible(item, { id: 'bob', clubGroups: { crew1: { name: 'Crew' } } }), true);
  assert.equal(wisdomVisible({ authorId: 'alice', groupCode: '', status: 'published' }, { id: 'bob' }), true);
});
