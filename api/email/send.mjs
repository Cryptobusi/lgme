import { json } from '../lib/http.mjs';

export default function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, enabled: false, error: 'Use POST.' });
  return json(res, 200, { ok: false, enabled: false, error: 'Email is disabled.' });
}
