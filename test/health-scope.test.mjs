import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiSetupSteps } from '../js/ai-setup.mjs';
import { RESET_EPOCH, clearAppState, keepKey, shouldReset } from '../js/reset-epoch.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the reset keeps health records and signing keys', () => {
  const storage = new Map();
  const box = {
    get length() { return storage.size; },
    key(index) { return [...storage.keys()][index]; },
    getItem(name) { return storage.get(name) ?? null; },
    setItem(name, value) { storage.set(name, String(value)); },
    removeItem(name) { storage.delete(name); }
  };
  box.setItem('lgme.demo.posts', '[{"where":"device"}]');
  box.setItem('lgme.device.key', '{"privateJwk":{"d":"secret"}}');
  box.setItem('lgme-sim:peer:ada', '{"healthNote":"kept"}');
  box.setItem('lgme.health.page:ada', '{"photo":"kept"}');
  box.setItem('lgme.exchange.splashSeen', '1');
  clearAppState(box);
  assert.equal(box.getItem('lgme.demo.posts'), null);
  assert.equal(box.getItem('lgme.exchange.splashSeen'), null);
  assert.equal(keepKey('lgme.device.key'), true);
  assert.equal(box.getItem('lgme.device.key').includes('secret'), true);
  assert.equal(box.getItem('lgme-sim:peer:ada').includes('kept'), true);
  assert.equal(box.getItem('lgme.health.page:ada').includes('kept'), true);
  assert.equal(shouldReset({ epoch: '1' }), true);
  assert.equal(shouldReset({ epoch: '', controlled: true }), true);
  assert.equal(shouldReset({ epoch: '', caches: ['lgme-v161'] }, ['lgme-v162', 'lgme-gym-v72']), true);
  assert.equal(shouldReset({ epoch: RESET_EPOCH, caches: ['lgme-v161'] }, ['lgme-v162']), false);
  assert.equal(shouldReset({ epoch: '', caches: [] }, ['lgme-v162']), false);
});

test('AI setup steps match the browser and say when it cannot run', () => {
  assert.equal(aiSetupSteps('Mozilla/5.0 Chrome/120.0.0.0').id, 'chrome');
  assert.match(aiSetupSteps('Chrome/120').steps.join(' '), /chrome:\/\/settings\/ai/);
  assert.equal(aiSetupSteps('Chrome/120 Mobile Android').id, 'chrome-android');
  assert.equal(aiSetupSteps('Edg/120').id, 'edge');
  assert.equal(aiSetupSteps('Mozilla/5.0 Version/17.0 Mobile Safari/605').can, false);
  assert.equal(aiSetupSteps('Firefox/120').can, false);
  assert.equal(aiSetupSteps('SamsungBrowser/20').can, false);
  assert.match(aiSetupSteps('Firefox/120').steps.join(' '), /Chrome/);
});

test('the shell bumps the reset epoch and refuses a non-health write', () => {
  const api = readFileSync(join(root, 'api/hedera/listings.mjs'), 'utf8');
  const nav = readFileSync(join(root, 'js/site-nav.js'), 'utf8');
  assert.equal(api.includes('Only Health can be written. An IwanIT in development is posted on the Health board.'), true);
  assert.equal(api.includes("kind === 'iwanit' && inDev"), true);
  assert.equal(nav.includes("var EPOCH = '2'"), true);
  assert.equal(nav.includes('lgme.device.key'), true);
  assert.equal(nav.includes('lgme-sim:peer:'), true);
  assert.equal(readFileSync(join(root, 'sw.js'), 'utf8').includes('lgme-v164'), true);
});
