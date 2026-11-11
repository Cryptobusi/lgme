import { generateDeviceKey, signDevice } from '../js/device-sign.mjs';
import { authorPayloads, examplePayloads, mockListings } from '../js/mock-catalog.mjs';

const endpoint = 'https://lgme.app/api/hedera/listings';
const keys = new Map();

async function keyFor(handle) {
  if (!keys.has(handle)) keys.set(handle, await generateDeviceKey());
  return keys.get(handle);
}

async function postOne(row) {
  const key = await keyFor(row.handle);
  const payload = {
    handle: row.handle,
    action: 'listing',
    category: 'exchange',
    id: row.id,
    title: row.title,
    service: row.service,
    durationMin: row.durationMin,
    tags: row.tags,
    status: row.status,
    summary: row.summary,
    place: row.place,
    side: row.side,
    group: row.group,
    authorHandle: row.authorHandle,
    receiptHash: row.receiptHash,
    at: '2026-11-11T00:30:00.000Z'
  };
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
      const text = Buffer.from(row.message, 'base64').toString('utf8');
      const item = JSON.parse(text);
      if (item?.id) seen.add(item.id);
    } catch { /* not one of ours */ }
  }
}

const queue = [...authorPayloads(), ...mockListings(), ...await examplePayloads()].filter((row) => !seen.has(row.id));
console.log('to post', queue.length, 'already', seen.size);
const posted = [];
for (const row of queue) {
  let attempt = await postOne(row);
  if (attempt.status === 429) {
    console.log('pause', row.id);
    await new Promise((resolve) => setTimeout(resolve, 65000));
    attempt = await postOne(row);
  }
  console.log(row.id, attempt.status, attempt.result.sequenceNumber || attempt.result.error || '');
  if (attempt.result?.ok) posted.push({ id: row.id, sequence: attempt.result.sequenceNumber, hashscan: attempt.result.hashscan });
  await new Promise((resolve) => setTimeout(resolve, 1200));
}
console.log(JSON.stringify(posted, null, 2));
