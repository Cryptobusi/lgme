import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONSENT_COPY,
  GUARDRAILS,
  acceptSuggestion,
  commitQuickFill,
  createSampleState,
  creditGauge,
  declineSerendipity,
  didProgress,
  dismissSuggestion,
  forgetLearned,
  learnPatterns,
  loadState,
  noticeCount,
  pillarMetrics,
  proofToast,
  ruleSuggestions,
  saveState,
  setSerendipity,
  suggestionsFor,
  suggestionsMarkup,
  weeklyHours
} from '../js/my-picture.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

const UNTOUCHED = {
  'exchange.html': 'bbd42fbb6eba6ad5bff31b8b01574f151f52faa666b177c793cc2093f06c40cb',
  'js/p2p-exchange-sim.mjs': '30c24d75e8dca4d0a5427ba1176b13f192cd27d2ef4f2f709ab7c82449b4087c',
  'js/p2p-exchange-sim-ui.mjs': '060f62857f9d28a21b1ff941157e8ee6f9099b0ca15256231584c44c6870e01f',
  'js/solana-pay.mjs': '91696ed805cb43bca35734dbfbac1f70ea002a4d0c4398393e7df5cf0de976d5',
  'campus.html': '082309bc96c8ccf0647db694204d220f835260213295e8450ae933def2df8f19',
  'js/campus-page.mjs': 'dfff943e00078fc8efc965d9f608b56c47d181d8fada9bd3060bb231566738ba',
  'data/campus-pilot.json': 'e76672225b4c889f03f7cb8d03a651092eff250de2edc5f61fdaad472044b6fc',
  'mutual-credit.html': '89cf1c7436eec32f45a81097e8e204228d7a0ce2f3380f5bbe1a6a942b3d67d9',
  'js/pages/mutual-credit-simulator.js': '8932252678988985ca572615564455dfcf067d61a388eb38359cf155f5a4381f'
};

test('the my-picture route exists as its own page', () => {
  const page = text('my-picture.html');
  assert.equal(page.includes('<title>LGME.APP · My Picture</title>'), true);
  assert.equal(page.includes('Prototype'), true);
  assert.equal(page.includes('href="/css/my-picture.css"'), true);
  assert.equal(page.includes('src="/js/my-picture.mjs"'), true);
  assert.equal(page.includes('id="my-picture-app"'), true);
  assert.equal(text('css/my-picture.css').includes('--stage: #05060c'), true);
  assert.equal(text('vercel.json').includes('"cleanUrls": true'), true);
  assert.equal(text('vercel.json').includes('my-picture'), false);
  assert.equal(text('sitemap.xml').includes('https://lgme.app/my-picture'), true);
});

test('the consent dialog uses the on-device wording', () => {
  const page = text('my-picture.html');
  assert.equal(CONSENT_COPY, 'Allow on-device AI to learn your patterns and suggest unexpected matches? Your data never leaves this device.');
  assert.equal(page.includes(CONSENT_COPY), true);
  assert.equal(page.includes('id="consent-dialog"'), true);
  assert.equal(page.includes('>Allow<'), true);
  assert.equal(page.includes('>Not now<'), true);
  for (const line of GUARDRAILS) assert.equal(page.includes(line), true);
  assert.equal(page.includes('Voice · coming soon'), true);
  assert.equal(page.includes('Photo · coming soon'), true);
});

test('rule-based suggestions are exactly three and essentials come first', () => {
  const state = createSampleState();
  const items = ruleSuggestions(state);
  assert.equal(items.length, 3);
  assert.equal(items[0].kind, 'duty');
  assert.equal(items[0].essential, true);
  assert.equal(items[0].title, 'Elena needs Garden Bed Terracing');
  assert.equal(items[0].action, 'Claim Pledgework');
  assert.match(items[0].why, /Duties due come first/);
  assert.equal(items[1].kind, 'expiring');
  assert.equal(items[1].title, 'Surplus Heirloom Seeds ⇄ Solar kWh');
  assert.equal(items[1].action, 'Open Channel');
  assert.match(items[1].why, /Expiring listings are next/);
  assert.equal(items[2].kind, 'duty');
  assert.equal(items[2].title, 'Oak Ridge Trail Culvert Clearing');
  assert.equal(items.some((item) => item.kind === 'serendipity'), false);
  assert.equal(suggestionsFor(state).length, 3);
  assert.equal((suggestionsMarkup(state).match(/data-suggestion=/g) || []).length, 3);
  assert.equal(suggestionsMarkup(state).includes('Why this?'), true);
});

test('serendipity adds a fourth suggestion only after it is allowed', () => {
  const sample = createSampleState();
  const declined = declineSerendipity(sample);
  assert.equal(declined.consent, 'later');
  assert.equal(suggestionsFor(declined).length, 3);
  const allowed = setSerendipity(sample, true);
  assert.equal(allowed.serendipity, true);
  const learned = allowed.learned.map((item) => item.id);
  assert.deepEqual(learned, ['learn-category', 'learn-hours', 'learn-partner', 'learn-place', 'learn-cross']);
  assert.match(allowed.learned[0].label, /Garden/);
  assert.match(allowed.learned[1].label, /2 hours/);
  assert.match(allowed.learned[2].label, /Elena/);
  assert.match(allowed.learned[3].label, /Oak Ridge/);
  assert.match(learnPatterns(sample)[4].label, /greenhouse/i);
  const shown = suggestionsFor(allowed);
  assert.equal(shown.length, 4);
  assert.equal(shown[3].kind, 'serendipity');
  assert.match(shown[3].title, /Elena/);
  assert.match(shown[3].why, /AI suggests, you decide/);
  assert.equal((suggestionsMarkup(allowed).match(/data-suggestion=/g) || []).length, 4);
  const off = setSerendipity(allowed, false);
  assert.equal(off.serendipity, false);
  assert.equal(off.learned.length, 5);
  assert.equal(suggestionsFor(off).length, 3);
});

