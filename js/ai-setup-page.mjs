import { aiSetupSteps } from './ai-setup.mjs';
import { measureModelWarmup } from './model-warmup.mjs';
import { localAiReady, refreshHelper } from './one-tap.mjs';

const guide = aiSetupSteps(navigator.userAgent);
document.getElementById('ai-setup-title').textContent = guide.title;
const steps = document.getElementById('ai-setup-steps');
for (const line of guide.steps) {
  const item = document.createElement('li');
  item.textContent = line;
  steps.append(item);
}

const status = document.getElementById('ai-check-status');
document.getElementById('model-try').addEventListener('click', async () => {
  status.textContent = 'Running the warmup on this phone…';
  const result = await measureModelWarmup(window);
  if (result.pass) {
    try { localStorage.setItem('lgme.localModel.ready', '1'); } catch { /* the note still shows */ }
    status.textContent = `The on-device model passed the warmup in ${result.ms} ms. It stays on this phone.`;
    return;
  }
  try { localStorage.removeItem('lgme.localModel.ready'); } catch { /* the note still shows */ }
  status.textContent = 'This phone did not pass the warmup. You can still browse and confirm by hand.';
});
document.getElementById('ai-check').addEventListener('click', async () => {
  status.textContent = 'Checking this device…';
  await refreshHelper(window, localStorage);
  status.textContent = localAiReady()
    ? 'On-device AI is on.'
    : 'On-device AI is still off. Follow the steps above, then check again.';
});
