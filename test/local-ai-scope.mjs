import { createServer } from 'node:http';
import { mkdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json' };
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
const posts = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    posts.push(url.pathname);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, emailHash: 'demo-hash', item: { title: 'help' } }));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, notices: [] }));
    return;
  }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404, { 'content-type': 'text/html' }); res.end(readFileSync(join(root, '404.html'))); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const failures = [];
const routes = ['/', '/gym', '/exchange', '/campus', '/develop', '/disclaimer', '/neighbors'];
const member = JSON.stringify({ demo: true, handle: 'demo', disclaimer: true, emailHash: 'demo-hash' });

async function boot(width, height, extra) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('fonts.g')) return route.abort();
    return route.continue();
  });
  await context.addInitScript((raw) => {
    if (raw) localStorage.setItem('lgme.demo.member', raw);
    localStorage.setItem('lgme.exchange.splashSeen', '1');
    localStorage.setItem('lgme.exchange.introSeen', '1');
    window.LanguageModel = { availability: async () => 'available', prompt: async () => 'A short on-device line.' };
  }, extra || '');
  return context;
}

for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
  const context = await boot(width, height, '');
  const page = await context.newPage();
  try {
    for (const path of routes) {
      await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.locator('#ai-dock').waitFor();
      await page.locator('#site-home').waitFor();
      const box = await page.locator('#ai-log').evaluate((node) => {
        const style = getComputedStyle(node);
        const line = parseFloat(style.lineHeight);
        return { height: node.clientHeight, scroll: node.scrollHeight, line, text: node.textContent };
      });
      if (!(box.height >= 48 && box.height <= 80 && box.scroll > box.height + 4)) failures.push(`${width} ${path} lines ${box.height}/${box.scroll}`);
      if (!/Explain|Turn on/.test(box.text)) failures.push(`${width} ${path} empty panel`);
      const covered = await page.evaluate(() => {
        const nav = document.getElementById('site-nav').getBoundingClientRect();
        const dock = document.getElementById('ai-dock').getBoundingClientRect();
        return nav.bottom > dock.top;
      });
      if (covered) failures.push(`${width} ${path} dock covers nav`);
      if (box.line && box.height + 2 < box.line * 3) failures.push(`${width} ${path} clips a line ${box.height}/${box.line}`);
      if (path === '/') {
        const place = await page.evaluate(() => {
          const nav = document.getElementById('site-nav').getBoundingClientRect();
          const grid = document.getElementById('category-grid').getBoundingClientRect();
          const between = [...document.body.querySelectorAll('p, h1, h2, section, button, a')].filter((el) => {
            if (document.getElementById('site-nav').contains(el) || document.getElementById('category-grid').contains(el)) return false;
            const box = el.getBoundingClientRect();
            return box.height > 4 && box.width > 4 && box.top >= nav.bottom - 1 && box.top < grid.top - 1;
          });
          const actions = document.getElementById('demo-actions');
          return { gap: between.map((el) => el.textContent.trim().slice(0, 24)), overflow: actions.scrollWidth > actions.clientWidth + 1 };
        });
        if (place.gap.length) failures.push(`${width} above grid ${place.gap.join('|')}`);
        if (place.overflow) failures.push(`${width} action row overflows`);
      }
    }
    if (width === 390) {
      mkdirSync('/opt/cursor/artifacts', { recursive: true });
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      await page.locator('.entry-tile').first().waitFor();
      await page.screenshot({ path: '/opt/cursor/artifacts/category-first-390.png', timeout: 8000, animations: 'disabled' });
      await page.screenshot({ path: '/opt/cursor/artifacts/ai-panel-390.png', timeout: 8000, animations: 'disabled' });
    }
    console.log(`ok panel ${width}`);
  } catch (error) {
    failures.push(`${width}: ${error.message.split('\n')[0]}`);
    console.log('FAIL', width, error.message.split('\n')[0]);
  }
  await context.close();
}

const signed = await boot(390, 844, member);
const signedPage = await signed.newPage();
await signedPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await signedPage.locator('#ai-flag').waitFor();
const flag = await signedPage.locator('#ai-flag').innerText();
if (!flag.includes('Only available online with AI enabled.')) failures.push(`flag ${flag}`);
if (!/Online: yes/.test(flag) || !/AI: yes/.test(flag)) failures.push(`flag state ${flag}`);
await signedPage.screenshot({ path: '/opt/cursor/artifacts/ai-flag-390.png', timeout: 8000, animations: 'disabled' });
posts.length = 0;
await signedPage.getByRole('button', { name: 'Offer', exact: true }).click();
await signedPage.locator('#demo-confirm').click();
await signedPage.locator('#demo-saved').waitFor();
if (posts.some((path) => path.startsWith('/api/hedera') || path === '/api/develop/want')) failures.push(`local offer wrote ${posts.join(',')}`);
await signedPage.screenshot({ path: '/opt/cursor/artifacts/local-listing-390.png', timeout: 8000, animations: 'disabled' });
posts.length = 0;
await signedPage.getByRole('button', { name: 'IwanIT help develop', exact: true }).click();
await signedPage.locator('#demo-confirm').click();
await signedPage.waitForTimeout(400);
if (!posts.includes('/api/develop/want')) failures.push(`IwanIT did not post ${posts.join(',')}`);
await signed.close();

const offline = await boot(390, 844, member);
const offPage = await offline.newPage();
await offPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await offPage.context().setOffline(true);
await offPage.evaluate(() => window.dispatchEvent(new Event('offline')));
await offPage.getByRole('button', { name: 'Offer', exact: true }).click();
if (await offPage.locator('#demo-confirm').count()) failures.push('offline opened a confirm');
const offFlag = await offPage.locator('#ai-flag').innerText();
if (!/Online: no/.test(offFlag)) failures.push(`offline flag ${offFlag}`);
await offline.close();

await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('local AI scope passed');
