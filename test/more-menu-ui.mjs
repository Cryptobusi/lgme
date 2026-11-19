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
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); return; }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' });
await context.addInitScript(() => { localStorage.setItem('lgme.reset.epoch', '2'); });
const failures = [];
const page = await context.newPage();
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.locator('#one-more').waitFor();
await page.locator('#ai-dock').waitFor();
const stack = await page.evaluate(() => {
  const more = document.getElementById('one-more');
  const dock = document.getElementById('ai-dock');
  return {
    more: Number(getComputedStyle(more).zIndex),
    dock: Number(getComputedStyle(dock).zIndex),
    first: document.querySelector('#one-menu')?.firstElementChild?.textContent || ''
  };
});
if (stack.more <= stack.dock) failures.push(`more under dock ${stack.more}/${stack.dock}`);
if (stack.first !== 'Introduction') failures.push(`first item ${stack.first}`);
await page.locator('#one-more').dispatchEvent('pointerup');
await page.waitForFunction(() => document.getElementById('one-more')?.getAttribute('aria-expanded') === 'true' && document.getElementById('one-menu')?.hidden === false);
const intro = await page.locator('#one-menu [data-intro]').boundingBox();
if (!intro || intro.height < 44) failures.push('introduction tap');
await page.waitForTimeout(500);
await page.locator('#one-more').dispatchEvent('pointerup');
await page.waitForFunction(() => document.getElementById('one-more')?.getAttribute('aria-expanded') === 'false' && document.getElementById('one-menu')?.hidden === true);
await page.waitForTimeout(500);
await page.locator('#one-more').click();
if ((await page.locator('#one-more').getAttribute('aria-expanded')) !== 'true') failures.push('click did not open');
await page.locator('#tape-sound').click();
await page.waitForFunction(() => document.getElementById('one-menu')?.hidden === true);
await page.waitForTimeout(500);
await page.locator('#one-more').click();
await page.locator('#one-menu [data-intro]').click();
await page.waitForURL(/\/introduction/);
await page.waitForFunction(() => document.documentElement.dataset.density === 'compact' && !!document.querySelector('script[src="/js/display-fit.mjs"]'));
if (!/Debit = you owe/.test(await page.locator('#creo-glossary').innerText())) failures.push('glossary missing');
await page.locator('#intro-list a').first().waitFor();
await page.locator('#intro-q').fill('glossary');
await page.locator('#intro-find').evaluate((form) => form.requestSubmit());
await page.waitForFunction(() => /glossary/i.test(document.getElementById('intro-hits')?.innerText || ''));
const hit = await page.locator('#intro-hits a').first().getAttribute('href');
if (hit !== '/glossary') failures.push(`search ${hit}`);
const gym = await context.newPage();
await gym.goto(`${base}/gym`, { waitUntil: 'domcontentloaded' });
await gym.locator('#one-more').waitFor();
await gym.waitForFunction(() => !!document.querySelector('script[src="/js/display-fit.mjs"]'));
for (const label of ['Club', 'Train', 'People', 'Groups', 'IdidIt', 'Settings']) {
  await gym.locator('#one-more').click();
  await gym.locator('#one-menu button[data-route]', { hasText: label }).click();
  await gym.waitForFunction(() => document.getElementById('one-menu')?.hidden === true);
  await gym.waitForTimeout(500);
}
if (!String(await gym.evaluate(() => location.hash)).includes('/more')) failures.push('settings route');
await gym.locator('#one-more').click();
await gym.locator('#inventory-open').click();
await gym.waitForURL(/\/inventory/);
if (!(await gym.evaluate(() => document.documentElement.dataset.density))) failures.push('inventory density');
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('more menu ok');
