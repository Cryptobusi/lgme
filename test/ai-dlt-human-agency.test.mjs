import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'ai-dlt-human-agency.html'), 'utf8');
const home = readFileSync(join(root, 'index.html'), 'utf8');
const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');

test('the homepage summary sits under the gift banner and links the reading', () => {
  const body = home.slice(home.indexOf('<body>'));
  const launch = body.indexOf('class="launch-bar"');
  const give = body.indexOf('class="give-banner"');
  const agency = body.indexOf('id="agency"');
  const archive = body.indexOf('class="topsecret"');
  assert.ok(launch >= 0 && give > launch && agency > give, 'summary follows the gift banner');
  assert.ok(archive < 0 || agency < archive, 'summary stays above the archive');
  assert.equal(home.includes('href="/ai-dlt-human-agency">Read the full page</a>'), true);
  assert.equal(home.includes('href="/ai-dlt-human-agency">AI + DLT</a>'), true);
  assert.equal(home.includes('The machines can keep the book.'), true);
  assert.equal(sitemap.includes('https://lgme.app/ai-dlt-human-agency'), true);
});

test('the reading keeps the thesis, the table, and the implementation limits', () => {
  assert.equal(page.includes('AI + DLT for Human Agency'), true);
  assert.equal(page.includes('not a proven live architecture'), true);
  assert.equal(page.includes('not a financial offer'), true);
  assert.equal(page.includes('<table>'), true);
  for (const heading of ['Value accounting', 'Agent role', 'Safety floor', 'Market clearing']) {
    assert.equal(page.includes(heading), true, heading);
  }
  for (const phrase of [
    'tamper-evident receipt',
    'does not establish real-world truth',
    'does not by itself stop money creation',
    'Not a legal fiduciary',
    'A shortfall stays visible',
    'No fund is guaranteed',
    'paid in HBAR',
    'Not written to Hedera',
    'testnet only',
    'does not bind anyone who never joined',
    'They are not running',
    'one-step barter',
    'not a computed multi-hop path',
    'The oracle gap',
    'Cognitive load',
    '$1,470',
    'specimen, not cash on hand'
  ]) {
    assert.equal(page.includes(phrase), true, phrase);
  }
  for (const banned of ['$0.0001', '0.0008', '10–30', '10-30', '$Trust', 'ClubHbar', 'ungameable', 'near-zero', 'Hederica.hbar', 'Add to all 3 sites']) {
    assert.equal(page.includes(banned), false, banned);
    assert.equal(home.slice(home.indexOf('id="agency"'), home.indexOf('id="agency"') + 800).includes(banned), false, 'summary ' + banned);
  }
  assert.equal(/<script(?![^>]*\bsrc=)/i.test(page), false);
});
