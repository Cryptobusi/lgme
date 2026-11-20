export function upstashStore(url, token, fetchImpl = globalThis.fetch) {
  const endpoint = String(url || '').replace(/\/$/, '');
  async function command(args) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!response.ok) throw new Error('The code store did not answer.');
    const body = await response.json();
    return body.result;
  }
  return {
    async get(key) {
      const raw = await command(['GET', key]);
      if (raw == null || raw === '') return null;
      try { return JSON.parse(raw); } catch { return null; }
    },
    async set(key, value, ttlSec) {
      const payload = JSON.stringify(value);
      if (ttlSec > 0) await command(['SET', key, payload, 'EX', String(ttlSec)]);
      else await command(['SET', key, payload]);
    },
    async del(key) {
      await command(['DEL', key]);
    },
    async incr(key, ttlSec = 172800) {
      const count = Number(await command(['INCR', key])) || 0;
      if (count === 1) await command(['EXPIRE', key, String(ttlSec)]);
      return count;
    }
  };
}
