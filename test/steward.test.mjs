import test from 'node:test';
import assert from 'node:assert/strict';
import { CLARIFICATIONS } from '../js/covenant.mjs';
import { approveLimitRaise, breakSplit, intakeCreditLimit, intakeOutcome } from '../js/intake.mjs';
import { changeSteward, clearedOnce, groupSteward, majoritySteward, queueFor, routeSteward, stewardEligible } from '../js/steward.mjs';
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
  assert.equal(CLARIFICATIONS[10].startsWith('Admissions Steward:'), true);
  assert.equal(CLARIFICATIONS[10].includes('receives no credit or perks'), true);
  const sam = member('sam', { role: 'trainer' });
  const jordan = member('jordan');
  assert.equal(groupSteward([jordan, sam], 'club'), 'sam');
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
  assert.equal(intakeOutcome([
    { primary: pass, secondary: pass },
    { primary: revise, secondary: pass }
  ]).status, 'Split');
});
