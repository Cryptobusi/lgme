import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { ADMIN_WINDOW_MS, versionRequest } from '../js/version-flow.mjs';

const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const playwright = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
const store = { bag: new Map(), async get(key) { return this.bag.has(key) ? this.bag.get(key) : null; }, async set(key, value) { this.bag.set(key, value); } };
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
  const now = Number(req.headers['x-lgme-now']) || Date.now();
  if (url.pathname === '/api/versions') {
    const body = req.method === 'POST' ? JSON.parse(await readBody(req) || '{}') : {};
    const result = await versionRequest({
      method: req.method,
      search: url.search,
      body,
      store,
      now,
      admin: req.headers['x-lgme-admin'] === 'test-admin',
      env: { OWNER_NOTIFY_EMAIL: 'owner@example.test', RESEND_API_KEY: 'k', EMAIL_FROM: 'desk@lgme.app' },
      fetchImpl: async (_target, options) => { mail.push(JSON.parse(options.body)); return { ok: true }; }
    });
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result.body));
    return;
  }
  if (url.pathname === '/api/develop/want' || url.pathname === '/api/categories') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, notices: [] }));
    return;
  }
  if (url.pathname === '/api/hedera/status') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, network: 'testnet', mainnetWrites: false }));
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
  return { context, page: await context.newPage() };
}

async function tap(page, selector) {
  const target = page.locator(selector).first();
  await target.evaluate((node) => {
    const y = node.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo(0, Math.max(0, y));
  });
  await target.click();
}

async function shot(page, selector, file) {
  await page.locator(selector).first().evaluate((node) => {
    const y = node.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo(0, Math.max(0, y));
  });
  await page.screenshot({ path: file, timeout: 8000, animations: 'disabled' });
}

async function offer(page, name, purpose, useDock) {
  await page.locator('#customize-theme').selectOption('gold');
  await page.locator('#customize-preview').waitFor();
  check(await page.locator('#customize-preview').getAttribute('data-theme') === 'gold', 'preview did not follow the theme');
  await tap(page, '#customize-reset');
  check(await page.locator('#customize-preview').getAttribute('data-theme') === 'night', 'reset did not restore the preview');
  await page.locator('#customize-theme').selectOption('gold');
  await tap(page, '#customize-offer');
  if (useDock) {
    await page.locator('#version-name').click();
    await page.locator('#ai-chips').getByRole('button', { name, exact: true }).click();
    await page.locator('#version-purpose').click();
    await page.locator('#ai-chips').getByRole('button', { name: purpose, exact: true }).click();
  } else {
    await page.locator('#version-name').fill(name);
    await page.locator('#version-purpose').fill(purpose);
  }
  await tap(page, '#customize-confirm');
  await page.locator('#version-count').waitFor();
}

async function attest(page, name) {
  const steps = [['test-b', '1 of 3'], ['test-c', '2 of 3'], ['test-d', '3 of 3. Waiting for the administrator.']];
  for (const [member, label] of steps) {
    await page.evaluate((id) => localStorage.setItem('lgme.member', id), member);
    await page.goto(page.url().includes('/versions') ? page.url() : `${page.url().split('/customize')[0]}/versions`, { waitUntil: 'domcontentloaded' });
    await page.locator(`article:has-text("${name}")`).getByRole('button', { name: 'Attest' }).click();
    await page.locator(`article:has-text("${name}") .version-count`).waitFor();
    await page.waitForFunction((pair) => {
      const card = [...document.querySelectorAll('article')].find((node) => node.textContent.includes(pair.name));
      return card && card.textContent.includes(pair.label);
    }, { name, label });
  }
}

