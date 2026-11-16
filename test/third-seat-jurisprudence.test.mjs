import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

test('the jurisprudence route, sitemap, and links are present', () => {
  const page = text('third-seat-jurisprudence.html');
  const home = text('index.html');
  const map = text('sitemap.xml');
  assert.equal(page.includes('<title>Third Seat jurisprudence · lgme</title>'), true);
  assert.equal(page.includes('https://lgme.app/third-seat-jurisprudence'), true);
  assert.equal(map.includes('<loc>https://lgme.app/third-seat-jurisprudence</loc>'), true);
  const navStart = home.indexOf('id="main-nav"');
  const nav = home.slice(navStart, home.indexOf('</nav>', navStart));
  const toolsStart = home.indexOf('class="tools"');
  const tools = home.slice(toolsStart, home.indexOf('class="view-switch"', toolsStart));
  assert.equal(nav.includes('href="/third-seat-jurisprudence"'), true);
  assert.equal(tools.includes('href="/third-seat-jurisprudence"'), true);
  assert.equal(text('the-third-seat.html').includes('href="/third-seat-jurisprudence"'), true);
  assert.equal(text('structural-synthesis.html').includes('href="/third-seat-jurisprudence"'), true);
  for (const href of ['href="/tap-entry"', 'href="/clearing-engine"', 'href="/the-third-seat"', 'href="/structural-synthesis"', 'href="/workflow"']) {
    assert.equal(page.includes(href), true, href);
  }
  for (const id of ['id="standing"', 'id="precedent"', 'id="logic"', 'id="limits"', 'id="map"']) {
    assert.equal(page.includes(id), true, id);
  }
});

test('the page keeps the analogy label, the mappings, and the corrected wording', () => {
  const page = text('third-seat-jurisprudence.html');
  for (const phrase of [
    'Structural analogy, not legal advice; Creo is not positive law',
    'Fundamental standing',
    'Precedent as a shore-up',
    'Supporting logic',
    'Limits of the parallel',
    'Standing',
    'Attested provenance',
    'Precedent',
    'public tape',
    'holds $lgme only in trust',
    'takes no seigniorage',
    'Floor Seniority',
    'Bankruptcy priority',
    'Statutes of limitation',
    'Surpluses never expire',
    'defined term',
    'Judicial review',
    'arbiter who can veto',
    'Members mint credit on verified delivery',
    'The Third Seat does not mint',
    'alongside the US dollar',
    'would require legislation',
    'modelling metaphors',
    'adjunction',
    'colimit',
    'owns nothing it adjudicates and holds $lgme only in trust',
    'SAMPLE / unverified'
  ]) {
    assert.equal(page.includes(phrase), true, phrase);
  }
  for (const banned of [
    'a boundary that owns nothing.',
    'owns no assets',
    'without fiat',
    'state coercion',
    '$Trust',
    'the Third Seat mints',
    'Creo is already positive law',
    'PROVEN ANCE'
  ]) {
    assert.equal(page.includes(banned), false, banned);
  }
  assert.equal(text('the-third-seat.html').includes('arbiter who can veto'), false);
  assert.equal(text('index.html').includes('arbiter who can veto'), false);
});

test('exchange, payments, and the view switcher stay untouched', () => {
  for (const file of [
    'exchange.html',
    'js/solana-pay.mjs',
    'js/p2p-exchange-sim.mjs',
    'campus.html',
    'mutual-credit.html',
    'js/ui-view.js',
    'js/clearing-engine.mjs',
    'js/workflow-map.mjs'
  ]) {
    assert.equal(text(file).includes('third-seat-jurisprudence'), false, file);
  }
  const view = text('js/ui-view.js');
  assert.equal(view.includes('Default is Classic'), true);
  assert.equal(view.includes("classic: '/'"), true);
  assert.equal(view.includes("tap: '/tap-entry'"), true);
});
