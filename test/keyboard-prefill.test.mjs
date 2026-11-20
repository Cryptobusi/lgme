import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keyboardOpen } from '../js/local-ai-panel.mjs';

test('the keyboard is open below 75 percent of the screen', () => {
  assert.equal(keyboardOpen(844, 400), true);
  assert.equal(keyboardOpen(844, 600), true);
  assert.equal(keyboardOpen(844, 633), false);
  assert.equal(keyboardOpen(844, 800), false);
  assert.equal(keyboardOpen(0, 100), false);
});

test('Row 2 is Reset then Next step, pushed to the right', () => {
  const panel = readFileSync(new URL('../js/local-ai-panel.mjs', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../site-nav.css', import.meta.url), 'utf8');
  assert.match(panel, /id="ai-path-reset">Reset<\/button><button type="button" id="ai-path-skip">Next step<\/button>/);
  assert.equal(panel.includes('Skip step'), false);
  assert.match(css, /#ai-path \{[^}]*justify-content:\s*space-between/);
  assert.match(css, /#ai-path-actions \{[^}]*margin-left:\s*auto/);
});
