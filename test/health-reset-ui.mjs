import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
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
const wants = [];
const writes = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/develop/want' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, items: wants }));
    return;
  }
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    writes.push(url.pathname);
    if (url.pathname === '/api/develop/want') {
      wants.push({ category: 'Health', label: 'In development', target: body.category || 'Health', title: body.title || 'IwanIT' });
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, emailHash: 'demo-hash', item: { title: body.title || 'IwanIT', target: body.category || 'Health', label: 'In development' } }));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
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
mkdirSync('/opt/cursor/artifacts', { recursive: true });

const reset = await browser.newContext({ viewport: { width: 390, height: 844 } });
await reset.addInitScript(() => {
  if (localStorage.getItem('lgme.reset.epoch') === '2') return;
  localStorage.setItem('lgme.reset.epoch', '1');
  localStorage.setItem('lgme.demo.posts', '[{"where":"device","title":"old"}]');
  localStorage.setItem('lgme.device.key', '{"publicJwk":{"x":"abc"},"privateJwk":{"d":"secret"}}');
  localStorage.setItem('lgme-sim:peer:ada', '{"id":"ada","healthNote":"kept"}');
  localStorage.setItem('lgme.exchange.splashSeen', '1');
});
const resetPage = await reset.newPage();
await resetPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await resetPage.locator('#app-reset-note').waitFor({ timeout: 10000 });
const kept = await resetPage.evaluate(() => ({
  note: document.getElementById('app-reset-note').textContent,
  posts: localStorage.getItem('lgme.demo.posts'),
  key: localStorage.getItem('lgme.device.key'),
  peer: localStorage.getItem('lgme-sim:peer:ada'),
  splash: localStorage.getItem('lgme.exchange.splashSeen'),
  epoch: localStorage.getItem('lgme.reset.epoch')
}));
if (kept.note !== 'App updated and reset') failures.push(`reset note ${kept.note}`);
if (kept.posts) failures.push('old listing survived');
if (!kept.key?.includes('secret')) failures.push('signing key cleared');
if (!kept.peer?.includes('kept')) failures.push('health record cleared');
if (kept.splash) failures.push('old splash survived');
if (kept.epoch !== '2') failures.push(`epoch ${kept.epoch}`);
await reset.close();

const home = await browser.newContext({ viewport: { width: 390, height: 844 } });
await home.addInitScript(() => {
  localStorage.setItem('lgme.exchange.splashSeen', '1');
  localStorage.setItem('lgme.reset.epoch', '2');
  window.LanguageModel = { availability: async () => 'available', prompt: async () => 'A short on-device line.' };
});
await home.route('**/*', (route) => route.request().url().includes('fonts.g') ? route.abort() : route.continue());
const homePage = await home.newPage();
await homePage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await homePage.locator('.badge', { hasText: 'In development' }).first().waitFor();
await homePage.screenshot({ path: '/opt/cursor/artifacts/health-first-390.png', timeout: 8000, animations: 'disabled' });
await homePage.locator('#ai-switch').click();
if (await homePage.locator('#ai-switch').getAttribute('aria-checked') !== 'false') failures.push('switch did not turn off');
if (/Turn on the browser/.test(await homePage.locator('#ai-log').innerText())) failures.push('long setup stayed visible');
await homePage.screenshot({ path: '/opt/cursor/artifacts/ai-toggle-off-390.png', timeout: 8000, animations: 'disabled' });
await homePage.locator('#ai-switch').click();
if (!/AI on/i.test(await homePage.locator('#ai-switch').innerText())) failures.push('pill did not turn on');
const box = await homePage.locator('#ai-dock').evaluate((node) => node.getBoundingClientRect().height);
if (box > 844 * 0.25) failures.push(`toggle on too tall ${box}`);
await homePage.screenshot({ path: '/opt/cursor/artifacts/ai-toggle-on-390.png', timeout: 8000, animations: 'disabled' });
await homePage.goto(`${base}/ai-setup`, { waitUntil: 'domcontentloaded' });
await homePage.locator('#ai-setup-steps li').first().waitFor();
const setup = await homePage.locator('#ai-setup-steps').innerText();
if (!/chrome:\/\/settings\/ai/i.test(setup)) failures.push(`setup steps ${setup.slice(0, 80)}`);
await homePage.locator('#ai-check').click();
await homePage.locator('#ai-check-status').waitFor();
await homePage.screenshot({ path: '/opt/cursor/artifacts/ai-setup-390.png', timeout: 8000, animations: 'disabled' });
await home.close();

