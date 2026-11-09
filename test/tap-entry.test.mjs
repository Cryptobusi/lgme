import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTIONS,
  METHOD_SCRIPTS,
  REVIEW_INTRO,
  SAMPLE_HABIT,
  SAMPLE_RECEIPT,
  SAMPLE_SENTENCE,
  STORAGE_KEY,
  acceptSuggestion,
  buildSuggestion,
  canUseSuggestion,
  capabilityRows,
  commitTape,
  counterText,
  createCounter,
  detectFeatures,
  emptyState,
  forgetLearned,
  loadState,
  locationRead,
  measureMethod,
  modeFor,
  parseEntryLink,
  parseEntryText,
  passkeyCreationOptions,
  phaseAfterCapture,
  prepareLocalSpeech,
  readPhotoText,
  recordField,
  recordTap,
  resetState,
  reviewRows,
  reviewTableHtml,
  runPasskey,
  sampleCapture,
  sampleLink,
  saveState,
  scriptFor,
  setConsent,
  startLocalRecognition,
  suggestionFor,
  undoLast,
  withPartner
} from '../js/tap-entry.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

function memory() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

test('the parser reads a sentence, a receipt, a habit, and an entry link', () => {
  const sentence = parseEntryText(SAMPLE_SENTENCE);
  assert.equal(sentence.category, 'did');
  assert.equal(sentence.hours, 2);
  assert.equal(sentence.partner, 'Elena');
  assert.equal(sentence.place, 'greenhouse');
  assert.equal(sentence.reasons.some((reason) => reason.startsWith('Category Did')), true);

  const receipt = parseEntryText(SAMPLE_RECEIPT);
  assert.equal(receipt.category, 'did');
  assert.equal(receipt.hours, 2);
  assert.equal(receipt.partner, 'Elena');
  assert.equal(receipt.place, 'greenhouse');

  const habit = parseEntryText(SAMPLE_HABIT);
  assert.equal(habit.category, 'did');
  assert.equal(habit.hours, 2);
  assert.equal(habit.partner, null);
  assert.equal(habit.place, null);
  assert.equal(canUseSuggestion(buildSuggestion(sampleCapture('smart'))), false);
  assert.equal(canUseSuggestion(withPartner(buildSuggestion(sampleCapture('smart')), 'Elena')), true);

  assert.equal(parseEntryText('I wish for two hours with Elena at the greenhouse').category, 'wish');
  assert.equal(parseEntryText('sell surplus to Elena at the shed').category, 'sell');
  assert.equal(parseEntryText('sell surplus to Elena at the shed').place, 'shed');
  assert.equal(parseEntryText('pledge a duty of two hours with Elena').category, 'duty');
  assert.equal(parseEntryText('responsible for the greenhouse for two hours with Elena').category, 'responsible');
  assert.equal(parseEntryText('').reasons[0], 'There is no text to read.');

  const link = parseEntryLink(sampleLink());
  assert.equal(link.category, 'did');
  assert.equal(link.hours, 2);
  assert.equal(link.partner, 'Elena');
  assert.equal(link.place, 'greenhouse');
  assert.equal(link.note, SAMPLE_SENTENCE);
  assert.equal(parseEntryLink('https://lgme.app/tap-entry'), null);
  const fromLink = buildSuggestion(sampleCapture('nfc'));
  assert.equal(fromLink.reasons.some((reason) => reason.includes('entry link')), true);
  assert.equal(fromLink.reasons.some((reason) => reason.startsWith('No partner')), false);
});

test('the step counter and the measured paths use the same actions', () => {
  let counter = createCounter();
  counter = recordTap(counter, ACTIONS.nfc.label);
  counter = recordField(counter, ACTIONS['share-type'].label);
  assert.equal(counter.taps, 1);
  assert.equal(counter.fields, 1);
  assert.equal(counter.events.length, 2);
  assert.equal(counterText(counter), 'This method: 1 tap, 1 field typed.');
  assert.equal(counterText(recordTap(createCounter(), 'QR handshake')), 'This method: 1 tap, 0 fields typed.');

  const ui = text('js/tap-entry-ui.mjs');
  for (const [method, steps] of Object.entries(METHOD_SCRIPTS)) {
    assert.equal(steps.length >= 5, true, method);
    const measured = measureMethod(method);
    const first = measureMethod(method, { consent: true });
    assert.equal(measured.fields, 0, method);
    assert.equal(first.taps, measured.taps + 1, method);
    assert.equal(scriptFor(method, { consent: true })[2], 'consent-allow');
    for (const id of scriptFor(method, { consent: true })) {
      assert.equal(Boolean(ACTIONS[id]), true, id);
      assert.equal(ui.includes(`'${id}'`) || ui.includes(`"${id}"`) || ui.includes(id), true, id);
    }
  }
  assert.equal(measureMethod('nfc').taps, 5);
  assert.equal(measureMethod('qr').taps, 5);
  assert.equal(measureMethod('share').taps, 5);
  assert.equal(measureMethod('camera').taps, 5);
  assert.equal(measureMethod('voice').taps, 5);
  assert.equal(measureMethod('smart').taps, 6);
  assert.equal(measureMethod('passkey').taps, 5);
  assert.equal(measureMethod('manual').taps, 5);
  assert.equal(measureMethod('manual').events.some((event) => event.type === 'field'), false);
  const rows = reviewRows();
  assert.equal(rows.find((row) => row.id === 'smart').steps, '6 taps, 0 fields typed');
  assert.equal(rows.find((row) => row.id === 'manual').steps, '5 taps, 0 fields typed');
  const table = reviewTableHtml();
  assert.equal(table.includes('5 taps, 0 fields typed'), true);
  assert.equal(table.includes('6 taps, 0 fields typed'), true);
  assert.equal(table.includes('Recommended default'), true);
  assert.equal(REVIEW_INTRO.some((line) => line.includes('not timings')), true);
});

