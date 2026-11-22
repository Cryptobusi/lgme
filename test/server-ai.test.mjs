import test from 'node:test';
import assert from 'node:assert/strict';
import { askServer, shouldSelfTest, sourceChip, testLine } from '../js/server-ai.mjs';

test('the client names the guide that answered', () => {
  assert.equal(sourceChip('device'), 'AI on · on-device');
  assert.equal(sourceChip('online', 'Gemini 2.5 Flash Lite'), 'AI on · Gemini 2.5 Flash Lite');
  assert.equal(sourceChip('guide'), 'AI on · built-in guide');
  const line = testLine({ ok: true, label: 'Gemini 2.5 Flash Lite' }, new Date('2026-11-20T20:41:00Z'));
  assert.equal(line, 'AI test passed · Gemini 2.5 Flash Lite');
  assert.match(testLine({ ok: false, reason: 'cap' }), /AI test failed · using built-in guide · cap/);
  assert.equal(shouldSelfTest({ getItem: () => null }, 'lgme.app'), true);
  assert.equal(shouldSelfTest({ getItem: () => '1' }, 'lgme.app'), false);
  assert.equal(shouldSelfTest({ getItem: () => null }, '127.0.0.1'), false);
});

test('the client uses the same-origin route and falls back', async () => {
  const calls = [];
  const storage = { getItem: () => 'phone', setItem() {} };
  const ok = await askServer('What is Creo?', 'Home', {
    storage,
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { json: async () => ({ ok: true, text: 'Creo is value you create.', label: 'Gemini 2.5 Flash Lite', model: 'google/gemini-2.5-flash-lite' }) };
    }
  });
  assert.equal(calls[0].url, '/api/ai/ask');
  assert.equal(calls[0].body.device, 'phone');
  assert.equal(ok.label, 'Gemini 2.5 Flash Lite');
  const miss = await askServer('Hello', 'Home', {
    storage,
    fetchImpl: async () => { throw new Error('down'); }
  });
  assert.equal(miss.ok, false);
});
