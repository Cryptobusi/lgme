import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acceptFile, careFromManual, receiptHints, searchThings, storageMeter } from '../js/ihavit.mjs';
import { extractPdfText } from '../js/pdf-text.mjs';

const manual = new TextEncoder().encode(`%PDF-1.1
1 0 obj << /Length 48 >> stream
(Check the chain every 90 days) Tj
endstream
endobj
%%EOF`);

test('manuals suggest care and receipts stay suggestions', async () => {
  const pages = await extractPdfText(manual);
  assert.match(pages[0].text, /every 90 days/);
  const care = careFromManual(pages, 'City bike', 'bike');
  assert.equal(care.found, true);
  assert.equal(care.suggestions[0].everyDays, 90);
  assert.equal(care.suggestions[0].page, 1);
  assert.match(care.suggestions[0].quote, /every 90 days/);
  const empty = careFromManual([], 'City bike', 'bike');
  assert.equal(empty.found, false);
  assert.match(empty.note, /No routine was found/);
  assert.match(empty.suggestions[0].label, /General guidance/);
  const hint = receiptHints('Total: $18.50 on 2024-05-02');
  assert.equal(hint.purchased, '2024-05-02');
  assert.equal(hint.price, '18.50');
  assert.match(hint.note, /Nothing was saved/);
  assert.equal(acceptFile('video', 9000000, 0).ok, false);
  assert.equal(acceptFile('photo', 1000, 39999999).ok, false);
  assert.equal(storageMeter(1500000).label.includes('1.5 MB'), true);
  const found = searchThings(
    [{ id: 'a', name: 'City bike', category: 'bike', notes: '' }],
    [{ itemId: 'a', text: 'Check the chain every 90 days' }],
    'chain'
  );
  assert.equal(found[0].id, 'a');
  const worker = readFileSync(new URL('../js/pdf-text-worker.js', import.meta.url), 'utf8');
  assert.equal(/https?:/.test(worker), false);
  const policy = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = policy.headers.flatMap((block) => block.headers).find((header) => header.key === 'Content-Security-Policy').value;
  assert.match(csp, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.match(csp, /worker-src 'self'/);
  const page = readFileSync(new URL('../ihavit.html', import.meta.url), 'utf8');
  assert.match(page, /does not read words off a picture/);
  assert.match(page, /id="ihavit-meter"/);
  assert.match(page, /id="ihavit-camera"/);
});