test('consent gates suggestions, and undo and forget each remove one change', () => {
  const storage = memory();
  let state = emptyState();
  const capture = sampleCapture('manual');
  assert.equal(suggestionFor(state, capture).blocked, true);
  assert.equal(suggestionFor(state, capture).suggestion, null);
  assert.equal(acceptSuggestion(state, buildSuggestion(capture)), state);
  assert.equal(phaseAfterCapture(state), 'consent');
  assert.equal(state.learned.length, 0);

  state = setConsent(state, 'deny');
  assert.equal(suggestionFor(state, capture).blocked, true);
  assert.equal(phaseAfterCapture(state), 'plain');
  assert.equal(acceptSuggestion(state, buildSuggestion(capture)).learned.length, 0);

  state = setConsent(undoLast(state), 'allow');
  assert.equal(phaseAfterCapture(state), 'correct');
  const suggestion = suggestionFor(state, capture);
  assert.equal(suggestion.blocked, false);
  assert.equal(suggestion.suggestion.partner, 'Elena');
  const accepted = acceptSuggestion(state, suggestion.suggestion);
  assert.equal(accepted.learned.length >= 3, true);
  const learnedIds = accepted.learned.map((item) => item.id);
  const forgotten = forgetLearned(accepted, learnedIds[0]);
  assert.equal(forgotten.learned.length, accepted.learned.length - 1);
  assert.equal(forgotten.learned.some((item) => item.id === learnedIds[0]), false);
  assert.equal(forgotten.learned.some((item) => item.id === learnedIds[1]), true);
  assert.equal(forgetLearned(forgotten, learnedIds[0]), forgotten);
  const undone = undoLast(accepted);
  assert.equal(undone.learned.length, 0);
  assert.equal(undoLast(undone).undo, null);

  const taped = commitTape(accepted, { ...suggestion.suggestion, method: 'manual' });
  assert.equal(taped.tape.length, 1);
  assert.equal(taped.tape[0].sample, true);
  const withoutTape = undoLast(taped);
  assert.equal(withoutTape.tape.length, 0);
  assert.equal(withoutTape.learned.length, accepted.learned.length);
  assert.equal(undoLast(withoutTape).learned.length, 0);
  saveState(storage, taped);
  const loaded = loadState(storage);
  assert.equal(loaded.consent, 'allow');
  assert.equal(loaded.tape.length, 1);
  assert.equal(loaded.learned.length, accepted.learned.length);
  assert.equal(JSON.stringify(saveState(storage, { ...taped, latitude: 38.9, learned: taped.learned.concat({ id: 'x', label: 'X', why: 'y', longitude: 1 }) })).includes('latitude'), false);
  assert.equal(JSON.stringify(storage.getItem(STORAGE_KEY)).includes('longitude'), false);
  assert.equal(resetState(storage).consent, null);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  storage.setItem(STORAGE_KEY, '{');
  assert.equal(loadState(storage).consent, null);
});

