import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const playwright = loaded.chromium ? loaded : loaded.default;
const { chromium, webkit } = playwright;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
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
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/email/status') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, enabled: false }));
    return;
  }
  if (url.pathname === '/api/hedera/status') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, enabled: true, network: 'testnet', mainnetWrites: false }));
    return;
  }
  if (url.pathname === '/api/hedera/queue') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, network: 'testnet', transactionId: '0.0.1273453@1.1', sequenceNumber: '3' }));
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

async function fresh(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await context.addInitScript(() => {
    localStorage.setItem('lgme.reset.epoch', '2');
    localStorage.setItem('lgme.exchange.splashSeen', '1');
    localStorage.setItem('lgme.ai.enabled', '1');
  });
  const page = await context.newPage();
  return { context, page };
}

async function onboard(page, shot) {
  await page.goto(`${base}/gym#/start`, { waitUntil: 'domcontentloaded' });
  await page.locator('#demo-phone').click();
  await page.locator('#demo-understand').click();
  if (await page.locator('#collect-health').count()) {
    await page.locator('#collect-health').check();
    await page.locator('#age-confirm').click();
  }
  if (await page.locator('#demo-confirm').count()) await page.locator('#demo-confirm').click();
  await page.locator('#join-phone').click();
  await Promise.race([
    page.locator('#health-gate').waitFor(),
    page.locator('#offer-chips').waitFor()
  ]);
  if (await page.locator('#health-gate').count()) {
    await page.locator('#health-gate input').nth(0).check();
    await page.locator('#health-gate input').nth(1).check();
    await page.locator('#age-continue').click();
  }
  await page.locator('#offer-chips').waitFor();
  if (shot) {
    await page.locator('#offer-chips').evaluate((node) => {
      const y = node.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo(0, Math.max(0, y));
    });
    await page.screenshot({ path: '/opt/cursor/artifacts/gym-onboard-390.png', timeout: 8000, animations: 'disabled' });
  }
  await page.locator('#agree-all').click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('#intake-chips').waitFor();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('#handle-chips').waitFor();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.locator('#setup-fee').waitFor();
  const status = await page.locator('#gym-status').innerText().catch(() => '');
  if (/did not open|Agree to each|Both offerings|Add your legal|Add a handle|Pick 3/.test(status)) failures.push(`onboard ${status}`);
}

async function ididitHome(page, shot) {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'IdidIt (verified receipt)', exact: true }).click();
  await page.locator('#demo-phone').click();
  await page.locator('#demo-understand').click();
  await page.locator('#ididit-chips').waitFor();
  await page.getByRole('button', { name: 'I finished a walk', exact: true }).click();
  await page.locator('#demo-confirm').click();
  await page.locator('#ididit-done').waitFor();
  const text = await page.locator('#ididit-status').innerText();
  if (!/Recorded on testnet/.test(text)) failures.push(`home receipt ${text}`);
  if (!/IdidIt \(verified receipt\)/.test(await page.locator('#ididit-done').innerText())) failures.push('home receipt name');
  if (shot) {
    await page.locator('#ididit-done').evaluate((node) => {
      const y = node.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo(0, Math.max(0, y));
    });
    await page.screenshot({ path: '/opt/cursor/artifacts/ididit-done-390.png', timeout: 8000, animations: 'disabled' });
  }
}

async function ididitGym(page) {
  await page.goto(`${base}/gym#/ididit`, { waitUntil: 'domcontentloaded' });
  await page.locator('#gym-ididit-confirm').click();
  await page.locator('#ididit-status', { hasText: 'Recorded on testnet' }).waitFor();
  const text = await page.locator('#ididit-status').innerText();
  if (!/Recorded on testnet/.test(text)) failures.push(`gym receipt ${text}`);
}

async function dock(page, shot) {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  const ask = page.locator('#ai-ask');
  await ask.waitFor();
  const info = await ask.evaluate((node) => ({
    tag: node.tagName,
    font: parseFloat(getComputedStyle(node).fontSize),
    disabled: node.disabled,
    readOnly: node.readOnly,
    events: getComputedStyle(node).pointerEvents
  }));
  if (info.tag !== 'TEXTAREA' || info.font < 16 || info.disabled || info.readOnly || info.events === 'none') failures.push(`dock input ${JSON.stringify(info)}`);
  await ask.click();
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id === 'ai-ask');
  if (!focused) failures.push('dock input did not focus');
  await page.getByRole('button', { name: 'Log a workout', exact: true }).click();
  if (await ask.inputValue() !== 'Log a workout') failures.push('chip did not fill the input');
  if (shot) {
    await ask.scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/opt/cursor/artifacts/ai-dock-focus-390.png', timeout: 8000, animations: 'disabled' });
  }
}

async function check(browserType, name, launch) {
  const browser = await browserType.launch(launch);
  const shot = name === 'chromium';
  const first = await fresh(browser);
  await onboard(first.page, shot);
  await first.context.close();
  const second = await fresh(browser);
  await ididitHome(second.page, shot);
  await second.context.close();
  const third = await fresh(browser);
  await ididitGym(third.page);
  await third.context.close();
  const fourth = await fresh(browser);
  await dock(fourth.page, shot);
  await fourth.context.close();
  await browser.close();
}

await check(chromium, 'chromium', { executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  await check(webkit, 'webkit', {});
} catch (error) {
  const message = String(error?.message || error);
  if (/missing dependencies|shared libraries|Host system/.test(message)) console.log('webkit skipped on this runner');
  else failures.push(`webkit ${message.split('\n')[0]}`);
}
server.close();
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
console.log('phone flows passed');
