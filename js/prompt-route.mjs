import { CATEGORIES } from './category-help.mjs';

const HINTS = [
  { id: 'health', words: ['workout', 'treadmill', 'gym', 'walk', 'run', 'yoga', 'health', 'session', 'swim', 'bike'] },
  { id: 'campus', words: ['campus', 'tutoring', 'class', 'dorm'] },
  { id: 'neighbor', words: ['neighbor', 'neighbour', 'block'] },
  { id: 'hosts', words: ['host', 'hosting', 'gathering'] },
  { id: 'circles', words: ['circle', 'circles'] },
  { id: 'stories', words: ['story', 'stories'] },
  { id: 'exchange', words: ['exchange', 'trade', 'swap'] },
  { id: 'ihelpit', words: ['ihelpit', 'older', 'caregiver', 'large print'] }
];

function scores(text) {
  return HINTS.map((hint) => ({
    id: hint.id,
    name: CATEGORIES.find((item) => item.id === hint.id)?.name || hint.id,
    score: hint.words.reduce((sum, word) => sum + (new RegExp(`\\b${word}\\b`).test(text) ? 1 : 0), 0)
  })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function actionOf(text) {
  if (/^(log\b|did\b|i did\b|ididit\b)/.test(text) || /\b(treadmill|walk|run|yoga|swim|bike)\b/.test(text)) return 'IdidIt';
  if (/^i want\b/.test(text)) return 'IwantIT';
  if (/^i have\b/.test(text)) return 'IhavIT';
  return 'help';
}

export function classifyPrompt(text) {
  const raw = String(text || '').trim();
  const q = raw.toLowerCase();
  const ranked = scores(q);
  const best = ranked[0];
  const second = ranked[1];
  const category = best?.score ? best.name : 'Health';
  const item = CATEGORIES.find((entry) => entry.name === category) || CATEGORIES[0];
  const live = item.badge === 'Beta';
  const confidence = best?.score ? (best.score > (second?.score || 0) ? 0.9 : 0.45) : 0.3;
  const action = actionOf(q);
  const steps = live
    ? ['Check the draft on this phone', 'Tap Confirm', 'The receipt stays on testnet only after you confirm']
    : ['This category is In development', 'Open the prefilled Help develop note', 'Nothing is written live'];
  return {
    category,
    action,
    fields: { text: raw },
    confidence,
    liveWrite: live,
    alternatives: confidence < 0.6 ? ranked.slice(0, 3).map((row) => row.name) : [],
    steps,
    href: live ? '/gym#/ididit' : `/develop?category=${encodeURIComponent(item.name)}`
  };
}

export function routeLine(route, detail) {
  return `Category: ${route.category}. Recommend: ${detail} Steps: 1) ${route.steps[0]} 2) ${route.steps[1]} 3) ${route.steps[2]}`;
}
