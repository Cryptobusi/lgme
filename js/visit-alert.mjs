const ASSET = /\.(?:js|mjs|css|map|json|webmanifest|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|txt|xml|pdf|mp3|mp4|webm|wasm|gz|br|zip)$/i;
const ASSET_DIR = /^\/(?:api|js|css|icons|images|docs|fonts|data|assets|_next)(?:\/|$)/;
export const BOT_UA = /bot|crawl|spider|slurp|preview|monitor|headless|curl|wget|python|gptbot|chatgpt|claude|anthropic|perplexity|bytespider|ccbot|amazonbot|meta-externalagent|cohere-ai|diffbot|omgili|google-extended|applebot|semrush|ahrefs|scrapy|facebookexternalhit/i;
export const SEEN_COOKIE = 'va_seen=1; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/';
const FROM = 'Site Visits <onboarding@resend.dev>';
const TO = 'egonomist@mail.grokbot.com';

export function visitFrom(env = {}) {
  const configured = String(env.EMAIL_FROM || '').trim();
  const email = (configured.match(/<([^>]+)>/) || [, configured])[1].trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/resend\.dev$/i.test(email)) return `Site Visits <${email}>`;
  return FROM;
}

function header(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  const found = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return found ? String(headers[found] || '') : '';
}

function oneLine(value, max) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

export function maskIp(ip) {
  const raw = oneLine(ip, 80);
  if (!raw) return '';
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(raw)) {
    const parts = raw.split('.');
    parts[3] = '0';
    return parts.join('.');
  }
  if (raw.includes(':')) {
    const embedded = raw.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (embedded) return maskIp(embedded[1]);
    const halves = raw.split('::');
    const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
    const right = halves.length > 1 && halves[1] ? halves[1].split(':').filter(Boolean) : [];
    const missing = halves.length > 1 ? Math.max(8 - left.length - right.length, 0) : 0;
    const groups = [...left, ...Array(missing).fill('0'), ...right].slice(0, 3);
    return groups.length ? `${groups.join(':')}::` : '';
  }
  return '';
}

export function deviceLine(ua) {
  const agent = String(ua || '');
  let device = 'Unknown device';
  if (/iPhone/.test(agent)) device = 'iPhone';
  else if (/iPad/.test(agent)) device = 'iPad';
  else if (/Android/.test(agent)) device = 'Android';
  else if (/Mac OS X/.test(agent)) device = 'Mac';
  else if (/Windows/.test(agent)) device = 'Windows';
  else if (/CrOS/.test(agent)) device = 'ChromeOS';
  else if (/Linux/.test(agent)) device = 'Linux';
  let browser = 'Unknown browser';
  if (/Edg\//.test(agent) || /EdgiOS\//.test(agent)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(agent)) browser = 'Opera';
  else if (/CriOS\/|Chrome\//.test(agent)) browser = 'Chrome';
  else if (/FxiOS\/|Firefox\//.test(agent)) browser = 'Firefox';
  else if (/Safari\//.test(agent)) browser = 'Safari';
  return `${device} · ${browser}`;
}

function clock(now) {
  const when = now instanceof Date ? now : new Date(now);
  const format = (timeZone) => new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'long'
  }).format(when);
  return { ny: format('America/New_York'), utc: format('UTC') };
}

function seen(cookie) {
  return /(?:^|;\s*)va_seen=/.test(String(cookie || ''));
}

function prefetch(headers) {
  const purpose = `${header(headers, 'purpose')} ${header(headers, 'sec-purpose')} ${header(headers, 'x-purpose')} ${header(headers, 'next-router-prefetch')} ${header(headers, 'x-middleware-prefetch')}`;
  return /prefetch/i.test(purpose);
}

export function planVisit(request, env = {}, now = new Date()) {
  const url = new URL(request.url);
  const headers = request.headers;
  const method = String(request.method || 'GET').toUpperCase();
  const accept = header(headers, 'accept');
  const agent = header(headers, 'user-agent');
  const path = `${url.pathname}${url.search}`;
  if (method !== 'GET') return { send: false };
  if (prefetch(headers)) return { send: false };
  if (ASSET_DIR.test(url.pathname) || ASSET.test(url.pathname)) return { send: false };
  if (!accept.toLowerCase().includes('text/html')) return { send: false };
  if (BOT_UA.test(agent)) return { send: false };
  if (seen(header(headers, 'cookie'))) return { send: false };
  const key = env.RESEND_API_KEY || '';
  if (!key) return { send: false };
  const production = env.VERCEL_ENV === 'production';
  const previewTest = env.VERCEL_ENV === 'preview' && url.searchParams.get('va_test') === '1';
  if (!production && !previewTest) return { send: false };
  const times = clock(now);
  const ip = maskIp(header(headers, 'x-forwarded-for').split(',')[0] || header(headers, 'x-real-ip'));
  const city = (() => {
    try { return decodeURIComponent(header(headers, 'x-vercel-ip-city').replace(/\+/g, ' ')); }
    catch { return header(headers, 'x-vercel-ip-city'); }
  })();
  const place = [city, header(headers, 'x-vercel-ip-country-region'), header(headers, 'x-vercel-ip-country')].map((part) => oneLine(part, 80)).filter(Boolean).join(', ') || 'unknown';
  const page = oneLine(url.pathname || '/', 120) || '/';
  const text = [
    'Site: lgme.app',
    `Time (New York): ${times.ny}`,
    `Time (UTC): ${times.utc}`,
    `Path: ${oneLine(path, 500) || '/'}`,
    `Referrer: ${oneLine(header(headers, 'referer'), 300) || 'none'}`,
    `Place: ${place}`,
    `IP (masked): ${ip || 'unknown'}`,
    `User-Agent: ${oneLine(agent, 400) || 'none'}`,
    `Device: ${deviceLine(agent)}`,
    `Language: ${oneLine(header(headers, 'accept-language'), 120) || 'none'}`
  ].join('\n');
  return {
    send: true,
    cookie: SEEN_COOKIE,
    revealId: previewTest,
    payload: { path: page, text }
  };
}

export async function sendVisit(payload, env = {}, fetchImpl = fetch) {
  const key = env.RESEND_API_KEY || '';
  if (!key || !payload?.text) return { ok: false, skipped: true, id: '' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: visitFrom(env),
        to: [TO],
        subject: `[lgme.app] Visit: ${payload.path}`,
        text: payload.text
      })
    });
    const body = await response.json().catch(() => ({}));
    return {
      ok: response.ok === true,
      id: typeof body.id === 'string' ? body.id : '',
      status: response.status,
      error: typeof body.name === 'string' ? body.name.slice(0, 40) : '',
      skipped: false
    };
  } catch {
    return { ok: false, id: '', skipped: false };
  } finally {
    clearTimeout(timer);
  }
}
