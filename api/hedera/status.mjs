import { hederaReadiness } from '../../js/hedera-anchor-core.mjs';
import { json, readEnv } from '../lib/http.mjs';

export default function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Use GET.' });
  const ready = hederaReadiness(readEnv());
  return json(res, ready.enabled ? 200 : 503, {
    ok: ready.enabled,
    enabled: ready.enabled,
    network: 'testnet',
    missing: ready.missing,
    wording: ready.wording
  });
}