const browser = await playwright.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const plans = [
  [390, 844, 'Night gold', 'A darker gold theme for night walks.', true],
  [1280, 800, 'Paper desk', 'A paper look for daytime.', false]
];
for (const [width, height, name, purpose, useDock] of plans) {
  const { context, page } = await open(browser, width, height);
  try {
    await page.goto(`${base}/customize`, { waitUntil: 'domcontentloaded' });
    await page.locator('#customize-preview').waitFor();
    if (width === 390) await shot(page, '#customize-preview', '/opt/cursor/artifacts/customize-390.png');
    await offer(page, name, purpose, useDock);
    check((await page.locator('#version-count').innerText()) === '0 of 3', `${width} count`);
    check((await page.locator('#customize-status').innerText()).includes('Sent to the owner'), `${width} owner send`);
    check(/diagnos|treatment|cure|\$Trust/i.test(await page.locator('main').innerText()) === false, `${width} claim`);
    if (width === 390) await shot(page, '#version-count', '/opt/cursor/artifacts/version-proposal-390.png');
    await page.goto(`${base}/versions`, { waitUntil: 'domcontentloaded' });
    await attest(page, name);
    await page.goto(`${base}/owner`, { waitUntil: 'domcontentloaded' });
    await page.locator('#owner-token').fill('test-admin');
    await page.locator('#owner-gate button').click();
    await page.locator('#version-json').waitFor();
    await page.locator('#version-deny').waitFor();
    check((await page.locator('#dao-line').innerText()).includes('sole right to deny'), `${width} dao line`);
    check((await page.locator('#version-json').innerText()).includes('"theme"'), `${width} owner copy`);
    if (width === 390) await shot(page, '#version-deny', '/opt/cursor/artifacts/version-owner-390.png');
    const readyAt = await page.evaluate(async (author) => {
      const body = await (await fetch(`/api/versions?mine=${author}`)).json();
      return Date.parse(body.mine.find((row) => row.status === 'awaiting-admin').readyAt);
    }, 'test-a');
    await page.evaluate(async (stamp) => {
      await fetch('/api/versions?mine=test-a', { headers: { 'x-lgme-now': String(stamp) } });
    }, readyAt + ADMIN_WINDOW_MS);
    await page.goto(`${base}/versions`, { waitUntil: 'domcontentloaded' });
    await page.locator('#version-gallery').getByText(name).waitFor();
    if (width === 390) {
      await shot(page, 'h1', '/opt/cursor/artifacts/versions-page-390.png');
      await shot(page, '#version-gallery', '/opt/cursor/artifacts/versions-gallery-390.png');
    }
    await page.evaluate(() => localStorage.setItem('lgme.member', 'test-b'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await tap(page, '#version-install');
    const installed = await page.evaluate(() => JSON.parse(localStorage.getItem('lgme.variant.active') || 'null')?.theme);
    check(installed === 'gold', `${width} install ${installed}`);
    await page.goto(`${base}/customize`, { waitUntil: 'domcontentloaded' });
    await tap(page, '#customize-revert');
    const reverted = await page.evaluate(() => localStorage.getItem('lgme.variant.active'));
    check(reverted == null, `${width} revert left ${reverted}`);
    await page.evaluate(() => localStorage.setItem('lgme.member', 'test-a'));
    await page.goto(`${base}/customize`, { waitUntil: 'domcontentloaded' });
    const denyName = width === 390 ? 'Study hour' : 'Quiet home';
    await offer(page, denyName, 'A quieter home screen.', false);
    await page.goto(`${base}/owner`, { waitUntil: 'domcontentloaded' });
    await page.locator('#owner-token').fill('test-admin');
    await page.locator('#owner-gate button').click();
    const denyCard = page.locator('article', { hasText: `Proposed version: ${denyName}` });
    await denyCard.locator('input').fill('Keep this one private.');
    await denyCard.getByRole('button', { name: 'Deny', exact: true }).evaluate((node) => node.click());
    await page.goto(`${base}/customize`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /Denied/.test(document.getElementById('customize-status')?.textContent || ''));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(overflow === false, `${width} overflow`);
  } catch (error) {
    const detail = await page.locator('#customize-status').innerText().catch(() => '');
    const nameValue = await page.locator('#version-name').inputValue().catch(() => '');
    failures.push(`${width} ${error.message} status=${detail} name=${nameValue}`);
  }
  await context.close();
}
await browser.close();
server.close();
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
console.log('my version passed');
