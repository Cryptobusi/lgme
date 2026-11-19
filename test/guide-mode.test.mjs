import test from 'node:test';
import assert from 'node:assert/strict';
import { actionIdFrom, dismissOffer, explainOnTap, fieldGuideWithoutModel, guideCards, nextStep, noteUse, pinShortcuts, promotion, readMode, readShortcuts, setMode, shortcutOffer, topActions } from '../js/guide-mode.mjs';
import { defaultVariant, diffLines, validateVariant } from '../js/variant-schema.mjs';

function memory() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); }
  };
}

test('guided is the default and manual hides the next-step cards', () => {
  const store = memory();
  assert.equal(readMode(store), 'guided');
  assert.equal(guideCards('guided'), true);
  assert.equal(guideCards('manual'), false);
  assert.equal(explainOnTap('manual'), false);
  assert.equal(fieldGuideWithoutModel('guided'), true);
  assert.equal(setMode(store, 'manual'), 'manual');
  assert.equal(readMode(store), 'manual');
  const step = nextStep('/gym', '#/ididit');
  assert.equal(step.primary.length > 0, true);
  assert.equal(step.alternates.length, 2);
  assert.doesNotMatch(promotion('/'), /leaderboard|streak|urgent|diagnos/i);
});

test('uses stay on the phone, skip Incognito, and offer shortcuts once', () => {
  const store = memory();
  const link = { id: '', getAttribute(name) { return name === 'href' ? '/gym#/ididit' : ''; } };
  assert.equal(actionIdFrom(link), 'ididit');
  for (let i = 0; i < 5; i += 1) noteUse(store, 'ididit', false);
  noteUse(store, 'ididit', true);
  assert.equal(topActions(noteUse(store, 'health', true))[0], 'ididit');
  assert.deepEqual(shortcutOffer(store), ['ididit']);
  dismissOffer(store);
  assert.equal(shortcutOffer(store), null);
  const fresh = memory();
  for (let i = 0; i < 5; i += 1) noteUse(fresh, 'health', false);
  assert.deepEqual(pinShortcuts(fresh, shortcutOffer(fresh)), ['health']);
  assert.deepEqual(readShortcuts(fresh), ['health']);
  const draft = JSON.parse(fresh.getItem('lgme.variant.draft'));
  assert.deepEqual(draft.shortcuts, ['health']);
  assert.equal(validateVariant(draft).ok, true);
  const base = defaultVariant();
  assert.deepEqual(base.shortcuts, []);
  assert.equal(diffLines({ ...base, shortcuts: ['health'] }).some((line) => line.startsWith('Shortcuts')), true);
});
