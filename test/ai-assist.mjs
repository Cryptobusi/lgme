import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const loaded = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = loaded.chromium ? loaded : loaded.default;

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const posts = [];

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

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
    const raw = req.method === 'POST' ? await readBody(req) : '';
    let action = '';
    try { action = JSON.parse(raw || '{}').payload?.action || ''; } catch { action = ''; }
    if (req.method === 'POST') posts.push(action || url.pathname);
    const held = action === 'pool-sponsor'
      ? { ok: true }
      : { ok: false, error: 'Held in this test. Nothing was written.' };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      network: 'testnet',
      pool: { covers: 2, offers: 1, inUsd: 2, outUsd: 0, anonymous: true },
      listings: [],
      ...held
    }));
    return;
  }
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

const views = [
  { name: '390 browser online signed-out', width: 390, height: 844, standalone: false, offline: false, signed: false, shot: true, gym: 'out' },
  { name: '390 browser offline signed-out', width: 390, height: 844, standalone: false, offline: true, signed: false, gym: 'out' },
  { name: '390 installed online signed-out', width: 390, height: 844, standalone: true, offline: false, signed: false, gym: 'out' },
  { name: '390 installed offline signed-out', width: 390, height: 844, standalone: true, offline: true, signed: false, gym: 'out' },
  { name: '390 browser online signed-in', width: 390, height: 844, standalone: false, offline: false, signed: true, gym: 'full' },
  { name: '390 browser offline signed-in', width: 390, height: 844, standalone: false, offline: true, signed: true, gym: 'ask' },
  { name: '390 installed online signed-in', width: 390, height: 844, standalone: true, offline: false, signed: true, gym: 'full' },
  { name: '390 installed offline signed-in', width: 390, height: 844, standalone: true, offline: true, signed: true, gym: 'ask' },
  { name: '1280 browser online signed-out', width: 1280, height: 800, standalone: false, offline: false, signed: false, gym: 'out' },
  { name: '1280 browser offline signed-out', width: 1280, height: 800, standalone: false, offline: true, signed: false, gym: 'out' },
  { name: '1280 installed online signed-out', width: 1280, height: 800, standalone: true, offline: false, signed: false, gym: 'out' },
  { name: '1280 installed offline signed-out', width: 1280, height: 800, standalone: true, offline: true, signed: false, gym: 'out' },
  { name: '1280 browser online signed-in', width: 1280, height: 800, standalone: false, offline: false, signed: true, gym: 'full' },
  { name: '1280 browser offline signed-in', width: 1280, height: 800, standalone: false, offline: true, signed: true, gym: 'ask' },
  { name: '1280 installed online signed-in', width: 1280, height: 800, standalone: true, offline: false, signed: true, gym: 'full' },
  { name: '1280 installed offline signed-in', width: 1280, height: 800, standalone: true, offline: true, signed: true, gym: 'ask' }
];

const results = [];
function assert(ok, message) {
  if (!ok) throw new Error(message);
}
async function check(fn, view, run) {
  console.log(`RUN\t${fn}\t${view}`);
  const before = posts.length;
  try {
    await run();
    results.push({ fn, view, ok: true, detail: '' });
  } catch (error) {
    results.push({ fn, view, ok: false, detail: error.message });
  }
  return before;
}

async function openPage(view, path) {
  const context = await browser.newContext({ viewport: { width: view.width, height: view.height } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.addInitScript((opts) => {
    localStorage.setItem('lgme.demo.member', '{"demo":true,"handle":"demo"}');
    localStorage.setItem('lgme.exchange.splashSeen', '1');
    localStorage.setItem('lgme.exchange.introSeen', '1');
    if (opts.signed) {
      localStorage.setItem('lgme-gym.mode', 'demo');
      localStorage.setItem('lgme-gym.seat', 'jordan');
      localStorage.setItem('lgme-sim:peer:jordan', JSON.stringify({
        id: 'jordan',
        tape: [{ type: 'EXERCISE_CREDIT', payload: { toId: 'jordan', authorShare: 2 } }]
      }));
    }
    if (opts.standalone) {
      const orig = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (String(query).includes('display-mode: standalone')) {
          return { matches: true, media: String(query), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
        }
        return orig(query);
      };
      try { Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true }); } catch { /* already defined */ }
    }
    const origFetch = window.fetch.bind(window);
    window.__posts = [];
    window.fetch = async (...args) => {
      const input = args[0];
      const url = String(input?.url || input || '');
      const method = String(args[1]?.method || input?.method || 'GET').toUpperCase();
      if (method === 'POST') window.__posts.push(url);
      return origFetch(...args);
    };
  }, { signed: view.signed, standalone: view.standalone });
  await page.route('**/*', (route) => {
    if (route.request().url().startsWith(base)) return route.continue();
    return route.abort();
  });
  const writes = [];
  page.lgmeWrites = writes;
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/(hedera|exchange|email\/send|email\/verify)/.test(req.url())) writes.push(req.url());
  });
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (view.offline) await page.context().setOffline(true);
  return page;
}

