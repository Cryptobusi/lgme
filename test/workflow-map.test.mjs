import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EDGES,
  LIVE_ROWS,
  MAP_H,
  MAP_W,
  NODES,
  PATHS,
  ZONES,
  ZONE_KEY,
  arrowKeyDelta,
  createView,
  edgeEndpoints,
  fitScale,
  jumpToZone,
  panBy,
  renderLiveTableHtml,
  renderWorkflowSvg,
  renderZoneKeyHtml,
  resetView,
  zoomBy
} from '../js/workflow-map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

test('the workflow page loads its own stylesheet and script', () => {
  const page = text('workflow.html');
  const css = text('css/workflow.css');
  const script = text('js/workflow-map.mjs');
  assert.equal(page.includes('<title>SPP Workflow Map · lgme</title>'), true);
  assert.equal(page.includes('id="workflow-app"'), true);
  assert.equal(page.includes('href="/css/workflow.css"'), true);
  assert.equal(page.includes('src="/js/workflow-map.mjs"'), true);
  assert.equal(page.includes('data-zoom-out'), true);
  assert.equal(page.includes('data-zoom-in'), true);
  assert.equal(page.includes('data-fit'), true);
  assert.equal(page.includes('data-reset'), true);
  assert.equal(page.includes('id="workflow-minimap"'), true);
  assert.equal(page.includes('Zone key'), true);
  assert.equal(page.includes('Live versus planned'), true);
  assert.equal(page.includes('href="/spp-framework"'), true);
  assert.equal(page.includes('href="/clearing-engine"'), true);
  for (const zone of ZONES) assert.equal(page.includes(`data-zone="${zone.n}"`), true, String(zone.n));
  assert.equal(css.includes('overflow: auto'), true);
  assert.equal(script.includes('from "grok/canvas"'), false);
  assert.equal(script.includes('from "react"'), false);
  assert.equal(script.includes('fetch('), false);
  assert.equal(text('sitemap.xml').includes('https://lgme.app/workflow</loc>'), true);
  assert.equal(text('vercel.json').includes('workflow'), false);
});

test('nine zones, the nodes, and the edges are in the map', () => {
  assert.equal(ZONES.length, 9);
  assert.deepEqual(ZONES.map((zone) => zone.n).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(NODES.length > 40, true);
  assert.equal(EDGES.length, 29);
  assert.equal(PATHS.length, 10);
  assert.equal(ZONE_KEY.length, 9);
  const svg = renderWorkflowSvg();
  const visible = NODES.filter((node) => !node.hidden);
  assert.equal((svg.match(/data-node="/g) || []).length, visible.length);
  assert.equal((svg.match(/data-edge="/g) || []).length, EDGES.length);
  assert.equal((svg.match(/data-path="/g) || []).length, PATHS.length);
  for (const phrase of [
    'Person and onboarding',
    'Third Seat arbiter',
    'the arbiter who can veto',
    'Consent first',
    'AI suggests, you decide',
    'Live beta',
    'Planned',
    'to be verified',
    'audit feedback: back to the person and the seats',
    'One confirmed deed = one CC',
    'sum 0'
  ]) {
    assert.equal(svg.includes(phrase), true, phrase);
  }
  const allow = EDGES.find((edge) => edge.label === 'Allow');
  const ends = edgeEndpoints(allow);
  assert.equal(Number.isFinite(ends.x1 + ends.y1 + ends.x2 + ends.y2), true);
  assert.equal(renderZoneKeyHtml().includes('arbiter who can veto'), true);
  assert.equal(renderLiveTableHtml().includes('Live beta'), true);
  assert.equal(renderLiveTableHtml().includes('To be verified'), true);
  assert.equal(LIVE_ROWS[2][1], 'Planned');
});

test('zoom and pan state stay inside the map', () => {
  assert.equal(zoomBy(1, 0.2), 1.2);
  assert.equal(zoomBy(1.6, 0.2), 1.6);
  assert.equal(zoomBy(0.3, -0.2), 0.3);
  assert.equal(fitScale(MAP_W + 4), 1);
  assert.equal(fitScale(804), 0.25);
  const start = createView();
  const moved = panBy(start, 120, 80, { width: 400, height: 300 });
  assert.equal(moved.scrollLeft, 120);
  assert.equal(moved.scrollTop, 80);
  const stuck = panBy(moved, -500, -500, { width: 400, height: 300 });
  assert.equal(stuck.scrollLeft, 0);
  assert.equal(stuck.scrollTop, 0);
  const jumped = jumpToZone({ scale: 1, scrollLeft: 0, scrollTop: 0 }, 8, { width: 400, height: 300 });
  assert.equal(jumped.scrollLeft > 1800, true);
  assert.equal(jumped.scrollTop > 1200, true);
  const arrows = arrowKeyDelta('ArrowRight');
  assert.deepEqual(arrows, { dx: 80, dy: 0 });
  assert.equal(arrowKeyDelta('Enter'), null);
  assert.deepEqual(resetView(), { scale: 1, scrollLeft: 0, scrollTop: 0 });
  assert.equal(MAP_W, 3200);
  assert.equal(MAP_H, 2200);
});
