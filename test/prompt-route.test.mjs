import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPrompt } from '../js/prompt-route.mjs';
import { draftFollowUp, attestBadges, reminderState, sendDraft, stopReminders, suggestAttesters } from '../js/attest-follow.mjs';

const DAY = 24 * 60 * 60 * 1000;

test('each category gets a phrase and browse-only categories do not write', () => {
  const cases = [
    ['log 10min treadmill', 'Health', true],
    ['log a campus tutoring session', 'Campus', false],
    ['I want neighbor help with groceries', 'Neighbor help', false],
    ['I have a room to host', 'Hosts', false],
    ['log a circle meeting', 'Circles', false],
    ['I want to share a story', 'Stories', false],
    ['I have an item to exchange', 'Exchange', false],
    ['I want large print for older adults', 'IhelpIT', false]
  ];
  for (const [phrase, category, live] of cases) {
    const route = classifyPrompt(phrase);
    assert.equal(route.category, category, phrase);
    assert.equal(route.liveWrite, live, phrase);
    if (!live) assert.equal(route.href.startsWith('/develop?category='), true, phrase);
    assert.equal(route.href.includes('/api/'), false, phrase);
  }
});

test('attestation drafts are not sent until a person confirms, and reminders expire at 30 days', () => {
  const people = suggestAttesters({
    category: 'Health',
    trainer: 'Mina',
    members: [
      { id: 'a', name: 'Ada', category: 'Health', optedIn: true, area: 'near the park' },
      { id: 'b', name: 'Bea', category: 'Health', optedIn: false, exact: '1.23,4.56' }
    ]
  });
  assert.equal(people[0].name, 'Mina');
  assert.equal(people.some((person) => person.exact), false);
  const draft = draftFollowUp(people[1], 'Please attest the session');
  assert.equal(sendDraft(draft).sent, false);
  assert.equal(sendDraft(draft, true).sent, true);
  const item = { created: 0 };
  assert.equal(reminderState(item, 0).remind, true);
  assert.equal(reminderState({ created: 0, lastRemind: 0 }, DAY).remind, true);
  assert.equal(reminderState(item, 30 * DAY).status, 'expired, not attested');
  assert.equal(reminderState(stopReminders([item])[0], DAY).remind, false);
  const badges = attestBadges([
    { created: 0 },
    { created: 0, attested: true },
    ...Array.from({ length: 10 }, () => ({ created: 0, attested: false, lastRemind: 0 }))
  ], DAY);
  assert.equal(badges['Reminders today'], '9+');
  assert.equal(badges.Attested, '1');
  assert.equal(badges['Waiting on others'], '9+');
});