const flow = await browser.newContext({ viewport: { width: 390, height: 844 } });
await flow.addInitScript(() => {
  localStorage.setItem('lgme.reset.epoch', '2');
  localStorage.setItem('lgme.exchange.splashSeen', '1');
  localStorage.setItem('lgme.exchange.introSeen', '1');
  localStorage.setItem('lgme.demo.member', '{"demo":true,"handle":"demo","disclaimer":true,"emailHash":"demo-hash"}');
  localStorage.setItem('lgme-gym.seat', 'demo');
  window.LanguageModel = { availability: async () => 'available', prompt: async () => 'A short on-device line.' };
});
const flowPage = await flow.newPage();
await flowPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await flowPage.getByRole('button', { name: 'Offer', exact: true }).click();
await flowPage.locator('#demo-confirm').click();
await flowPage.locator('#browse-only').waitFor();
if (writes.some((path) => path.startsWith('/api/hedera') || path === '/api/develop/want')) failures.push(`browse wrote ${writes.join(',')}`);
writes.length = 0;
await flowPage.getByRole('button', { name: 'IwanIT help develop', exact: true }).click();
const title = await flowPage.locator('#demo-title').inputValue();
if (title.length < 8) failures.push(`IwanIT was not prefilled ${title}`);
await flowPage.locator('#demo-confirm').click();
await flowPage.waitForTimeout(300);
if (!writes.includes('/api/develop/want')) failures.push('IwanIT did not post');
await flowPage.goto(`${base}/exchange`, { waitUntil: 'domcontentloaded' });
await flowPage.locator('.dev-board-item').first().waitFor({ timeout: 8000 });
const board = await flowPage.locator('#dev-board').innerText();
if (!/In development/.test(board)) failures.push(`board ${board}`);
await flowPage.locator('#dev-board').evaluate((node) => window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 60));
await flowPage.locator('#dev-board').screenshot({ path: '/opt/cursor/artifacts/iwanit-board-390.png', timeout: 8000, animations: 'disabled' });
await flow.close();

const routes = ['/', '/gym', '/gym#/start', '/gym#/train', '/gym#/people', '/exchange', '/develop', '/campus', '/neighbors', '/hosts', '/circles', '/stories', '/disclaimer', '/testnet-review', '/owner', '/credits', '/no-such-page', '/my-picture', '/tap-entry', '/ai-setup'];
for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => {
    localStorage.setItem('lgme.reset.epoch', '2');
    localStorage.setItem('lgme.exchange.splashSeen', '1');
    localStorage.setItem('lgme.demo.member', '{"demo":true,"handle":"demo","disclaimer":true}');
    localStorage.setItem('lgme-gym.mode', 'demo');
    localStorage.setItem('lgme-gym.seat', 'jordan');
    window.LanguageModel = { availability: async () => 'available', prompt: async () => 'line' };
  });
  const page = await context.newPage();
  for (const path of routes) {
    try {
      await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.locator('#ai-switch').waitFor({ timeout: 8000 });
      const on = await page.locator('#ai-switch').getAttribute('aria-checked');
      if (on !== 'true') failures.push(`${width} ${path} switch ${on}`);
      await page.locator('#ai-switch').click();
      if (/Turn on the browser/.test(await page.locator('#ai-log').innerText())) failures.push(`${width} ${path} long setup`);
      await page.locator('#ai-switch').click();
      if (await page.locator('#ai-switch').getAttribute('aria-checked') !== 'true') failures.push(`${width} ${path} did not turn on`);
    } catch (error) {
      failures.push(`${width} ${path}: ${error.message.split('\n')[0]}`);
    }
  }
  await context.close();
}

const installed = await browser.newContext({ viewport: { width: 390, height: 844 } });
await installed.addInitScript(() => {
  localStorage.setItem('lgme.reset.epoch', '2');
  localStorage.setItem('lgme.exchange.splashSeen', '1');
  const orig = window.matchMedia.bind(window);
  window.matchMedia = (query) => String(query).includes('display-mode')
    ? { matches: true, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }
    : orig(query);
});
const app = await installed.newPage();
for (const path of ['/gym', '/tap-entry', '/my-picture']) {
  await app.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await app.locator('#ai-switch').waitFor();
  await app.locator('#ai-switch').click();
  if (/Turn on the browser/.test(await app.locator('#ai-log').innerText())) failures.push(`pwa ${path} long setup`);
  await app.locator('#ai-switch').click();
}
await installed.close();

await browser.close();
server.close();
if (failures.length) {
  console.log(failures.slice(0, 20).join('\n'));
  process.exit(1);
}
console.log('health reset ui passed');
