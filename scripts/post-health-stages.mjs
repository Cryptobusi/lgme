import { generateDeviceKey, signDevice } from '../js/device-sign.mjs';
import { HEALTH_EXAMPLES, healthExamplePosts } from '../js/health-examples.mjs';
import { mockWriteAllowed } from '../js/hedera-network.mjs';

if (!mockWriteAllowed(process.env.HEDERA_NETWORK || 'testnet')) {
  console.log('Stage messages are not written to mainnet. Nothing was posted.');
  process.exit(0);
}

const CHAINS = {
  'hx-yoga': ['unclaimed', 'matched'],
  'hx-stretch': ['unclaimed', 'matched'],
  'hx-hike': ['unclaimed', 'partial'],
  'hx-swim': ['unclaimed', 'matched', 'confirmed'],
  'hx-cycle': ['unclaimed', 'matched', 'confirmed'],
  'hx-sleep': ['unclaimed', 'matched', 'confirmed'],
  'hx-nutrition': ['unclaimed', 'matched', 'confirmed', 'receipt'],
  'hx-meal': ['unclaimed', 'matched', 'confirmed', 'receipt'],
  'hx-checkin': ['unclaimed', 'matched', 'confirmed', 'receipt']
};

const STATUS = {
  unclaimed: 'Test item - unclaimed',
  matched: 'Test item - matched',
  partial: 'Test item - partial',
  confirmed: 'Test item - confirmed',
  receipt: 'Test item - receipt'
};

const endpoint = 'https://lgme.app/api/hedera/listings';
const handles = ['desk-examples', 'sage-holm', 'remy-cole', 'nico-fern', 'otto-park', 'mina-vale', 'lila-brook'];
let handleAt = 0;
const keys = new Map();

async function keyFor(handle) {
  if (!keys.has(handle)) keys.set(handle, await generateDeviceKey());
  return keys.get(handle);
}

async function postOne(row, handle) {
  const key = await keyFor(handle);
  const payload = { ...row, handle };
  delete payload.chain;
  const body = { handle, publicJwk: key.publicJwk, payload, sig: await signDevice(key.privateJwk, payload) };
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  return { status: response.status, result };
}

const base = new Map((await healthExamplePosts()).map((row) => [row.id, row]));
const posted = [];
for (const [id, stages] of Object.entries(CHAINS)) {
  const example = HEALTH_EXAMPLES.find((row) => row.id === id);
  const seed = base.get(id);
  for (const stage of stages) {
    const row = { ...seed, status: STATUS[stage], hashOnly: true };
    let handle = handles[handleAt % handles.length];
    let attempt = await postOne(row, handle);
    if (attempt.status === 429 || /10 listing/.test(attempt.result?.error || '')) {
      handleAt += 1;
      handle = handles[handleAt % handles.length];
      await new Promise((resolve) => setTimeout(resolve, attempt.status === 429 ? 65000 : 1000));
      attempt = await postOne(row, handle);
    }
    console.log(id, stage, attempt.status, attempt.result.sequenceNumber || attempt.result.error || '');
    if (attempt.result?.ok) posted.push({ id, activity: example.title, path: example.path, stage, sequence: attempt.result.sequenceNumber });
    else process.exitCode = 1;
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
}
console.log(JSON.stringify(posted));
