import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acceptMatch, addEntry, barterMatches, contributionDraft, emptyBook, postIdidIt, proofPanel, reviewBundle, statements, upkeepDraft } from '../js/books.mjs';
import { matchPrompt } from '../js/local-ai-panel.mjs';

function memory() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('the local book does not pay and waits for OK', () => {
  const storage = memory();
  assert.equal(postIdidIt(storage, { title: 'Walk', item: 'Walk' }, false).ok, false);
  const posted = postIdidIt(storage, { title: 'Walk', item: 'Walk' }, true);
  assert.equal(posted.ok, true);
  assert.equal(posted.book.lines[0].paid, false);
  assert.equal(posted.book.lines[0].link, 'Walk');
  const draft = contributionDraft(1);
  assert.equal(draft.live, 'off');
  assert.equal(draft.legs[1].credit + draft.legs[2].credit, 100);
  const book = addEntry(emptyBook(), draft, true);
  assert.equal(book.ok, true);
  const view = statements(book.book);
  assert.equal(view.balance.find((row) => row.code === '2100').amount, -50);
  const upkeep = addEntry(emptyBook(), upkeepDraft('Rower'), false);
  assert.equal(upkeep.ok, false);
  const proof = proofPanel({ name: 'Bike', condition: 'good' }, [{ kind: 'photo', name: 'bike.jpg' }]);
  assert.match(proof.line, /IhavIt/);
  assert.equal(proof.photos[0], 'bike.jpg');
  const match = barterMatches([{ name: 'City bike', notes: 'blue' }], [{ text: 'bike for a lamp' }])[0];
  assert.equal(acceptMatch(match, 'have', true).agreed, false);
  assert.equal(acceptMatch(acceptMatch(match, 'have', true), 'want', true).agreed, true);
  assert.equal(acceptMatch(match, 'have', true).sent, false);
  const bundle = reviewBundle({ items: [{ name: 'Bike', category: 'bike', condition: 'good', quantity: 1 }], book: posted.book });
  assert.match(bundle.report, /LGME_CONTRIB_LIVE is off/);
  assert.match(bundle.ledger, /4000/);
  assert.equal(matchPrompt('open sobeit').kind, 'sobeit');
  assert.equal(JSON.parse(readFileSync(new URL('../data/credit-rules.json', import.meta.url), 'utf8')).LGME_CONTRIB_LIVE, 'off');
  const page = readFileSync(new URL('../books.html', import.meta.url), 'utf8');
  assert.match(page, /Consult a professional/);
  assert.match(page, /Debit = you owe/);
});
