import { emailReadiness } from '../../js/email-check-core.mjs';
import { json, readEnv } from '../lib/http.mjs';

export default function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Use GET.' });
  const ready = emailReadiness(readEnv());
  return json(res, ready.enabled ? 200 : 503, {
    ok: ready.enabled,
    enabled: ready.enabled,
    waiting: ready.enabled ? '' : 'Email sign-in is coming. Nothing is sent until that step is connected.'
  });
}
