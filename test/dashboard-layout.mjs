import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
let emptyMode = false;
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.endsWith('.html') || url.pathname === '/') emptyMode = url.searchParams.get('empty') === '1';
  if (url.pathname.startsWith('/api/')) {
    const empty = emptyMode;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, network: 'testnet', listings: empty ? [] : [{ sequenceNumber: 90, consensusTimestamp: '1794360913.1', item: { id: 'hx-walk', kind: 'listing', group: 'health', service: 'walk', side: 'offer', status: 'Test item - unclaimed', durationMin: 45 } }] }));
    return;
  }
  const path = join(root, decodeURIComponent(url.pathname === '/' ? '/exchange.html' : url.pathname));
  try {
    const body = readFileSync(path);
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end('missing');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const sizes = [[360, 640], [640, 360], [390, 844], [844, 390], [414, 896], [896, 414], [768, 1024], [1024, 768], [1280, 800], [1440, 900]];
const schemes = ['light', 'dark'];
const periods = ['day', 'week', 'month'];
const failures = [];
const book = { handle: 'mina-vale', sessions: [{ id: 's1', at: '2026-11-10T15:00:00Z', side: 'offer', minutes: 60, status: 'Test item - receipt', activity: 'Walking group', credit: 2, attestations: 1 }] };

for (const [width, height] of sizes) {
  for (const scheme of schemes) {
    for (const empty of [false, true]) {
      for (const personal of [false, true]) {
        const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
        await page.addInitScript((saved) => {
          localStorage.setItem('lgme.exchange.splashSeen', '1');
          localStorage.setItem('lgme.exchange.introSeen', '1');
          if (saved) {
            localStorage.setItem('lgme-gym.seat', 'mina-vale');
            localStorage.setItem('lgme.health.book', JSON.stringify(saved));
          }
        }, personal ? (empty ? { handle: 'mina-vale', sessions: [] } : book) : null);
        await page.goto(`${base}/exchange.html${empty ? '?empty=1' : ''}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#overview-source', { timeout: 20000 });
        if (personal) await page.getByRole('button', { name: 'Mine' }).click();
        for (const period of periods) {
          await page.getByRole('button', { name: period, exact: true }).click();
          const box = await page.evaluate(() => {
            const node = document.querySelector('#exchange-overview');
            const rect = node.getBoundingClientRect();
            const small = [];
            node.querySelectorAll('button, a, small, b, h2, p').forEach((el) => {
              const size = parseFloat(getComputedStyle(el).fontSize);
              if ((el.textContent || '').trim() && size < 12) small.push(`${el.tagName}:${size}`);
            });
            const taps = [];
            node.querySelectorAll('button, .dash-kpi').forEach((el) => {
              const r = el.getBoundingClientRect();
              if (r.height < 44 || r.width < 44) taps.push(`${el.textContent.trim().slice(0, 12)}:${Math.round(r.width)}x${Math.round(r.height)}`);
            });
            const clipped = [];
            node.querySelectorAll('button, a, small, b, h2, p').forEach((el) => {
              if ((el.textContent || '').trim() && el.scrollWidth > el.clientWidth + 1) clipped.push(el.textContent.trim().slice(0, 24));
            });
            const boxes = [...node.querySelectorAll('.dash-kpi')].map((el) => el.getBoundingClientRect());
            let overlap = false;
            for (let i = 0; i < boxes.length; i += 1) {
              for (let j = i + 1; j < boxes.length; j += 1) {
                const a = boxes[i];
                const b = boxes[j];
                if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) overlap = true;
              }
            }
            return {
              bottom: rect.bottom,
              height: rect.height,
              inner: window.innerHeight,
              overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
              small,
              taps,
              clipped,
              overlap
            };
          });
          const name = `${width}x${height} ${scheme} ${empty ? 'empty' : 'full'} ${personal ? 'mine' : 'all'} ${period}`;
          if (box.overflowX || box.bottom > box.inner + 1 || box.height > box.inner + 1 || box.small.length || box.taps.length || box.clipped.length || box.overlap) {
            failures.push({ name, ...box });
          }
        }
        await page.close();
      }
    }
  }
}
await browser.close();
server.close();
if (failures.length) {
  console.log(JSON.stringify(failures.slice(0, 12), null, 2));
  console.log('failures', failures.length);
  process.exit(1);
}
console.log('layout ok', sizes.length * schemes.length * 2 * 2 * periods.length);
