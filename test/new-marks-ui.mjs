import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const pw = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
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
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, seen: {} })); return; }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const failures = [];
await page.goto(`${base}/gym`, { waitUntil: 'domcontentloaded' });
const want = page.getByRole('button', { name: /IwantIT, \d|IwantIT, 9\+/ });
await want.waitFor();
const before = await want.getAttribute('aria-label');
if (!/IwantIT, \d new|IwantIT, 9\+ new/.test(before)) failures.push(before || 'no new label');
const height = await want.evaluate((node) => node.getBoundingClientRect().height);
await want.click();
const after = await page.locator('#category-board .category-actions button', { hasText: 'IwantIT' }).getAttribute('aria-label');
if (/new/.test(after || '')) failures.push(`count stayed ${after}`);
const heightAfter = await page.locator('#category-board .category-actions button', { hasText: 'IwantIT' }).evaluate((node) => node.getBoundingClientRect().height);
if (Math.abs(heightAfter - height) > 2) failures.push('badge shifted the button');
await page.reload({ waitUntil: 'domcontentloaded' });
const kept = await page.locator('#category-board .category-actions button', { hasText: 'IwantIT' }).getAttribute('aria-label');
if (/new/.test(kept || '')) failures.push('count returned after reload');
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.locator('[data-entry="health"] .new-badge').waitFor();
const tile = await page.locator('[data-entry="health"]').getAttribute('aria-label');
if (!/new/.test(tile || '')) failures.push(`tile ${tile}`);
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('new marks ok');
