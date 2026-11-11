import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceContext, draftWithHelper, pickHelperSync, rememberContext } from '../js/one-tap.mjs';

function memory() {
  const bag = new Map();
  return {
    getItem(key) { return bag.has(key) ? bag.get(key) : null; },
    setItem(key, value) { bag.set(key, String(value)); }
  };
}

test('the helper pick is instant and the draft stays on the device', async () => {
  const storage = memory();
  storage.setItem('lgme-gym.seat', 'Mina Vale');
  storage.setItem('lgme.entry.category', 'campus');
  const none = pickHelperSync({ navigator: { lgmeAi: 'off' } }, storage);
  assert.equal(none.note, 'Using: no AI');
  const app = pickHelperSync({ navigator: {} }, storage);
  assert.equal(app.note, 'Using: app helper');
  const browser = pickHelperSync({ navigator: {}, LanguageModel: { prompt: async () => 'ok' } }, storage);
  assert.equal(browser.note, 'Using: on-device AI');
  const ctx = deviceContext(storage, { getItem: () => null });
  assert.equal(ctx.handle, 'minavale');
  assert.equal(ctx.category, 'campus');
  rememberContext(storage, { skill: 'writing', time: 'one hour' });
  assert.equal(deviceContext(storage, { getItem: () => null }).skill, 'writing');
  const drafted = await draftWithHelper(browser, {
    template: 'I can help build Campus.',
    prompt: 'Draft a sentence.',
    scope: { LanguageModel: { prompt: async () => 'I can help build Campus this week.' } }
  });
  assert.equal(drafted.sent, false);
  assert.match(drafted.text, /Campus/);
  const blocked = await draftWithHelper(browser, {
    template: 'Keep the template.',
    prompt: 'My diagnosis is private.',
    scope: { LanguageModel: { prompt: async () => 'should not be used' } }
  });
  assert.equal(blocked.text, 'Keep the template.');
});
