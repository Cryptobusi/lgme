import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

const SENTENCE = "Members mint credit on verified delivery; the Third Seat — the $lgme self-regulating nonprofit — audits and is the arbiter who can veto; it holds $lgme only in trust for the Floor's posterity and takes no seigniorage.";

test('the structural synthesis route, sitemap, and navigation are present', () => {
  const page = text('structural-synthesis.html');
  const home = text('index.html');
  const map = text('sitemap.xml');
  assert.equal(page.includes('<title>Structural synthesis · lgme</title>'), true);
  assert.equal(page.includes('href="https://lgme.app/structural-synthesis"') || page.includes('https://lgme.app/structural-synthesis'), true);
  assert.equal(page.includes('role="img"'), true);
  assert.equal(page.includes('<svg'), true);
  assert.equal(page.includes('id="d-title"'), true);
  assert.equal(page.includes('id="d-desc"'), true);
  assert.equal(map.includes('<loc>https://lgme.app/structural-synthesis</loc>'), true);
  const navStart = home.indexOf('id="main-nav"');
  const nav = home.slice(navStart, home.indexOf('</nav>', navStart));
  const toolsStart = home.indexOf('class="tools"');
  const tools = home.slice(toolsStart, home.indexOf('class="view-switch"', toolsStart));
  assert.equal(nav.includes('href="/structural-synthesis"'), true);
  assert.equal(tools.includes('href="/structural-synthesis"'), true);
  assert.equal(text('workflow.html').includes('href="/structural-synthesis"'), true);
  assert.equal(text('clearing-engine.html').includes('href="/structural-synthesis"'), true);
  assert.equal(text('the-third-seat.html').includes('href="/structural-synthesis"'), true);
  assert.equal(page.includes('href="https://hederica.com"'), true);
  assert.equal(page.includes('href="https://www.egonomicanonymous.live"'), true);
  assert.equal(page.includes('href="/clearing-engine"'), true);
  assert.equal(page.includes('href="/workflow"'), true);
  assert.equal(page.includes('href="/tap-entry"'), true);
  assert.equal(page.includes('href="/exchange"'), true);
  assert.equal(page.includes('href="/the-third-seat"'), true);
});

test('the page uses the approved clearing wording and labels speculation', () => {
  const page = text('structural-synthesis.html');
  for (const phrase of [
    SENTENCE,
    'The Third Seat does not mint.',
    'arbiter who can veto',
    'self-regulating nonprofit',
    'takes no seigniorage',
    'only in trust for the Floor\'s posterity',
    'works alongside',
    'state sovereignty',
    'Unpaid debts sunset on a defined term',
    'absorbed by the subfloor and the sponsors',
    'Surpluses never expire',
    '90 days',
    'gift surplus to the Floor',
    'Inside lgme, Floor claims rank first',
    'legislation',
    'laws, mandates, and tax incentives',
    '1-for-1 time parity applies inside Floor services',
    'Enterprise goods stay priced',
    'transparency, UBI, and AI faculties',
    'Known risks and safeguards',
    'leaves while negative',
    'Free-riding',
    'Collusive fake loops',
    'Covenant -50/-200 limits',
    '-50 Creo',
    '-200',
    'at least one outside a closed circle',
    'passkey',
    'public tape',
    'Third Seat veto',
    'SAMPLE / unverified',
    'The Riemann Hypothesis remains unproven',
    'Hilbert–Pólya',
    'assumes the hypothesis',
    'not a proof',
    'provenance'
  ]) {
    assert.equal(page.includes(phrase), true, phrase);
  }
  for (const banned of [
    'owns no assets',
    'owns nothing',
    'without fiat',
    'state coercion',
    'non-coercive',
    'PROVEN ANCE',
    '$Trust',
    'Third Seat mints',
    'the Third Seat mints'
  ]) {
    assert.equal(page.includes(banned), false, banned);
  }
});

test('existing settlement behavior and the view switcher are untouched', () => {
  for (const file of [
    'exchange.html',
    'js/solana-pay.mjs',
    'js/p2p-exchange-sim.mjs',
    'campus.html',
    'js/campus-page.mjs',
    'mutual-credit.html',
    'js/pages/mutual-credit-simulator.js',
    'js/ui-view.js',
    'js/clearing-engine.mjs',
    'js/workflow-map.mjs'
  ]) {
    assert.equal(text(file).includes('structural-synthesis'), false, file);
  }
  const view = text('js/ui-view.js');
  assert.equal(view.includes('Default is Classic'), true);
  assert.equal(view.includes("classic: '/'"), true);
  assert.equal(view.includes("tap: '/tap-entry'"), true);
  const home = text('index.html');
  assert.equal(home.includes('data-ui-view="classic"'), true);
  assert.equal(home.includes('>Classic</a>'), true);
  assert.equal(home.includes('>One-Tap Entry</a>'), true);
  assert.equal(text('workflow.html').includes('held by you alone'), true);
  assert.equal(text('workflow.html').includes('arbiter who can veto'), false);
  assert.equal(text('the-third-seat.html').includes('arbiter who can veto'), false);
  assert.equal(text('clearing-engine.html').includes('arbiter who can veto'), false);
  assert.equal(text('index.html').includes('arbiter who can veto'), false);
});