test('missing device APIs use a labelled fallback and coordinates are not kept', async () => {
  const none = detectFeatures({});
  assert.equal(none.nfc, false);
  assert.equal(none.camera, false);
  assert.equal(none.speech, false);
  assert.equal(none.share, false);
  assert.equal(none.passkey, false);
  assert.equal(none.textDetector, false);
  assert.equal(none.geolocation, false);
  const nfc = modeFor('nfc', none);
  assert.equal(nfc.live, false);
  assert.match(nfc.reason, /Simulated/);
  assert.match(nfc.reason, /Chrome on Android/);
  assert.match(nfc.reason, /iPhone/);
  const voice = modeFor('voice', none);
  assert.equal(voice.live, false);
  assert.match(voice.reason, /Simulated/);
  assert.match(voice.reason, /two hours framing/);
  const camera = modeFor('camera', none);
  assert.equal(camera.live, false);
  assert.match(camera.reason, /TextDetector/);
  assert.match(camera.reason, /Nothing is uploaded/);
  const passkey = modeFor('passkey', none);
  assert.equal(passkey.live, false);
  assert.match(passkey.reason, /Simulated passkey/);
  assert.match(passkey.reason, /No server/);
  const share = modeFor('share', { share: true });
  assert.match(share.reason, /share target/i);
  assert.match(share.reason, /server receives/);
  assert.equal(capabilityRows(none).length, 6);

  const local = await prepareLocalSpeech(class Speech {});
  assert.equal(local.live, false);
  assert.match(local.reason, /sample sentence/);
  let started = false;
  class LocalSpeech {
    static available() { return Promise.resolve('available'); }
    start() { started = true; }
  }
  LocalSpeech.prototype.processLocally = false;
  const ready = await prepareLocalSpeech(LocalSpeech);
  assert.equal(ready.live, true);
  startLocalRecognition(LocalSpeech, {});
  assert.equal(started, true);
  const photo = await readPhotoText(null, {});
  assert.equal(photo.simulated, true);
  assert.equal(photo.text, SAMPLE_RECEIPT);
  const read = await readPhotoText({ detect: async () => [{ rawValue: '2 hours framing, Elena, greenhouse' }] }, {});
  assert.equal(read.simulated, false);
  assert.match(read.reason, /not uploaded/);

  const position = await locationRead({
    getCurrentPosition(ok) { ok({ coords: { latitude: 38.9072, longitude: -77.0369 } }); }
  });
  assert.equal(position.stored, false);
  assert.equal(JSON.stringify(position).includes('38.9072'), false);
  assert.equal(JSON.stringify(position).includes('latitude'), false);
  const missingGeo = await locationRead(null);
  assert.match(missingGeo.summary, /not stored|were not read/);

  const options = passkeyCreationOptions('lgme.app', new Uint8Array(32));
  assert.equal(options.publicKey.rp.id, 'lgme.app');
  assert.equal(options.publicKey.attestation, 'none');
  assert.equal(options.publicKey.authenticatorSelection.authenticatorAttachment, 'platform');
  assert.equal(JSON.stringify(options).includes('http'), false);
  const simulated = await runPasskey(null, options);
  assert.equal(simulated.simulated, true);
  const created = await runPasskey({ create: async () => ({ id: 'sample' }) }, options);
  assert.equal(created.ok, true);
  assert.equal(created.simulated, false);
});

test('the page is linked from the menus, the picture, the workflow, and the sitemap', () => {
  const page = text('tap-entry.html');
  const script = text('js/tap-entry.mjs');
  const ui = text('js/tap-entry-ui.mjs');
  const home = text('index.html');
  const navStart = home.indexOf('id="main-nav"');
  const nav = home.slice(navStart, home.indexOf('</nav>', navStart));
  const toolsStart = home.indexOf('class="tools"');
  const tools = home.slice(toolsStart, home.indexOf('class="view-switch"', toolsStart));
  assert.equal(page.includes('<title>One-Tap Entry demo · lgme</title>'), true);
  assert.equal(page.includes('id="tap-entry-app"'), true);
  assert.equal(page.includes('href="/css/tap-entry.css"'), true);
  assert.equal(page.includes('src="/js/tap-entry-ui.mjs"'), true);
  assert.equal(page.includes('src="/js/vendor/qrcode.js"'), true);
  assert.equal(page.includes('src="/js/vendor/jsQR.js"'), true);
  assert.equal(page.includes('href="/my-picture"'), true);
  assert.equal(page.includes('href="/workflow"'), true);
  assert.equal(nav.includes('href="/tap-entry"'), true);
  assert.equal(tools.includes('href="/tap-entry"'), true);
  assert.equal(text('sitemap.xml').includes('https://lgme.app/tap-entry</loc>'), true);
  assert.equal(text('my-picture.html').includes('href="/tap-entry"'), true);
  assert.equal(text('workflow.html').includes('href="/tap-entry"'), true);
  assert.equal(text('my-picture.html').includes('arbiter who can veto'), true);
  assert.equal(text('workflow.html').includes('arbiter who can veto'), true);
  assert.equal(page.includes('arbiter who can veto') || ui.includes('arbiter who can veto'), true);
  assert.equal(ui.includes('Review: what works, what doesn’t'), true);
  assert.equal(STORAGE_KEY, 'lgme.tap-entry.demo.v1');
  assert.equal(script.includes(STORAGE_KEY), true);
  for (const file of ['js/tap-entry.mjs', 'js/tap-entry-ui.mjs']) {
    const body = text(file);
    assert.equal(body.includes('fetch('), false, file);
    assert.equal(body.includes('XMLHttpRequest'), false, file);
    assert.equal(body.includes('WebSocket'), false, file);
    assert.equal(body.includes('sendBeacon'), false, file);
    assert.equal(body.includes('SpeechRecognition.install'), false, file);
  }
  assert.equal(script.includes('processLocally'), true);
  assert.equal(text('manifest.json').includes('share_target'), false);
  assert.equal(text('vercel.json').includes('microphone=(self)'), true);
  assert.equal(text('vercel.json').includes('geolocation=(self)'), true);
  for (const file of ['exchange.html', 'js/solana-pay.mjs', 'js/p2p-exchange-sim.mjs', 'campus.html', 'js/campus-page.mjs', 'mutual-credit.html', 'js/pages/mutual-credit-simulator.js', 'js/ui-view.js', 'clearing-engine.html', 'js/clearing-engine.mjs', 'js/workflow-map.mjs']) {
    assert.equal(text(file).includes('tap-entry'), false, file);
  }
});
