import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tapeTicksOn } from '../js/press-feedback.mjs';

function storage(values) {
  const data = new Map(Object.entries(values));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('tape ticks stay quiet unless sound is allowed', () => {
  const media = (query) => ({ matches: String(query).includes('reduce') });
  const still = () => ({ matches: false });
  assert.equal(tapeTicksOn({ storage: storage({}), media: still, incognito: false }), true);
  assert.equal(tapeTicksOn({ storage: storage({ 'lgme.sounds': 'off' }), media: still, incognito: false }), false);
  assert.equal(tapeTicksOn({ storage: storage({}), media: still, incognito: true }), false);
  assert.equal(tapeTicksOn({ storage: storage({}), media, incognito: false }), false);
  assert.equal(tapeTicksOn({ storage: storage({ 'lgme.tape.sound': 'on' }), media, incognito: false }), true);
  assert.equal(tapeTicksOn({ storage: storage({ 'lgme.tape.sound': 'off' }), media: still, incognito: false }), false);
  const css = readFileSync(new URL('../site-nav.css', import.meta.url), 'utf8');
  assert.match(css, /html\.tape body/);
  assert.equal(/html\.tape[\s\S]*url\(/.test(css), false);
  const nav = readFileSync(new URL('../js/site-nav.js', import.meta.url), 'utf8');
  assert.match(nav, /id = 'tape-sound'/);
  assert.match(nav, /tape-scroll\.mjs/);
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(page, /class="is-one-tab tape"/);
});
