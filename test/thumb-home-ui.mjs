import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const pw = loaded.chromium ? loaded : loaded.default;
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
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
  if (url.pathname === '/api/email/send' && req.method === 'POST') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === '/api/email/verify' && req.method === 'POST') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, emailHash: 'abc123hash' }));
    return;
  }
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); return; }
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
  window.LanguageModel = { availability: async () => 'available', prompt: async () => 'A short line.' };
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => String(query).includes('display-mode') && String(query).includes('standalone')
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : original(query);
});
const failures = [];
const page = await context.newPage();
await page.goto(`${base}/?picker=1`, { waitUntil: 'domcontentloaded' });
await page.locator('#profile-board').waitFor();
const navBits = await page.evaluate(() => {
  const back = document.getElementById('site-back');
  const home = document.getElementById('site-home');
  const next = document.getElementById('site-next');
  const bar = document.getElementById('site-nav').getBoundingClientRect();
  const hit = back.getBoundingClientRect();
  return {
    back: back.getAttribute('aria-label'),
    home: home.getAttribute('aria-label'),
    next: next.getAttribute('aria-label'),
    icons: `${back.textContent}${home.textContent}${next.textContent}`,
    bar: Math.round(bar.height),
    hit: Math.round(Math.min(hit.width, hit.height)),
    nextOn: next.hidden === false
  };
});
if (navBits.back !== 'Back' || navBits.home !== 'Home' || navBits.next !== 'Next') failures.push('nav labels');
if (navBits.icons !== '‹⌂›') failures.push(`nav icons ${navBits.icons}`);
if (navBits.bar > 32) failures.push(`nav row ${navBits.bar}`);
if (navBits.hit < 40) failures.push(`nav tap ${navBits.hit}`);
if (!navBits.nextOn) failures.push('next hidden on the sign-in steps');
const glance = await page.evaluate(() => {
  const head = document.querySelector('#dash-creo .dash-head');
  const box = head.getBoundingClientRect();
  const figure = document.getElementById('dash-creo-figure').textContent;
  head.click();
  return {
    height: box.height,
    figure,
    debit: document.getElementById('dash-debit').textContent,
    open: head.getAttribute('aria-expanded') === 'true',
    columns: getComputedStyle(document.getElementById('home-board')).gridTemplateColumns.split(' ').filter(Boolean).length
  };
});
if (glance.figure !== 'None yet' || glance.debit !== 'None yet') failures.push(`mock creo ${glance.figure}`);
if (!glance.open) failures.push('card stayed closed');
if (glance.height < 44) failures.push(`dash tap ${glance.height}`);
if (glance.columns < 2) failures.push('dash is one column');
await page.locator('#one-more').click();
await page.locator('#function-row').waitFor();
await page.locator('#ai-dock').waitFor();
const regions = await page.evaluate(() => {
  const profile = document.getElementById('profile-board').getBoundingClientRect();
  const row = document.getElementById('function-row').getBoundingClientRect();
  const dock = document.getElementById('ai-dock').getBoundingClientRect();
  const button = document.querySelector('#function-row a').getBoundingClientRect();
  const ratio = dock.height / window.innerHeight;
  document.getElementById('function-row').scrollIntoView({ block: 'end' });
  const rowAfter = document.getElementById('function-row').getBoundingClientRect();
  const dockAfter = document.getElementById('ai-dock').getBoundingClientRect();
  return { order: profile.top < row.top, clear: rowAfter.bottom <= dockAfter.top + 2, target: button.height >= 48, ratio };
});
if (!regions.order) failures.push('regions out of order');
if (!regions.clear) failures.push('function row overlaps the dock');
if (!regions.target) failures.push('tap target under 48');
const areas = await page.evaluate(() => ['#profile-board', '#function-row', '#ai-dock'].map((id) => {
  const style = getComputedStyle(document.querySelector(id));
  return { id, width: style.borderTopWidth, style: style.borderTopStyle, color: style.borderTopColor };
}));
for (const area of areas) {
  if (area.width !== '2px' || area.style !== 'solid') failures.push(`outline ${area.id} ${area.width} ${area.style}`);
}
if (await page.locator('#ai-head').count() && !(await page.locator('#ai-head').isVisible())) failures.push('AI notice hidden');
if (regions.ratio < 0.38 || regions.ratio > 0.42) failures.push(`dock height ${regions.ratio}`);
if (await page.locator('#functions-import').isVisible()) failures.push('choose file visible before open');
if ((await page.locator('#function-row a').first().innerText()) !== 'IdidIt (verified receipt)') failures.push('ididit label');
if (!/Step 1 of 3: email or authenticator/.test(await page.locator('#step-count').innerText())) failures.push('step count');
await page.locator('#access-fingerprint').scrollIntoViewIfNeeded();
const fingerBox = await page.locator('#access-fingerprint').boundingBox();
const dockBox = await page.locator('#ai-dock').boundingBox();
if (!fingerBox || fingerBox.height < 48 || await page.locator('#access-fingerprint').isDisabled()) failures.push('fingerprint button hidden');
await page.locator('#access-fingerprint').click();
await page.locator('#device-allow').click();
await page.waitForFunction(() => /Touch the sensor when your phone asks|Try again|Signed in/.test(document.querySelector('.fingerprint-steps')?.innerHTML || ''));
if (fingerBox && dockBox && fingerBox.y < dockBox.y + dockBox.height && fingerBox.y + fingerBox.height > dockBox.y) failures.push('fingerprint button covered');
const emailBox = await page.locator('#access-email').boundingBox();
if (!emailBox || emailBox.width < 280 || emailBox.height < 48) failures.push('email field cut off');
await page.route('**/api/email/verify', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"enabled":false,"emailHash":"abc123hashmember","member":"new"}' }));
await page.locator('#access-email').fill('ada@example.com');
await page.locator('#access-send').click();
await page.waitForFunction(() => /Member ID/.test(document.getElementById('access-member')?.textContent || ''));
await page.unroute('**/api/email/verify');
await page.locator('#ai-test').click();
const ai = await page.locator('#ai-test-result').innerText();
if (!/AI on|AI off/.test(ai) || !/Typing still works/.test(ai)) failures.push(`ai test ${ai}`);
await page.locator('#access-grant').click();
if ((await page.evaluate(() => localStorage.getItem('lgme.access'))) !== 'full') failures.push('access not granted');
await page.locator('#function-row a[data-sensitive]').click();
await page.locator('#gate-passkey').click();
await page.waitForFunction(() => /fingerprint/i.test(document.getElementById('gate-status')?.innerHTML || ''));
const gateBox = await page.locator('#gate-passkey').boundingBox();
const dockNow = await page.locator('#ai-dock').boundingBox();
if (!gateBox || await page.locator('#gate-passkey').isDisabled()) failures.push('gate fingerprint hidden');
if (gateBox && dockNow && gateBox.y < dockNow.y + dockNow.height && gateBox.y + gateBox.height > dockNow.y) failures.push('gate fingerprint covered');
await page.evaluate(() => {
  const day = new Date().toISOString().slice(0, 10);
  localStorage.setItem('lgme.member.id', 'ada');
  localStorage.setItem('lgme.credits.mine', JSON.stringify({ balances: { ada: 150 }, history: [{ member: 'ada', amount: 200, why: 'IdidIt receipt', when: day }, { member: 'ada', amount: -50, why: 'Spent', when: day }] }));
  localStorage.setItem('lgme.incognito.pending', JSON.stringify([{ path: '/api/hedera/queue' }]));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('#dash-creo-figure').waitFor();
const filled = await page.evaluate(() => ({
  creo: document.getElementById('dash-creo-figure').textContent,
  debit: document.getElementById('dash-debit').textContent,
  credit: document.getElementById('dash-credit').textContent,
  today: document.getElementById('dash-today-figure').textContent,
  receipt: document.getElementById('dash-receipt-figure').textContent,
  held: document.getElementById('dash-incognito-figure').textContent
}));
if (filled.creo !== '1.50' || filled.debit !== '-0.50' || filled.credit !== '2.00') failures.push(`book ${filled.creo} ${filled.debit} ${filled.credit}`);
if (filled.today !== '2' || filled.receipt !== '2.00' || filled.held !== '1') failures.push(`glance ${filled.today} ${filled.receipt} ${filled.held}`);
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('thumb home ok');
