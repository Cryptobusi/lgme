const ciLimit = setTimeout(() => { console.error('ui test exceeded 8 minutes'); process.exit(1); }, 8 * 60 * 1000);
ciLimit.unref();
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
// Home demo buttons and the Health tile keep their place from first paint until the page settles.
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, notices: [] })); return; }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404, { 'content-type': 'text/html' }); res.end(readFileSync(join(root, '404.html'))); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const failures = [];
const targets = ['#demo-actions', '#health-dash'];
const member = JSON.stringify({ demo: true, handle: 'demo', disclaimer: true });

for (const signed of [false, true]) {
  for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    await context.route('**/*', (route) => (route.request().url().includes('fonts.g') ? route.abort() : route.continue()));
    await context.addInitScript(({ raw, targets }) => {
      if (raw) localStorage.setItem('lgme.demo.member', raw);
      localStorage.setItem('lgme.version.choice', '1');
      window.__first = {};
      document.addEventListener('DOMContentLoaded', () => {
        for (const sel of targets) {
          const node = document.querySelector(sel);
          if (!node) continue;
          const box = node.getBoundingClientRect();
          window.__first[sel] = { y: box.top + window.scrollY, h: box.height };
        }
      });
    }, { raw: signed ? member : '', targets });
    const page = await context.newPage();
    await page.goto(`${base}/?v=1`, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
    await page.waitForTimeout(1500);
    const result = await page.evaluate((targets) => targets.map((sel) => {
      const node = document.querySelector(sel);
      const box = node ? node.getBoundingClientRect() : null;
      return { sel, first: window.__first[sel] || null, last: box ? { y: box.top + window.scrollY, h: box.height } : null };
    }), targets);
    for (const { sel, first, last } of result) {
      const tag = `${signed ? 'member' : 'guest'} ${width} ${sel}`;
      if (!first) { failures.push(`${tag} missing at first paint`); continue; }
      if (!last) { failures.push(`${tag} gone after settle`); continue; }
      if (Math.abs(last.y - first.y) > 2) failures.push(`${tag} moved ${Math.round(first.y)} -> ${Math.round(last.y)}`);
    }
    await context.close();
  }
}

await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('layout hold passed');
