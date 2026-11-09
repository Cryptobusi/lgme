import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path));
const text = (path) => read(path).toString('utf8');

const PDF_SHA256 = 'b474f9ec53ffe9862e823b7aab2aff36b553af400d80b8407f171dcc689f25cc';

test('the whitepaper route, navigation, and original PDF are present', () => {
  const page = text('whitepaper.html');
  const home = text('index.html');
  const map = text('sitemap.xml');
  const pdf = read('docs/sovereign-provenance-protocol-draft.pdf');
  assert.equal(createHash('sha256').update(pdf).digest('hex'), PDF_SHA256);
  assert.equal(pdf.length, 148347);
  assert.equal(page.includes('href="/docs/sovereign-provenance-protocol-draft.pdf"'), true);
  assert.equal(page.includes('type="application/pdf"'), true);
  assert.equal(home.includes('href="/whitepaper">Whitepaper</a>'), true);
  assert.equal((home.match(/href="\/whitepaper"/g) || []).length >= 2, true);
  assert.equal(map.includes('https://lgme.app/whitepaper'), true);
  assert.equal(text('spp.html').includes('href="/whitepaper"'), true);
  assert.equal(text('exchange.html').includes('id="hedera-desk"'), false);
  assert.equal(text('js/p2p-sim-guard.mjs').includes('export function passkeyCreationOptions'), true);
  assert.equal(home.includes('id="menu-toggle"'), true);
  assert.equal(home.includes('id="main-nav"'), true);
});

test('the HTML keeps the draft title, numbering, formula, drawings notice, and eight claims', () => {
  const page = text('whitepaper.html');
  const phrases = [
    'Sovereign Provenance Protocol system and method for identity-anchored governance and utility-based resource allocation',
    'DRAFT FOR FORMATTING PURPOSES ONLY - NOT LEGAL ADVICE',
    'not a complete, file-ready application',
    '37 C.F.R. and the MPEP',
    'Abstract of the disclosure',
    'zero-knowledge proofs of personhood',
    'V_total equals the sum of the square root of C_i multiplied by delta_i',
    'delta_i equals 1 only if a unique non-transferable human cryptographic anchor is present',
    'FIG. 1 is a high-level architectural diagram',
    'FIG. 2 is a flowchart of the recorded presentation lifecycle',
    'FIG. 3 is a schematic of the attested quadratic voting calculation',
    'Actual drawings are to be prepared by a draftsman or patent illustrator in compliance with 37 C.F.R. section 1.84.',
    'Poseidon hashing and Merkle inclusion checks',
    'What is claimed is:',
    'A computer-implemented method for identity-anchored governance',
    'The method of claim 1, further comprising permitting a holder of an identity anchor to rotate',
    'time integral over an epoch of a first coefficient times an objective utility function',
    'detecting synchronized automated voting patterns',
    'ingesting hardware telemetry payloads from edge devices',
    'tokenized real-world assets, and intellectual property rights',
    'A system for implementing the method of claim 1',
    'The system of claim 7, further comprising a decentralized purpose trust'
  ];
  for (const phrase of phrases) assert.equal(page.includes(phrase), true, phrase);
  for (let n = 1; n <= 16; n += 1) {
    const id = String(n).padStart(4, '0');
    assert.equal(page.includes(`[${id}]`), true, id);
    assert.equal(page.includes(`id="p-${id}"`), true, id);
  }
  for (let n = 1; n <= 8; n += 1) assert.equal(page.includes(`id="claim-${n}"`), true, `claim ${n}`);
  assert.equal(page.includes('<img'), false);
  assert.equal(page.includes('<svg'), false);
  assert.equal(/patent granted|U\.S\. Patent No/i.test(page), false);
  assert.match(page, /proposed design/);
  assert.match(page, /does not present this draft as an issued patent/);
  assert.match(page, /not a description of functions that lgme\.app already runs/);
  assert.equal(page.includes('aside class="editorial"'), true);
  assert.equal(page.includes('<nav class="toc"'), true);
});
