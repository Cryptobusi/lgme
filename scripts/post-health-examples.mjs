import { generateDeviceKey, signDevice } from '../js/device-sign.mjs';
import { healthExamplePosts } from '../js/health-examples.mjs';
import { mockWriteAllowed } from '../js/hedera-network.mjs';

if (!mockWriteAllowed(process.env.HEDERA_NETWORK || 'testnet')) {
  console.log('Health examples are not written to mainnet. Nothing was posted.');
  process.exit(0);
}

const endpoint = 'https://lgme.app/api/hedera/listings';
const keys = new Map();

async function keyFor(handle) {
  if (!keys.has(handle)) keys.set(handle, await generateDeviceKey());
  return keys.get(handle);
}

async function postOne(row) {
  const key = await keyFor(row.handle);
  const payload = { ...row };
  delete payload.chain;
  const body = { handle: row.handle, publicJwk: key.publicJwk, payload, sig: await signDevice(key.privateJwk, payload) };
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  return { status: response.status, result };
}

const mirror = await fetch('https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.11397293/messages?limit=100&order=desc');
const seen = new Set();
if (mirror.ok) {
  const body = await mirror.json();
  for (const row of body.messages || []) {
    try {
      const item = JSON.parse(Buffer.from(row.message, 'base64').toString('utf8'));
      if (item?.id) seen.add(item.id);
    } catch { /* skip */ }
  }
}

const queue = (await healthExamplePosts()).filter((row) => !seen.has(row.id));
console.log('to post', queue.length);
const posted = [];
for (const row of queue) {
  let attempt = await postOne(row);
  if (attempt.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 65000));
    attempt = await postOne(row);
  }
  console.log(row.id, row.path, attempt.status, attempt.result.sequenceNumber || attempt.result.error || '');
  if (attempt.result?.ok) posted.push({ id: row.id, path: row.path, sequence: attempt.result.sequenceNumber });
  await new Promise((resolve) => setTimeout(resolve, 3500));
}
console.log(JSON.stringify(posted));
