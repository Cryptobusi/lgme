import { guardRequest, readBody, json, readEnv } from '../lib/http.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { gymChatReady } from '../../js/gym-sync.mjs';
import { allowRate } from '../../js/gym-kv.mjs';
import { VIEW_ONLY_MESSAGE } from '../../js/view-only-api.mjs';
import { ALLOWED_ACTIONS, publicRepairFeed, repairWrite } from '../../js/repair-follow.mjs';

const hits = new Map();
const KEY = 'exchange:repair';

export default async function handler(req, res) {
  const state = gymChatReady(readEnv());
  if (!state.enabled) {
    return json(res, 503, { ok: false, enabled: false, viewOnly: true, hedera: false, offer: publicRepairFeed({ repairs: [] }).offer, items: [], message: 'Repair follow-through stays on this phone until sync is on.' });
  }
  const redis = redisRest(readEnv());
  const store = upstashStore(redis.url, redis.token);
  const book = (await store.get(KEY)) || { members: {}, repairs: [], highValue: [] };
  if (req.method === 'GET') return json(res, 200, publicRepairFeed(book));
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET or POST.' });
  const action = String((await peekAction(req)) || '');
  if (guardRequest(req, res)) return;
  if (!ALLOWED_ACTIONS.has(action)) return json(res, 403, { ok: false, viewOnly: true, error: VIEW_ONLY_MESSAGE });
  const ip = String(req.headers?.['x-forwarded-for'] || 'local').split(',')[0].trim();
  const paced = allowRate(hits, ip);
  if (!paced.ok) return json(res, 429, paced);
  const body = req._lgmeBody || await readBody(req);
  const result = await repairWrite(book, body);
  if (!result.ok) return json(res, result.status || 400, result);
  await store.set(KEY, { members: book.members, repairs: book.repairs, highValue: book.highValue || [] });
  return json(res, 200, { ...publicRepairFeed(book), ok: true, item: result.item, sent: false, pending: result.pending === true, recorded: result.recorded === true });
}

async function peekAction(req) {
  const body = await readBody(req);
  req._lgmeBody = body;
  return body?.payload?.action;
}
