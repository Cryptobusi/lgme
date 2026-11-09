import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

test('the SPP framework route, navigation, sitemap, and untouched exchange files are present', () => {
  const page = text('spp-framework.html');
  const home = text('index.html');
  const map = text('sitemap.xml');
  const vercel = text('vercel.json');
  assert.equal(page.includes('<title>SPP framework'), true);
  assert.equal(vercel.includes('"cleanUrls": true'), true);
  assert.equal(home.includes('href="/spp-framework">SPP framework</a>'), true);
  assert.equal((home.match(/href="\/spp-framework"/g) || []).length >= 2, true);
  const navStart = home.indexOf('id="main-nav"');
  const navEnd = home.indexOf('</nav>', navStart);
  assert.equal(navStart > 0 && navEnd > navStart, true);
  assert.equal(home.slice(navStart, navEnd).includes('href="/spp-framework"'), true);
  const toolsStart = home.indexOf('class="tools"');
  const toolsEnd = home.indexOf('</div>', toolsStart);
  assert.equal(toolsStart > 0 && toolsEnd > toolsStart, true);
  assert.equal(home.slice(toolsStart, toolsEnd).includes('href="/spp-framework">SPP framework</a>'), true);
  assert.equal(home.includes('id="menu-toggle"'), true);
  assert.equal(map.includes('<loc>https://lgme.app/spp-framework</loc><lastmod>2026-11-09</lastmod>'), true);
  assert.equal(text('spp.html').includes('href="/spp-framework"'), true);
  assert.equal(text('exchange.html').includes('spp-framework'), false);
  assert.equal(text('js/p2p-exchange-sim.mjs').includes('spp-framework'), false);
  assert.equal(text('js/solana-pay.mjs').includes('spp-framework'), false);
  assert.equal(text('js/solana-pay.mjs').includes('export function buildTransferRequest'), true);
});

test('the page carries the disclaimer, CLPR caveat, pilot names, and proposed-design framing', () => {
  const page = text('spp-framework.html');
  const phrases = [
    'proposed design',
    'not a description of functions that lgme.app already runs',
    'not legal, tax, or investment advice',
    'not legal, tax, investment, or securities advice',
    'not an offer to sell',
    'Campus Credit is not cash',
    'holders receive no yield',
    'CLPR',
    'to be verified',
    'WIR',
    'Sardex',
    'Banco Palmas',
    'BerkShares',
    'Bristol Pound',
    'Brixton Pound',
    'Sarafu',
    'TimeBanks',
    'Fureai Kippu',
    'Stockton',
    'Finland',
    'OpenResearch',
    'GiveDirectly',
    'Alaska',
    'Encointer',
    'Gitcoin',
    'Hedera HCS',
    'Hiero',
    'Chainlink'
  ];
  for (const phrase of phrases) assert.equal(page.includes(phrase), true, phrase);
  assert.equal(page.includes('aside class="editorial"'), true);
  assert.equal(page.includes('id="disclaimer"'), true);
  assert.equal(page.includes('<nav class="toc"'), true);
  assert.equal(/became socialism/i.test(page), false);
  assert.equal(page.includes('28% to 40%'), true);
  assert.equal(page.includes('32% to 37%'), true);
  assert.equal(page.includes('A Practical Foundation: SPP + DLT + AI under the Constitution'), true);
  assert.equal(page.includes('id="foundation"'), true);
  assert.equal(page.includes('href="#foundation"'), true);
  assert.equal(page.includes('constitutional alignment'), true);
  assert.equal(page.includes('This section is not legal advice.'), true);
  assert.equal(page.includes('Fifth Amendment'), true);
  assert.equal(page.includes('Fourteenth Amendment'), true);
  assert.equal(page.includes('non-convertible'), true);
  assert.equal(page.includes('no yield'), true);
  assert.equal(page.includes('Refusal: Its Power, Its Limits, and How IdidIt Balances the Ledger'), true);
  assert.equal(page.includes('id="refusal"'), true);
  assert.equal(page.includes('href="#refusal"'), true);
  assert.equal(page.includes('IdidIt'), true);
  assert.equal(page.includes('practical limits of refusal'), true);
  assert.equal(page.includes('limits'), true);
});
