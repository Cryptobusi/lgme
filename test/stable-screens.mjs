import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
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
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/email/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, emailHash: 'demo-hash' }));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, notices: [] }));
    return;
  }
  const path = fileFor(url.pathname);
  if (!path) {
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end(readFileSync(join(root, '404.html')));
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const member = JSON.stringify({ demo: true, handle: 'demo', disclaimer: true, choice: 'Browse' });
const routes = [
  ['home', '/'],
  ['disclaimer', '/disclaimer'],
  ['gym', '/gym'],
  ['gym-start', '/gym#/start'],
  ['gym-setup', '/gym#/setup'],
  ['gym-train', '/gym#/train'],
  ['gym-people', '/gym#/people'],
  ['gym-dispute', '/gym#/dispute'],
  ['exchange', '/exchange'],
  ['develop', '/develop'],
  ['campus', '/campus'],
  ['neighbors', '/neighbors'],
  ['hosts', '/hosts'],
  ['circles', '/circles'],
  ['stories', '/stories'],
  ['review', '/testnet-review'],
  ['owner', '/owner'],
  ['credits', '/credits'],
  ['missing', '/no-such-page']
];
const failures = [];
function ignore(url) {
  return /fonts\.google|fonts\.gstatic|pump\.fun|birdeye|geckoterminal|solana\.com|dexscreener|jup\.ag|huggingface|favicon/i.test(url);
}

async function openContext(width, height, scheme, signed, pwa) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  await context.addInitScript(({ raw, standalone }) => {
    window.__cls = 0;
    window.__shifts = [];
    window.__errors = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          if (entry.startTime < (window.__mark || 0)) continue;
          window.__cls += entry.value;
          const node = entry.sources && entry.sources[0] && entry.sources[0].node;
          window.__shifts.push(`${node ? node.tagName : ''}.${node && node.id || ''}:${Math.round(entry.value * 1000) / 1000}`);
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (error) { window.__errors.push(String(error)); }
    window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
    window.addEventListener('unhandledrejection', (event) => window.__errors.push(String(event.reason && event.reason.message || event.reason)));
    if (raw) localStorage.setItem('lgme.demo.member', raw);
    if (standalone) {
      const orig = window.matchMedia.bind(window);
      window.matchMedia = (query) => String(query).includes('display-mode')
        ? { matches: true, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }
        : orig(query);
    }
  }, { raw: signed ? member : '', standalone: pwa });
  return context;
}

async function read(page) {
  return page.evaluate(() => {
    const nav = document.getElementById('site-nav');
    const navBox = nav ? nav.getBoundingClientRect() : null;
    const covered = [];
    if (navBox && navBox.height) {
      for (const el of document.querySelectorAll('h1, h2, a.install-launch, button, input')) {
        if (nav.contains(el) || el.closest('#site-nav')) continue;
        const box = el.getBoundingClientRect();
        if (box.width < 8 || box.height < 8) continue;
        if (box.top < navBox.bottom - 1 && box.bottom > navBox.top + 1) covered.push((el.innerText || el.id || el.tagName).trim().slice(0, 32));
      }
    }
    const taps = [];
    for (const el of document.querySelectorAll('#site-nav button, #site-nav a, .menu-toggle, .chips button')) {
      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      if (box.height < 44 || box.width < 44) taps.push(`${(el.innerText || el.id).trim().slice(0, 16)}:${Math.round(box.width)}x${Math.round(box.height)}`);
    }
    const doc = document.documentElement;
    return {
      cls: Math.round((window.__cls || 0) * 1000) / 1000,
      shifts: (window.__shifts || []).slice(0, 4),
      overflow: doc.scrollWidth > doc.clientWidth + 1,
      covered: covered.slice(0, 4),
      taps,
      errors: (window.__errors || []).filter((item) => !/favicon|pump\.fun|birdeye|solana|geckoterminal/i.test(item)).slice(0, 4),
      nav: Boolean(nav)
    };
  });
}

for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
  for (const scheme of width === 390 ? ['dark', 'light'] : ['dark']) {
    for (const signed of [false, true]) {
      const context = await openContext(width, height, scheme, signed, false);
      const page = await context.newPage();
      const nets = [];
      page.on('pageerror', (error) => nets.push(String(error.message || error).slice(0, 140)));
      page.on('response', (res) => { if (res.status() >= 400 && !ignore(res.url())) nets.push(`${res.status()} ${res.url().replace(base, '').slice(0, 80)}`); });
      for (const [name, path] of routes) {
        nets.length = 0;
        try {
          await page.evaluate(() => { window.__cls = 0; window.__shifts = []; window.__mark = performance.now(); });
          await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(700);
          const data = await read(page);
          const problems = [];
          if (data.cls > 0.05) problems.push(`cls ${data.cls} ${data.shifts.join(',')}`);
          if (data.overflow) problems.push('overflow');
          if (!data.nav) problems.push('no nav');
          if (data.covered.length) problems.push(`cover ${data.covered.join('|')}`);
          if (data.taps.length) problems.push(`taps ${data.taps.join('|')}`);
          if (data.errors.length) problems.push(`js ${data.errors.join('|')}`);
          const unexpected = nets.filter((item) => !(name === 'missing' && item.startsWith('404 ')));
          if (unexpected.length) problems.push(`net ${unexpected.slice(0, 3).join('|')}`);
          const label = `${width} ${scheme} ${signed ? 'in' : 'out'} ${name}`;
          if (problems.length) {
            failures.push(`${label}: ${problems.join('; ')}`);
            console.log('FAIL', label, problems.join('; '));
          } else console.log('ok', label, data.cls);
        } catch (error) {
          failures.push(`${width} ${name}: ${error.message.split('\n')[0]}`);
          console.log('FAIL', name, error.message.split('\n')[0]);
        }
      }
      await context.close();
    }
  }
}

const pwa = await openContext(390, 844, 'dark', false, true);
const pwaPage = await pwa.newPage();
await pwaPage.goto(`${base}/gym`, { waitUntil: 'domcontentloaded' });
await pwaPage.waitForTimeout(500);
const pwaUrl = pwaPage.url();
if (!pwaUrl.includes('demo=1') && !pwaPage.url().includes(base + '/')) failures.push(`pwa loop ${pwaUrl}`);
else if (pwaUrl.includes('/gym') && !pwaUrl.includes('demo=1')) failures.push(`pwa stayed on gym ${pwaUrl}`);
await pwaPage.goto(`${base}/?demo=1`, { waitUntil: 'domcontentloaded' });
await pwaPage.waitForTimeout(400);
if (pwaPage.url().includes('/gym')) failures.push('demo sign-in bounced to gym');
await pwa.close();

const flow = await openContext(390, 844, 'dark', false, false);
const flowPage = await flow.newPage();
await flowPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await flowPage.locator('#demo-email').fill('ada@example.com');
await flowPage.locator('#demo-send').click();
await flowPage.locator('#demo-code').fill('123456');
await flowPage.locator('#demo-verify').click();
await flowPage.locator('#demo-understand').click();
await flowPage.getByRole('button', { name: 'IwantIT', exact: true }).click();
await flowPage.locator('#demo-confirm').waitFor();
await flowPage.evaluate(() => {
  const button = document.getElementById('demo-confirm');
  button.click();
  button.click();
});
await flowPage.locator('#demo-dashboard').waitFor();
const posts = await flowPage.evaluate(() => JSON.parse(localStorage.getItem('lgme.demo.posts') || '[]').length);
if (posts !== 1) failures.push(`double confirm saved ${posts}`);
await flow.close();

await browser.close();
server.close();
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
console.log('stable screens passed');
