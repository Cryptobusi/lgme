import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { floorBlockReason } from '../js/p2p-exchange-sim.mjs';
import { addReview, intakeCreditLimit, intakeOutcome, intakeParts, publicIntake, reviewCanonical, reviewHash, sharePrivate } from '../js/intake.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = readFileSync(join(root, 'data/intake-protocol.txt'), 'utf8');

const pass = { gates: [true, true, true, true, true], status: 'PASS' };
const half = { gates: [true, true, true, true, false], status: 'PASS' };

test('the intake protocol file matches the vetting text', () => {
  const lines = text.replace(/\n$/, '').split('\n');
  assert.equal(lines[0], 'Member Intake: Productive Capacity Vetting Protocol');
  assert.equal(lines[4], 'Circle Node: ____ Date: ____');
  assert.equal(lines[5], 'Applicant Name: ____ Handle / Identifier: ____');
  assert.equal(lines[10], '   * [ ] Physical in-person delivery / on-site labor');
  assert.equal(lines[43], '| Gate | Assessment Criterion | Passing Standard | Red Flags (Auto-Fail) |');
  assert.equal(lines[47], '| 3. Non-Intermediated Labor (Directness) | The offering represents the applicant\u2019s own direct exertion and time, not brokered or subcontracted work. | Performed personally by the applicant; transparent execution. | Reselling goods made by third parties, outsourcing labor to non-members, or automated scraping/arbitrage. |');
  assert.equal(lines[49].includes('4\u201315 hours/month'), true);
  assert.equal(lines.at(-1), '____');
  assert.equal(text.split('____').length - 1, 19);
  assert.equal(text.split('[ ]').length - 1, 29);
  const parts = intakeParts(text);
  assert.equal(parts.part1.includes('Part II:'), false);
  assert.equal(parts.part3.startsWith('Part III:'), true);
  assert.equal(text.includes('CONTENT_FROM_FILE'), false);
});

test('two full passes open tier 1 and a single pass stays tier 0', async () => {
  assert.equal(intakeOutcome([]).status, 'Pending sponsors');
  const one = addReview({ handle: 'ada', primary: 'spotting', secondary: 'meals', reviews: [] }, {
    handle: 'bo', primary: { status: 'REVISE', gates: half.gates }, secondary: pass, notes: 'Name the unit.'
  });
  assert.equal(one.intake.status, 'Revise');
  assert.equal(one.intake.notes[0], 'Name the unit.');
  const both = [
    { handle: 'bo', primary: pass, secondary: pass },
    { handle: 'cy', primary: pass, secondary: pass }
  ];
  assert.equal(intakeOutcome(both).status, 'Tier-1');
  assert.equal(intakeOutcome([
    { handle: 'bo', primary: pass, secondary: half },
    { handle: 'cy', primary: pass, secondary: pass }
  ]).status, 'Tier-0');
  assert.equal(intakeOutcome([
    { handle: 'bo', primary: { status: 'REJECT', gates: pass.gates }, secondary: pass, notes: 'Not direct.' }
  ]).status, 'paused');
  const hidden = publicIntake({ ...one.intake, applicantName: 'Ada Lovelace', trackRecord: 'a neighbor' });
  assert.equal(hidden.applicantName, undefined);
  assert.equal(reviewCanonical(hidden).includes('Ada'), false);
  assert.equal(reviewCanonical(hidden).includes('Lovelace'), false);
  assert.equal(await reviewHash(one.intake), await reviewHash({ ...one.intake, applicantName: 'Ada Lovelace', trackRecord: 'a neighbor' }));
  assert.equal(sharePrivate({ applicantName: 'Ada', trackRecord: 'neighbor', sponsors: ['bo'] }, 'cy').ok, false);
  assert.equal(sharePrivate({ applicantName: 'Ada', trackRecord: 'neighbor', sponsors: ['bo'] }, 'bo').private.applicantName, 'Ada');
  assert.equal(intakeCreditLimit({ status: 'Tier-1' }, 0), -50);
  assert.equal(intakeCreditLimit({ status: 'Tier-0' }, 0), 0);
  assert.equal(intakeCreditLimit({ status: 'Tier-0' }, 25), -50);
  const peer = {
    id: 'ada',
    intake: { status: 'Tier-0' },
    tape: [{ type: 'genesis', payload: { balance: 0, floor: -200, creditLimit: -200, floorNote: 'food' } }]
  };
  assert.notEqual(floorBlockReason(peer, -1), '');
  peer.intake.status = 'Tier-1';
  assert.equal(floorBlockReason(peer, -40), '');
  assert.notEqual(floorBlockReason(peer, -51), '');
});
