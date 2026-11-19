import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentLevel, eventCompletes, experienced, guideFor, isStartQuestion, LEVELS, markDone, pathChips, pathLine, readPath, resetPath, skipAhead } from '../js/learn-path.mjs';

function memory() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('learning path is five steps without scores', () => {
  assert.deepEqual(LEVELS.map((level) => level.title), ['Getting started', 'First receipt', 'Exchange', 'Attest', 'Your way']);
  const source = readFileSync(new URL('../js/learn-path.mjs', import.meta.url), 'utf8');
  assert.equal(/streak|ranking|leaderboard|badge/i.test(source), false);
  assert.equal(readFileSync(new URL('../js/local-ai-panel.mjs', import.meta.url), 'utf8').includes('id="ai-intents"'), false);
  assert.equal(readFileSync(new URL('../js/site-nav.js', import.meta.url), 'utf8').includes('lgme.ask.tab'), false);
});

test('path advances, skips, resets, and shortens for frequent use', () => {
  const storage = memory();
  assert.equal(pathLine(storage), 'Step 1 of 5 · Getting started');
  assert.equal(currentLevel(storage).chip, 'What is lgme');
  assert.equal(isStartQuestion('What is this app for'), true);
  assert.equal(eventCompletes('start', 'start'), true);
  markDone(storage, 'start');
  assert.equal(pathLine(storage), 'Step 2 of 5 · First receipt');
  assert.deepEqual(pathChips(storage), ['Log a workout']);
  skipAhead(storage);
  assert.equal(currentLevel(storage).id, 'exchange');
  resetPath(storage);
  assert.equal(currentLevel(storage).id, 'start');
  assert.match(guideFor(storage), /IdidIt/);
  const sentences = guideFor(storage).split(/(?<=[.?!])\s+/);
  assert.ok(sentences.length >= 2 && sentences.length <= 4);
  const uses = { 'Log a workout': 4, 'What can I do here?': 1 };
  assert.equal(experienced(storage, uses), true);
  assert.equal(pathChips(storage, uses), null);
  assert.equal(guideFor(storage, uses).includes('.'), true);
  assert.equal(guideFor(storage, uses).split(/(?<=[.?!])\s+/).length, 1);
  assert.equal(pathChips(storage, {}, {}, 'manual'), null);
  for (const level of LEVELS) markDone(storage, level.id);
  assert.equal(pathLine(storage), '');
  assert.equal(readPath(storage).done.length, 5);
});
