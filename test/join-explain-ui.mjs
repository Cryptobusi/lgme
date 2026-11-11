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

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = fileFor(url.pathname);
  if (!path) {
    res.writeHead(404);
    res.end('missing');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

async function open(width, height, ai) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const posts = [];
  page.on('request', (req) => {
    if (req.method() === 'POST') posts.push(req.url());
  });
  await page.addInitScript((on) => {
    if (!on) Object.defineProperty(navigator, 'lgmeAi', { configurable: true, get: () => 'off' });
  }, ai);
  await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  page.posts = posts;
  return page;
}

const sizes = [[390, 844], [768, 1024], [1280, 800]];
const failures = [];

for (const [width, height] of sizes) {
  for (const ai of [true, false]) {
    const label = `${width} ${ai ? 'with AI' : 'without AI'}`;
    const page = await open(width, height, ai);
    try {
      const section = page.locator('#join-step-2');
      await section.scrollIntoViewIfNeeded();
      const steps = await page.locator('#join-steps li').allInnerTexts();
      assert(steps.length === 5, `${label} steps ${steps.length}`);
      assert(steps.every((line) => line.length < 80), `${label} a step is too long`);
      const box = await page.evaluate(() => {
        const node = document.getElementById('join-step-2');
        const small = [];
        node.querySelectorAll('h2, li, button, label, #explain-answer').forEach((el) => {
          const size = parseFloat(getComputedStyle(el).fontSize);
          if ((el.textContent || '').trim() && size < 16) small.push(`${el.tagName}:${size}`);
        });
        const button = document.getElementById('explain-join');
        const rect = button.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          small,
          hidden: document.getElementById('join-explain').hidden,
          tap: Math.round(rect.height)
        };
      });
      assert(box.overflow === false, `${label} overflows`);
      assert(box.small.length === 0, `${label} small type ${box.small.join(',')}`);
      if (ai) {
        assert(box.hidden === false, `${label} helper hidden`);
        assert(box.tap >= 44, `${label} tap ${box.tap}`);
        const before = page.url();
        await page.locator('#explain-join').click();
        await page.waitForFunction(() => /I do not sign you up/.test(document.getElementById('explain-answer')?.textContent || ''));
        await page.locator('#explain-question').fill('Please sign me up');
        await page.locator('#explain-join').click();
        await page.waitForFunction(() => /cannot sign you up/.test(document.getElementById('explain-answer')?.textContent || ''));
        assert(page.url() === before, `${label} left the page`);
        assert(page.posts.length === 0, `${label} posted`);
        if (width === 390) {
          mkdirSync('/opt/cursor/artifacts', { recursive: true });
          await page.screenshot({ path: '/opt/cursor/artifacts/join-step2-phone-ai.png' });
        }
      } else {
        assert(box.hidden === false, `${label} no-AI path hidden`);
        await page.locator('#explain-join').click();
        await page.waitForFunction(() => /I do not sign you up/.test(document.getElementById('explain-answer')?.textContent || ''));
        assert(/no AI/i.test(await page.locator('#explain-note').innerText()), 'missing no-AI note');
        if (width === 390) {
          mkdirSync('/opt/cursor/artifacts', { recursive: true });
          await page.screenshot({ path: '/opt/cursor/artifacts/join-step2-phone-no-ai.png' });
        }
      }
      console.log(`PASS ${label}`);
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
      console.log(`FAIL ${label}: ${error.message}`);
    }
    await page.context().close();
  }
}

await browser.close();
server.close();
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
console.log('6/6 passed');
