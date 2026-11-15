import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateVariant } from '../js/variant-schema.mjs';
import { applyMode, recommendMode, screenChosen, screenPresets, undoMode } from '../js/screen-modes.mjs';
import { matchPrompt } from '../js/local-ai-panel.mjs';

function memory() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

test('the three screen presets are safe and the suggestion can be undone', () => {
  for (const preset of Object.values(screenPresets())) {
    assert.equal(validateVariant(preset).ok, true, preset.mode);
  }
  assert.equal(recommendMode({ largeText: true }).mode, 'simple');
  assert.equal(recommendMode({ voiceUsed: true }).mode, 'simple');
  assert.equal(recommendMode({}).mode, 'everyday');
  const storage = memory();
  storage.setItem('lgme.variant.active', '{"schema":1,"theme":"night"}');
  const applied = applyMode(storage, 'simple');
  assert.equal(applied.ok, true);
  assert.equal(JSON.parse(storage.getItem('lgme.variant.active')).theme, 'paper');
  assert.equal(screenChosen(storage), true);
  undoMode(storage);
  assert.equal(storage.getItem('lgme.variant.active'), '{"schema":1,"theme":"night"}');
  assert.equal(matchPrompt('make it simpler').mode, 'simple');
  assert.equal(matchPrompt('bigger text').mode, 'simple');
  const home = readFileSync(new URL('../js/thumb-home.mjs', import.meta.url), 'utf8');
  assert.equal(home.includes('screenChosen(localStorage)'), true);
  assert.equal(home.includes('id = \'screen-reopen\''), true);
});
