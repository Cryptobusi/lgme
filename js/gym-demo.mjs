import * as sim from './p2p-exchange-sim.mjs';
import { evidenceHash } from './exercise-record.mjs';
import { EVIDENCE_UNVERIFIED } from './exercise-record.mjs';

export const DEMO_PREFIX = 'lgme-gym-demo:peer:';
export const MODE_KEY = 'lgme-gym.mode';
export const DEMO_CLUB = 'demo-club';
export const DEMO_NAME = 'Demo Health Club';

const AT = '2026-11-09T15:00:00.000Z';
const END = '2026-11-09T15:40:00.000Z';

const PEOPLE = [
  { id: 'jordan', name: 'Jordan', role: 'member', balance: 70, floor: 20, journey: 'My better tomorrow is a stronger walk home.' },
  { id: 'sam', name: 'Sam', role: 'trainer', balance: 60, floor: 20, journey: 'My better tomorrow is a class that starts on time.' },
  { id: 'desk', name: 'Front Desk', role: 'front-desk', balance: 40, floor: 10, journey: 'My better tomorrow is a clear redemption list.' },
  { id: 'riley', name: 'Riley', role: 'member', balance: 80, floor: 20, journey: 'My better tomorrow is one honest session.' }
];

function profile(journey) {
  return {
    journey,
    healthNote: '',
    public: { journey: true, sessions: true, minutes: false, supports: false, credits: false }
  };
}

export function demoStore(storage = globalThis.localStorage) {
  return sim.createLocalStorageStore(storage, DEMO_PREFIX);
}

export function realStore(storage = globalThis.localStorage) {
  return sim.createLocalStorageStore(storage);
}

export async function ensureDemoProgress(store, now = new Date()) {
  const sam = await store.get('sam');
  if (!sam) return { ok: true };
  if (!sam.gymProgress) {
  sam.gymProgress = {
    chosen: ['miles', 'minutes', 'sessions'],
    custom: null,
    allowGps: false,
    share: { miles: 'board', minutes: 'me', sessions: 'me' },
    manual: [{ kind: 'miles', value: 12, at: now.toISOString(), source: 'example' }]
  };
  }
  if (!Object.keys(sam.exerciseSessions || {}).length && sam.privateKeyJwk) {
    const at = now.toISOString();
    const recorded = await sim.recordExerciseSession(store, 'sam', {
      day: at.slice(0, 10),
      category: 'cardio',
      evidence: EVIDENCE_UNVERIFIED,
      terms: 'Example: a walk',
      durationSec: 1800,
      sensors: [],
      locationMatched: 'no',
      evidenceHash: await evidenceHash({ startedAt: at, finishedAt: at, points: [], photos: [], samples: 0 }),
      at
    });
    if (!recorded.ok) return recorded;
  }
  await store.set('sam', await store.get('sam').then(async (fresh) => {
    fresh.gymProgress = fresh.gymProgress || sam.gymProgress;
    return fresh;
  }));
  const jordan = await store.get('jordan');
  if (jordan && !jordan.gymProgress) {
    jordan.gymProgress = {
      chosen: ['minutes', 'sessions', 'verified'],
      custom: null,
      allowGps: false,
      share: { minutes: 'me', sessions: 'me', verified: 'me' },
      manual: []
    };
    await store.set('jordan', jordan);
  }
  return { ok: true };
}

export async function seedDemoClub(store) {
  if (await store.get('jordan')) {
    await ensureDemoProgress(store);
    return { ok: true, seeded: false, example: true };
  }
  for (const person of PEOPLE) {
    const created = await sim.createPeer(store, {
      id: person.id,
      name: person.name,
      balance: person.balance,
      floor: person.floor,
      creditLimit: -40,
      floorNote: 'example',
      at: AT
    });
    if (!created.ok) return created;
    const peer = await store.get(person.id);
    peer.example = true;
    peer.gymRole = person.role;
    peer.gymProfile = profile(person.journey);
    peer.clubGroups = { [DEMO_CLUB]: { name: DEMO_NAME, code: DEMO_CLUB, role: person.role, steward: 'sam', creator: 'sam', stewardSet: 'default', trainerAt: person.role === 'trainer' ? AT : '' } };
    await store.set(person.id, peer);
  }
  const bundle = { startedAt: AT, finishedAt: END, points: [], photos: [], samples: 0 };
  const recorded = await sim.recordExerciseSession(store, 'jordan', {
    day: '2026-11-09',
    category: 'mixed',
    evidence: EVIDENCE_UNVERIFIED,
    terms: 'Example: spotting or a ride',
    durationSec: 2400,
    sensors: [],
    locationMatched: 'no',
    intent: 'Walking measures the ground',
    evidenceHash: await evidenceHash(bundle),
    at: END
  });
  if (!recorded.ok) return recorded;
  const witnessed = await sim.witnessExercise(store, 'sam', recorded.sessionId, { authorId: 'jordan', at: END });
  if (!witnessed.ok) return witnessed;
  const quote = await sim.submitWisdom(store, 'riley', {
    text: 'Example: one honest session is enough for today.',
    theme: 'honesty',
    kind: 'original',
    at: AT
  });
  if (!quote.ok) return quote;
  await sim.concurWisdom(store, 'sam', quote.submissionId, { authorId: 'riley', at: AT });
  await sim.concurWisdom(store, 'jordan', quote.submissionId, { authorId: 'riley', at: END });
  await ensureDemoProgress(store);
  return { ok: true, seeded: true, example: true };
}

export function seedDemoChat(storage) {
  const key = `lgme-gym-chat:demo:${DEMO_CLUB}`;
  if (storage.getItem(key)) return;
  storage.setItem(key, JSON.stringify([
    { handle: 'Sam', text: 'Example: class starts at the top of the hour.', at: '2026-11-09T14:00:00.000Z', example: true },
    { handle: 'Jordan', text: 'Example: I will be there for the walk.', at: '2026-11-09T14:05:00.000Z', example: true }
  ]));
}

export function chatKey(mode, code) {
  return `lgme-gym-chat:${mode}:${String(code || '').trim().toLowerCase()}`;
}
