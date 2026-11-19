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
await page.locator('#ai-intents').waitFor();
const labels = await page.locator('#ai-intents [role="tab"]').allTextContents();
if (labels.join('|') !== 'Direct|Excite|Review|Inform|Use') failures.push(`tabs ${labels.join('|')}`);
await page.locator('#intent-inform').click();
if ((await page.evaluate(() => localStorage.getItem('lgme.ask.tab'))) !== 'inform') failures.push('tab not remembered');
await page.locator('#ai-ask').fill('Log a workout');
await page.locator('#ai-send').click();
await page.locator('#ididit-done').waitFor();
await page.waitForFunction(() => /session|workout/i.test(document.getElementById('gym-ididit-other')?.value || ''));
await page.waitForFunction(() => {
  const active = document.activeElement;
  return active && active.required && !String(active.value || '').trim();
});
if (/Recorded on testnet/.test(await page.locator('#ididit-status').innerText())) failures.push('workout saved without OK');
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.locator('#ai-ask').fill('I want a lamp');
await page.locator('#ai-send').click();
await page.locator('#evolve-line').waitFor();
await page.waitForFunction(() => document.activeElement?.id === 'evolve-line');
if (!/lamp/i.test(await page.locator('#evolve-name').inputValue())) failures.push('listing was not prefilled');
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('ask intent ok');
