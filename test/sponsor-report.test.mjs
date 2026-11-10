import test from 'node:test';
import assert from 'node:assert/strict';
import { creditReport, memberVelocity, mirrorMatch, sponsorshipReady, TESTNET_TOPIC } from '../js/sponsor-report.mjs';

const NOW = Date.parse('2026-11-10T12:00:00.000Z');

function peer() {
  return {
    id: 'ada',
    clubGroups: { dawn: { creator: 'bo', name: 'Dawn' } },
    covenant: {
      sponsors: [{ handle: 'bo' }, { handle: 'cy', inGroup: false }],
      reportAccess: true,
      authorizeHealth: false
    },
    tape: [
      { type: 'genesis', hash: 'aa', at: '2026-06-01T00:00:00.000Z', payload: { balance: 0 } },
      { type: 'transfer', hash: 'bb', at: '2026-11-02T00:00:00.000Z', payload: { amount: 4, fromId: 'cy', toId: 'ada', direction: 'in' } },
      { type: 'EXERCISE_SESSION', hash: 'cc', at: '2026-11-02T00:00:00.000Z', payload: { mood: 9, note: 'knee pain' } },
      { type: 'SUBFLOOR_DONATION', hash: 'dd', at: '2026-11-03T00:00:00.000Z', payload: { amount: 1.5 } },
      { type: 'transfer', hash: 'ee', at: '2026-01-01T00:00:00.000Z', payload: { amount: 9, fromId: 'cy', toId: 'ada', direction: 'in' } }
    ]
  };
}

test('two sponsors are enough when one is the group creator, and more are allowed', () => {
  const member = peer();
  assert.equal(sponsorshipReady(member).ok, true);
  assert.equal(sponsorshipReady(member).count, 2);
  assert.match(sponsorshipReady({ covenant: { sponsors: [{ handle: 'cy' }] } }).error, /Sponsors: 1/);
  member.covenant.sponsors.push({ handle: 'dee', inGroup: true });
  assert.equal(sponsorshipReady(member).count, 3);
  assert.equal(TESTNET_TOPIC, '0.0.11397291');
});

test('a sponsor report keeps health data out and proves credit rows', async () => {
  const report = await creditReport(peer(), { now: NOW });
  assert.equal(report.ok, true);
  assert.equal(report.healthIncluded, false);
  assert.equal(JSON.stringify(report).includes('knee'), false);
  assert.equal(JSON.stringify(report).includes('mood'), false);
  assert.equal(report.rows.some((row) => row.type === 'EXERCISE_SESSION'), false);
  assert.equal(report.balance, 13);
  assert.deepEqual(report.limits, { initial: -50, maximum: -200, balance: 13, acrossGroups: true });
  assert.equal(report.velocity.acrossGroups, true);
  assert.equal(report.velocity.days, 90);
  assert.equal(report.velocity.net, 4);
  assert.equal(report.floor, 1.5);
  const transfer = report.rows.find((row) => row.hash === 'bb');
  assert.equal(transfer.credit, 4);
  assert.equal(transfer.included, true);
  assert.equal(transfer.proof.root, report.root);
  const closed = await creditReport({ ...peer(), covenant: { reportAccess: false } });
  assert.equal(closed.ok, false);
  const opened = await creditReport({ ...peer(), covenant: { authorizeHealth: true } }, { authorizeHealth: true, now: NOW });
  assert.equal(opened.rows.some((row) => row.type === 'health-authorized'), true);
  assert.equal(JSON.stringify(opened).includes('knee'), false);
});

test('mirror matching looks for the root on the testnet topic messages', () => {
  assert.equal(mirrorMatch('abc', [{ contents: '{"root":"abc"}', root: 'abc' }]), true);
  assert.equal(mirrorMatch('abc', [{ contents: 'other', root: '' }]), false);
  assert.equal(memberVelocity(peer(), NOW).net, 4);
});
