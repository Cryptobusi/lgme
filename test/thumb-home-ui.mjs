import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const pw = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
function fileFor(pathname) {
  let rel = decodeURIComponent(pathname.split('?')[0]);
  if (rel.endsWith('/')) rel = rel.slice(0, -1);
  if (!rel) rel = '/index.html';
  const full = join(root, rel);
  if (existsSync(full) && statSync(full).isDirectory()) return join(full, 'index.html');
  if (existsSync(full)) return full;
  if (existsSync(full + '.html')) return full + '.html';
  return '';
}
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/email/send' && req.method === 'POST') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === '/api/email/verify' && req.method === 'POST') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, emailHash: 'abc123hash' }));
    return;
  }
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); return; }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' });
await context.addInitScript(() => {
  localStorage.setItem('lgme.reset.epoch', '2');
  window.LanguageModel = { availability: async () => 'available', prompt: async () => 'A short line.' };
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => String(query).includes('display-mode') && String(query).includes('standalone')
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : original(query);
});
const failures = [];
const page = await context.newPage();
await page.goto(`${base}/?picker=1`, { waitUntil: 'domcontentloaded' });
await page.locator('#profile-board').waitFor();
await page.locator('#function-row').waitFor();
await page.locator('#ai-dock').waitFor();
const regions = await page.evaluate(() => {
  const profile = document.getElementById('profile-board').getBoundingClientRect();
  const row = document.getElementById('function-row').getBoundingClientRect();
  const dock = document.getElementById('ai-dock').getBoundingClientRect();
  const button = document.querySelector('#function-row a').getBoundingClientRect();
  const ratio = dock.height / window.innerHeight;
  document.getElementById('function-row').scrollIntoView({ block: 'end' });
  const rowAfter = document.getElementById('function-row').getBoundingClientRect();
  const dockAfter = document.getElementById('ai-dock').getBoundingClientRect();
  return { order: profile.top < row.top, clear: rowAfter.bottom <= dockAfter.top + 2, target: button.height >= 48, ratio };
});
if (!regions.order) failures.push('regions out of order');
if (!regions.clear) failures.push('function row overlaps the dock');
if (!regions.target) failures.push('tap target under 48');
const areas = await page.evaluate(() => ['#profile-board', '#function-row', '#ai-dock'].map((id) => {
  const style = getComputedStyle(document.querySelector(id));
  return { id, width: style.borderTopWidth, style: style.borderTopStyle, color: style.borderTopColor };
}));
for (const area of areas) {
  if (area.width !== '2px' || area.style !== 'solid') failures.push(`outline ${area.id} ${area.width} ${area.style}`);
}
if (await page.locator('#ai-head').count() && !(await page.locator('#ai-head').isVisible())) failures.push('AI notice hidden');
if (regions.ratio < 0.38 || regions.ratio > 0.42) failures.push(`dock height ${regions.ratio}`);
if (await page.locator('#functions-import').isVisible()) failures.push('choose file visible before open');
if ((await page.locator('#function-row a').first().innerText()) !== 'IdidIt (verified receipt)') failures.push('ididit label');
if (!/Step 1 of 3: email or authenticator/.test(await page.locator('#step-count').innerText())) failures.push('step count');
await page.route('**/api/email/send', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: '{"ok":false,"error":"Nothing was sent."}' }));
await page.locator('#access-email').fill('ada@example.com');
await page.locator('#access-send').click();
await page.waitForFunction(() => document.getElementById('access-status')?.className === 'is-error' && /Nothing was sent/.test(document.getElementById('access-status').textContent));
await page.unroute('**/api/email/send');
if (await page.locator('#step-ai').isVisible()) failures.push('ai step shown too early');
const emailBox = await page.locator('#access-email').boundingBox();
if (!emailBox || emailBox.width < 280 || emailBox.height < 48) failures.push('email field cut off');
let releaseSend;
const sendHung = new Promise((resolve) => { releaseSend = resolve; });
await page.route('**/api/email/send', async (route) => { await sendHung; await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
await page.locator('#access-email').fill('ada@example.com');
await page.locator('#access-send').click();
if (!(await page.locator('#access-send').isDisabled())) failures.push('send stayed enabled');
if ((await page.locator('#access-send').innerText()) !== 'Sending…') failures.push('no sending label');
releaseSend();
await page.waitForFunction(() => /Code sent to a…@example.com/.test(document.getElementById('access-status')?.textContent || ''));
await page.unroute('**/api/email/send');
await page.locator('#access-code').fill('123456');
await page.locator('#access-verify').click();
await page.waitForFunction(() => /Member ID/.test(document.getElementById('access-member')?.textContent || ''));
await page.locator('#ai-test').click();
const ai = await page.locator('#ai-test-result').innerText();
if (!/AI on|AI off/.test(ai) || !/Typing still works/.test(ai)) failures.push(`ai test ${ai}`);
await page.locator('#access-grant').click();
if ((await page.evaluate(() => localStorage.getItem('lgme.access'))) !== 'full') failures.push('access not granted');
await page.locator('#function-row a[data-sensitive]').click();
await page.locator('#gate-passkey').click();
await page.waitForFunction(() => /fingerprint/i.test(document.getElementById('gate-status')?.textContent || ''));
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('thumb home ok');
