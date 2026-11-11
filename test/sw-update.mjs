import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;
let version = 'OLD';
const updater = readFileSync(new URL('../js/sw-update.js', import.meta.url));
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/sw.js') {
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-cache' });
    res.end(`const VERSION=${JSON.stringify(version)};
self.addEventListener('install', (event) => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (event) => {
  const path = new URL(event.request.url).pathname;
  if (path === '/sw-version') event.respondWith(new Response(VERSION, { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } }));
});
`);
    return;
  }
  if (url.pathname === '/js/sw-update.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    res.end(updater);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><p id="seen">loading</p><script src="/js/sw-update.js"></script></body></html>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
await page.waitForTimeout(300);
const first = await page.evaluate(async () => (await fetch('/sw-version', { cache: 'no-store' })).text());
if (first !== 'OLD') throw new Error(`first version ${first}`);
version = 'NEW';
await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  await reg.update();
});
await page.waitForFunction(async () => {
  try { return (await fetch('/sw-version', { cache: 'no-store' })).text() === 'NEW'; } catch { return false; }
}, null, { timeout: 15000 });
const seen = await page.evaluate(() => sessionStorage.getItem('lgme.sw.reload'));
if (seen === '1') throw new Error('reload flag stuck');
console.log('sw update passed', await page.evaluate(async () => (await fetch('/sw-version', { cache: 'no-store' })).text()));
await browser.close();
server.close();
