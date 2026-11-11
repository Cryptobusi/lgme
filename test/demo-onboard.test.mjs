import test from 'node:test';
import assert from 'node:assert/strict';
import { CHOICES, DISCLAIMER, countByCategory, draftFor, examplePosts, newSince, saveDemo, savePost } from '../js/demo-onboard.mjs';

function memory() {
  const bag = new Map();
  return {
    getItem(key) { return bag.has(key) ? bag.get(key) : null; },
    setItem(key, value) { bag.set(key, String(value)); }
  };
}

test('demo sign-in defers the long join and counts new public posts', () => {
  assert.equal(CHOICES.includes('IwantIT'), true);
  assert.equal(CHOICES.includes('IdidIt (verified receipt)'), true);
  assert.equal(CHOICES.includes('IwanIT help develop'), true);
  assert.equal(DISCLAIMER.length >= 3 && DISCLAIMER.length <= 4, true);
  assert.equal(DISCLAIMER.join(' ').includes('$Trust'), false);
  assert.equal(DISCLAIMER.join(' ').includes('Hedera'), false);
  const storage = memory();
  saveDemo(storage, { emailHash: 'abc' });
  assert.equal(JSON.parse(storage.getItem('lgme.demo.member')).email, undefined);
  const draft = draftFor('IwanIT help develop', { handle: 'demo', category: 'Campus' });
  assert.match(draft.title, /Campus/);
  savePost(storage, { id: 'me', category: 'Campus', title: draft.title, at: new Date().toISOString() });
  const fresh = newSince([...examplePosts(), ...JSON.parse(storage.getItem('lgme.demo.posts'))], {});
  assert.equal(fresh.length >= 2, true);
  assert.equal(countByCategory(fresh).Campus >= 1, true);
});
