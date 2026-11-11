import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installedEntry, personalTarget } from '../js/pwa-open.mjs';
import { pickAiTier, pushReadiness, shareProfile } from '../js/device-capabilities.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

function memory(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { getItem(key) { return data.has(key) ? data.get(key) : null; }, setItem(key, value) { data.set(key, String(value)); } };
}

test('an installed launch opens the saved page, or Health, with no hop', () => {
  const bare = memory();
  const win = { matchMedia: () => ({ matches: true }) };
  const nav = { standalone: false, userAgent: 'Mozilla/5.0' };
  assert.equal(installedEntry(bare, win, nav).open, false);
  assert.equal(installedEntry(memory({ 'lgme.demo.member': '{"demo":true}' }), win, nav).open, false);
  assert.equal(installedEntry(memory({ 'lgme.demo.member': '{"demo":true}' }), { matchMedia: () => ({ matches: true }), location: { search: '?home=1' } }, nav).open, false);
  assert.equal(installedEntry(bare, { matchMedia: () => ({ matches: false }) }, nav).open, false);
  const saved = memory({
    'lgme-gym.seat': 'jordan',
    'lgme.health.page:jordan': JSON.stringify({ confirmed: true, layout: { title: 'Easy' } }),
    'lgme.health.email': JSON.stringify({ email: 'jordan@example.com' })
  });
  assert.equal(personalTarget(saved), '/gym#/page');
  assert.equal(saved.getItem('lgme.health.email').includes('jordan@example.com'), true);
  const manifest = JSON.parse(text('manifest.json'));
  assert.equal(manifest.start_url, '/gym');
  assert.equal(manifest.shortcuts.some((item) => item.url === '/gym'), true);
  assert.equal(text('js/p2p-exchange-sim-ui.mjs').includes('display-mode: standalone'), true);
});

test('iOS push, the AI tier, and sharing stay on the device', async () => {
  assert.equal(pushReadiness({ ios: true, major: 16, minor: 3, standalone: true, notification: true, pushManager: true }).state, 'no');
  assert.match(pushReadiness({ ios: true, major: 16, minor: 4, standalone: false, notification: true, pushManager: true }).detail, /Home Screen/);
  assert.equal(pushReadiness({ ios: true, major: 17, minor: 0, standalone: true, notification: true, pushManager: true }).state, 'yes');
  assert.equal(pickAiTier({ webgpu: 'yes', wasmSimd: 'yes' }).tier, 'on-device model');
  assert.equal(pickAiTier({ webgpu: 'no', wasmSimd: 'yes' }).tier, 'smaller on-device model');
  assert.equal(pickAiTier({ webgpu: 'no', wasmSimd: 'no' }).tier, 'offline helper');
  let fetched = false;
  const blocked = await shareProfile({ label: 'desktop Chrome', ai: { tier: 'offline helper' }, push: 'yes' }, { consent: false, share: () => { fetched = true; } });
  assert.equal(blocked.sent, false);
  assert.equal(fetched, false);
  const shared = await shareProfile({ label: 'desktop Chrome', ai: { tier: 'offline helper' }, push: 'yes' }, { consent: true, share: async () => {} });
  assert.equal(shared.sent, false);
  assert.equal(shared.shared, true);
});
