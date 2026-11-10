import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JPEG_QUALITY, MAX_EDGE, acceptsPhoto, fittedSize } from '../js/health-tile-photo.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

test('a tile photo is resized and a non-photo is refused', () => {
  assert.deepEqual(fittedSize(4000, 2000, MAX_EDGE), { width: 1280, height: 640 });
  assert.deepEqual(fittedSize(800, 600), { width: 800, height: 600 });
  assert.equal(acceptsPhoto({ type: 'image/jpeg', size: 1000 }).ok, true);
  assert.equal(acceptsPhoto({ type: 'text/plain', size: 10 }).ok, false);
  assert.equal(acceptsPhoto({ type: 'image/png', size: 13 * 1024 * 1024 }).ok, false);
  assert.equal(JPEG_QUALITY < 1, true);
});

test('the first screen names every category and keeps the photo on the phone', () => {
  const home = text('index.html');
  const script = text('js/health-tile-photo.mjs');
  const milestones = text('milestones.html');
  const sitemap = text('sitemap.xml');
  const csp = text('vercel.json');
  assert.equal(home.includes('href="/campus"'), true);
  assert.equal(home.includes('href="/neighbors"'), true);
  assert.equal(home.includes('Neighbor help'), true);
  assert.equal(home.includes('href="/hosts"'), true);
  assert.equal(home.includes('href="/circles"'), true);
  assert.equal(home.includes('href="/stories"'), true);
  assert.equal(text('js/gym-app.mjs').includes('href="/neighbors"'), false);
  assert.equal(home.includes('href="/gym"'), true);
  assert.equal(home.includes('Set background photo'), true);
  assert.equal(home.includes('Remove photo'), true);
  assert.equal(home.includes('src="/js/health-tile-photo.mjs"'), true);
  assert.equal(script.includes('fetch('), false);
  assert.equal(script.includes('XMLHttpRequest'), false);
  assert.equal(script.includes('hedera'), false);
  assert.equal(script.includes("toBlob(resolve, 'image/jpeg'"), true);
  assert.equal(script.includes('indexedDB.open'), true);
  assert.equal(milestones.includes('Not on the first-screen roadmap.'), true);
  assert.equal(milestones.includes('Campus'), true);
  assert.equal(milestones.includes('Neighbor help'), true);
  assert.equal(sitemap.includes('preview-campus'), false);
  assert.equal(sitemap.includes('preview-neighbor'), false);
  assert.equal(sitemap.includes('https://lgme.app/milestones'), true);
  assert.equal(sitemap.includes('https://lgme.app/campus'), true);
  assert.equal(csp.includes("img-src 'self' data: blob:"), true);
  assert.equal(text('sw.js').includes('lgme-v125'), true);
});
