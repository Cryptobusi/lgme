import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
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
const server = createServer((req, res) => {
  const path = fileFor(new URL(req.url, 'http://127.0.0.1').pathname);
  if (!path) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
mkdirSync('/opt/cursor/artifacts', { recursive: true });
const failures = [];
for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => {
    localStorage.setItem('lgme.reset.epoch', '2');
    localStorage.setItem('lgme.exchange.splashSeen', '1');
  });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('fonts.g')) return route.abort();
    if (url.includes('/api/hedera/status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, network: 'testnet', mainnetWrites: false })
      });
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(`${base}/gym`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (document.querySelector('#health-anchor')?.textContent || '').includes('Hedera testnet'));
  const anchor = await page.locator('#health-anchor').innerText();
  if (anchor !== 'Health hashes are anchored on Hedera testnet. Health data itself is never written on chain.') failures.push(`${width} missing testnet anchor`);
  const gym = await page.locator('body').innerText();
  if (/mainnet/i.test(gym)) failures.push(`${width} gym says mainnet`);
  const home = await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' }).then(() => page.locator('body').innerText());
  if (/mainnet/i.test(home)) failures.push(`${width} homepage says mainnet`);
  await page.goto(`${base}/gym`, { waitUntil: 'domcontentloaded' });
  await page.locator('#health-anchor').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/opt/cursor/artifacts/health-anchor-${width}.png`, timeout: 8000, animations: 'disabled' });
  await context.close();
}
await browser.close();
server.close();
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
console.log('mainnet wording passed');
