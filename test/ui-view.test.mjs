import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ui = require('../js/ui-view.js');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

function memory() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); }
  };
}

test('the default view is classic and an unsaved visit stays put', () => {
  assert.equal(ui.KEY, 'lgme-ui-view');
  assert.equal(ui.normalizeView(null), null);
  assert.equal(ui.normalizeView('later'), null);
  assert.equal(ui.viewForPage('/', null), 'classic');
  assert.equal(ui.viewForPage('/study', undefined), 'classic');
  assert.equal(ui.viewForPage('/my-picture', null), 'app');
  assert.equal(ui.destinationFor('/', null), null);
  assert.equal(ui.destinationFor('/my-picture', null), null);
  assert.equal(ui.destinationFor('/campus', 'app'), null);
  assert.equal(ui.readView(memory()), null);
});

test('a saved app choice opens the sovereign app from home, and classic returns', () => {
  assert.equal(ui.destinationFor('/', 'app'), '/my-picture');
  assert.equal(ui.destinationFor('/index.html', 'app'), '/my-picture');
  assert.equal(ui.destinationFor('/my-picture', 'app'), null);
  assert.equal(ui.destinationFor('/my-picture.html', 'classic'), '/');
  assert.equal(ui.destinationFor('/', 'classic'), null);
  assert.equal(ui.viewForPage('/my-picture', 'classic'), 'classic');
  assert.equal(ui.viewForPage('/', 'app'), 'app');
  const store = memory();
  store.setItem(ui.KEY, 'app');
  assert.equal(ui.readView(store), 'app');
  store.setItem(ui.KEY, 'classic');
  assert.equal(ui.readView(store), 'classic');
  assert.equal(ui.readView({ getItem() { throw new Error('blocked'); } }), null);
});

test('both pages carry the switcher and apply the saved view before the body', () => {
  for (const file of ['index.html', 'my-picture.html']) {
    const page = text(file);
    const scriptAt = page.indexOf('src="/js/ui-view.js"');
    const bodyAt = page.indexOf('<body');
    assert.equal(scriptAt > 0 && scriptAt < bodyAt, true, file);
    assert.equal(page.includes('aria-label="View"'), true, file);
    assert.equal(page.includes('data-ui-view="classic"'), true, file);
    assert.equal(page.includes('data-ui-view="app"'), true, file);
    assert.equal(page.includes('>Classic</a>'), true, file);
    assert.equal(page.includes('>Sovereign App</a>'), true, file);
    assert.equal(/<script(?![^>]*\bsrc=)/i.test(page), false, file);
  }
  const home = text('index.html');
  const navStart = home.indexOf('id="main-nav"');
  const nav = home.slice(navStart, home.indexOf('</nav>', navStart));
  assert.equal(nav.includes('Sovereign App'), false);
  assert.equal(text('css/ui-view.css').includes('.view-switch'), true);
});
