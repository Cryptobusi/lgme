import { publicStatus } from '../../js/public-listings.mjs';

function send(res, status, body) {
  const payload = JSON.stringify(body);
  if (res && typeof res.status === 'function' && typeof res.json === 'function') return res.status(status).json(body);
  if (res && typeof res.end === 'function') {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(payload);
    return;
  }
  return new Response(payload, { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export default function handler(req, res) {
  if ((req?.method || 'GET') !== 'GET') return send(res, 405, { ok: false, error: 'GET only.' });
  return send(res, 200, publicStatus(process.env));
}
