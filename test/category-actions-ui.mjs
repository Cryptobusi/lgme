import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { categoryRequest } from '../js/category-evolve.mjs';

const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const playwright = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
const store = {
  bag: new Map(),
  async get(key) { return this.bag.has(key) ? this.bag.get(key) : null; },
  async set(key, value) { this.bag.set(key, value); }
};
const mail = [];
function fileFor(pathname) {
  let rel = decodeURIComponent(pathname.split('?')[0]);
  if (rel.endsWith('/')) rel = rel.slice(0, -1);
  if (rel === '') rel = '/index.html';
  const full = join(root, rel);
  if (existsSync(full) && statSync(full).isDirectory()) return join(full, 'index.html');
  if (existsSync(full)) return full;
  if (existsSync(full + '.html')) return full + '.html';
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
  if (url.pathname === '/api/categories') {
    const body = req.method === 'POST' ? JSON.parse(await readBody(req) || '{}') : {};
    const result = await categoryRequest({
      method: req.method,
      search: url.search,
      body,
      store,
      env: { OWNER_NOTIFY_EMAIL: 'owner@example.test', RESEND_API_KEY: 'k', EMAIL_FROM: 'desk@lgme.app' },
      fetchImpl: async (_target, options) => { mail.push(JSON.parse(options.body)); return { ok: true }; }
    });
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result.body));
    return;
  }
  if (url.pathname === '/api/hedera/status') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, enabled: true, network: 'testnet', mainnetWrites: false }));
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
mkdirSync('/opt/cursor/artifacts', { recursive: true });
const failures = [];
function check(ok, message) { if (!ok) failures.push(message); }

async function open(browser, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: width < 800,
    isMobile: width < 800,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });
  await context.addInitScript(() => {
    localStorage.setItem('lgme.reset.epoch', '2');
    localStorage.setItem('lgme.ai.enabled', '0');
    if (!localStorage.getItem('lgme.member')) localStorage.setItem('lgme.member', 'test-a');
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => String(query).includes('display-mode') && String(query).includes('standalone')
      ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
      : original(query);
  });
  const page = await context.newPage();
  return { context, page };
}

async function tap(page, selector) {
  const target = page.locator(selector);
  await target.evaluate((node) => {
    const y = node.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo(0, Math.max(0, y));
  });
  await target.click();
}

async function shot(page, selector, file) {
  await page.locator(selector).evaluate((node) => {
    const y = node.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo(0, Math.max(0, y));
  });
  await page.screenshot({ path: file, timeout: 8000, animations: 'disabled' });
}

const browser = await playwright.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const [width, height] of [[390, 844], [1280, 800]]) {
  const { context, page } = await open(browser, width, height);
  try {
    await page.goto(`${base}/gym`, { waitUntil: 'domcontentloaded' });
    const idid = page.getByRole('button', { name: /^IdidIt/ });
    const want = page.getByRole('button', { name: /^IwantIT/ });
    const have = page.getByRole('button', { name: /^IhavIT/ });
    await idid.waitFor();
    for (const button of [idid, want, have]) {
      const box = await button.boundingBox();
      check(box && box.height >= 48, `${width} action shorter than 48`);
    }
    const contrast = await want.evaluate((node) => {
      const style = getComputedStyle(node);
      return { bg: style.backgroundColor, fg: style.color };
    });
    check(contrast.bg !== contrast.fg, `${width} action contrast`);
    if (width === 390) await shot(page, '.category-actions', '/opt/cursor/artifacts/category-actions-390.png');
    await tap(page, '#category-board .category-actions button:has-text("IwantIT")');
    await page.locator('#category-list .category-row').first().waitFor();
    const titles = await page.locator('#category-list .category-row').allTextContents();
    check(titles.length >= 5, `${width} fewer than 5 listings`);
    check(/A ride to the park/.test(titles[0]), `${width} newest listing missing`);
    const scroll = await page.locator('#category-list').evaluate((node) => ({ over: node.scrollHeight > node.clientHeight + 4, top: node.scrollTop }));
    check(scroll.over, `${width} list does not scroll inside itself`);
    if (width === 390) await shot(page, '#category-list', '/opt/cursor/artifacts/category-list-390.png');
    await tap(page, '#category-more');
    const moved = await page.locator('#category-list').evaluate((node) => node.scrollTop);
    check(moved > scroll.top, `${width} See more did not scroll`);
    const chips = page.locator('#category-chips');
    const chipScroll = await chips.evaluate((node) => node.scrollWidth > node.clientWidth + 4);
    check(chipScroll || width > 800, `${width} chips do not scroll`);
    check(await page.locator('#category-create').innerText() === 'Create new', `${width} create chip`);
    if (width === 390) {
      await chips.evaluate((node) => { node.scrollLeft = node.scrollWidth; });
      await shot(page, '#category-chips', '/opt/cursor/artifacts/category-chips-390.png');
    }
    await tap(page, '#category-create');
    const nameOption = width === 390 ? 'Tool library' : 'Study hour';
    const lineOption = width === 390 ? 'A place to trade tools' : 'A study hour';
    await page.locator('#evolve-name').click();
    await page.locator('#ai-chips').getByRole('button', { name: nameOption, exact: true }).click();
    await page.locator('#evolve-line').click();
    await page.locator('#ai-chips').getByRole('button', { name: lineOption, exact: true }).click();
    await tap(page, '#evolve-send');
    await page.locator('#evolve-count').waitFor();
    const count = await page.locator('#evolve-count').innerText();
    check(count === '0 of 3', `${width} count ${count}`);
    check((await page.locator('#category-status').innerText()).includes('Sent to the owner'), `${width} owner notice`);
    check(/diagnos|treatment|cure/i.test(await page.locator('#category-board').innerText()) === false, `${width} medical claim`);
    if (width === 390) await shot(page, '#evolve-proposal', '/opt/cursor/artifacts/category-proposal-390.png');
    const steps = [['test-b', '1 of 3'], ['test-c', '2 of 3'], ['test-d', 'Early / In development']];
    for (const [member, label] of steps) {
      await page.evaluate((id) => localStorage.setItem('lgme.member', id), member);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await tap(page, `#category-chips button:has-text("${nameOption}")`);
      await tap(page, '#evolve-attest');
      await page.waitForFunction((next) => document.getElementById('evolve-count')?.textContent === next, label);
    }
    const finalLabel = await page.locator('#evolve-count').innerText();
    check(finalLabel === 'Early / In development', `${width} promoted ${finalLabel}`);
    check(mail.length >= 2, 'owner mail missing');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(overflow === false, `${width} page overflow`);
  } catch (error) {
    failures.push(`${width} ${error.message}`);
  }
  await context.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
console.log('category actions passed');
