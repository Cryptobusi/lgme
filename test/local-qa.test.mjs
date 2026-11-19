import test from 'node:test';
import assert from 'node:assert/strict';
import { answerOrFallback, localAnswer } from '../js/local-qa.mjs';

test('what is this app for answers with AI off and falls back when the model is empty', () => {
  const off = answerOrFallback({ question: 'what is this app for', aiOn: false, modelText: '' });
  assert.match(off.text, /work-value credit and barter exchange/);
  assert.match(off.text, /IdidIt/);
  assert.match(off.text, /Creo/);
  assert.match(off.text, /Only Health is live/);
  assert.equal(off.text.trim().length > 0, true);
  assert.equal(off.actions.length >= 1 && off.actions.length <= 3, true);
  const empty = answerOrFallback({ question: 'what is this app for', aiOn: true, modelText: '' });
  assert.equal(empty.text, off.text);
  assert.equal(empty.source, 'local');
  const blank = answerOrFallback({ question: 'what is this app for', aiOn: true, modelText: '   ' });
  assert.equal(blank.text, off.text);
  const model = answerOrFallback({ question: 'what is this app for', aiOn: true, modelText: 'A short model reply about the exchange.' });
  assert.match(model.text, /model reply/);
  assert.equal(model.source, 'model');
  const unknown = localAnswer('zzzz');
  assert.match(unknown.text, /I can't reach AI right now, here's the built-in guide/);
  assert.equal(unknown.text.trim().length > 0, true);
});
