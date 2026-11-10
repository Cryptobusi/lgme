import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmServiceCredit, recommendRate, scoreSolo, soloCredit } from '../js/exercise-arbiter.mjs';

test('the arbiter suggests a rate, waits for both confirms, and caps solo credit', () => {
  const physical = recommendRate({ kind: 'physical', minutes: 30 });
  const mental = recommendRate({ kind: 'mental', minutes: 30 });
  assert.equal(physical.kind, 'physical');
  assert.equal(mental.kind, 'mental');
  assert.match(physical.text, /Both people confirm/);
  assert.equal(physical.author > 0, true);
  const waiting = confirmServiceCredit({ giver: true, receiver: false, amount: physical.author });
  assert.equal(waiting.credit, 0);
  assert.equal(waiting.pending, true);
  const both = confirmServiceCredit({ giver: true, receiver: true, amount: physical.author });
  assert.equal(both.credit, physical.author);
  const low = scoreSolo({ minutes: 5, note: 'short' });
  assert.equal(low.confidence < 0.85, true);
  assert.equal(soloCredit({ confidence: low.confidence, amount: 2 }).credit, 0);
  const high = scoreSolo({ minutes: 30, note: 'A steady walk outside' });
  assert.equal(high.confidence >= 0.85, true);
  const earned = soloCredit({ confidence: high.confidence, amount: mental.author, prior: [] });
  assert.equal(earned.credit, mental.author);
  assert.equal(earned.label, 'self-attested (AI-checked)');
  assert.equal(earned.needsTap, true);
  const capped = soloCredit({ confidence: high.confidence, amount: 2, prior: [Date.now()], dayCap: 1, weekCap: 5 });
  assert.equal(capped.credit, 0);
  assert.match(capped.text, /1 a day and 5 a week/);
});
