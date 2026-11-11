import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const pw = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
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
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, network: 'testnet', seen: {} })); return; }
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
  localStorage.setItem('lgme.ai.enabled', '0');
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => String(query).includes('display-mode') && String(query).includes('standalone')
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : original(query);
});
const failures = [];
const page = await context.newPage();
await page.goto(`${base}/gym`, { waitUntil: 'domcontentloaded' });
await page.locator('#ai-ask').waitFor();
await page.locator('#ai-ask').fill('log a workout');
await page.locator('#ai-ask').press('Enter');
await page.locator('#gym-ididit-other').waitFor();
if ((await page.locator('#gym-ididit-other').inputValue()) !== 'I did the session') failures.push('enter did not open the draft');
if (!/Opened the IdidIt draft/.test(await page.locator('#ai-log').innerText())) failures.push('enter result missing');
await page.locator('#ai-ask').fill('I want a ride');
await page.locator('#ai-send').click();
await page.locator('#prompt-draft').waitFor();
if (!/a ride/.test(await page.locator('#prompt-draft').innerText())) failures.push('send did not open IwantIT');
await page.evaluate(() => {
  const scroller = document.getElementById('ai-scroll');
  const extra = document.createElement('p');
  extra.textContent = 'Extra line so the dock overflows. '.repeat(20);
  scroller.append(extra);
  scroller.dispatchEvent(new Event('scroll'));
});
if (await page.locator('#ai-more').isHidden()) failures.push('more indicator missing');
const before = await page.locator('#ai-dock').evaluate((node) => node.getBoundingClientRect().height);
await page.locator('#ai-larger').click();
await page.reload({ waitUntil: 'domcontentloaded' });
const size = await page.evaluate(() => localStorage.getItem('lgme.dock.size'));
if (size !== 'tall') failures.push(`size not remembered ${size}`);
const after = await page.locator('#ai-dock').evaluate((node) => node.getBoundingClientRect().height);
if (!(after > before - 5)) failures.push(`resize ${before} to ${after}`);
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('dock prompt ok');
