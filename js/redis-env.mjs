export function redisRest(env = {}) {
  const url = String(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || '').trim();
  const token = String(env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || '').trim();
  const missing = [];
  if (!url) missing.push('KV_REST_API_URL');
  if (!token) missing.push('KV_REST_API_TOKEN');
  return { url, token, configured: missing.length === 0, missing };
}
