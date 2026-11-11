import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function fileFor(pathname) {
  let rel = decodeURIComponent(pathname.split('#')[0]);
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
const routes = ['/', '/gym', '/gym#/start', '/gym#/train', '/gym#/people', '/gym#/groups', '/gym#/more', '/gym#/dispute', '/gym#/setup', '/gym#/helper', '/gym#/intake', '/gym#/personalize', '/gym#/page', '/gym#/register', '/exchange', '/develop', '/campus', '/neighbors', '/hosts', '/circles', '/stories', '/disclaimer', '/testnet-review', '/owner', '/credits', '/no-such-page', '/my-picture', '/my-picture-classic', '/tap-entry'];
const failures = [];
const rows = [];
mkdirSync('/opt/cursor/artifacts', { recursive: true });

function contrast(fg, bg) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = (rgb) => 0.2126 * lin(rgb[0] / 255) + 0.7152 * lin(rgb[1] / 255) + 0.0722 * lin(rgb[2] / 255);
  const a = L(fg);
  const b = L(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function check(page, label, shot) {
  await page.locator('#ai-dock').waitFor({ timeout: 15000 });
  await page.locator('.ai-label').waitFor();
  await page.evaluate(() => {
    const dock = document.getElementById('ai-dock');
    dock.classList.remove('is-open');
    const open = dock.querySelector('#ai-expand');
    open.setAttribute('aria-expanded', 'false');
    open.textContent = 'Open';
  });
  const box = await page.locator('#ai-dock').evaluate((node) => {
    const dock = getComputedStyle(node);
    const ink = getComputedStyle(node.querySelector('#ai-switch'));
    return {
      height: node.getBoundingClientRect().height,
      text: document.getElementById('ai-log').textContent,
      dock: dock.backgroundColor,
      ink: ink.color,
      label: ink.color
    };
  });
  const problems = [];
  if (box.height > window.innerHeight * 0.25) problems.push(`tall ${box.height}`);
  if (!/Ask here|AI off|AI on/.test(box.text)) problems.push('empty prompt');
  if (shot) await page.screenshot({ path: shot, timeout: 8000, animations: 'disabled' });
  const parse = (value) => {
    const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    return match ? { rgb: [Number(match[1]), Number(match[2]), Number(match[3])], a: match[4] == null ? 1 : Number(match[4]) } : null;
  };
  const bg = parse(box.dock);
  const ink = parse(box.ink);
  const mark = parse(box.label);
  if (!bg || bg.a < 1) problems.push(`dock not solid ${box.dock}`);
  if (bg && ink && contrast(ink.rgb, bg.rgb) < 4.5) problems.push(`text contrast ${contrast(ink.rgb, bg.rgb).toFixed(2)}`);
  if (bg && mark && contrast(mark.rgb, bg.rgb) < 4.5) problems.push(`label contrast ${contrast(mark.rgb, bg.rgb).toFixed(2)}`);
  await page.locator('#ai-accept').click({ timeout: 5000 });
  await page.locator('#ai-expand').click({ timeout: 5000 });
  const opened = await page.locator('#ai-expand').getAttribute('aria-expanded');
  if (opened !== 'true') problems.push('Open did not expand');
  const accepted = await page.locator('#ai-log').innerText();
  if (!/Accepted on this phone/.test(accepted)) problems.push('Accept did not keep the line');
  if (problems.length) failures.push(`${label}: ${problems.join('; ')}`);
  rows.push({ label, ok: problems.length === 0 });
}

for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
  for (const standalone of [false, true]) {
    for (const custom of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript((installed) => {
        localStorage.setItem('lgme.exchange.splashSeen', '1');
        localStorage.setItem('lgme.exchange.introSeen', '1');
        localStorage.setItem('lgme.demo.member', '{"demo":true,"handle":"demo","disclaimer":true}');
        localStorage.setItem('lgme-gym.mode', 'demo');
        localStorage.setItem('lgme-gym.seat', 'jordan');
        window.LanguageModel = { availability: async () => 'available', prompt: async () => 'A short on-device line.' };
        if (!installed) return;
        const orig = window.matchMedia.bind(window);
        window.matchMedia = (query) => String(query).includes('display-mode')
          ? { matches: true, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }
          : orig(query);
      }, standalone);
      await context.route('**/*', (route) => route.request().url().includes('fonts.g') ? route.abort() : route.continue());
      const page = await context.newPage();
      for (const path of routes) {
        const label = `${width} ${standalone ? 'pwa' : 'browser'} ${custom ? 'photo' : 'plain'} ${path}`;
        try {
          await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(async (error) => {
            if (!/interrupted|destroyed/.test(error.message)) throw error;
            await page.waitForLoadState('domcontentloaded');
          });
          if (custom) {
            await page.evaluate(() => {
              const img = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#f4efe4"/><circle cx="86" cy="24" r="14" fill="#e07a3d"/><rect y="48" width="120" height="32" fill="#2f6f4e"/></svg>');
              document.body.style.backgroundImage = `url("${img}")`;
              document.body.style.backgroundSize = 'cover';
              const tile = document.getElementById('health-tile');
              if (tile) tile.style.backgroundImage = `url("${img}")`;
            });
          }
          const shot = width === 390 && path === '/tap-entry' && standalone && !custom
            ? '/opt/cursor/artifacts/ai-dock-installed-390.png'
            : width === 390 && path === '/' && !standalone && custom
              ? '/opt/cursor/artifacts/ai-dock-custom-390.png'
              : '';
          try {
            await check(page, label, shot);
          } catch (error) {
            if (!/destroyed|interrupted/.test(error.message)) throw error;
            await page.waitForLoadState('domcontentloaded').catch(() => {});
            await check(page, label, shot);
          }
        } catch (error) {
          failures.push(`${label}: ${error.message.split('\n')[0]}`);
          rows.push({ label, ok: false });
        }
      }
      await context.close();
    }
  }
}

const explain = await browser.newContext({ viewport: { width: 390, height: 844 } });
await explain.addInitScript(() => {
  window.LanguageModel = { availability: async () => 'available', prompt: async () => 'I do not sign you up. You confirm.' };
});
const explainPage = await explain.newPage();
await explainPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await explainPage.locator('#explain-join').scrollIntoViewIfNeeded();
await explainPage.locator('#explain-join').click();
await explainPage.waitForFunction(() => (document.getElementById('explain-answer')?.textContent || '').length > 10);
rows.push({ label: '390 browser explain', ok: true });
await explain.close();
await browser.close();
server.close();
const passed = rows.filter((row) => row.ok).length;
console.log(`${passed}/${rows.length} passed`);
if (failures.length) {
  console.log(failures.slice(0, 20).join('\n'));
  process.exit(1);
}
console.log('ai dock views passed');
