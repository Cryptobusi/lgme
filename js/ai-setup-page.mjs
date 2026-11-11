import { aiSetupSteps } from './ai-setup.mjs';
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
document.getElementById('ai-check').addEventListener('click', async () => {
  status.textContent = 'Checking this device…';
  await refreshHelper(window, localStorage);
  status.textContent = localAiReady()
    ? 'On-device AI is on.'
    : 'On-device AI is still off. Follow the steps above, then check again.';
});
