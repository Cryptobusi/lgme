import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const classic = await import('../js/my-picture-classic.mjs');
const sovereign = await import('../js/my-picture.mjs');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

test('the restored my picture route exists beside the sovereign app', () => {
  const page = text('my-picture-classic.html');
  assert.equal(page.includes('<title>My Picture · lgme</title>'), true);
  assert.equal(page.includes('Prototype'), true);
  assert.equal(page.includes('Sample data on this device'), true);
  assert.equal(page.includes('href="/css/my-picture-classic.css"'), true);
  assert.equal(page.includes('src="/js/my-picture-classic.mjs"'), true);
  assert.equal(page.includes('id="my-picture-classic-app"'), true);
  assert.equal(page.includes('What it learned'), true);
  assert.equal(page.includes('Allow on-device AI to learn your patterns and suggest unexpected matches? Your data never leaves this device.'), true);
  assert.equal(page.includes('AI suggests, you decide'), true);
  assert.equal(page.includes('Nothing is published without your tap'), true);
  assert.equal(page.includes('No personal data on the public Tape'), true);
  assert.equal(text('sitemap.xml').includes('https://lgme.app/my-picture-classic</loc>'), true);
  assert.equal(text('sitemap.xml').includes('https://lgme.app/my-picture</loc>'), true);
});

test('the restored picture keeps its own sample store', () => {
  assert.equal(classic.STORAGE_KEY, 'lgme.my-picture-classic.demo.v1');
  assert.equal(sovereign.STORAGE_KEY, 'lgme.my-picture.demo.v2');
  assert.notEqual(classic.STORAGE_KEY, sovereign.STORAGE_KEY);
  const state = classic.createSampleState();
  assert.equal(state.label, 'sample');
  assert.equal(classic.suggestionsFor(state).length, 3);
  const memory = new Map();
  const storage = {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, String(value)); }
  };
  classic.saveState(storage, state);
  assert.equal(storage.getItem(sovereign.STORAGE_KEY), null);
  assert.equal(classic.loadState(storage).label, 'sample');
  assert.equal(text('js/my-picture-classic.mjs').includes('fetch('), false);
  assert.equal(text('exchange.html').includes('my-picture-classic'), false);
  assert.equal(text('campus.html').includes('my-picture-classic'), false);
  assert.equal(text('mutual-credit.html').includes('my-picture-classic'), false);
  assert.equal(text('js/solana-pay.mjs').includes('my-picture-classic'), false);
});
