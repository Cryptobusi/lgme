import test from 'node:test';
import assert from 'node:assert/strict';
import { measureModelWarmup } from '../js/model-warmup.mjs';
import { aiSetupSteps } from '../js/ai-setup.mjs';

test('a phone without WebGPU does not pass the model warmup', async () => {
  const result = await measureModelWarmup({
    performance: { now: () => 0 },
    WebAssembly: { validate: () => true },
    navigator: {}
  });
  assert.equal(result.pass, false);
  assert.equal(result.wasm, true);
  assert.equal(result.adapter, false);
});

test('Safari and Firefox say the warmup can fail and confirm still works', () => {
  const safari = aiSetupSteps('Mozilla/5.0 Version/17.0 Mobile Safari/605').steps.join(' ');
  const firefox = aiSetupSteps('Firefox/120').steps.join(' ');
  assert.match(safari, /confirm by hand/);
  assert.match(firefox, /confirm by hand/);
  assert.match(firefox, /Chrome/);
});
