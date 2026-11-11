import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
function fileFor(pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.includes('..')) return '';
  if (rel.endsWith('/')) rel = rel.slice(0, -1);
  if (rel === '') rel = '/index.html';
  const full = join(root, rel);
  if (existsSync(full) && statSync(full).isDirectory()) return join(full, 'index.html');
  if (existsSync(full)) return full;
  if (existsSync(`${full}.html`)) return `${full}.html`;
  return '';
}
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, listings: [], topicId: '0.0.11397293' }));
    return;
  }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const names = ['Campus', 'Neighbor help', 'Hosts', 'Circles', 'Stories', 'Exchange'];
const failures = [];
function assert(ok, message) { if (!ok) throw new Error(message); }

for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('lgme.exchange.splashSeen', '1');
    localStorage.setItem('lgme.exchange.introSeen', '1');
  });
  await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  try {
    await page.goto(`${base}/?picker=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('#health-tile').scrollIntoViewIfNeeded();
    const badges = await page.locator('.entry-picker .badge').evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
    assert(badges.length === 1 && badges[0] === 'Beta', `${width} badges ${badges.join('|')}`);
    const health = await page.locator('[data-entry="health"]').getAttribute('href');
    assert(health === '/gym', `${width} health link`);
    for (const name of names) {
      const tile = page.locator(`[data-entry]`).filter({ hasText: name }).first();
      const open = await tile.locator('.tile-open').getAttribute('href');
      const mail = await tile.locator('.help-develop').getAttribute('href');
      const dev = await tile.locator('.dev-team').getAttribute('href');
      assert(open && open.startsWith('/'), `${width} ${name} link`);
      const parsed = new URL(mail);
      assert(parsed.protocol === 'mailto:' && parsed.pathname === 'cryptovanities@gmail.com', `${width} ${name} mail`);
      assert(parsed.searchParams.get('subject') === `Help develop lgme.app: ${name}`, `${width} ${name} subject`);
      assert(dev === '/hosts#dev-interest', `${width} ${name} team`);
      const tap = await tile.locator('.help-develop').boundingBox();
      assert(tap && tap.height >= 44, `${width} ${name} tap ${tap && tap.height}`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(overflow === false, `${width} home overflow`);
    if (width === 390 || width === 1280) {
      mkdirSync('/opt/cursor/artifacts', { recursive: true });
      await page.screenshot({ path: `/opt/cursor/artifacts/categories-home-${width}.png` });
    }
    await page.goto(`${base}/campus`, { waitUntil: 'domcontentloaded' });
    await page.locator('#category-help').scrollIntoViewIfNeeded();
    const campusMail = new URL(await page.locator('#help-develop').getAttribute('href'));
    assert(campusMail.searchParams.get('subject') === 'Help develop lgme.app: Campus', `${width} campus subject`);
    assert((await page.locator('#seed-board, #category-help').count()) >= 1, `${width} campus view`);
    if (width === 390 || width === 1280) {
      await page.screenshot({ path: `/opt/cursor/artifacts/categories-campus-${width}.png` });
    }
    console.log(`PASS ${width}`);
  } catch (error) {
    failures.push(`${width}: ${error.message}`);
    console.log(`FAIL ${width}: ${error.message}`);
  }
  await context.close();
}
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('3/3 passed');