async function sent(page) {
  const urls = await page.evaluate(() => (window.__posts || []).slice());
  return urls.filter((url) => /\/api\/(hedera|exchange|email\/send|email\/verify|gym)/.test(url));
}

async function launch(view) {
  const page = await openPage(view, '/');
  if (view.shot) {
    mkdirSync('/opt/cursor/artifacts', { recursive: true });
    const launchButton = page.locator('[data-install-launch]');
    await launchButton.waitFor({ state: 'visible' });
    await launchButton.scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/opt/cursor/artifacts/ai-one-tap-phone.png' });
  }
  if (view.standalone) {
    await page.locator('.entry-picker').waitFor();
    assert(page.url().includes('/gym') === false, 'installed home left the category screen');
    assert(page.lgmeWrites.length === 0, `installed open posted ${page.lgmeWrites.join(' ')}`);
  } else if (!view.offline) {
    const before = await sent(page);
    await page.locator('[data-install-launch]').click();
    await page.waitForURL(/\/exchange/, { timeout: 8000 });
    assert(before.length === 0, 'install tap posted before navigation');
  } else {
    await page.locator('[data-install-launch]').click();
    await page.waitForTimeout(700);
    assert((await sent(page)).length === 0, 'offline install posted');
  }
  await page.context().close();
}

async function clickClear(page, selector) {
  try {
    await page.locator(selector).evaluate((node) => {
      const dock = document.getElementById('ai-dock');
      const limit = dock ? dock.getBoundingClientRect().top - 12 : window.innerHeight;
      const box = node.getBoundingClientRect();
      if (box.bottom > limit) window.scrollBy(0, box.bottom - limit + 16);
      node.click();
    });
  } catch (error) {
    if (!/destroyed|navigation/.test(String(error && error.message))) throw error;
  }
}

async function aiHelp(view) {
  const page = await openPage(view, '/ai-help');
  await page.waitForSelector('#ask-ai');
  await clickClear(page, '#draft-ai');
  await page.waitForFunction(() => document.getElementById('ai-status')?.textContent.includes('Ask and offer first'));
  await clickClear(page, '#ask-ai');
  await page.waitForFunction(() => document.getElementById('ai-status')?.textContent.includes('Choose the words'));
  await page.locator('#ai-notes').fill('my diagnosis is private');
  await clickClear(page, '#ask-ai');
  await page.waitForFunction(() => document.getElementById('ai-status')?.textContent.includes('Leave out'));
  await page.locator('#ai-notes').fill('Need a short reply about the session.');
  await clickClear(page, '#ask-ai');
  await page.waitForSelector('#ai-request');
  await clickClear(page, '#offer-ai');
  await page.waitForSelector('#ai-offer');
  await clickClear(page, '#draft-ai');
  await page.waitForSelector('#ai-draft');
  const draft = await page.locator('#ai-draft').inputValue();
  assert(draft.length > 10, 'draft was empty');
  assert(await page.locator('#ai-receipt').count() === 0, 'receipt appeared before accept');
  if (view.shot) {
    await page.locator('#accept-ai').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/opt/cursor/artifacts/ai-draft-confirm-phone.png' });
  }
  await clickClear(page, '#accept-ai');
  await page.waitForFunction(() => document.getElementById('ai-status')?.textContent.includes('Edit the draft'));
  await clickClear(page, '#decline-ai');
  await page.waitForFunction(() => !document.getElementById('ai-draft'));
  await clickClear(page, '#draft-ai');
  await page.locator('#ai-draft').fill('Edited by the member before anything is kept.');
  await clickClear(page, '#accept-ai');
  await page.waitForSelector('#ai-receipt');
  assert((await sent(page)).length === 0, `ai help posted ${await sent(page)}`);

  await clickClear(page, '#equipment-ask');
  await page.waitForFunction(() => document.getElementById('ai-status')?.textContent.includes('Nothing was sent'));
  await page.locator('#equipment-question').fill('the treadmill is broken call 555-010-9999');
  await clickClear(page, '#equipment-ask');
  await page.waitForFunction(() => document.getElementById('ai-status')?.textContent.includes('Leave the phone number'));
  await page.locator('#equipment-question').fill('the treadmill is broken and needs a tune');
  await clickClear(page, '#equipment-ask');
  await page.waitForSelector('#equipment-referral');
  await clickClear(page, '#request-repair');
  await page.waitForFunction(() => document.getElementById('ai-status')?.textContent.includes('Choose to share'));
  assert((await sent(page)).length === 0, 'repair posted before share');
  const mailto = await page.locator('#equipment-mailto').getAttribute('href');
  assert(mailto.startsWith('mailto:'), 'mailto missing');
  await page.locator('#equipment-share').check();
  await clickClear(page, '#request-repair');
  if (view.offline) {
    await page.waitForFunction(() => document.getElementById('ai-status')?.textContent.includes('Nothing was sent'));
  } else {
    await page.waitForFunction(() => document.getElementById('ai-status')?.textContent.includes('Nothing was written') || document.getElementById('ai-status')?.textContent.includes('Nothing was emailed') || document.getElementById('ai-status')?.textContent.includes('stayed on this phone'));
    assert((await sent(page)).some((url) => url.includes('/api/exchange/repair')), 'confirm did not reach the request');
  }
  await page.context().close();
}

