const ciLimit = setTimeout(() => { console.error('ui test exceeded 8 minutes'); process.exit(1); }, 8 * 60 * 1000);
ciLimit.unref();
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const pw = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
function fileFor(pathname) {
  let rel = decodeURIComponent(pathname.split('?')[0]);
  if (rel.endsWith('/')) rel = rel.slice(0, -1);
  if (!rel) rel = '/index.html';
  const full = join(root, rel);
  if (existsSync(full) && statSync(full).isDirectory()) return join(full, 'index.html');
  if (existsSync(full)) return full;
  if (existsSync(full + '.html')) return full + '.html';
  return '';
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/ai/ask') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || '{}');
    const text = /creo/i.test(body.question || '') ? 'Creo is value you create.' : '';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(text
      ? { ok: true, text, label: 'Gemini 2.5 Flash Lite', model: 'google/gemini-2.5-flash-lite' }
      : { ok: false, fallback: true, reason: 'skip' }));
    return;
  }
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, proposals: [], offers: [] })); return; }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.addInitScript(() => {
  localStorage.setItem('lgme.reset.epoch', '2');
  localStorage.setItem('lgme.ai.enabled', '1');
  try { localStorage.removeItem('lgme.localModel.ready'); } catch { /* none yet */ }
  Object.defineProperty(window, 'LanguageModel', { configurable: true, get: () => undefined });
});
const page = await context.newPage();
const failures = [];
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
if (!(await page.locator('#ai-dock').isVisible())) await page.locator('#hand-ai').click();
await page.locator('#ai-switch').waitFor();
const chip = await page.locator('#ai-switch').innerText();
if (chip !== 'AI on - unavailable') failures.push(`chip ${chip}`);
if (await page.locator('#ai-switch').evaluate((node) => node.classList.contains('is-on'))) failures.push('unavailable chip is green');
await page.locator('#ai-ask').fill('What is the problem section');
await page.locator('#ai-send').click();
await page.waitForFunction(() => /no section called problem/i.test(document.getElementById('ai-log')?.textContent || ''));
const log = await page.locator('#ai-log').innerText();
if (/turn AI on/i.test(log)) failures.push('told to turn AI on');
if (!/On-device AI isn't available on this phone/.test(log)) failures.push('missing unavailable line');
if (!/sections on this page/i.test(log)) failures.push(`sections ${log.slice(0, 180)}`);
const chips = await page.locator('#ai-try .ai-try-chip').evaluateAll((nodes) => nodes.map((node) => {
  const box = node.getBoundingClientRect();
  return { text: node.textContent, left: box.left, right: box.right, top: box.top };
}));
if (chips.length < 2) failures.push(`try chips ${chips.length}`);
if (chips.length >= 2 && chips[1].left < chips[0].right - 1 && Math.abs(chips[1].top - chips[0].top) < 4) failures.push(`chips overlap ${JSON.stringify(chips)}`);
if (!(await page.locator('#ai-dock').evaluate((node) => node.classList.contains('is-open')))) await page.locator('#ai-expand').click();
await page.locator('#ai-self-test').click();
await page.waitForFunction(() => /AI test passed/.test(document.getElementById('ai-test-line')?.textContent || ''));
const status = await page.locator('#ai-test-line').innerText();
if (!/Gemini 2.5 Flash Lite/.test(status) || /ET$/.test(status.trim())) failures.push(`test line ${status}`);
const named = await page.locator('#ai-switch').innerText();
if (named !== 'AI on · Gemini 2.5 Flash Lite') failures.push(`source chip ${named}`);
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('ai answer ok');
