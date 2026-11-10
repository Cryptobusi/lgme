import { MAXIMS, rotationFor } from './wisdom.mjs';

export const AI_KEY = 'lgme.localAi';
export const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
export const MODEL_MB = 290;
export const OPT_IN_COPY = `Runs on this phone. Nothing you type or your progress leaves the device. It may download a model of about ${MODEL_MB} MB on Wi-Fi.`;

const HEALTH = /\b(health|pain|doctor|diagnos|mood|sleep|energy|sick|symptom|medical)\b/i;

const TERMS = [
  ['floor', 'The floor is the basic-needs reserve. A gift that would spend it is refused.'],
  ['subfloor', 'A subfloor is a category pool under the floor. Health and fitness keeps a 1% skim on deed-credit support.'],
  ['ididit', 'IdidIt (verified receipt) is the record after the work is confirmed. A workout by itself mints no credit.'],
  ['iwantit', 'IwantIT is a request. You ask another member for a deed.'],
  ['ihavit', 'IhavIT is an offer. You offer a deed you can do.'],
  ['iselit', 'IselIT is a priced sale. A discount can come from the subfloor.'],
  ['sobeit', 'soBeIT is a donation. A zero price becomes a donation request.'],
  ['concurrence', 'Concurrence means at least two other members agree before wisdom is published. You cannot concur on your own.'],
  ['sharing', 'Sharing levels are Only me, My groups, and Shared community board. Only me is the default. Stop sharing is one tap.'],
  ['group', 'A group is invite-only. Share the code with the people in it. Group content is not public.'],
  ['start', 'Tap Start, then Finish. Duration comes from those two taps. GPS, camera, and motion are optional.'],
  ['app development', 'A $lgme or US$ gift keeps 5% for the Floor and 5% for the App development fund. 90% goes to the author.']
];

export function isOn(storage) {
  try { return storage.getItem(AI_KEY) === 'on'; } catch { return false; }
}

export function setOn(storage, on) {
  storage.setItem(AI_KEY, on ? 'on' : 'off');
}

export function detectEngine(scope = globalThis) {
  const builtin = scope.LanguageModel || scope.ai?.languageModel;
  if (builtin && (typeof builtin.create === 'function' || typeof builtin.prompt === 'function' || typeof builtin.availability === 'function')) {
    return { id: 'browser', label: 'Browser AI' };
  }
  if (scope.navigator?.gpu && typeof scope.navigator.gpu.requestAdapter === 'function') {
    return { id: 'webllm', label: 'On-device model' };
  }
  return { id: 'rules', label: 'Offline helper' };
}

function medical(text) {
  return HEALTH.test(text) ? `Not medical advice. ${text}` : text;
}

export function offlineAnswer(question, progressLines = []) {
  const q = String(question || '').trim();
  if (!q) return medical('Ask about a term, a step, your week, or a draft.');
  if (/\b(leaderboard|streak|ranking|rank)\b/i.test(q)) {
    return 'There is no leaderboard, streak, or ranking. Each page is one member’s own record.';
  }
  if (/\b(draft|message|offer)\b/i.test(q)) {
    return 'Draft only. This was not sent, posted, or paid. “I can help with a session this week. Contribution or barter.”';
  }
  if (/\b(progress|summar|week|my numbers)\b/i.test(q)) {
    const lines = (progressLines || []).filter(Boolean);
    return medical(lines.length
      ? `Here is your week, in plain words. ${lines.join(' ')} This is not a ranking.`
      : 'No progress numbers are on this page yet.');
  }
  if (/\b(intent|maxim|sober)\b/i.test(q)) {
    const today = rotationFor(new Date().toISOString().slice(0, 10), []);
    const hit = MAXIMS.find((maxim) => q.toLowerCase().includes(maxim.title.toLowerCase().slice(0, 8))) || today;
    return `A session intent can be “${hit.title}”. The receipt stores the title only. ${hit.practice}`;
  }
  for (const [key, text] of TERMS) {
    if (q.toLowerCase().includes(key)) return medical(text);
  }
  if (HEALTH.test(q)) {
    return medical('The health meter is a self-reported 1 to 10 score for energy, mood, and sleep. I cannot diagnose or advise treatment.');
  }
  if (/\bhow\b/i.test(q)) {
    return 'Tap Start, then Finish for a session. Post IwantIT to ask, IhavIT to offer, IselIT to sell, or soBeIT to donate. Another person verifies. A workout mints no credit.';
  }
  return medical('I can explain Floor, Subfloor, IdidIt, IwantIT, IhavIT, IselIT, soBeIT, groups, and sharing. I can also suggest a maxim or draft a message that is not sent.');
}

let webEngine = null;

async function askBrowser(api, prompt) {
  if (typeof api.availability === 'function') {
    const state = await api.availability();
    if (state === 'unavailable' || state === 'no') return '';
  }
  const session = typeof api.create === 'function' ? await api.create({ temperature: 0.2 }) : api;
  if (typeof session?.prompt === 'function') {
    const text = await session.prompt(prompt);
    session.destroy?.();
    return String(text || '');
  }
  return '';
}

async function askWebLLM(prompt, onProgress) {
  const lib = await import('./vendor/web-llm.mjs');
  if (!webEngine) {
    webEngine = await lib.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report) => { if (onProgress) onProgress(report); }
    });
  }
  const reply = await webEngine.chat.completions.create({
    messages: [
      { role: 'system', content: 'You help on this phone only. Do not give a medical diagnosis. Do not send messages, post, or mint credit. No leaderboards.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 280
  });
  return String(reply?.choices?.[0]?.message?.content || '');
}

export async function unloadLocalModel() {
  try { await webEngine?.unload?.(); } catch { /* the engine is already gone */ }
  webEngine = null;
}

export async function deleteDownloadedModel() {
  await unloadLocalModel();
  if (!globalThis.caches?.keys) return;
  const names = await caches.keys();
  for (const name of names) {
    if (/webllm|mlc|qwen2\.5-0\.5b/i.test(name)) await caches.delete(name);
  }
}

export async function answerLocal({ question, progressLines = [], scope = globalThis, onProgress } = {}) {
  const prompt = `${question}\n\nProgress on this phone: ${(progressLines || []).join(' ') || 'none'}`;
  const wanted = detectEngine(scope);
  if (wanted.id === 'browser') {
    try {
      const text = await askBrowser(scope.LanguageModel || scope.ai.languageModel, prompt);
      if (text) return { engine: 'browser', label: 'Browser AI', text: medical(text) };
    } catch { /* fall through */ }
  }
  if (wanted.id === 'webllm' || (wanted.id === 'browser' && scope.navigator?.gpu)) {
    try {
      const text = await askWebLLM(prompt, onProgress);
      if (text) return { engine: 'webllm', label: 'On-device model', text: medical(text) };
    } catch { /* the phone stays on the offline helper */ }
  }
  return { engine: 'rules', label: 'Offline helper', text: offlineAnswer(question, progressLines) };
}
