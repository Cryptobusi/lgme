import { detectEngine, MODEL_MB } from './local-ai.mjs';

export const HELPER_KEY = 'lgme.helper';
export const STEPS = Object.freeze([
  { id: 'engine', title: 'Your helper runs on your phone.', line: 'Nothing you type leaves this device.' },
  { id: 'start', title: 'Pick a starting helper.', line: 'Choose a card or write your own.' },
  { id: 'you', title: 'Tell it about you, in your words.', line: 'The helper drafts fields for you to edit. Nothing is submitted.' },
  { id: 'terms', title: 'Set your terms.', line: 'You tap to confirm every action.' },
  { id: 'review', title: 'Review and turn on.', line: 'Check the card, then turn the helper on.' }
]);

export const HELPERS = Object.freeze([
  { id: 'gym', name: 'Gym buddy', blurb: 'Goals, workout reminders, and the maxim of the day.', goal: 'Remind me about sessions and suggest one maxim as my intent. Do not send anything.' },
  { id: 'barter', name: 'Barter scout', blurb: 'Watches IhavIT and IwantIT matches and drafts offers.', goal: 'Watch IhavIT and IwantIT matches and draft an offer for me to review. Never accept.' },
  { id: 'campus', name: 'Campus helper', blurb: 'Drafts time-and-deed bank posts.', goal: 'Draft a campus time-and-deed post for me to review. Do not post it.' },
  { id: 'wisdom', name: 'Wisdom keeper', blurb: 'Suggests a maxim and drafts a wisdom submission.', goal: 'Suggest one maxim and draft a wisdom note for me to review. Do not submit it.' },
  { id: 'onboard', name: 'Onboarding helper', blurb: 'Fills my sign-up forms for me to check.', goal: 'Prefill my sign-up fields for me to edit. Do not sign or submit.' },
  { id: 'blank', name: 'Blank', blurb: 'Write your own.', goal: '' }
]);

export const ALLOWED = Object.freeze([
  ['remind', 'Remind'],
  ['notify', 'Notify'],
  ['summarize', 'Summarize'],
  ['draftMessages', 'Draft messages'],
  ['draftOffers', 'Draft offers'],
  ['prefill', 'Prefill forms']
]);

export const LOCKED = Object.freeze([
  'It never sends.',
  'It never posts.',
  'It never accepts.',
  'It never signs.',
  'It never spends.',
  'It never mints credit.'
]);

export const FREQUENCIES = Object.freeze(['Only when I open the app', 'Once a day', 'A few times a day']);

export function engineChoices(scope = globalThis) {
  const detected = detectEngine(scope);
  return [
    { id: 'browser', label: 'Built-in browser AI', detail: 'Used when this browser has it.', picked: detected.id === 'browser' },
    { id: 'webllm', label: 'Downloaded small model', detail: `About ${MODEL_MB} MB on Wi-Fi.`, picked: detected.id === 'webllm' },
    { id: 'rules', label: 'Simple offline helper', detail: 'Templates on this phone. No download.', picked: detected.id === 'rules' }
  ];
}

export function extractFields(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 800);
  const first = raw.split(/(?<=[.!?])\s+/)[0] || '';
  const grab = (pattern) => {
    const hit = raw.match(pattern);
    return hit ? hit[1].trim().slice(0, 120) : '';
  };
  const hours = grab(/(\d+(?:\.\d+)?)\s*hours?/i);
  const monthly = grab(/(\d+)\s*(?:a month|per month|units?)/i);
  const categories = ['minutes', 'sessions', 'miles', 'calories', 'health'].filter((word) => raw.toLowerCase().includes(word.slice(0, 5)));
  return {
    profile: first,
    primary: grab(/\b(?:i (?:can|offer|do|coach|teach)|offering is)\s+([^.]{3,100})/i),
    secondary: grab(/\b(?:also|second(?:ary)?(?: offering)?(?: is)?)\s+([^.]{3,100})/i),
    unit: grab(/\b(session-hours|sessions|hours|meals|rides|lessons)\b/i) || (hours ? 'hours' : ''),
    hours,
    monthly,
    goals: grab(/\b(?:my goal is|i want to|goal:)\s+([^.]{3,140})/i),
    categories
  };
}

export function defaultTerms() {
  return {
    remind: true,
    notify: false,
    summarize: true,
    draftMessages: true,
    draftOffers: false,
    prefill: true,
    quietStart: '21:00',
    quietEnd: '07:00',
    frequency: FREQUENCIES[1]
  };
}

export function summaryCard(config) {
  const does = ALLOWED.filter(([key]) => config.terms?.[key]).map(([, label]) => label).join(', ') || 'Nothing until you allow it';
  return {
    name: config.name || 'Helper',
    engine: config.engineLabel || 'Offline helper',
    does,
    schedule: `${config.terms?.frequency || FREQUENCIES[0]}. Quiet ${config.terms?.quietStart || '21:00'} to ${config.terms?.quietEnd || '07:00'}.`
  };
}

function bytesToB64(bytes) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function b64ToBytes(text) {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function makeHelperKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function sealText(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(text)));
  return { iv: bytesToB64(iv), cipher: bytesToB64(new Uint8Array(cipher)) };
}

export async function openText(payload, key) {
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(payload.iv) },
    key,
    b64ToBytes(payload.cipher)
  );
  return new TextDecoder().decode(clear);
}

export function publicHelper(config) {
  return {
    name: config.name,
    engine: config.engine,
    engineLabel: config.engineLabel,
    paused: config.paused === true,
    schedule: summaryCard(config).schedule,
    sends: false,
    signs: false,
    mints: false
  };
}
