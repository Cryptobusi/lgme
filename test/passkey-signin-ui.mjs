import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { passkeyRequest } from '../js/webauthn-passkey.mjs';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const pw = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' };
const store = { bag: new Map(), async get(k) { return this.bag.has(k) ? this.bag.get(k) : null; }, async set(k, v) { this.bag.set(k, v); } };
function fileFor(pathname) {
  let rel = decodeURIComponent(pathname.split('?')[0]);
  if (rel.endsWith('/')) rel = rel.slice(0, -1);
  if (rel === '') rel = '/index.html';
  const full = join(root, rel);
  if (existsSync(full) && statSync(full).isDirectory()) return join(full, 'index.html');
  if (existsSync(full)) return full;
  if (existsSync(full + '.html')) return full + '.html';
  return '';
}
function readBody(req) {
  return new Promise((resolve) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); });
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/webauthn' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}');
    const result = await passkeyRequest({ store, action: body.action, body, host: req.headers.host });
    const saved = [...store.bag.values()].some((row) => row && row.publicKey && /biometric|fingerprint|template/i.test(JSON.stringify(row)));
    res.writeHead(saved ? 500 : result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(saved ? { ok: false, error: 'biometric stored' } : result.body));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, enabled: false, network: 'testnet' }));
    return;
  }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://localhost:${server.address().port}`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' });
await context.addInitScript(() => {
  localStorage.setItem('lgme.reset.epoch', '2');
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => String(query).includes('display-mode') && String(query).includes('standalone')
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : original(query);
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('WebAuthn.enable');
await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
const failures = [];
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'IdidIt (verified receipt)', exact: true }).click();
await page.locator('#demo-phone').click();
await page.locator('#passkey-offer').waitFor();
await page.locator('#passkey-offer').click();
await page.waitForFunction(() => /Fingerprint saved/.test(document.getElementById('passkey-offer')?.textContent || ''));
await page.evaluate(() => { localStorage.removeItem('lgme.demo.member'); localStorage.removeItem('lgme.health.email'); });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'IdidIt (verified receipt)', exact: true }).click();
await page.locator('#passkey-unlock-signin').click();
await page.waitForFunction(() => !!localStorage.getItem('lgme.demo.member'));
if (await page.locator('#demo-email').count()) failures.push('email asked after fingerprint');
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('passkey sign-in ok');
