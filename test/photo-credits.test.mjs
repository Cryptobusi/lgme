import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

test('self-hosted photos stay small, credited, and off the script policy', () => {
  const dir = join(root, 'images/photos');
  const files = readdirSync(dir).filter((name) => name.endsWith('.webp'));
  assert.equal(files.length >= 10, true);
  for (const name of files) {
    assert.equal(/health|diagnosis|patient|symptom/i.test(name), false, name);
    const size = statSync(join(dir, name)).size;
    assert.equal(size < 150 * 1024, true, `${name} ${size}`);
  }
  const credits = text('credits.html');
  const attribution = text('ATTRIBUTION.md');
  for (const name of ['jogger', 'stretch', 'neighborhood', 'shop-street', 'volunteers', 'dumbbells', 'tools-bench']) {
    assert.equal(credits.includes(name), true, name);
    assert.equal(attribution.includes(name), true, name);
    assert.match(attribution, new RegExp(`${name}[\\s\\S]{0,400}https://commons\\.wikimedia\\.org/`));
  }
  assert.match(attribution, /CC0/);
  assert.match(attribution, /CC BY 2\.0/);
  assert.match(attribution, /CC BY 4\.0/);
  const csp = text('vercel.json');
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /img-src 'self'/);
  assert.equal(text('index.html').includes('/images/photos/jogger-640.webp'), true);
  assert.equal(text('js/health-plan.mjs').includes('/images/photos/'), true);
  assert.equal(text('help.html').includes('page-hero'), true);
  assert.equal(text('disclaimer.html').includes('page-hero'), true);
});
