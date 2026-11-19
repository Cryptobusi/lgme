import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_STEPS, applyDisplay, changeStep, fontScale, pickDensity, readDisplay, simpleLabel, writeDisplay } from '../js/display-fit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'js/display-fit.mjs'), 'utf8');
const css = readFileSync(join(root, 'site-nav.css'), 'utf8');

function memory() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); }
  };
}

test('density follows the phone and a large system font makes the same screen compact', () => {
  const phone = pickDensity({ width: 390, height: 844, remPx: 16, orientation: 'portrait', safeArea: { top: 0, right: 0, bottom: 0, left: 0 } });
  assert.equal(phone.density, 'compact');
  const narrow = pickDensity({ width: 320, height: 640, remPx: 16, orientation: 'portrait' });
  assert.equal(narrow.density, 'compact');
  const wide = pickDensity({ width: 1280, height: 900, remPx: 16, orientation: 'landscape', reducedMotion: true });
  assert.equal(wide.density, 'roomy');
  assert.equal(wide.reducedMotion, true);
  const enlarged = pickDensity({ width: 390, height: 844, remPx: 24, orientation: 'portrait', visualViewport: { width: 390, height: 800 }, safeArea: { top: 20, bottom: 16, left: 0, right: 0 } });
  assert.equal(enlarged.density, 'compact');
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('XMLHttpRequest'), false);
  assert.equal(css.includes('clamp('), true);
  assert.equal(css.includes('html.tape { background: #cfc4b0; }'), true);
  assert.equal(css.includes('height: 40vh'), true);
});

test('five font steps stay on the device and Easy read toggles back', () => {
  assert.deepEqual(FONT_STEPS, [0.85, 1, 1.15, 1.3, 1.5]);
  assert.equal(changeStep(1, -1), 0);
  assert.equal(changeStep(0, -1), 0);
  assert.equal(changeStep(1, 1), 2);
  assert.equal(changeStep(4, 1), 4);
  assert.equal(changeStep(4, 0), 1);
  assert.equal(fontScale(0, 16, false), 0.85);
  assert.equal(fontScale(4, 16, false), 1.5);
  assert.equal(fontScale(1, 16, true), 1.125);
  assert.equal(fontScale(4, 16, true), 1.5);
  const store = memory();
  writeDisplay(store, { step: 3, easy: false });
  assert.deepEqual(readDisplay(store), { step: 3, easy: false });
  writeDisplay(store, { step: readDisplay(store).step, easy: true });
  assert.equal(readDisplay(store).easy, true);
  writeDisplay(store, { step: 1, easy: false });
  assert.equal(readDisplay(store).easy, false);
  assert.equal(simpleLabel('Inventory', true), 'My list');
  assert.equal(simpleLabel('Inventory', false), 'Inventory');
  const rootEl = {
    dataset: {},
    classList: { toggle(name, on) { this[name] = on; } },
    style: { vars: {}, setProperty(key, value) { this.vars[key] = value; } }
  };
  const applied = applyDisplay(rootEl, { step: 2, easy: true }, { width: 390, height: 844, remPx: 16, orientation: 'portrait' });
  assert.equal(applied.density, 'compact');
  assert.equal(rootEl.dataset.density, 'compact');
  assert.equal(rootEl.dataset.easy, '1');
  assert.equal(rootEl.classList['is-easy'], true);
  assert.equal(rootEl.style.vars['--lgme-font'], '1.15');
  assert.equal(readFileSync(join(root, 'js/site-nav.js'), 'utf8').includes('A−'), true);
  assert.equal(readFileSync(join(root, 'js/site-nav.js'), 'utf8').includes('Easy read'), true);
  assert.equal(css.includes('min-height: 48px'), true);
  assert.equal(css.includes('max(18px, 1.125rem)'), true);
  assert.equal(css.includes('max(22px, 1.15rem)'), true);
});
