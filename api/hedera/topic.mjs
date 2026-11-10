import { json } from '../lib/http.mjs';
import { VIEW_ONLY_MESSAGE } from '../../js/view-only-api.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  return json(res, 403, { ok: false, viewOnly: true, error: VIEW_ONLY_MESSAGE });
}
