import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

test('the Chetty review is a full page, linked, and matched to the live credits', () => {
  const page = text('chetty-review.html');
  const home = text('index.html');
  const campus = text('campus.html');
  const ego = text('egonomist.html');
  assert.equal(page.includes('CONTENT_FROM_FILE'), false);
  assert.equal(page.includes('hederica.com'), false);
  assert.equal(page.includes('Editorial review by the lgme.app administrator'), true);
  assert.equal(page.includes('id="page-1"'), true);
  assert.equal(page.includes('id="page-2"'), true);
  assert.equal(page.includes('id="page-3"'), true);
  assert.equal(page.includes('<table>'), true);
  assert.equal(page.includes('passkey- or authenticator-secured, both-sides-confirmed IdidIt (verified receipt) records'), true);
  assert.equal(page.includes('each verified task earns a small Creo (currently 0.01), spent once'), true);
  assert.equal(page.includes('Deeds earn Creo, not coins; $lgme stays pegged to US$ and is never minted from deeds.'), true);
  assert.equal(page.includes('one verified deed equals one credit'), false);
  assert.equal(page.includes('passkey-secured, dual-signed Merkle receipts'), false);
  assert.equal(page.includes('https://commonwealthbeacon.org/economy/raj-chettys-prescription-for-reviving-the-american-dream/'), true);
  assert.equal(page.includes('$Trust'), false);
  assert.equal(campus.includes('id="bridging-circles"'), true);
  assert.equal(campus.includes('Students, retirees, gig workers, and local trades meet in shared circles.'), true);
  assert.equal(campus.includes('href="/chetty-review"'), true);
  const learn = home.slice(home.indexOf('>Learn</span>'), home.indexOf('>Examine</span>'));
  assert.equal(learn.includes('href="/chetty-review"'), true);
  assert.equal(home.includes('href="/chetty-review">Read more</a>'), true);
  assert.equal(ego.includes('href="/chetty-review"'), true);
  assert.equal(text('sitemap.xml').includes('https://lgme.app/chetty-review'), true);
  assert.equal(text('sw.js').includes('lgme-v256'), true);
});
