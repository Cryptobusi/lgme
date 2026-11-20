import test from 'node:test';
import assert from 'node:assert/strict';
import { answerAsk, memoryCounter, quotaDecision, safeAnswer } from '../js/ai-ask.mjs';

test('the online guide caps each phone and the whole day', () => {
  assert.equal(quotaDecision(1, 1).ok, true);
  assert.equal(quotaDecision(30, 1).ok, true);
  assert.equal(quotaDecision(31, 1).ok, false);
  assert.equal(quotaDecision(1, 401).ok, false);
  assert.equal(/diagnos/.test(safeAnswer('This is a diagnosis.')), false);
});

test('a failed or empty model falls back without a secret', async () => {
  const store = memoryCounter();
  const empty = await answerAsk({
    question: 'What is Creo?',
    page: 'Home',
    device: 'phone-1',
    store,
    complete: async () => ({ text: '' })
  });
  assert.equal(empty.body.ok, false);
  assert.equal(empty.body.fallback, true);
  assert.equal(JSON.stringify(empty.body).includes('KEY'), false);
  const ok = await answerAsk({
    question: 'What is Creo?',
    page: 'Home',
    device: 'phone-1',
    store,
    complete: async () => ({ text: 'Creo is value you create.' })
  });
  assert.equal(ok.body.ok, true);
  assert.equal(ok.body.label, 'Gemini 2.5 Flash Lite');
  assert.match(ok.body.text, /Creo/);
});
