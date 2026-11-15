import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const pw = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
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
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, network: 'testnet', seen: {} })); return; }
  const path = fileFor(url.pathname);
  if (!path) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' });
await context.addInitScript(() => {
  localStorage.setItem('lgme.reset.epoch', '2');
  localStorage.setItem('lgme.ai.enabled', '0');
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => String(query).includes('display-mode') && String(query).includes('standalone')
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : original(query);
});
const failures = [];
const page = await context.newPage();
await page.goto(`${base}/gym`, { waitUntil: 'domcontentloaded' });
await page.locator('#ai-ask').waitFor();
const panel = await page.locator('#ai-dock').evaluate((node) => node.getBoundingClientRect().height / window.innerHeight);
if (panel < 0.38 || panel > 0.42) failures.push(`panel ${panel}`);
const chip = await page.locator('.ai-chip').first().evaluate((node) => {
  const box = node.getBoundingClientRect();
  return { h: box.height, size: parseFloat(getComputedStyle(node).fontSize) };
});
if (chip.h < 24 || chip.h > 32 || chip.size < 13 || chip.size > 14) failures.push(`chip ${chip.h}/${chip.size}`);
if (!(await page.locator('#ai-chip-hint').isVisible())) failures.push('chip hint missing');
await page.locator('#ai-ask').fill('log 10min treadmill');
await page.locator('#ai-ask').evaluate((node) => {
  node.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertLineBreak', bubbles: true, cancelable: true }));
});
if (!/Ready to log on IdidIt: Treadmill, 10 min/.test(await page.locator('#ai-log').innerText())) failures.push('first enter did not stage');
if (!/is-current/.test(await page.locator('#ai-steps li').first().getAttribute('class'))) failures.push('step 1 not current');
if (await page.locator('#gym-ididit-confirm').count()) failures.push('first enter recorded or opened');
await page.waitForTimeout(50);
await page.locator('#ai-ask').press('Enter');
await page.locator('#gym-ididit-other').waitFor();
if ((await page.locator('#gym-ididit-other').inputValue()) !== 'Treadmill, 10 min') failures.push('draft title');
if ((await page.locator('#gym-ididit-activity').inputValue()) !== 'Treadmill') failures.push('draft activity');
if ((await page.locator('#gym-ididit-minutes').inputValue()) !== '10') failures.push('draft minutes');
if (!/Draft filled: Treadmill, 10 min/.test(await page.locator('#ai-log').innerText())) failures.push('arrival explainer');
if ((await page.locator('#ai-steps li.is-current').innerText()).indexOf('2)') !== 0) failures.push('step 2 not current');
if (/Opening draft/.test(await page.locator('#ai-action-status').innerText().catch(() => ''))) failures.push('opening draft label');
if (await page.locator('#category-board').isVisible()) failures.push('listings still cover the draft');
if (!(await page.locator('#ididit-done').isVisible())) failures.push('draft not visible');
const wrap = await page.locator('#ai-log').evaluate((node) => getComputedStyle(node).whiteSpace);
if (wrap === 'nowrap') failures.push('explainer truncated');
await page.locator('#gym-ididit-minutes').fill('12');
if (!/Draft filled: Treadmill, 12 min/.test(await page.locator('#ai-log').innerText())) failures.push('edit did not update explainer');
if (/Recorded on testnet/.test(await page.locator('#ididit-status').innerText())) failures.push('recorded without confirm');
await page.locator('#ai-ask').fill('Treadmill 5 miles at 3mph');
await page.locator('#ai-ask').press('Enter');
await page.waitForTimeout(50);
await page.locator('#ai-ask').press('Enter');
await page.locator('#gym-ididit-distance').waitFor();
if ((await page.locator('#gym-ididit-distance').inputValue()) !== '5 miles') failures.push('distance');
if ((await page.locator('#gym-ididit-speed').inputValue()) !== '3 mph') failures.push('speed');
if ((await page.locator('#gym-ididit-minutes').inputValue()) !== '100') failures.push('computed minutes');
if (!/about 100 min/.test(await page.locator('#gym-ididit-computed').innerText())) failures.push('computed label');
if (!/Draft filled: Treadmill, 5 miles, 3 mph, about 100 min/.test(await page.locator('#ai-log').innerText())) failures.push('pace explainer');
if (!(await page.locator('#ididit-done').isVisible())) failures.push('pace draft hidden');
await page.locator('#ai-ask').fill('I want a ride');
await page.locator('#ai-send').click();
await page.locator('#ai-confirm').click();
await page.locator('#prompt-draft').waitFor();
if (!/a ride/.test(await page.locator('#prompt-draft').innerText())) failures.push('send did not open IwantIT');
await page.evaluate(() => {
  const scroller = document.getElementById('ai-scroll');
  const extra = document.createElement('p');
  extra.textContent = 'Extra line so the dock overflows. '.repeat(20);
  scroller.append(extra);
  scroller.dispatchEvent(new Event('scroll'));
});
if (await page.locator('#ai-more').isHidden()) failures.push('more indicator missing');
const before = await page.locator('#ai-dock').evaluate((node) => node.getBoundingClientRect().height);
await page.locator('#ai-larger').click();
await page.reload({ waitUntil: 'domcontentloaded' });
const size = await page.evaluate(() => localStorage.getItem('lgme.dock.size'));
if (size !== 'tall') failures.push(`size not remembered ${size}`);
const after = await page.locator('#ai-dock').evaluate((node) => node.getBoundingClientRect().height);
if (!(after > before - 5)) failures.push(`resize ${before} to ${after}`);
const ai = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' });
await ai.addInitScript(() => {
  localStorage.setItem('lgme.reset.epoch', '2');
  localStorage.setItem('lgme.ai.enabled', '1');
  localStorage.setItem('lgme.dock.used', JSON.stringify({ 'What can I do here?': 4, 'Log a workout': 1 }));
  window.LanguageModel = { availability: async () => 'available', prompt: async () => 'A short on-device line.' };
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => String(query).includes('display-mode') && String(query).includes('standalone')
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : original(query);
});
const aiPage = await ai.newPage();
await aiPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await aiPage.locator('#ai-dock').waitFor();
if ((await aiPage.locator('#ai-switch').innerText()) !== 'AI on') failures.push('AI did not start');
const order = await aiPage.locator('.ai-chip').allTextContents();
if (order[0] !== 'What can I do here?') failures.push(`rank ${order.join('|')}`);
await aiPage.locator('#ai-accept').click();
if (!/Accepted on this phone/.test(await aiPage.locator('#ai-log').innerText())) failures.push('accept did not apply');
const applied = await aiPage.evaluate(() => sessionStorage.getItem('lgme.prompt.draft'));
if (!/help/.test(applied || '')) failures.push(`accept draft ${applied}`);
await ai.close();
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('dock prompt ok');
