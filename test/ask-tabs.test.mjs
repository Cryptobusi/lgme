import test from 'node:test';
import assert from 'node:assert/strict';
import { ASK_TABS, readTab, setTab, shapeAnswer } from '../js/ask-tabs.mjs';

function memory() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); }
  };
}

test('the ask tabs stay on the device and shape the answer', () => {
  assert.deepEqual(ASK_TABS.map((tab) => tab.label), ['Direct', 'Excite', 'Review', 'Inform', 'Use']);
  const store = memory();
  assert.equal(readTab(store), 'direct');
  assert.equal(setTab(store, 'inform'), 'inform');
  assert.equal(readTab(store), 'inform');
  const direct = shapeAnswer('direct', 'Open Health.');
  assert.match(direct, /Do this next/);
  const excite = shapeAnswer('excite', 'Open Health.');
  assert.match(excite, /calm step/);
  assert.doesNotMatch(excite, /streak|rank|leaderboard/i);
  assert.match(shapeAnswer('review', 'Creo is value you create.', 'Nothing new is waiting on this phone.'), /short status/);
  assert.match(shapeAnswer('use', 'Log an IdidIt.'), /how to do it/i);
});
