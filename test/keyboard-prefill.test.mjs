import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keyboardDropped, keyboardFolded, keyboardMode } from '../js/local-ai-panel.mjs';

test('Android keyboard is a drop from the baseline, even when innerHeight shrinks too', () => {
  const baseline = 844;
  const shrunk = 520;
  assert.equal(keyboardDropped(baseline, shrunk), true);
  assert.equal(keyboardDropped(shrunk, shrunk), false);
  assert.equal(keyboardFolded(baseline, 800), true);
  assert.equal(keyboardFolded(baseline, 700), false);
  assert.equal(keyboardMode({ baseline, current: shrunk, onPage: true, onPrompt: false, coarse: true, seenDrop: true }), 'page');
  assert.equal(keyboardMode({ baseline, current: shrunk, onPage: false, onPrompt: true, coarse: true, seenDrop: true }), 'prompt');
  assert.equal(keyboardMode({ baseline, current: 820, onPage: true, onPrompt: false, coarse: true, seenDrop: true }), 'closed');
  assert.equal(keyboardMode({ baseline, current: baseline, onPage: true, onPrompt: false, coarse: true, seenDrop: false, allowFocus: true }), 'page');
  assert.equal(keyboardMode({ baseline, current: baseline, onPage: false, onPrompt: false, coarse: true, seenDrop: false }), 'closed');
});

test('Row 2 is Reset then Next step, pushed to the right', () => {
  const panel = readFileSync(new URL('../js/local-ai-panel.mjs', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../site-nav.css', import.meta.url), 'utf8');
  assert.match(panel, /id="ai-path-reset">Reset<\/button><button type="button" id="ai-path-skip">Next step<\/button>/);
  assert.equal(panel.includes('Skip step'), false);
  assert.match(css, /#ai-path \{[^}]*justify-content:\s*space-between/);
  assert.match(css, /#ai-path-actions \{[^}]*margin-left:\s*auto/);
  assert.match(panel, /id="ai-key-done"/);
});
