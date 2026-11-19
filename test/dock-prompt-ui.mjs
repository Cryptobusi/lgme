const ciLimit = setTimeout(() => { console.error('ui test exceeded 8 minutes'); process.exit(1); }, 8 * 60 * 1000);
ciLimit.unref();
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
const mic = await page.locator('#ai-mic-btn').boundingBox();
if (!mic || mic.width < 40 || mic.height < 40) failures.push(`mic hidden ${JSON.stringify(mic)}`);
const chipsNow = await page.locator('#ai-chips .ai-chip').allTextContents();
if (!chipsNow.includes('What is lgme')) failures.push(`path chip ${chipsNow.join('|')}`);
if (await page.locator('#ai-intents').count()) failures.push('intent tabs remain');
const frame = await page.locator('#ai-log-frame').evaluate((node) => getComputedStyle(node).borderTopWidth);
if (frame !== '2px') failures.push(`log frame ${frame}`);
const dots = await page.locator('#ai-status span i').count();
if (dots < 5) failures.push(`status dots ${dots}`);
const overlap = await page.locator('#ai-status').evaluate((node) => {
  const boxes = [...node.querySelectorAll('span')].map((item) => item.getBoundingClientRect()).filter((box) => box.width > 0);
  return boxes.some((box, index) => index > 0 && box.left < boxes[index - 1].right - 1);
});
if (overlap) failures.push('status labels overlap');
await page.evaluate(() => {
  class LocalSpeech {
    start() { window.__speech = this; }
    stop() { this.stopped = true; }
  }
  LocalSpeech.prototype.processLocally = true;
  window.SpeechRecognition = LocalSpeech;
  window.webkitSpeechRecognition = LocalSpeech;
});
const off = await page.locator('#ai-mic-btn').evaluate((node) => ({
  off: node.classList.contains('is-off'),
  pressed: node.getAttribute('aria-pressed'),
  bg: getComputedStyle(node).backgroundColor
}));
if (!off.off || off.pressed !== 'false' || !/176,\s*0,\s*32/.test(off.bg)) failures.push(`mic off ${JSON.stringify(off)}`);
await page.locator('#ai-mic-btn').click();
await page.locator('#device-allow').click();
const listening = await page.locator('#ai-mic-btn').evaluate((node) => ({
  on: node.classList.contains('is-listening'),
  pressed: node.getAttribute('aria-pressed'),
  bg: getComputedStyle(node).backgroundColor,
  voice: document.getElementById('ai-voice').className,
  dot: document.querySelector('#ai-status [data-voice]')?.className || ''
}));
if (!listening.on || listening.pressed !== 'true' || !/198,\s*161,\s*91/.test(listening.bg)) failures.push(`mic listen ${JSON.stringify(listening)}`);
if (!listening.voice.includes('is-listening') || listening.dot !== 'voice-listening') failures.push(`voice match ${JSON.stringify(listening)}`);
if (!/Listening/.test(await page.locator('#ai-mic-btn').getAttribute('aria-label') || '')) failures.push('listening label');
await page.evaluate(() => window.__speech.onresult({ results: [{ 0: { transcript: 'log fi' }, isFinal: false }] }));
if ((await page.locator('#ai-ask').inputValue()) !== 'log fi') failures.push('interim missing');
await page.evaluate(() => window.__speech.onresult({ results: [{ 0: { transcript: 'log 5min walk' }, isFinal: true }] }));
await page.locator('#gym-ididit-activity').waitFor();
await page.waitForFunction(() => document.getElementById('gym-ididit-activity')?.value === 'Walk' && /OK\?/.test(document.getElementById('ai-log')?.textContent || ''));
if ((await page.locator('#ai-ask').inputValue()) !== 'log 5min walk') failures.push('transcript missing');
if (/Recorded on testnet/.test(await page.locator('#ididit-status').innerText().catch(() => ''))) failures.push('voice recorded without OK');
await page.goto(`${base}/gym`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { sessionStorage.removeItem('lgme.voice.turn'); sessionStorage.removeItem('lgme.prompt.note'); });
await page.locator('#ai-ask').waitFor();
await page.evaluate(() => {
  localStorage.setItem('lgme.incognito', '1');
  class RemoteSpeech { start() { this.onresult?.({ results: [[{ transcript: 'should not land' }]] }); } stop() {} }
  window.SpeechRecognition = RemoteSpeech;
  window.webkitSpeechRecognition = RemoteSpeech;
});
await page.locator('#ai-mic-btn').click();
await page.waitForFunction(() => /Incognito is on/.test(document.getElementById('ai-log')?.textContent || ''));
await page.evaluate(() => localStorage.removeItem('lgme.incognito'));
await page.evaluate(() => {
  class ErrSpeech {
    start() { this.onerror?.({ error: 'not-allowed' }); }
    stop() {}
  }
  window.SpeechRecognition = ErrSpeech;
  window.webkitSpeechRecognition = ErrSpeech;
  window.__micPrompt = false;
  const devices = { getUserMedia() { window.__micPrompt = true; return Promise.resolve({ getTracks: () => [{ stop() {} }] }); } };
  try { Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: devices }); }
  catch { /* the page keeps its own devices object */ }
});
await page.locator('#ai-mic-btn').click();
await page.waitForTimeout(200);
const micError = await page.evaluate(() => document.getElementById('ai-log')?.textContent || '');
if (!/Mic blocked: allow microphone in site settings/.test(micError)) failures.push(`mic error ${micError}`);
const panel = await page.locator('#ai-dock').evaluate((node) => node.getBoundingClientRect().height / window.innerHeight);
if (panel < 0.38 || panel > 0.42) failures.push(`panel ${panel}`);
const chip = await page.locator('.ai-chip').first().evaluate((node) => {
  const box = node.getBoundingClientRect();
  return { h: box.height, size: parseFloat(getComputedStyle(node).fontSize) };
});
if (chip.h < 24 || chip.h > 32 || chip.size < 13 || chip.size > 14) failures.push(`chip ${chip.h}/${chip.size}`);
const frames = await page.evaluate(() => {
  const log = getComputedStyle(document.getElementById('ai-log-frame'));
  const input = getComputedStyle(document.getElementById('ai-input-frame'));
  return { logW: log.borderTopWidth, inputW: input.borderTopWidth, logR: log.borderRadius, inputR: input.borderRadius, logA: log.backgroundColor, inputA: input.backgroundColor };
});
if (frames.logW !== '2px' || frames.inputW !== '2px' || frames.logR !== frames.inputR) failures.push(`frames ${frames.logW}/${frames.inputW}`);
if (!/0\.5/.test(frames.logA) || frames.logA !== frames.inputA) failures.push(`shade ${frames.logA} ${frames.inputA}`);
const row = await page.locator('#ai-mic-btn, #ai-send, #ai-confirm').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
if (Math.max(...row) - Math.min(...row) > 4) failures.push(`action row ${row.join(',')}`);
if (/Mic/.test(await page.locator('#ai-mic-btn').innerText())) failures.push('mic is text');
if ((await page.locator('#ai-mic-btn svg').count()) !== 1) failures.push('mic icon missing');
if ((await page.locator('#ai-accept').evaluate((node) => node.textContent)) !== 'Hint') failures.push('hint label');
if (!/Not sent/.test(await page.locator('#ai-send-state').getAttribute('aria-label') || '')) failures.push('held label');
if ((await page.locator('.ai-suggest').count()) < 1) failures.push('suggest lines');
const shapes = await page.evaluate(() => {
  const yes = getComputedStyle(document.querySelector('.ai-yes'));
  const no = getComputedStyle(document.querySelector('.ai-no'));
  return { yes: yes.borderRadius, no: no.borderRadius, yesBg: yes.backgroundColor, noBg: no.backgroundColor };
});
if (shapes.yes === shapes.no || shapes.yesBg === shapes.noBg) failures.push('yes and no look the same');
if ((await page.locator('#ai-do-all').count()) !== 0) failures.push('do all still shown');
if ((await page.locator('#ai-path-line').innerText()) === 'Step 1 of 5 · Getting started') await page.locator('#ai-path-skip').click();
await page.locator('.ai-yes').first().click();
await page.locator('#gym-ididit-other').waitFor();
if (/recorded|queued/i.test(await page.locator('#ididit-status').innerText())) failures.push('yes saved');
if (!/Not sent/.test(await page.locator('#ai-send-state').getAttribute('aria-label') || '')) failures.push('yes sent');
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.locator('#ai-dock').waitFor();
await page.locator('.ai-suggest').first().waitFor();
const linesBefore = await page.locator('.ai-suggest').count();
await page.locator('.ai-no').last().click();
if (!((await page.locator('.ai-suggest').count()) < linesBefore)) failures.push('no did not dismiss');
if (!(await page.locator('#ai-chip-hint').isVisible())) failures.push('chip hint missing');
await page.locator('#ai-ask').fill('log 10min treadmill');
await page.locator('#ai-ask').evaluate((node) => {
  node.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertLineBreak', bubbles: true, cancelable: true }));
});
await page.locator('#gym-ididit-other').waitFor();
if (/Recorded on testnet/.test(await page.locator('#ididit-status').innerText())) failures.push('first enter recorded');
await page.waitForFunction(() => document.getElementById('gym-ididit-other')?.value === 'Treadmill, 10 min' && document.getElementById('gym-ididit-activity')?.value === 'Treadmill' && document.getElementById('gym-ididit-minutes')?.value === '10');
if (!/Suggestion: Treadmill, 10 min/.test(await page.locator('#draft-suggestion').innerText())) failures.push('suggestion not repeated');
if (!(await page.locator('#gym-ididit-confirm').evaluate((node) => node.classList.contains('is-next')))) failures.push('confirm not marked');
await page.waitForFunction(() => /Draft filled: Treadmill, 10 min/.test(document.getElementById('ai-log')?.textContent || ''));
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
await page.waitForFunction(() => document.getElementById('gym-ididit-distance')?.value === '5 miles' && document.getElementById('gym-ididit-speed')?.value === '3 mph' && document.getElementById('gym-ididit-minutes')?.value === '100');
await page.waitForFunction(() => /about 100 min/.test(document.getElementById('gym-ididit-computed')?.textContent || ''));
await page.waitForFunction(() => /Draft filled: Treadmill, 5 miles, 3 mph, about 100 min/.test(document.getElementById('ai-log')?.textContent || ''));
if (!(await page.locator('#ididit-done').isVisible())) failures.push('pace draft hidden');
await page.locator('#ai-ask').fill('I want a ride');
await page.locator('#ai-send').click();
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
await page.locator('#ai-controls').click();
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
