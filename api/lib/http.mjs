export function readEnv(source = process.env) {
  return source || {};
}

import { originAllowed, parseStrictJson } from '../../js/input-schema.mjs';

export function json(res, status, body) {
  const safe = body && typeof body === 'object' ? { ...body } : { ok: false };
  delete safe.stack;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(safe));
}

export async function readBody(req) {
  if (Object.prototype.hasOwnProperty.call(req, '_lgmeBody')) return req._lgmeBody;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) {
    req._lgmeBody = {};
    return {};
  }
  const parsed = parseStrictJson(Buffer.concat(chunks).toString('utf8'));
  if (!parsed.ok) {
    req._lgmeJsonError = parsed.error;
    req._lgmeBody = null;
    return null;
  }
  req._lgmeBody = parsed.body && typeof parsed.body === 'object' ? parsed.body : {};
  return req._lgmeBody;
}

export function guardRequest(req, res) {
  const origin = req.headers?.origin || '';
  if (origin && !originAllowed(origin)) {
    json(res, 403, { ok: false, error: 'That origin is not allowed.' });
    return true;
  }
  if (req._lgmeJsonError) {
    json(res, 400, { ok: false, error: req._lgmeJsonError });
    return true;
  }
  return false;
}

export function headerMap(req) {
  return req.headers || {};
}
