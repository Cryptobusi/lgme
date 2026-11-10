import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CARDS,
  EDGES,
  applyClearing,
  arrowKeyDelta,
  cardInner,
  createCanvasView,
  edgeGeometry,
  fitCanvas,
  focusCard,
  panCanvas,
  renderCard,
  renderEdges,
  specJson,
  specMarkdown,
  zoomCanvas
} from '../js/clearing-engine.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

const BANNED = ['94%', '3.2s', '0.0.782194', '1.2B', 'fiat bypass', 'Fiat Bypassed', 'without state courts', 'mainnet'];

test('the clearing engine page loads its canvas, nav, and spec controls', () => {
  const page = text('clearing-engine.html');
  const css = text('css/clearing-engine.css');
  const script = text('js/clearing-engine.mjs');
  assert.equal(page.includes('<title>Clearing engine · lgme</title>'), true);
  assert.equal(page.includes('id="clearing-app"'), true);
  assert.equal(page.includes('href="/css/clearing-engine.css"'), true);
  assert.equal(page.includes('src="/js/clearing-engine.mjs"'), true);
  assert.equal(page.includes('data-zoom-out'), true);
  assert.equal(page.includes('data-zoom-in'), true);
  assert.equal(page.includes('data-fit'), true);
  assert.equal(page.includes('Fit View'), true);
  assert.equal(page.includes('id="export-spec"'), true);
  assert.equal(page.includes('data-export="json"'), true);
  assert.equal(page.includes('data-export="md"'), true);
  assert.equal(page.includes('id="clearing-minimap"'), true);
  assert.equal(page.includes('href="/spp-framework"'), true);
  assert.equal(page.includes('href="/workflow"'), true);
  for (const card of CARDS) assert.equal(page.includes(`data-focus="${card.id}"`), true, card.id);
  assert.equal(css.includes('touch-action: none'), true);
  assert.equal(script.includes('fetch('), false);
  assert.equal(script.includes('XMLHttpRequest'), false);
  assert.equal(script.includes('WebSocket'), false);
  assert.equal(text('sitemap.xml').includes('https://lgme.app/clearing-engine</loc>'), true);
  for (const phrase of BANNED) assert.equal(script.includes(phrase), false, phrase);
});

test('five cards and the labelled edges exist', () => {
  assert.equal(CARDS.length, 5);
  assert.deepEqual(CARDS.map((card) => card.n), ['01', '02', '03', '04', '05']);
  const labels = EDGES.map((edge) => edge.label);
  assert.deepEqual(labels, [
    'Input Signals & Habits',
    'Dual-Attestation Request',
    'Signed Zero-Debt Hash',
    'Coincidence of Wants & Duty Matching',
    'Closed Loop Cleared: Instant Parity Update'
  ]);
  const svg = renderEdges();
  assert.equal((svg.match(/data-edge="/g) || []).length, 5);
  for (const edge of EDGES) {
    const line = edgeGeometry(edge);
    assert.equal(Number.isFinite(line.x1 + line.y1 + line.x2 + line.y2), true, edge.id);
  }
  const markup = CARDS.map((card) => renderCard(card) + cardInner(card)).join('\n');
  for (const phrase of ['SAMPLE', 'sample topic', 'to be verified', 'PLANNED', 'Live beta', 'AI suggests, you decide', 'held by you alone', 'Cleared in Campus Credit, no US$ needed for this loop']) {
    assert.equal(markup.includes(phrase), true, phrase);
  }
  for (const phrase of BANNED) assert.equal(markup.includes(phrase), false, phrase);
});

test('zoom and pan state functions move the canvas', () => {
  const start = createCanvasView();
  assert.equal(start.scale, 0.85);
  const closer = zoomCanvas(start, 0.1, 100, 80);
  assert.equal(closer.scale, 0.95);
  const capped = zoomCanvas({ scale: 1.6, x: 0, y: 0 }, 0.2, 0, 0);
  assert.equal(capped.scale, 1.6);
  const panned = panCanvas(start, -40, 25);
  assert.equal(panned.x, -40);
  assert.equal(panned.y, 25);
  const fit = fitCanvas(360, 640);
  assert.equal(fit.scale < 0.35, true);
  assert.equal(fit.scale >= 0.12, true);
  const card = focusCard(CARDS[4], 360, 640, 0.5);
  assert.equal(Number.isFinite(card.x + card.y), true);
  assert.deepEqual(arrowKeyDelta('ArrowLeft'), { dx: 70, dy: 0 });
  assert.equal(arrowKeyDelta('Tab'), null);
});

test('the sample three-way clearing demo sums to zero', () => {
  const result = applyClearing();
  assert.equal(result.frames.length, 3);
  for (const frame of result.frames) assert.equal(frame.stepSum, 0, frame.text);
  assert.deepEqual(result.total, { A: 0, B: 0, C: 0 });
  assert.equal(result.sum, 0);
  const markdown = specMarkdown();
  const json = specJson();
  assert.equal(markdown.includes('ΔA + ΔB + ΔC = 0'), true);
  assert.equal(json.includes('"sum": 0'), true);
  assert.equal(markdown.includes('sample topic'), true);
  assert.equal(markdown.includes('held by you alone'), true);
  for (const phrase of BANNED) {
    assert.equal(markdown.includes(phrase), false, phrase);
    assert.equal(json.includes(phrase), false, phrase);
  }
});
