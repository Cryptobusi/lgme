const ciLimit = setTimeout(() => { console.error('ui test exceeded 8 minutes'); process.exit(1); }, 8 * 60 * 1000);
ciLimit.unref();
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
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, proposals: [], offers: [] })); return; }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.addInitScript(() => {
  localStorage.setItem('lgme.ai.enabled', '0');
  localStorage.setItem('lgme.reset.epoch', '2');
});
const page = await context.newPage();
const failures = [];
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.locator('#ai-path-line').waitFor();
const row = await page.evaluate(() => {
  const path = document.getElementById('ai-path');
  const buttons = [...path.querySelectorAll('button')].map((button) => button.textContent);
  const box = path.getBoundingClientRect();
  const reset = document.getElementById('ai-path-reset').getBoundingClientRect();
  const next = document.getElementById('ai-path-skip').getBoundingClientRect();
  const line = document.getElementById('ai-path-line').getBoundingClientRect();
  const actions = getComputedStyle(document.getElementById('ai-path-actions'));
  return { buttons, reset: reset.left, next: next.left, nextRight: next.right, edge: box.right, line: line.left, margin: actions.marginLeft };
});
if (row.buttons.join('|') !== 'Reset|Next step') failures.push(`order ${row.buttons.join('|')}`);
if (!(row.line < row.reset && row.reset < row.next)) failures.push(`placement ${JSON.stringify(row)}`);
if (row.edge - row.nextRight > 12) failures.push(`not at the right edge ${JSON.stringify(row)}`);
await page.goto(`${base}/gym#/ididit`, { waitUntil: 'domcontentloaded' });
await page.locator('#gym-ididit-activity').click();
const stub = await page.evaluate(() => {
  const view = { height: Math.round(window.innerHeight * 0.5), offsetTop: 0, width: window.innerWidth, addEventListener() {}, removeEventListener() {} };
  try { Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => view }); }
  catch (error) { return error.message; }
  window.dispatchEvent(new Event('resize'));
  return 'ok';
});
if (stub !== 'ok') failures.push(`viewport ${stub}`);
await page.locator('#ai-prefill').waitFor();
if (await page.locator('#ai-scroll').isVisible()) failures.push('AI display stayed open over the form');
if (!(await page.locator('#ai-prefill').isVisible())) failures.push('prefill bar hidden');
const chip = page.locator('#ai-prefill-row button').first();
const label = await chip.innerText();
await chip.click();
if ((await page.locator('#gym-ididit-activity').inputValue()) !== label) failures.push(`prefill ${label}`);
const nextId = await page.evaluate(() => document.activeElement && document.activeElement.id);
if (nextId === 'gym-ididit-activity') failures.push('focus stayed on the filled field');
if (/Recorded on testnet/.test(await page.locator('#ididit-status').innerText())) failures.push('prefill saved without OK');
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('keyboard prefill ok');
