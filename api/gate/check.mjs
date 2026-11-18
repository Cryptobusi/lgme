import { applyGateCors, readGateToken } from '../../js/gate-core.mjs';
import { json, readEnv } from '../lib/http.mjs';

export default async function handler(req, res) {
  if (applyGateCors(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Use GET.' });
  const env = readEnv();
  const url = new URL(req.url || '/', 'http://localhost');
  const secret = env.EMAIL_CODE_PEPPER || '';
  const checked = secret ? await readGateToken(url.searchParams.get('token') || '', secret) : { ok: false };
  return json(res, 200, { ok: checked.ok === true });
}
