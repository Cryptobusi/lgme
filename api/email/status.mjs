import { json } from '../lib/http.mjs';

export default function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, enabled: false, error: 'Use GET.' });
  return json(res, 200, { ok: true, enabled: false, error: 'Email is disabled.' });
}
