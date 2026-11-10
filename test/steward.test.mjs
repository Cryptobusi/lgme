import test from 'node:test';
import assert from 'node:assert/strict';
import { CLARIFICATIONS } from '../js/covenant.mjs';
import { approveLimitRaise, breakSplit, intakeCreditLimit, intakeOutcome } from '../js/intake.mjs';
import { changeSteward, clearedOnce, groupSteward, majoritySteward, queueFor, routeSteward, setTrainer, stewardEligible, trainingOffer } from '../js/steward.mjs';
import { replay } from '../js/p2p-exchange-sim.mjs';

const pass = { status: 'PASS', gates: [true, true, true, true, true] };
const revise = { status: 'REVISE', gates: [true, false, false, false, false] };

function member(id, extra = {}) {
  return {
    id,
    name: id,
    gymRole: extra.role || 'member',
    intake: extra.intake,
    covenant: extra.covenant,
    clubGroups: { club: { name: 'Club', code: 'club', role: extra.role || 'member', creator: extra.creator || 'sam', steward: extra.steward || '', stewardSet: extra.stewardSet || 'default' } },
    tape: extra.tape || [{ type: 'genesis', payload: { balance: 0, floor: 0, creditLimit: 0 } }]
  };
}

test('the steward defaults to the trainer and a conflict leaves that review', () => {
  assert.equal(CLARIFICATIONS[10].includes('any member may opt in as a trainer'), true);
  assert.equal(CLARIFICATIONS[10].includes('earliest trainer to join'), true);
  assert.equal(CLARIFICATIONS[10].includes('receives no credit or perks'), true);
  const sam = member('sam', { role: 'trainer' });
  const jordan = member('jordan');
  assert.equal(groupSteward([jordan, sam], 'club'), 'sam');
  const early = member('amy', { role: 'trainer' });
  const late = member('zoe', { role: 'trainer' });
  early.clubGroups.club.trainerAt = '2026-01-01T00:00:00.000Z';
  late.clubGroups.club.trainerAt = '2026-06-01T00:00:00.000Z';
  assert.equal(groupSteward([late, early, jordan], 'club'), 'amy');
  const plain = member('ada', { creator: 'ada' });
  const other = member('bo', { creator: 'ada' });
  assert.equal(groupSteward([other, plain], 'club'), 'ada');
  const cleared = member('riley', {
    intake: { status: 'Tier-1' },
    tape: [
      { type: 'genesis', payload: { balance: 0 } },
      { type: 'transfer', payload: { toId: 'riley', amount: 10, direction: 'in' } },
      { type: 'transfer', payload: { fromId: 'riley', amount: 10, direction: 'out' } }
    ]
  });
  assert.equal(clearedOnce(cleared), true);
  assert.equal(stewardEligible(cleared), true);
  assert.equal(changeSteward([sam, cleared], 'club', 'riley', 'jordan').ok, false);
  assert.equal(changeSteward([sam, cleared], 'club', 'riley', 'sam').steward, 'riley');
  assert.equal(majoritySteward({ jordan: 'riley', desk: 'riley' }, 3), 'riley');
  const applicant = member('ada', { intake: { status: 'Split', reviews: [{ handle: 'sam' }, { handle: 'bo' }] }, covenant: { sponsors: [{ handle: 'sam' }] } });
  const routed = routeSteward({ steward: 'sam', members: [sam, cleared], sponsors: ['sam'], requested: false });
  assert.equal(routed.conflict, true);
  assert.equal(routed.steward, 'riley');
  const queue = queueFor('sam', [sam, applicant], 'club');
  assert.equal(queue.some((row) => row.kind === 'split'), false);
  assert.equal(queue.some((row) => row.kind === 'conflict'), true);
  const before = replay(applicant).balance;
  const broken = breakSplit({ reviews: [{ handle: 'bo', primary: pass, secondary: pass }, { handle: 'cy', primary: revise, secondary: pass }] }, 'sam', { primary: 'PASS', secondary: 'PASS' }, []);
  assert.equal(broken.intake.status, 'Tier-1');
  assert.equal(replay(applicant).balance, before);
  const raised = approveLimitRaise({ status: 'Tier-1', limitRequest: { to: -200, approved: false } }, 'sam', []);
  assert.equal(intakeCreditLimit(raised.intake, 0), -200);
  const toggled = setTrainer(member('jordan'), true, '2026-11-10T00:00:00.000Z');
  assert.equal(toggled.gymRole, 'trainer');
  assert.equal(setTrainer(toggled, false).gymRole, 'member');
  const offered = trainingOffer(toggled, { kind: 'IselIT', credit: true });
  assert.equal(offered.creditOpen, false);
  assert.equal(offered.note, 'Credit waits on the same 5-gate intake check.');
  toggled.intake = { status: 'Tier-1' };
  assert.equal(trainingOffer(toggled, { kind: 'IhavIT', credit: true }).offer.gates, 'passed');
  assert.equal(intakeOutcome([
    { primary: pass, secondary: pass },
    { primary: revise, secondary: pass }
  ]).status, 'Split');
});
