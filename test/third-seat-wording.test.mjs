import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

const FILES = [
  'index.html',
  'exchange.html',
  'how-it-works.html',
  'the-third-seat.html',
  'spp-framework.html',
  'spp.html',
  'whitepaper.html',
  'my-picture.html',
  'my-picture-classic.html',
  'marketing.html',
  'plain-english.html',
  'good-deeds.html',
  'grants.html',
  'campus.html',
  'balance.html',
  'dominion.html',
  'opportunity.html',
  'operating-system-of-enclosure.html',
  'memory-that-walks.html',
  'memory-that-walks-recommendations.html',
  'js/p2p-resources.mjs',
  'js/p2p-exchange-sim-ui.mjs',
  'workflow.html',
  'js/workflow-map.mjs',
  'js/clearing-engine.mjs'
];

test('Third Seat descriptions say the person holds the seat', () => {
  for (const file of FILES) {
    const body = text(file);
    assert.equal(body.includes('held by you alone'), true, file);
    assert.equal(body.includes('self-regulating nonprofit arbiter'), false, file);
    assert.equal(body.includes('arbiter who can veto'), false, file);
  }
  assert.equal(text('docs/sovereign-provenance-protocol-draft.pdf').includes('arbiter who can veto'), false);
});

test('home, sitemap, and the framework cross-link both new pages', () => {
  const home = text('index.html');
  const navStart = home.indexOf('id="main-nav"');
  const nav = home.slice(navStart, home.indexOf('</nav>', navStart));
  const toolsStart = home.indexOf('class="tools"');
  const tools = home.slice(toolsStart, home.indexOf('class="view-switch"', toolsStart));
  for (const href of ['href="/workflow"', 'href="/clearing-engine"']) {
    assert.equal(nav.includes(href), true, href);
    assert.equal(tools.includes(href), true, href);
    assert.equal(text('spp-framework.html').includes(href), true, href);
    assert.equal(text('sitemap.xml').includes(href.replace('href="', 'https://lgme.app').replace('"', '')), true, href);
  }
  assert.equal(nav.includes('my-picture'), false);
  assert.equal(text('js/ui-view.js').includes("picture: '/my-picture-classic'"), true);
});
