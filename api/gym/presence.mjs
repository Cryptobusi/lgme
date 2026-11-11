import { guardRequest, readBody, json, readEnv } from '../lib/http.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { gymChatReady } from '../../js/gym-sync.mjs';
import { acceptableInvite } from '../../js/device-sign.mjs';
import { allowRate, emptyGymKv, authorizeDevice } from '../../js/gym-kv.mjs';
import { contactKeys, publicEncouragement, publicPresence, visibleConnect, visibleMembers } from '../../js/health-presence.mjs';
import { publicDirect } from '../../js/health-contact.mjs';

const hits = new Map();

export default async function handler(req, res) {
  const state = gymChatReady(readEnv());
  if (!state.enabled) {
    return json(res, 503, { ok: false, enabled: false, shared: false, hedera: false, message: 'Status stays on this phone until sync is on.' });
  }
  const redis = redisRest(readEnv());
  const store = upstashStore(redis.url, redis.token);
  if (req.method === 'GET') {
    const url = new URL(req.url, 'https://lgme.app');
    const code = String(url.searchParams.get('code') || '').trim().toLowerCase();
    if (!acceptableInvite(code, { example: true })) return json(res, 400, { ok: false, error: 'That invite code is not usable.' });
    const presence = (await store.get(`gym:presence:${code}`)) || {};
    const encouragements = (await store.get(`gym:encourage:${code}`)) || [];
    const directs = (await store.get(`gym:direct:${code}`)) || [];
    return json(res, 200, {
      ok: true,
      enabled: true,
      shared: true,
      hedera: false,
      members: visibleMembers(Object.values(presence)),
      connects: visibleConnect(Object.values(presence)),
      contactKeys: contactKeys(Object.values(presence)),
      encouragements,
      directs
    });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET or POST.' });
  const ip = String(req.headers?.['x-forwarded-for'] || 'local').split(',')[0].trim();
  const paced = allowRate(hits, ip);
  if (!paced.ok) return json(res, 429, paced);
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  const book = emptyGymKv();
  book.members = (await store.get('gym:members')) || {};
  const auth = await authorizeDevice(book, body);
  if (!auth.ok) return json(res, auth.status || 401, auth);
  const code = String(auth.payload.code || '').trim().toLowerCase();
  if (!acceptableInvite(code, { example: true })) return json(res, 400, { ok: false, error: 'That invite code is not usable.' });
  await store.set('gym:members', book.members);
  if (auth.payload.action === 'presence') {
    const built = publicPresence({ ...auth.payload, handle: auth.handle });
    if (!built.ok) return json(res, 400, built);
    const prior = (await store.get(`gym:presence:${code}`)) || {};
    prior[auth.handle] = built.row;
    await store.set(`gym:presence:${code}`, prior);
    return json(res, 200, { ok: true, hedera: false, members: visibleMembers(Object.values(prior)), connects: visibleConnect(Object.values(prior)) });
  }
  if (auth.payload.action === 'direct') {
    const built = publicDirect(auth.payload, auth.handle);
    if (!built.ok) return json(res, 400, built);
    const prior = (await store.get(`gym:direct:${code}`)) || [];
    const next = [...prior.filter((row) => !(row.kind === built.row.kind && row.from === built.row.from && row.to === built.row.to)), built.row].slice(-80);
    await store.set(`gym:direct:${code}`, next);
    return json(res, 200, { ok: true, hedera: false, directs: next });
  }
  if (auth.payload.action === 'encouragement') {
    const built = publicEncouragement({ ...auth.payload, from: auth.handle });
    if (!built.ok) return json(res, 400, built);
    const prior = (await store.get(`gym:encourage:${code}`)) || [];
    const next = [...prior, built.row].slice(-40);
    await store.set(`gym:encourage:${code}`, next);
    return json(res, 200, { ok: true, hedera: false, encouragements: next });
  }
  return json(res, 400, { ok: false, error: 'That update is not available.' });
}
