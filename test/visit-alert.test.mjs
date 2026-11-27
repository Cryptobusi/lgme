import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deviceLine, maskIp, planVisit, sendVisit, SEEN_COOKIE } from '../js/visit-alert.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');
const html = (path, extra = {}) => ({
  method: 'GET',
  url: `https://lgme.app${path}`,
  headers: new Headers({
    accept: 'text/html',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'accept-language': 'en-US',
    referer: 'https://example.test/from',
    'x-forwarded-for': '203.0.113.45',
    'x-vercel-ip-city': 'New%20York',
    'x-vercel-ip-country-region': 'NY',
    'x-vercel-ip-country': 'US',
    ...extra
  })
});

test('a masked address drops the last IPv4 octet and keeps three IPv6 groups', () => {
  assert.equal(maskIp('203.0.113.45'), '203.0.113.0');
  assert.equal(maskIp('2001:db8:85a3:0:0:8a2e:370:7334'), '2001:db8:85a3::');
  assert.equal(maskIp('::ffff:192.0.2.15'), '192.0.2.0');
  assert.equal(maskIp(''), '');
});

test('the device line names a phone and a browser', () => {
  assert.equal(deviceLine('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'), 'iPhone · Safari');
  assert.equal(deviceLine('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'), 'Android · Chrome');
});

test('a page view does not send mail', () => {
  const env = { VERCEL_ENV: 'production' };
  const sent = planVisit(html('/workflow?from=desk'), env, new Date('2026-11-18T15:00:00Z'));
  assert.equal(sent.send, false);
  assert.equal(planVisit(html('/privacy?va_test=1'), { VERCEL_ENV: 'preview' }).send, false);
});

test('bots, assets, APIs, prefetch, HEAD, and a seen cookie do not send', () => {
  const env = { RESEND_API_KEY: 'present', VERCEL_ENV: 'production' };
  assert.equal(planVisit(html('/workflow', { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }), env).send, false);
  assert.equal(planVisit(html('/workflow', { 'user-agent': 'GPTBot/1.2' }), env).send, false);
  assert.equal(planVisit(html('/workflow', { 'user-agent': 'curl/8.0' }), env).send, false);
  assert.equal(planVisit(html('/workflow', { 'user-agent': 'python-requests/2.31' }), env).send, false);
  assert.equal(planVisit(html('/app.js'), env).send, false);
  assert.equal(planVisit(html('/api/health'), env).send, false);
  assert.equal(planVisit({ ...html('/workflow'), method: 'HEAD' }, env).send, false);
  assert.equal(planVisit(html('/workflow', { purpose: 'prefetch' }), env).send, false);
  assert.equal(planVisit(html('/workflow', { accept: 'image/avif' }), env).send, false);
  assert.equal(planVisit(html('/workflow', { cookie: 'va_seen=1' }), env).send, false);
});

test('a visit note is not mailed', async () => {
  let called = false;
  const skipped = await sendVisit({ path: '/privacy', text: 'Site: lgme.app' }, {}, async () => { called = true; return { ok: true }; });
  assert.equal(called, false);
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.id, '');
  assert.equal(text('js/visit-alert.mjs').includes('api.resend.com'), false);
});

test('the privacy page, footer, sitemap, and notice leave the exchange alone', () => {
  const page = text('privacy.html');
  const notice = text('js/visit-notice.js');
  const middleware = text('middleware.js');
  const alert = text('js/visit-alert.mjs');
  assert.equal(page.includes('<title>Privacy · lgme</title>'), true);
  assert.equal(page.includes('https://lgme.app/privacy'), true);
  assert.match(page, /owner's inbox until the owner deletes it/);
  assert.match(page, /does not sell that note/);
  assert.match(page, /does not share it/);
  assert.match(page, /does not use it for ads/);
  assert.match(page, / wallet checks and the Exchange keep the data practices they already have/);
  assert.equal(page.includes('arbiter who can veto'), false);
  assert.equal(text('sitemap.xml').includes('https://lgme.app/privacy'), true);
  assert.equal(text('index.html').includes('href="/privacy">Privacy</a>'), true);
  assert.equal(text('js/site-nav.js').includes('/js/visit-notice.js'), true);
  assert.match(notice, /lgme\.visit\.notice/);
  assert.match(notice, /pointer-events:none/);
  assert.match(notice, /exchange\|campus\|mutual-credit/);
  assert.match(middleware, /waitUntil/);
  assert.match(middleware, /@vercel\/functions/);
  assert.equal(/console\./.test(middleware), false);
  assert.equal(/console\./.test(alert), false);
  assert.equal(text('exchange.html').includes('visit-notice'), false);
  assert.equal(text('js/solana-pay.mjs').includes('visit-alert'), false);
  assert.equal(text('campus.html').includes('visit-notice'), false);
  assert.equal(text('mutual-credit.html').includes('visit-notice'), false);
  assert.equal(text('js/ui-view.js').includes('visit-notice'), false);
  assert.equal(text('js/ui-view.js').includes("classic: '/'"), true);
  const untouched = createHash('sha256').update(readFileSync(join(root, 'exchange.html'))).digest('hex');
  assert.equal(typeof untouched, 'string');
});
