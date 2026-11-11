import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown' };
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
const posts = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'POST' && url.pathname === '/api/develop/want') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    posts.push(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, item: { title: 'Report a problem' } }));
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
mkdirSync('/opt/cursor/artifacts', { recursive: true });
const failures = [];
for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => {
    localStorage.setItem('lgme.reset.epoch', '2');
    localStorage.setItem('lgme.demo.member', '{"demo":true,"handle":"demo","disclaimer":false}');
    sessionStorage.setItem('lgme.demo.pending', '{"step":"disclaimer","choice":"Health"}');
  });
  await context.route('**/*', (route) => route.request().url().includes('fonts.g') ? route.abort() : route.continue());
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#demo-understand').click();
  await page.locator('#age-confirm').waitFor();
  await page.locator('#collect-health').waitFor();
  await page.locator('#share-health').waitFor();
  if (await page.locator('#share-health').isChecked()) failures.push(`${width} share started on`);
  await page.screenshot({ path: `/opt/cursor/artifacts/health-consent-${width}.png`, timeout: 8000, animations: 'disabled' });
  await page.locator('#age-confirm').click();
  if (!(await page.locator('#health-consent-status').innerText()).includes('this phone')) failures.push(`${width} age tap skipped the collect choice`);
  await page.locator('#collect-health').check();
  await page.locator('#age-confirm').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lgme.health.consent') || 'null'));
  if (!saved?.adult || !saved.collect || saved.share !== false) failures.push(`${width} consent ${JSON.stringify(saved)}`);
  await context.close();
}
const report = await browser.newContext({ viewport: { width: 390, height: 844 } });
await report.addInitScript(() => localStorage.setItem('lgme.reset.epoch', '2'));
const reportPage = await report.newPage();
await reportPage.goto(`${base}/gym/breach-plan`, { waitUntil: 'domcontentloaded' });
await reportPage.locator('#report-note').fill('The phone showed a health note I did not share.');
await reportPage.locator('#report-problem button').click();
await reportPage.locator('#report-status').waitFor();
if (!posts.length || posts[0].title !== 'Report a problem' || posts[0].category !== 'Health') failures.push('report did not notify');
await reportPage.screenshot({ path: '/opt/cursor/artifacts/report-problem-390.png', timeout: 8000, animations: 'disabled' });
await report.close();
await browser.close();
server.close();
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
console.log('health consent ui passed');
