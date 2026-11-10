import { json, readEnv } from '../lib/http.mjs';
import { LEGACY_TOPIC, readableTopic } from '../../js/hedera-topic.mjs';

const TOPIC = LEGACY_TOPIC;
const hits = new Map();

function allowed(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 60000);
  if (recent.length >= 60) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Use GET.' });
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
  if (!allowed(ip)) return json(res, 429, { ok: false, error: 'Too many report checks from this network. Try again in a minute.' });
  const url = new URL(req.url || '/', 'https://lgme.app');
  const topic = url.searchParams.get('topic') || TOPIC;
  if (!readableTopic(topic, readEnv())) return json(res, 400, { ok: false, error: 'Only the legacy testnet topic 0.0.11397291, or HEDERA_TESTNET_TOPIC_ID, can be read.' });
  const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${topic}/messages?limit=20&order=desc`);
  if (!response.ok) return json(res, 502, { ok: false, error: 'The testnet mirror did not answer.', topic });
  const body = await response.json();
  const messages = (body.messages || []).map((message) => {
    let contents = '';
    try { contents = Buffer.from(message.message || '', 'base64').toString('utf8'); } catch { contents = ''; }
    let root = '';
    try { root = JSON.parse(contents).root || ''; } catch { root = ''; }
    return {
      sequence: message.sequence_number,
      consensus: message.consensus_timestamp,
      root,
      contents
    };
  });
  return json(res, 200, { ok: true, network: 'testnet', topic, messages });
}
