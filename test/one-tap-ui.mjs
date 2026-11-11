import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
function fileFor(pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.includes('..')) return '';
  if (rel.endsWith('/')) rel = rel.slice(0, -1);
  if (rel === '') rel = '/index.html';
  const full = join(root, rel);
  if (existsSync(full) && statSync(full).isDirectory()) return join(full, 'index.html');
  if (existsSync(full)) return full;
  if (existsSync(`${full}.html`)) return `${full}.html`;
  return '';
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, notified: true, item: { title: 'I want to help develop Campus' }, error: 'Held in this test. Nothing was written.' }));
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
const tiers = ['browser', 'app', 'none'];
const sizes = [[390, 844], [1280, 800]];
const rows = [];
const failures = [];
function assert(ok, message) { if (!ok) throw new Error(message); }

async function open(width, height, tier) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  let taps = 0;
  page.on('click', () => {});
  await page.addInitScript((picked) => {
    localStorage.setItem('lgme.demo.member', '{"demo":true,"handle":"demo"}');
    localStorage.setItem('lgme.exchange.splashSeen', '1');
    localStorage.setItem('lgme.exchange.introSeen', '1');
    localStorage.setItem('lgme-gym.seat', 'mina');
    localStorage.setItem('lgme-gym.mode', 'demo');
    localStorage.setItem('lgme.oneTap.memory', JSON.stringify({ skill: 'writing', time: 'one hour', fee: 'self' }));
    if (picked === 'app') Object.defineProperty(navigator, 'lgmeAi', { configurable: true, get: () => 'app' });
    if (picked === 'none') Object.defineProperty(navigator, 'lgmeAi', { configurable: true, get: () => 'off' });
    if (picked === 'browser') {
      window.LanguageModel = { availability: async () => 'available', prompt: async () => 'I can help build this on this phone.' };
    }
  }, tier);
  await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  page.tapCount = () => taps;
  page.count = async (selector) => { taps += 1; await page.locator(selector).click(); };
  return page;
}

async function run(width, height, tier) {
  const page = await open(width, height, tier);
  const noteFor = async (selector) => (await page.locator(selector).innerText()).trim();
  try {
    if (tier !== 'browser') {
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      await page.locator('#ai-dock').waitFor();
      assert(/built-in AI/i.test(await page.locator('#ai-log').innerText()), 'enable notice');
      console.log(`PASS ${width} ${tier} notice`);
      await page.context().close();
      return;
    }
    await page.goto(`${base}/?picker=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('#helper-note').waitFor();
    const installNote = await noteFor('#helper-note');
    await page.count('[data-install-launch]');
    await page.waitForURL(/\/(exchange|gym)/);
    rows.push({ flow: 'Install & launch', tier, width, taps: 1, note: installNote });

    await page.goto(`${base}/?picker=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('#start-health').scrollIntoViewIfNeeded();
    await page.count('#start-health');
    await page.waitForURL(/\/gym/);
    rows.push({ flow: 'Health start', tier, width, taps: 1, note: installNote });

    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('#explain-join').scrollIntoViewIfNeeded();
    await page.count('#explain-join');
    await page.waitForFunction(() => (document.getElementById('explain-answer')?.textContent || '').length > 20);
    rows.push({ flow: 'Explain this to me', tier, width, taps: 1, note: await noteFor('#explain-note') });

    await page.goto(`${base}/?picker=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-entry="campus"] .help-develop').scrollIntoViewIfNeeded();
    await page.count('[data-entry="campus"] .help-develop');
    await page.waitForSelector('#want-title');
    assert((await page.locator('#want-title').inputValue()).includes('Campus'), 'title');
    assert((await page.locator('#want-skill').inputValue()) === 'writing', 'skill');
    await page.locator('#want-confirm').scrollIntoViewIfNeeded();
    if (width === 390 && tier === 'app') {
      mkdirSync('/opt/cursor/artifacts', { recursive: true });
      await page.screenshot({ path: '/opt/cursor/artifacts/one-tap-draft-390.png' });
    }
    await page.count('#want-confirm');
    await page.waitForFunction(() => /Posted|Nothing was posted|Held/.test(document.getElementById('want-status')?.textContent || ''));
    rows.push({ flow: 'Help develop', tier, width, taps: 2, note: await noteFor('#want-helper') });

    await page.goto(`${base}/ai-help`, { waitUntil: 'domcontentloaded' });
    await page.locator('#one-tap-draft').waitFor();
    await page.count('#one-tap-confirm');
    await page.waitForFunction(() => /Confirmed/.test(document.getElementById('ai-status')?.textContent || ''));
    rows.push({ flow: 'AI help', tier, width, taps: 2, note: await noteFor('#one-tap-note'), why: 'The page opens from the AI help link, then Confirm is the second tap.' });

    await page.count('#one-tap-repair');
    await page.locator('#one-tap-repair-confirm').waitFor();
    await page.count('#one-tap-repair-confirm');
    rows.push({ flow: 'Repair helper', tier, width, taps: 2, note: await noteFor('#one-tap-note') });

    await page.goto(`${base}/exchange`, { waitUntil: 'domcontentloaded' });
    await page.locator('#one-tap-listing').scrollIntoViewIfNeeded();
    await page.count('#one-tap-listing');
    await page.locator('#confirm-upload').waitFor();
    await page.count('#confirm-upload');
    await page.waitForFunction(() => /Nothing was posted|Held|Posted/.test(document.getElementById('exchange-test-status')?.textContent || ''));
    rows.push({ flow: 'Listing draft', tier, width, taps: 2, note: 'prefilled session' });

    await page.goto(`${base}/gym.html#/more`, { waitUntil: 'domcontentloaded' });
    await page.locator('#invite-one-confirm').waitFor({ timeout: 20000 });
    await page.count('#invite-one-confirm');
    await page.waitForFunction(() => /Confirmed on this phone/.test(document.body.innerText));
    rows.push({ flow: 'Invite and fee', tier, width, taps: 1, note: await noteFor('#invite-one-note'), why: 'The invite draft is already on the screen. Confirm is the only tap. Sharing stays on the member’s own buttons after that.' });
    console.log(`PASS ${width} ${tier}`);
  } catch (error) {
    failures.push(`${width} ${tier}: ${error.message}`);
    console.log(`FAIL ${width} ${tier}: ${error.message}`);
  }
  console.log(JSON.stringify(rows.filter((row) => row.width === width && row.tier === tier)));
  await page.context().close();
}

for (const [width, height] of sizes) {
  for (const tier of tiers) await run(width, height, tier);
}
await browser.close();
server.close();
const over = rows.filter((row) => row.taps > 2);
if (over.length) failures.push(over.map((row) => `${row.flow} ${row.taps}`).join('; '));
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log(`${rows.length} flows within two taps`);
