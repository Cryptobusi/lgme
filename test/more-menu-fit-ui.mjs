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
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); return; }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 360, height: 640 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
});
await context.addInitScript(() => {
  localStorage.setItem('lgme.reset.epoch', '2');
  localStorage.setItem('lgme.display.easy', '1');
  localStorage.setItem('lgme.display.step', '4');
});
const failures = [];
const page = await context.newPage();
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.locator('#one-more').waitFor();
await page.waitForFunction(() => document.documentElement.classList.contains('is-easy') && document.getElementById('ai-dock')?.classList.contains('is-open'));
if (!(await page.locator('#ai-dock').evaluate((node) => node.classList.contains('is-open')))) await page.locator('#ai-expand').click();
await page.locator('#one-more').click();
await page.waitForFunction(() => document.getElementById('one-menu')?.hidden === false);
const fit = await page.evaluate(() => {
  const menu = document.getElementById('one-menu');
  const dock = document.getElementById('ai-dock');
  const view = window.visualViewport;
  menu.scrollTop = 0;
  const menuBox = menu.getBoundingClientRect();
  const visible = () => [...menu.querySelectorAll('a, button')].filter((el) => !el.closest('[hidden]'));
  const firstEl = visible()[0];
  const first = firstEl.getBoundingClientRect();
  const dockBox = dock.getBoundingClientRect();
  menu.scrollTop = menu.scrollHeight;
  const items = visible();
  const lastEl = items[items.length - 1];
  const last = lastEl.getBoundingClientRect();
  const menuAfter = menu.getBoundingClientRect();
  return {
    parent: menu.parentElement === document.body,
    z: Number(getComputedStyle(menu).zIndex),
    dockZ: Number(getComputedStyle(dock).zIndex),
    overflow: getComputedStyle(menu).overflowY,
    menu: { top: menuBox.top, bottom: menuBox.bottom, left: menuBox.left, right: menuBox.right },
    firstTop: first.top,
    firstName: firstEl.textContent,
    lastBottom: last.bottom,
    lastTop: last.top,
    lastName: lastEl.textContent,
    dockTop: dockBox.top,
    dockRatio: dockBox.height / view.height,
    viewH: view.height,
    viewW: view.width,
    scrolls: menu.scrollHeight > menu.clientHeight + 4,
    menuAfterBottom: menuAfter.bottom
  };
});
if (!fit.parent) failures.push('menu is not portaled to the body');
if (!(fit.z > fit.dockZ)) failures.push(`menu z ${fit.z} dock ${fit.dockZ}`);
if (fit.overflow !== 'auto' && fit.overflow !== 'scroll') failures.push(`overflow ${fit.overflow}`);
if (fit.menu.top < -1 || fit.menu.left < -1 || fit.menu.right > fit.viewW + 1 || fit.menu.bottom > fit.viewH + 1) failures.push(`menu off screen ${JSON.stringify(fit.menu)} view ${fit.viewW}x${fit.viewH}`);
if (fit.menu.bottom > fit.dockTop + 1) failures.push(`menu under dock ${fit.menu.bottom} ${fit.dockTop}`);
if (fit.dockRatio < 0.45 || fit.dockRatio > 0.58) failures.push(`dock ratio ${fit.dockRatio}`);
if (fit.firstTop < fit.menu.top - 2 || fit.firstTop >= fit.menu.bottom) failures.push(`first item unreachable ${fit.firstTop}`);
if (fit.lastBottom > fit.menuAfterBottom + 2 || fit.lastTop >= fit.menuAfterBottom) failures.push(`last item unreachable ${fit.lastName} ${fit.lastTop}-${fit.lastBottom}`);
if (!fit.scrolls) failures.push('menu does not scroll');
await page.keyboard.press('Escape');
await page.waitForFunction(() => document.getElementById('one-menu')?.hidden === true);
await page.waitForTimeout(500);
await page.locator('#one-more').click();
await page.waitForFunction(() => document.getElementById('one-menu')?.hidden === false);
await page.mouse.click(8, 200);
await page.waitForFunction(() => document.getElementById('one-menu')?.hidden === true);
await page.waitForTimeout(500);
await page.locator('#one-more').click();
await page.locator('#tape-sound').click();
await page.waitForFunction(() => document.getElementById('one-menu')?.hidden === true);
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('more menu fit ok');
