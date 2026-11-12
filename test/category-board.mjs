import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const wants = [];
const sentMail = [];
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
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/develop/want' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}');
    if (JSON.stringify(body).includes('@') || body.email) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Leave out email addresses and links.' }));
      return;
    }
    const notice = { category: body.category, title: body.title, at: new Date().toISOString(), link: `/develop?category=${encodeURIComponent(body.category || '')}` };
    wants.push(notice);
    sentMail.push({ to: 'owner-from-env', subject: `IwanIT: ${body.category}`, text: `${body.title}\n${notice.at}\n${notice.link}` });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, duplicate: false, notified: true, item: { kind: 'IwanIT', category: body.category, title: body.title, at: notice.at }, notice }));
    return;
  }
  if (url.pathname === '/api/develop/want') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, count: wants.length, notices: wants }));
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

const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('lgme.demo.member', '{"demo":true,"handle":"demo"}'));
await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
try {
  await page.goto(`${base}/?picker=1`, { waitUntil: 'domcontentloaded' });
  const badges = await page.locator('.entry-picker .badge').evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
  assert(badges[0] === 'Beta' && badges.slice(1).every((badge) => badge === 'In development'), badges.join('|'));
  assert((await page.content()).includes('mailto:') === false, 'mailto on the home screen');
  assert((await page.content()).includes('cryptovanities') === false, 'address on the home screen');
  for (const name of names) {
    const tile = page.locator('[data-entry]').filter({ hasText: name }).first();
    assert(await tile.locator('.help-develop').count() === 0, `${name} still has a develop button`);
    const open = await tile.locator('.tile-open').getAttribute('href');
    assert(open.startsWith('/'), open);
  }
  mkdirSync('/opt/cursor/artifacts', { recursive: true });
  await page.locator('#health-tile').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/opt/cursor/artifacts/categories-home-390.png' });
  await page.locator('#help-develop-open').click();
  await page.waitForURL(/\/develop\?category=Campus/);
  assert(await page.locator('#want-kind').inputValue() === 'IwanIT', 'kind');
  assert(await page.locator('#want-category').inputValue() === 'Campus', 'category');
  assert(await page.locator('#want-title').inputValue() === 'I want to help develop Campus', 'title');
  await page.locator('#want-confirm').evaluate((node) => {
    const dock = document.getElementById('ai-dock');
    const limit = dock ? dock.getBoundingClientRect().top - 12 : window.innerHeight;
    const box = node.getBoundingClientRect();
    if (box.bottom > limit) window.scrollBy(0, box.bottom - limit + 16);
  });
  await page.screenshot({ path: '/opt/cursor/artifacts/develop-want-390.png' });
  await page.locator('#want-confirm').evaluate((node) => node.click());
  await page.locator('#demo-email').waitFor();
  assert(page.url().includes('home=1'), page.url());
  await page.goto(`${base}/develop?category=Campus`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('lgme-gym.seat', 'mina'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#want-confirm').evaluate((node) => node.click());
  await page.waitForFunction(() => /Posted/.test(document.getElementById('want-status')?.textContent || ''));
  assert(sentMail.length === 1 && sentMail[0].subject === 'IwanIT: Campus', 'notify');
  assert(sentMail[0].text.includes('@') === false, 'mail body has an address');
  await page.goto(`${base}/owner`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('owner-badge')?.textContent === '1');
  await page.screenshot({ path: '/opt/cursor/artifacts/owner-notice-390.png' });
  console.log('PASS 390');
} catch (error) {
  failures.push(error.message);
  console.log('FAIL', error.message);
}
await context.close();

for (const [width, height] of [[768, 1024], [1280, 800]]) {
  const wide = await browser.newContext({ viewport: { width, height } });
  const desk = await wide.newPage();
  await desk.addInitScript(() => localStorage.setItem('lgme.demo.member', '{"demo":true,"handle":"demo"}'));
  await desk.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  try {
    await desk.goto(`${base}/?picker=1`, { waitUntil: 'domcontentloaded' });
    const overflow = await desk.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(overflow === false, `${width} overflow`);
    const count = await desk.locator('#help-develop-open').count();
    assert(count === 1, `${width} help buttons ${count}`);
    if (width === 1280) await desk.screenshot({ path: '/opt/cursor/artifacts/categories-home-1280.png' });
    console.log(`PASS ${width}`);
  } catch (error) {
    failures.push(`${width}: ${error.message}`);
    console.log(`FAIL ${width}`, error.message);
  }
  await wide.close();
}

await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('3/3 passed');
