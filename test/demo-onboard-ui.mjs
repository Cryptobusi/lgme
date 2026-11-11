import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
function fileFor(pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel = rel.slice(0, -1);
  if (rel === '') rel = '/index.html';
  const full = join(root, rel);
  if (existsSync(full) && statSync(full).isDirectory()) return join(full, 'index.html');
  if (existsSync(full)) return full;
  if (existsSync(full + '.html')) return full + '.html';
  return '';
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/email/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, emailHash: 'demo-hash' }));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
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
const failures = [];
function assert(ok, message) { if (!ok) throw new Error(message); }

for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  let taps = 0;
  const click = async (selector) => { taps += 1; await page.locator(selector).click(); };
  await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  try {
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('.entry-tile .badge', { hasText: 'Beta' }).waitFor();
    await page.locator('.help-develop').first().waitFor();
    await page.locator('#demo-signin').waitFor();
    assert(await page.locator('#demo-email').count() === 0, 'sign-in flashed');
    await page.locator('#site-home').waitFor();
    await page.locator('#site-back').waitFor();
    if (width === 390) {
      mkdirSync('/opt/cursor/artifacts', { recursive: true });
      await page.screenshot({ path: '/opt/cursor/artifacts/category-first-390.png' });
    }
    if (width === 1280) await page.screenshot({ path: '/opt/cursor/artifacts/category-first-1280.png' });
    await page.locator('a[href="/campus"]').first().click();
    await page.waitForURL(/\/campus/);
    assert(await page.evaluate(() => localStorage.getItem('lgme.demo.member')) === null, 'browse stored an account');
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'IwantIT', exact: true }).click();
    taps += 1;
    await page.locator('#demo-email').waitFor();
    await page.locator('#demo-email').fill('ada@example.com');
    await click('#demo-send');
    await page.locator('#demo-code').waitFor();
    await page.locator('#demo-code').fill('123456');
    await click('#demo-verify');
    await page.locator('#demo-understand').waitFor();
    await click('#demo-understand');
    await page.locator('#demo-title').waitFor();
    assert((await page.locator('#demo-title').inputValue()).length > 3, 'title');
    if (width === 390) await page.locator('#demo-confirm').scrollIntoViewIfNeeded();
    if (width === 390) await page.screenshot({ path: '/opt/cursor/artifacts/demo-step-390.png' });
    await click('#demo-confirm');
    await page.locator('#demo-dashboard').waitFor();
    const badge = await page.locator('.demo-badge').first().innerText();
    assert(/new/.test(badge), badge);
    if (width === 390) await page.screenshot({ path: '/opt/cursor/artifacts/demo-dashboard-390.png' });
    await page.goto(`${base}/campus`, { waitUntil: 'domcontentloaded' });
    await page.locator('#site-home').waitFor();
    await page.locator('#site-back').click();
    assert(page.url().includes(base), 'back left the site');
    console.log(`PASS ${width} taps ${taps}`);
    assert(taps <= 6, `taps ${taps}`);
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
