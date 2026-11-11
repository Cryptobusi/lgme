import { generateDeviceKey, signDevice } from '../js/device-sign.mjs';
import { healthExamplePosts } from '../js/health-examples.mjs';
import { mockWriteAllowed } from '../js/hedera-network.mjs';

if (!mockWriteAllowed(process.env.HEDERA_NETWORK || 'testnet')) {
  console.log('Trade types are not written to mainnet. Nothing was posted.');
  process.exit(0);
}

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

const posts = await healthExamplePosts();
const posted = [];
for (const row of posts) {
  let handle = handles[handleAt % handles.length];
  handleAt += 1;
  let attempt = await postOne(row, handle);
  if (attempt.status === 429 || /10 listing/.test(attempt.result?.error || '')) {
    handle = handles[handleAt % handles.length];
    handleAt += 1;
    await new Promise((resolve) => setTimeout(resolve, attempt.status === 429 ? 65000 : 1000));
    attempt = await postOne(row, handle);
  }
  console.log(row.id, row.type, attempt.status, attempt.result.sequenceNumber || attempt.result.error || '');
  if (attempt.result?.ok) posted.push({ id: row.id, type: row.type, pay: row.pay, sequence: attempt.result.sequenceNumber });
  else process.exitCode = 1;
  await new Promise((resolve) => setTimeout(resolve, 3500));
}
console.log(JSON.stringify(posted));
