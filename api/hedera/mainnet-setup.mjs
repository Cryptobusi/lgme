import { json, readEnv } from '../lib/http.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { adminTokenOk, runHealthMainnetSetup } from '../../js/mainnet-health-setup.mjs';

const memory = {
  bag: new Map(),
  async get(key) { return this.bag.has(key) ? this.bag.get(key) : null; },
  async set(key, value) { this.bag.set(key, value); }
};

function publicBody(result) {
  return {
    ok: result.ok === true,
    created: result.created === true,
    already: result.already === true,
    topicId: result.topicId || '',
    transactionId: result.transactionId || '',
    sequenceNumber: result.sequenceNumber || '',
    hbarSpent: result.hbarSpent ?? 0,
    capHbar: result.capHbar ?? 1,
    root: result.root || '',
    hashscan: result.hashscan || '',
    mirror: result.mirror || '',
    hederaStatus: result.hederaStatus || '',
    error: result.error || ''
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const env = readEnv();
  if (!adminTokenOk(req.headers?.['x-lgme-admin'], env)) {
    return json(res, 401, { ok: false, error: 'The owner inbox needs the admin token.' });
  }
  const redis = redisRest(env);
  const store = redis.configured ? upstashStore(redis.url, redis.token) : memory;
  try {
    const result = await runHealthMainnetSetup(env, { store });
    return json(res, result.status || (result.ok ? 200 : 400), publicBody(result));
  } catch (error) {
    return json(res, 502, { ok: false, hederaStatus: error?.hederaStatus || error?.status?.toString?.() || '', error: error?.public ? error.message : 'The mainnet setup did not finish.' });
  }
}
