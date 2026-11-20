export const TEST_QUESTION = 'What is Creo in one short sentence?';

export function deviceId(storage) {
  try {
    let id = storage.getItem('lgme.device.key');
    if (!id) {
      id = `d${Math.random().toString(36).slice(2, 12)}`;
      storage.setItem('lgme.device.key', id);
    }
    return String(id).slice(0, 64);
  } catch {
    return 'local';
  }
}

export async function askServer(question, page, { fetchImpl, storage } = {}) {
  const send = fetchImpl || globalThis.fetch;
  const box = storage || globalThis.localStorage;
  try {
    const response = await send('/api/ai/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, page, device: deviceId(box) })
    });
    const body = await response.json();
    if (body?.ok && String(body.text || '').trim()) {
      return { ok: true, text: String(body.text).trim(), label: body.label || 'online', model: body.model || '' };
    }
    return { ok: false, reason: body?.reason || 'The online guide did not answer.' };
  } catch {
    return { ok: false, reason: 'The online guide did not answer.' };
  }
}

export function testLine(result, now = new Date()) {
  if (result?.ok && result.label) {
    const when = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit'
    }).format(now);
    return `AI test passed · ${result.label} · ${when} ET`;
  }
  return `AI test failed · using built-in guide · ${result?.reason || 'no reply'}`;
}

export function sourceChip(kind, label) {
  if (kind === 'device') return 'AI on · on-device';
  if (kind === 'online') return `AI on · ${label || 'online'}`;
  return 'AI on · built-in guide';
}

export function shouldSelfTest(storage, host) {
  const live = /(^|\.)lgme\.app$/.test(host) || host.endsWith('.vercel.app');
  if (!live) return false;
  try { return storage.getItem('lgme.ai.test') !== '1'; } catch { return false; }
}
