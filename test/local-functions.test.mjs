import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { executionPlan, matchPrompt } from '../js/local-ai-panel.mjs';
import { importLocalFunctions, saveLocalFunction, validateLocalFunction } from '../js/local-functions.mjs';

function memory() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

test('a screen change does not open a draft, and local functions reject code', () => {
  const screen = matchPrompt('make it simpler');
  const plan = executionPlan(screen);
  assert.equal(screen.kind, 'screen');
  assert.equal(plan.openDraft, false);
  assert.equal(plan.message, 'Screen changed to Simple. Undo?');
  const saved = saveLocalFunction(memory(), { label: 'Usual walk', prompt: 'logs my usual 20 min walk', action: 'ididit', fields: { activity: 'Walk', minutes: 20 } });
  assert.equal(saved.ok, true);
  assert.equal(saved.sent, false);
  assert.equal(validateLocalFunction({ label: 'Bad', prompt: 'do it', action: 'eval', code: 'alert(1)' }).ok, false);
  assert.equal(validateLocalFunction({ label: 'Bad', prompt: 'function () { return 1 }', action: 'prefill' }).ok, false);
  assert.equal(importLocalFunctions(memory(), '[{"label":"Nope","prompt":"x","action":"mint"}]').ok, false);
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../js/thumb-home.mjs', import.meta.url), 'utf8');
  const help = readFileSync(new URL('../help.html', import.meta.url), 'utf8');
  const store = readFileSync(new URL('../js/local-functions.mjs', import.meta.url), 'utf8');
  assert.equal(home.includes('>My Agency<'), true);
  assert.equal(home.includes('My functions'), false);
  assert.equal(panel.includes('My Agency'), true);
  assert.equal(help.includes('My Agency'), true);
  assert.equal(store.includes("const KEY = 'lgme.local.functions'"), true);
});
