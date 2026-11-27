export const MODEL_ID = 'google/gemini-2.5-flash-lite';
export const MODEL_LABEL = 'Gemini 2.5 Flash Lite';
export const DEVICE_CAP = 30;
export const GLOBAL_CAP = 400;
export const MAX_OUTPUT_TOKENS = 300;

const MEDICAL = /\b(diagnos\w*|prescription|treatment|cure)\b/i;

export const SYSTEM_PROMPT = [
  'You are the lgme.app guide.',
  'Use plain language, in a few short sentences.',
  'You only explain, suggest, or draft.',
  'You never save, post, pay, or send. The person must tap OK.',
  'No medical claims, no rankings, no streaks, and no urgency.',
  'Creo is value you create. Debit means you owe. Credit means you lend.',
  ' is temporary until the DAO and is not Creo.',
  'Only Health is live, and it stays on testnet. Other categories are In development.'
].join(' ');

export function dayStamp(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function deviceBucket(device) {
  const clean = String(device || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return clean || 'shared';
}

export function quotaDecision(deviceCount, globalCount) {
  if (Number(globalCount) > GLOBAL_CAP) return { ok: false, reason: 'The daily guide limit is reached. The built-in guide still answers.' };
  if (Number(deviceCount) > DEVICE_CAP) return { ok: false, reason: 'This phone has used the daily guide. The built-in guide still answers.' };
  return { ok: true, reason: '' };
}

export function safeAnswer(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (MEDICAL.test(clean)) return 'I cannot give medical advice. I can explain how this page works. Nothing is saved until you tap OK.';
  return clean.slice(0, 1200);
}

export function memoryCounter() {
  const bag = new Map();
  return {
    async incr(key) {
      const next = (bag.get(key) || 0) + 1;
      bag.set(key, next);
      return next;
    }
  };
}

export async function answerAsk({ question, page, device, store, now = new Date(), complete }) {
  const asked = String(question || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!asked) return { status: 400, body: { ok: false, fallback: true, reason: 'Ask a question first.' } };
  const day = dayStamp(now);
  const bucket = deviceBucket(device);
  const globalKey = `lgme:ai:global:${day}`;
  const deviceKey = `lgme:ai:device:${bucket}:${day}`;
  let globalCount = 0;
  let deviceCount = 0;
  try {
    globalCount = await store.incr(globalKey);
    deviceCount = await store.incr(deviceKey);
  } catch {
    return { status: 200, body: { ok: false, fallback: true, reason: 'The guide count is not available. The built-in guide still answers.' } };
  }
  const quota = quotaDecision(deviceCount, globalCount);
  if (!quota.ok) return { status: 200, body: { ok: false, fallback: true, reason: quota.reason } };
  const context = String(page || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  try {
    const result = await complete({
      system: SYSTEM_PROMPT,
      prompt: `Page: ${context || 'This page.'}\nQuestion: ${asked}`
    });
    const text = safeAnswer(result?.text);
    if (!text) return { status: 200, body: { ok: false, fallback: true, reason: 'The online guide returned an empty reply.' } };
    return {
      status: 200,
      body: {
        ok: true,
        text,
        model: MODEL_ID,
        provider: 'google',
        label: MODEL_LABEL
      }
    };
  } catch {
    return { status: 200, body: { ok: false, fallback: true, reason: 'The online guide did not answer.' } };
  }
}
