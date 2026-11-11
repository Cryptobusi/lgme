import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEW_ONLY_MESSAGE, healthWrite } from '../js/view-only-api.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

test('only Health stays writable and every opening tile has a name', () => {
  const home = text('index.html');
  assert.equal(VIEW_ONLY_MESSAGE.startsWith('View only for now.'), true);
  assert.equal(healthWrite('health'), true);
  assert.equal(healthWrite(''), true);
  assert.equal(healthWrite('campus'), false);
  assert.equal(healthWrite('exchange'), false);
  assert.equal(home.includes('<span class="badge">Beta</span><span class="tile-name">Health</span>'), true);
  assert.equal(home.includes('>Live</span>'), false);
  assert.equal(home.includes('>Testnet</span>'), false);
  for (const name of ['Campus', 'Neighbor help', 'Hosts', 'Circles', 'Stories', 'Exchange']) {
    assert.equal(home.includes(`<span class="tile-name">${name}</span>`), true, name);
    assert.equal(home.includes(`href="/develop?category=${encodeURIComponent(name)}"`), true, name);
    assert.equal(home.includes('<span class="badge">Early</span>'), true);
  }
  assert.equal(home.includes('mailto:'), false);
  assert.equal(home.includes('cryptovanities@gmail.com'), false);
  assert.equal(home.includes('href="/helper"'), true);
  assert.equal(home.includes('href="/ai-help"'), true);
  assert.equal(text('js/gym-app.mjs').includes('href="/neighbors"'), false);
  assert.equal(text('js/gym-app.mjs').includes('href="/campus"'), false);
  for (const file of ['good-deeds.html', 'mutual-credit.html', 'tap-entry.html']) {
    assert.equal(text(file).includes('/js/view-only.js'), true, file);
  }
  for (const file of ['campus.html', 'neighbors.html', 'hosts.html', 'circles.html', 'stories.html']) {
    assert.equal(text(file).includes('/js/view-only.js'), false, file);
    assert.equal(text(file).includes('Help develop this'), true, file);
  }
  assert.equal(text('exchange.html').includes('/js/view-only.js'), false);
  assert.equal(text('gym.html').includes('/js/view-only.js'), false);
  assert.equal(text('api/hedera/listings.mjs').includes('VIEW_ONLY_MESSAGE'), true);
  assert.equal(text('api/hedera/topic.mjs').includes('VIEW_ONLY_MESSAGE'), true);
  assert.equal(text('api/hedera/queue.mjs').includes('healthWrite'), true);
  assert.equal(text('api/gym/dispute.mjs').includes('VIEW_ONLY_MESSAGE'), false);
  assert.equal(text('sw.js').includes('lgme-v158'), true);
});
