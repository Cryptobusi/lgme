import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import rules from '../data/credit-rules.json' with { type: 'json' };
import { awardAttestation, awardQuiz, awardVerified, emptyBook, formatCredits, scoreQuiz } from '../js/work-credits.mjs';

const ok = { signedIn: true, deviceVerified: true, bot: false, day: '2026-11-15' };

test('attestation credits both people, blocks self and pair repeats, and quizzes pay once', () => {
  const first = awardAttestation(emptyBook(), { ...ok, logger: 'ada', attester: 'mina' }, rules);
  assert.equal(first.book.balances.ada, 1);
  assert.equal(formatCredits(first.book.balances.ada), '0.01');
  assert.equal(first.book.balances.mina, 1);
  const self = awardAttestation(first.book, { ...ok, logger: 'ada', attester: 'ada' }, rules);
  assert.equal(self.book.balances.ada, 1);
  const again = awardAttestation(first.book, { ...ok, logger: 'mina', attester: 'ada' }, rules);
  assert.equal(again.book, first.book);
  let book = first.book;
  for (const kind of ['ididit', 'listing', 'proposal']) {
    book = awardVerified(book, { ...ok, member: 'ada', kind }, rules).book;
  }
  assert.equal(book.balances.ada, 4);
  let tiny = emptyBook();
  for (const kind of ['ididit', 'listing', 'proposal']) tiny = awardVerified(tiny, { ...ok, member: 'cy', kind }, rules).book;
  assert.equal(tiny.balances.cy, 3);
  assert.equal(formatCredits(tiny.balances.cy), '0.03');
  const answers = ['On this device', 'No', 'Two people'];
  assert.equal(scoreQuiz('help-start', answers), true);
  const quiz = awardQuiz(book, { ...ok, member: 'ada', topic: 'help-start', passed: true }, rules);
  assert.equal(quiz.entry.amount, 1);
  const twice = awardQuiz(quiz.book, { ...ok, member: 'ada', topic: 'help-start', passed: true }, rules);
  assert.equal(twice.entry, null);
  const capped = emptyBook();
  let learning = capped;
  for (let i = 0; i < rules.quizDailyCap; i += 1) {
    learning = awardQuiz(learning, { ...ok, member: 'bea', topic: `topic-${i}`, passed: true }, rules).book;
  }
  const overDay = awardQuiz(learning, { ...ok, member: 'bea', topic: 'topic-extra', passed: true }, rules);
  assert.match(overDay.error, /daily/);
  const paused = awardAttestation(emptyBook(), { ...ok, bot: true, logger: 'ada', attester: 'mina' }, rules);
  assert.equal(paused.paused, true);
  assert.equal(paused.book.balances.ada, undefined);
  const home = readFileSync(new URL('../js/thumb-home.mjs', import.meta.url), 'utf8');
  assert.equal(home.includes('<details id="my-credits">'), true);
  assert.equal(home.includes('id="credits-total"'), true);
  assert.equal(home.includes('Creo 0.00'), true);
  assert.equal(home.includes("Creo is not a debt."), true);
  assert.equal(home.includes('<details id="my-credits" open>'), false);
  const help = readFileSync(new URL('../help.html', import.meta.url), 'utf8');
  assert.equal(help.includes('id="work-credits"'), true);
  assert.match(help, /There is no leaderboard/);
});