async function helper(view) {
  const page = await openPage(view, '/helper');
  await page.waitForSelector('#helper-step-1');
  await clickClear(page, '#helper-next');
  await page.waitForSelector('#helper-step-2');
  await page.locator('#helper-back').click();
  await page.waitForSelector('#helper-step-1');
  if (view.offline) {
    await page.locator('#helper-skip').click();
    await page.waitForSelector('#helper-step-2');
    assert((await sent(page)).length === 0, 'helper posted');
    await page.context().close();
    return;
  }
  for (const step of [2, 3, 4, 5]) {
    if (step === 5) {
      const locked = await page.locator('.locked').innerText();
      assert(/never sends|confirm every action/i.test(locked), locked);
    }
    await clickClear(page, '#helper-next');
    await page.waitForSelector(`#helper-step-${step}`);
  }
  await page.waitForSelector('#turn-on-helper');
  await page.locator('#turn-on-helper').click();
  await page.waitForURL(/\/gym/, { timeout: 8000 });
  let turned = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      turned = await page.evaluate(() => localStorage.getItem('lgme.localAi'));
      break;
    } catch (error) {
      if (attempt === 2 || !/destroyed|navigation/.test(error.message)) throw error;
      await page.waitForLoadState('domcontentloaded');
    }
  }
  assert(turned === 'on', 'helper did not turn on');
  await page.context().close();
}

async function listing(view) {
  const page = await openPage(view, '/exchange#exchange');
  await page.waitForSelector('#draft-upload', { timeout: 20000 });
  await page.locator('#draft-upload').click();
  await page.waitForFunction(() => document.getElementById('exchange-test-status')?.textContent.includes('Describe the session'));
  await page.locator('#upload-note').fill('A 45 minute treadmill repair session for the gym.');
  await page.locator('#draft-upload').click();
  await page.waitForSelector('#upload-draft');
  const note = await page.locator('#upload-draft').innerText();
  assert(/Suggested credit/.test(note), 'rate suggestion missing');
  assert(/Not posted|Deterministic draft|Nothing is posted/.test(note) || /Draft only/.test(await page.locator('#exchange-test-status').innerText()), 'draft was treated as posted');
  assert(await page.locator('#confirm-upload').count() === 1, 'confirm missing');
  const before = (await sent(page)).length;
  await page.locator('#confirm-upload').click();
  if (view.offline) {
    await page.waitForFunction(() => /Nothing was posted/.test(document.getElementById('exchange-test-status')?.textContent || ''));
  } else {
    await page.waitForFunction(() => /Nothing was written|Nothing was posted/.test(document.getElementById('exchange-test-status')?.textContent || ''));
    assert((await sent(page)).length > before, 'confirm did not submit');
  }
  await page.waitForSelector('#attestation-rule', { timeout: 20000 });
  const rule = await page.locator('#attestation-rule').innerText();
  assert(/Needs 3 attestations/.test(rule) && /Suggested third attester/.test(rule), rule);
  await page.evaluate(() => { location.hash = 'books'; });
  await page.waitForSelector('#invoice-form', { timeout: 15000 });
  assert(await page.locator('a[href^="sms:"]').count() === 0, 'an SMS link was ready before an invoice');
  const writesBefore = page.lgmeWrites.length;
  const beforeSms = page.url();
  await page.locator('#invoice-form button[type="submit"]').click();
  await page.waitForFunction(() => (document.getElementById('status')?.textContent || '').length > 0);
  const invoiceStatus = await page.locator('#status').innerText();
  assert(page.url() === beforeSms && !page.url().startsWith('sms:'), 'invoice opened a send');
  assert(/amount|phone|wallet|locked|due|greater than zero/i.test(invoiceStatus), invoiceStatus);
  assert(page.lgmeWrites.length === writesBefore, `invoice posted ${page.lgmeWrites.slice(writesBefore).join(' ')}`);
  await page.context().close();
}