test('forgetting a learned item keeps the rest on the device', () => {
  let state = setSerendipity(createSampleState(), true);
  state = forgetLearned(state, 'learn-cross');
  assert.equal(state.learned.some((item) => item.id === 'learn-cross'), false);
  assert.equal(state.forgottenIds.includes('learn-cross'), true);
  const fallback = suggestionsFor(state);
  assert.equal(fallback.length, 4);
  assert.equal(fallback[3].id, 'serendipity:category');
  for (const item of [...state.learned]) state = forgetLearned(state, item.id);
  assert.equal(state.learned.length, 0);
  assert.equal(suggestionsFor(state).length, 3);
  const again = setSerendipity(state, true);
  assert.equal(again.learned.some((item) => item.id === 'learn-cross'), false);
});

test('dismiss and accept leave three rule-based suggestions from what remains', () => {
  const state = createSampleState();
  const first = ruleSuggestions(state)[0];
  const dismissed = ruleSuggestions(dismissSuggestion(state, first.id));
  assert.equal(dismissed.length, 3);
  assert.equal(dismissed.some((item) => item.id === first.id), false);
  assert.equal(dismissed[0].kind, 'duty');
  assert.equal(dismissed[1].kind, 'expiring');
  const accepted = suggestionsFor(acceptSuggestion(state, first.id));
  assert.equal(accepted.some((item) => item.id === first.id), false);
  assert.equal(accepted.length, 3);
});

test('quick fill writes sample records on the device store only', () => {
  const state = createSampleState();
  const next = commitQuickFill(state, {
    kind: 'did',
    category: 'Repair',
    hours: '1',
    location: 'North dorm',
    partner: 'Priya'
  });
  assert.equal(state.did.length, 3);
  assert.equal(next.did.length, 4);
  assert.equal(next.did.at(-1).title, 'Repair with Priya');
  assert.equal(next.did.at(-1).hash, 'sample:local1');
  assert.equal(next.history.lastCategory, 'Repair');
  assert.equal(next.history.usualHours, 1);
  assert.equal(next.history.partners[0], 'Priya');
  assert.match(next.notifications.digest[0].items[0].text, /Nothing was published/);
  const memory = new Map();
  const storage = {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, value); },
    removeItem(key) { memory.delete(key); }
  };
  saveState(storage, next);
  const loaded = loadState(storage);
  assert.equal(loaded.label, 'sample');
  assert.equal(loaded.did.length, 4);
  assert.equal(weeklyHours(loaded), 6.5);
  assert.equal(didProgress(createSampleState()).ratio, 0.6);
  assert.equal(creditGauge(createSampleState().summary).value, 12);
  assert.ok(Math.abs(creditGauge(createSampleState().summary).ratio - (32 / 60)) < 1e-9);
  assert.equal(noticeCount(createSampleState()), 3);
  assert.equal(proofToast(2), 'Proof Committed — Ledger balance updated +2.00 HRS');
  assert.deepEqual(pillarMetrics(createSampleState()).map((pillar) => pillar.name), ['WANT', 'DID', 'SELL', 'WISH', 'DUTY']);
  assert.equal(loadState({ getItem() { return '{'; } }).label, 'sample');
});

test('the phone names five pillars, the bottom nav, and the consent control', () => {
  const page = text('my-picture.html');
  const script = text('js/my-picture.mjs');
  for (const label of ['Big Picture', 'Quick Log', 'Serendipity', 'Ledger', 'Compact Phone View', 'Reset State']) {
    assert.equal(page.includes(label), true, label);
  }
  for (const label of ['WANT', 'DID', 'SELL', 'WISH', 'DUTY', '5-Pillar Sovereign Balance', 'Configure Permission', 'Live Attestation Feed', 'Recommended Next Moves']) {
    assert.equal(script.includes(label), true, label);
  }
  assert.equal(page.includes(CONSENT_COPY), true);
});

test('my picture is not in the main nav', () => {
  const home = text('index.html');
  const start = home.indexOf('id="main-nav"');
  const end = home.indexOf('</nav>', start);
  const nav = home.slice(start, end);
  assert.equal(start > 0, true);
  assert.equal(nav.includes('my-picture'), false);
  assert.equal(nav.includes('Sovereign App'), false);
  assert.equal(home.includes('role="radiogroup" aria-label="View"'), true);
  assert.equal(home.includes('data-ui-view="app"'), true);
});

test('exchange, solana payment, campus, and mutual-credit files are unchanged', () => {
  const script = text('js/my-picture.mjs');
  assert.equal(script.includes('fetch('), false);
  assert.equal(script.includes('XMLHttpRequest'), false);
  assert.equal(script.includes('WebSocket'), false);
  assert.equal(script.includes('solana'), false);
  assert.equal(script.includes('p2p-exchange'), false);
  assert.equal(script.includes('campus-page'), false);
  assert.equal(/from ['"][^'"]*mutual-credit/.test(script), false);
  assert.equal(script.includes('href="/exchange"'), true);
  assert.equal(script.includes('href="/campus"'), true);
  assert.equal(script.includes('href="/mutual-credit"'), true);
  for (const [file, hash] of Object.entries(UNTOUCHED)) {
    const bytes = readFileSync(join(root, file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, file);
    assert.equal(bytes.includes(Buffer.from('my-picture')), false, file);
  }
});
