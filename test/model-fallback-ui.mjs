import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const playwright = loaded.chromium ? loaded : loaded.default;
const { chromium, webkit } = playwright;
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
mkdirSync('/opt/cursor/artifacts', { recursive: true });
const failures = [];

async function check(browserType, name, launch = {}) {
  const browser = await browserType.launch(launch);
  for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(() => {
      localStorage.setItem('lgme.reset.epoch', '2');
      localStorage.setItem('lgme.demo.member', '{"demo":true,"handle":"demo","disclaimer":true}');
      localStorage.setItem('lgme.exchange.splashSeen', '1');
      try { delete window.LanguageModel; } catch { /* the page still loads */ }
      window.LanguageModel = undefined;
    });
    const page = await context.newPage();
    await page.goto(`${base}/ai-setup`, { waitUntil: 'domcontentloaded' });
    await page.locator('#model-try').click();
    const status = await page.locator('#ai-check-status').innerText();
    if (!/passed the warmup|did not pass the warmup/.test(status)) failures.push(`${name} ${width} ${status}`);
    if (width === 390) await page.screenshot({ path: `/opt/cursor/artifacts/model-fallback-${name}-390.png`, timeout: 8000, animations: 'disabled' });
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Offer', exact: true }).click();
    await page.locator('#demo-confirm').click();
    await page.locator('#browse-only').waitFor();
    await context.close();
  }
  await browser.close();
}

await check(chromium, 'chromium', { executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  await check(webkit, 'webkit');
} catch (error) {
  const message = String(error?.message || error);
  if (/missing dependencies|shared libraries|Host system/.test(message)) {
    console.log('webkit skipped on this runner');
  } else {
    failures.push(`webkit ${message.split('\n')[0]}`);
  }
}
server.close();
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
console.log('model fallback passed');