async function invites(view) {
  const pool = await openPage(view, '/join?invite=abcdefghij&fee=pool');
  await pool.waitForSelector('#join-fee-preset');
  const poolText = await pool.locator('#join-fee-preset').innerText();
  assert(poolText.includes('Use the pool'), poolText);
  assert((await sent(pool)).length === 0, 'join posted');
  await pool.context().close();

  const sponsor = await openPage(view, '/gym.html?invite=abcdefghij&fee=sponsor&from=mina#/setup');
  await sponsor.waitForFunction(() => {
    const button = document.getElementById('accept-cover');
    return button && button.hidden === false && button.classList.contains('primary') && /mina/i.test(button.textContent || '');
  });
  assert((await sent(sponsor)).length === 0, 'sponsor fee posted on open');
  await sponsor.context().close();

  const self = await openPage(view, '/gym.html?invite=abcdefghij&fee=self#/setup');
  await self.waitForFunction(() => document.getElementById('pay-now')?.classList.contains('primary'));
  const note = await self.locator('#invite-fee').innerText();
  assert(/leaves the fee with you/i.test(note), note);
  assert((await sent(self)).length === 0, 'self-pay posted on open');
  await self.context().close();

  const covered = await openPage(view, '/gym.html?invite=abcdefghij&fee=pool#/setup');
  await covered.waitForFunction(() => {
    const button = document.getElementById('use-pool');
    return button && button.hidden === false && button.classList.contains('primary');
  });
  assert((await sent(covered)).filter((url) => url.includes('/api/')).length === 0, 'pool fee posted on open');
  await covered.context().close();
}

async function gymOut(view) {
  const page = await openPage(view, '/gym.html#/more');
  await page.waitForSelector('#local-ai');
  await page.getByRole('button', { name: 'Show what turning on means' }).click();
  await page.getByRole('button', { name: 'Turn on' }).click();
  await page.waitForSelector('#local-ai-question');
  await page.locator('#local-ai-question').fill('');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForFunction(() => /Ask about a term/.test(document.body.innerText));
  await page.locator('#local-ai-question').fill('Draft a reminder for tomorrow');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForFunction(() => /Draft only/.test(document.body.innerText) && /Not sent/.test(document.body.innerText));
  assert((await sent(page)).length === 0, 'signed-out ask posted');
  await page.context().close();
  const groups = await openPage(view, '/gym.html#/groups');
  await groups.waitForSelector('input[placeholder="Message"]');
  await groups.locator('input[placeholder="Message"]').fill('Hello from this phone');
  await groups.getByRole('button', { name: 'Send', exact: true }).click();
  await groups.waitForFunction(() => /Choose who is acting/.test(document.getElementById('gym-status')?.textContent || ''));
  assert((await sent(groups)).length === 0, 'signed-out chat posted');
  await groups.context().close();
}

async function gymAsk(view) {
  const page = await openPage(view, '/gym.html#/more');
  await page.waitForSelector('#local-ai');
  if (await page.locator('#local-ai-question').count() === 0) {
    await page.getByRole('button', { name: 'Show what turning on means' }).click();
    await page.getByRole('button', { name: 'Turn on' }).click();
  }
  await page.locator('#local-ai-question').fill('Draft a reminder for tomorrow');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForFunction(() => /Draft only/.test(document.body.innerText));
  assert((await sent(page)).length === 0, 'offline ask posted');
  await page.context().close();
}

