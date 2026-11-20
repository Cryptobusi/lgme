const ciLimit = setTimeout(() => { console.error('ui test exceeded 8 minutes'); process.exit(1); }, 8 * 60 * 1000);
ciLimit.unref();
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const pw = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
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
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); return; }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.addInitScript(() => { localStorage.setItem('lgme.reset.epoch', '2'); });
const failures = [];
const page = await context.newPage();
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.locator('#font-reset').waitFor();
const visibleText = await page.locator('[aria-label="Text"]').evaluateAll((nodes) => nodes.filter((node) => {
  if (node.hidden) return false;
  const box = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}).length);
if (visibleText !== 1) failures.push(`text controls ${visibleText}`);
if (await page.locator('#notice-smaller, #notice-larger, #ai-smaller, #ai-larger, #font-steps, #easy-read-menu').count()) failures.push('extra text controls');
if ((await page.locator('#easy-read').count()) !== 1) failures.push('easy read count');
const tip = await page.locator('#text-tip').innerText();
if (tip !== 'Make text smaller / reset / bigger; saved on this phone') failures.push(`tip ${tip}`);
await page.locator('#font-up').click();
await page.waitForFunction(() => document.getElementById('font-reset')?.textContent === '115%');
if (await page.locator('#text-tip').isVisible()) failures.push('tip stayed');
const grown = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lgme-font').trim());
if (grown !== '1.15') failures.push(`scale ${grown}`);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('#font-reset').waitFor();
if ((await page.evaluate(() => localStorage.getItem('lgme.display.step'))) !== '2') failures.push('size did not persist');
if (await page.locator('#text-tip').isVisible()) failures.push('tip returned');
await page.locator('#font-reset').click();
await page.waitForFunction(() => document.getElementById('font-reset')?.textContent === '100%' && localStorage.getItem('lgme.display.step') === '1');
await page.locator('#font-down').click();
await page.waitForFunction(() => document.getElementById('font-down')?.disabled === true && document.getElementById('font-reset')?.textContent === '85%');
await page.locator('#font-up').click();
await page.locator('#font-up').click();
await page.locator('#font-up').click();
await page.locator('#font-up').click();
await page.waitForFunction(() => document.getElementById('font-up')?.disabled === true && document.getElementById('font-reset')?.textContent === '150%');
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('text size ok');
