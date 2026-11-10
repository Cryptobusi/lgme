import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { communityFeed } from '../js/gym-feed.mjs';

const now = new Date('2026-11-10T15:00:00.000Z');

test('the community feed keeps private numbers off and sorts by time', () => {
  const viewer = { id: 'ada', name: 'Ada', clubGroups: { crew1: { name: 'Crew' } } };
  const sam = {
    id: 'sam',
    name: 'Sam',
    example: true,
    clubGroups: { 'demo-club': { name: 'Demo Health Club' } },
    gymProgress: {
      chosen: ['miles', 'sessions'],
      share: { miles: 'board', sessions: 'me' },
      manual: [{ kind: 'miles', value: 12, at: now.toISOString(), source: 'example' }],
      allowGps: false
    },
    exerciseSessions: {},
    wisdomSubmissions: {}
  };
  const riley = {
    id: 'riley',
    name: 'Riley',
    clubGroups: { crew1: { name: 'Crew' } },
    gymProgress: {
      chosen: ['minutes'],
      share: { minutes: 'groups' },
      manual: [],
      allowGps: false
    },
    exerciseSessions: { a: { day: '2026-11-10', durationSec: 600, evidence: 'phone-recorded (unverified)' } },
    wisdomSubmissions: { w: { status: 'published', theme: 'honesty', handle: 'Riley', at: '2026-11-10T16:00:00.000Z' } }
  };
  const outsider = {
    id: 'pat',
    name: 'Pat',
    clubGroups: {},
    gymProgress: { chosen: ['minutes'], share: { minutes: 'groups' }, manual: [], allowGps: false },
    exerciseSessions: { a: { day: '2026-11-10', durationSec: 9999, evidence: 'phone-recorded (unverified)' } }
  };
  const feed = communityFeed({ peers: [sam, riley, outsider, viewer], viewer, now });
  const text = JSON.stringify(feed);
  assert.equal(text.includes('9999'), false);
  assert.equal(text.includes('latitude'), false);
  assert.equal(feed.some((item) => item.text.includes('12')), true);
  assert.equal(feed.some((item) => item.text.includes('honesty')), true);
  assert.equal(feed.some((item) => item.handle === 'Pat'), false);
  assert.equal(feed[0].at >= feed.at(-1).at, true);
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(home.includes('data-entry="health"'), true);
  assert.equal(home.includes('Gym beta'), true);
  assert.equal(home.indexOf('data-entry="health"') < home.indexOf('View only, coming next'), true);
  assert.equal(home.includes('Health is the live category'), true);
  assert.equal(home.includes('>Health</span>'), true);
  assert.equal(home.includes('>Campus</span>'), true);
  assert.equal(home.includes('>Neighbor help</span>'), true);
  assert.equal(home.includes('>Hosts</span>'), true);
  assert.equal(home.includes('>Circles</span>'), true);
  assert.equal(home.includes('>Stories</span>'), true);
  assert.equal(home.includes('>Exchange</span>'), true);
  assert.equal(home.includes('href="/neighbors"'), true);
  assert.equal(readFileSync(new URL('../js/gym-app.mjs', import.meta.url), 'utf8').includes('href="/neighbors"'), false);
  assert.equal(home.includes('lgme.entry.category') || readFileSync(new URL('../js/home-entry.js', import.meta.url), 'utf8').includes('lgme.entry.category'), true);
  assert.equal(home.includes('$Trust'), false);
  assert.equal(home.includes('CONTENT_FROM_FILE'), false);
});
