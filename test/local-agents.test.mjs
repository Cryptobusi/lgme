import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTERS, agentNotice, deleteAgent, dueAgents, listAgents, needsPermission, parseAgent, pauseAgent, saveAgent } from '../js/local-agents.mjs';

function memory() {
  const bag = {};
  return {
    getItem(key) { return bag[key] || null; },
    setItem(key, value) { bag[key] = String(value); }
  };
}

test('starter prompts become local helpers that only remind, notify, summarize, or draft', () => {
  assert.equal(STARTERS.length, 6);
  const now = Date.parse('2026-11-10T15:00:00.000Z');
  const kinds = STARTERS.map((text) => parseAgent(text, now).agent);
  assert.deepEqual(kinds.map((agent) => agent.action), ['reminder', 'reminder', 'notification', 'summary', 'draft', 'notification']);
  assert.equal(kinds[1].trigger.time, '06:30');
  assert.deepEqual(kinds[1].trigger.days, ['Mon', 'Wed', 'Fri']);
  assert.equal(kinds[4].trigger.name, 'workout-finish');
  assert.equal(kinds[5].trigger.name, 'matching-offer');
  assert.equal(kinds.every((agent) => agent.sends === false && agent.accepts === false), true);
  const store = memory();
  const saved = saveAgent(store, 'Remind me in 1 minute to start a workout.', now);
  assert.equal(saved.ok, true);
  assert.equal(needsPermission(saved.agent), true);
  assert.equal(dueAgents(listAgents(store), now).length, 0);
  assert.equal(dueAgents(listAgents(store), now + 60 * 1000).length, 1);
  assert.match(agentNotice(saved.agent), /^Reminder:/);
  assert.equal(/missed|guilt|streak|ranking/i.test(agentNotice(saved.agent)), false);
  pauseAgent(store, saved.agent.id);
  assert.equal(dueAgents(listAgents(store), now + 60 * 1000).length, 0);
  deleteAgent(store, saved.agent.id);
  assert.equal(listAgents(store).length, 0);
  for (let i = 0; i < 10; i += 1) saveAgent(store, `Remind me in ${i + 1} minute.`, now + i);
  assert.equal(saveAgent(store, 'Remind me in 2 minute.', now).ok, false);
});
