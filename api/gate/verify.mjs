import { applyGateCors } from '../../js/gate-core.mjs';
import { json } from '../lib/http.mjs';

export default function handler(req, res) {
  if (applyGateCors(req, res)) return;
  return json(res, 200, { ok: false, enabled: false, error: 'Email is disabled.' });
}