async function gymFull(view) {
  const page = await openPage(view, '/gym.html#/more');
  await page.waitForSelector('#local-ai');
  if (await page.locator('#local-ai-question').count() === 0) {
    await page.getByRole('button', { name: 'Show what turning on means' }).click();
    await page.getByRole('button', { name: 'Turn on' }).click();
  }
  await page.locator('#local-ai-question').fill('Draft a reminder for tomorrow');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForFunction(() => /Draft only/.test(document.body.innerText) && /Not sent/.test(document.body.innerText));
  const beforeInvite = (await sent(page)).length;
  await page.locator('#local-ai-question').fill('Please send an invite from the pool');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForSelector('#invite-link');
  const link = await page.locator('#invite-link').innerText();
  assert(link.includes('fee=pool'), link);
  assert(link.includes('https://lgme.app/join'), link);
  const email = await page.locator('#invite-email').getAttribute('href');
  const sms = await page.locator('#invite-text').getAttribute('href');
  assert(email.startsWith('mailto:'), 'email share missing');
  assert(sms.startsWith('sms:'), 'text share missing');
  await page.locator('#invite-share').click();
  await page.waitForFunction(() => /Share is not on this phone/.test(document.getElementById('gym-status')?.textContent || ''));
  assert((await sent(page)).length === beforeInvite, 'invite share posted');

  await page.locator('#local-ai-question').fill('Please send an invite and I will cover it');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForSelector('#invite-reserve');
  assert((await sent(page)).length === beforeInvite, 'sponsor reserved before confirm');
  if (view.name.startsWith('390 browser') || view.name.startsWith('1280 browser')) {
    await page.locator('#invite-reserve').click();
    await page.waitForFunction(() => /still not sent/i.test(document.body.innerText));
    assert((await sent(page)).some((url) => url.includes('/api/hedera/listings')), 'reserve confirm did not submit');
  }
  await page.context().close();

  const groups = await openPage(view, '/gym.html#/groups');
  await groups.waitForSelector('input[placeholder="Message"]');
  await groups.getByRole('button', { name: 'Send', exact: true }).click();
  await groups.waitForFunction(() => /Add a short message/.test(document.getElementById('gym-status')?.textContent || ''));
  await groups.locator('input[placeholder="Message"]').fill('call me at 555-111-2222');
  await groups.getByRole('button', { name: 'Send', exact: true }).click();
  await groups.waitForFunction(() => /Leave out/.test(document.getElementById('gym-status')?.textContent || ''));
  await groups.locator('input[placeholder="Message"]').fill('Hello from this phone');
  await groups.getByRole('button', { name: 'Send', exact: true }).click();
  await groups.waitForFunction(() => /on this phone only/.test(document.body.innerText));
  assert((await sent(groups)).length === 0, 'chat posted');
  await groups.context().close();

  const images = await openPage(view, '/gym.html#/personalize');
  await images.waitForSelector('#confirm-layout');
  await images.locator('#confirm-layout').click();
  await images.waitForSelector('#change-image-banner');
  await images.locator('#change-image-banner').click();
  await images.locator('#suggest-image-banner').click();
  await images.waitForFunction(() => /Describe a picture/.test(document.getElementById('suggest-image-note-banner')?.textContent || ''));
  await images.locator('#describe-image-banner').fill('a treadmill that needs repair');
  await images.locator('#suggest-image-banner').click();
  await images.waitForFunction(() => /Nothing was sent/.test(document.getElementById('suggest-image-note-banner')?.textContent || ''));
  assert((await sent(images)).length === 0, 'suggest posted');
  await images.locator('#confirm-image-banner').click();
  await images.waitForFunction(() => /Kept on this phone/.test(document.getElementById('gym-status')?.textContent || ''));
  await images.locator('#reset-image-banner').click();
  await images.waitForFunction(() => /back to the default/.test(document.getElementById('gym-status')?.textContent || ''));
  assert((await sent(images)).length === 0, 'image confirm posted');
  await images.context().close();
}

const only = process.env.ONLY || '';
for (const view of views) {
  if (only && !view.name.includes(only)) continue;
  await check('Install & launch', view.name, () => launch(view));
  await check('AI help and repair draft', view.name, () => aiHelp(view));
  await check('Helper wizard', view.name, () => helper(view));
  await check('Listing draft and rate', view.name, () => listing(view));
  await check('Invite fee preselect', view.name, () => invites(view));
  if (view.gym === 'out') await check('Gym assistant signed out', view.name, () => gymOut(view));
  if (view.gym === 'ask') await check('Gym assistant offline', view.name, () => gymAsk(view));
  if (view.gym === 'full') await check('Gym invite, chat, image', view.name, () => gymFull(view));
}

await browser.close();
server.close();
const failed = results.filter((row) => !row.ok);
for (const row of results) console.log(`${row.ok ? 'PASS' : 'FAIL'}\t${row.fn}\t${row.view}${row.detail ? `\t${row.detail}` : ''}`);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
