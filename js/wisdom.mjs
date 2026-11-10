import { commonsSplit } from './commons-split.mjs';

export const TEXT_MAX = 280;
export const EXCERPT_NOTE = 'New excerpts are added daily.';
export const EXCERPT_FIELDS = Object.freeze(['date', 'text', 'theme', 'forTheApp', 'source', 'sourceUrl', 'kind']);
export const CHECK_KEY = 'lgme.wisdom.checks';
export const CONCUR_NEED = 2;

const PRIVATE = /@|https?:|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/i;

export const MAXIMS = Object.freeze([
  {
    domain: 'Morning Induction',
    title: 'Cold water wakes the marrow',
    practice: 'End morning hygiene with 90–120 seconds of unheated water. No transitional warming.',
    clearance: 'Nervous system fully alert without exogenous stimulants.'
  },
  {
    domain: 'Morning Induction',
    title: 'Silence exposes the signal',
    practice: 'Zero audio, feeds, notifications, or external media for the first 60 minutes after waking.',
    clearance: 'Mental baseline established in silence before external inputs enter.'
  },
  {
    domain: 'Morning Induction',
    title: 'Direct responsibility kills anxiety',
    practice: 'Identify the single highest-friction administrative or technical task and begin it within 15 minutes of work onset.',
    clearance: 'Dread converted into concrete material progress.'
  },
  {
    domain: 'Focused Work Block',
    title: 'Necessity concentrates the mind',
    practice: 'Work in isolated 90-minute blocks with only essential terminal windows/tools active; close background monitors.',
    clearance: 'Task objective completed without cognitive residue or task-switching tax.'
  },
  {
    domain: 'Focused Work Block',
    title: 'Fewer tools sharpen the craftsman',
    practice: 'Restrict workflow to core utilities (plain text/markdown, command-line interfaces, foundational libraries) before reaching for heavy abstractions or plugins.',
    clearance: 'Code, prose, or architecture is lean, functional, and devoid of bloat.'
  },
  {
    domain: 'Focused Work Block',
    title: 'Frugality creates the true reserve',
    practice: 'Commit zero capital or commitments to speculative tools, subscriptions, or speculative dependencies.',
    clearance: 'Operational surface area remains completely self-contained.'
  },
  {
    domain: 'Midday Reset & Metabolic Discipline',
    title: 'Fasting purifies the palate',
    practice: 'Maintain water/electrolyte-only intake through the morning; defer the initial caloric window until core mental output is finalized.',
    clearance: 'Sensory receptors reset; mental acuity maintained through stable blood glucose.'
  },
  {
    domain: 'Midday Reset & Metabolic Discipline',
    title: 'Hunger seasons the bread',
    practice: 'Break fast with single-ingredient, unprocessed whole foods prepared by hand. No refined flavor enhancers or artificial sweeteners.',
    clearance: 'Satiety achieved through earned biological demand rather than hedonic stimulation.'
  },
  {
    domain: 'Midday Reset & Metabolic Discipline',
    title: 'Walking measures the ground',
    practice: 'Conduct transitions and errands on foot. Minimum 30-minute purposeful stride under open sky.',
    clearance: 'Spatial and temporal orientation anchored to natural human locomotion.'
  },
  {
    domain: 'Mutual Exchange & Social Ledger',
    title: 'The gift clears its own ledger',
    practice: 'Execute one high-leverage peer support action (technical review, direct aid, knowledge transfer) with zero tracking, expectation of return, or public signaling.',
    clearance: 'Obligation ledger remains at zero; transaction clears in the moment of execution.'
  },
  {
    domain: 'Mutual Exchange & Social Ledger',
    title: 'Simplicity preserves sovereignty',
    practice: 'Audit incoming agreements, communication channels, and accounts; decline non-essential commitments and close dormant dependencies.',
    clearance: 'Zero external leverage, recurring liabilities, or administrative entrapments.'
  },
  {
    domain: 'Evening Grounding & Recovery',
    title: 'Labor anchors the sleep',
    practice: 'Undergo 45–60 minutes of direct physical loading (compound lifts, bodyweight resistance, manual work) until genuine physical fatigue is achieved.',
    clearance: 'Physical exhaustion matches mental output; sleep initiates without artificial sedatives.'
  }
]);

export const MAXIM_TITLES = Object.freeze(MAXIMS.map((maxim) => maxim.title));

export const CHECKLIST = Object.freeze([
  {
    phase: 'Morning Calibration',
    items: [
      'Thermal contrast executed (cold exposure).',
      'First hour protected from digital feeds, news, and notifications.',
      'Highest-friction duty tackled first to eliminate speculative anxiety.'
    ]
  },
  {
    phase: 'Deep Work Execution',
    items: [
      'Deep-work window isolated; all non-essential applications closed.',
      'Core tools prioritized over complex toolchains.',
      'Operational expenditures capped at direct utility.'
    ]
  },
  {
    phase: 'Metabolic & Physical Grounding',
    items: [
      'Caloric intake delayed until physical and intellectual labor is underway.',
      'Meal composed of basic, whole elements consumed without distraction.',
      'Terrain covered on foot to recalibrate scale and pacing.'
    ]
  },
  {
    phase: 'Clearing & Rest',
    items: [
      'Unilateral peer support offered with zero deferred social credit.',
      'Unneeded obligations pruned from the operational surface.',
      'High-intensity resistance/load completed to guarantee unmedicated, deep biological recovery.'
    ]
  }
]);

function clean(value, max) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function blocked(value) {
  return PRIVATE.test(value) || String(value || '').includes('$Trust');
}

export function publicWisdom(spec = {}) {
  const text = clean(spec.text, TEXT_MAX);
  const theme = clean(spec.theme, 40);
  const kind = spec.kind === 'quote' || spec.kind === 'original' ? spec.kind : '';
  const source = clean(spec.source, 80);
  const sourceUrl = String(spec.sourceUrl || '').trim().slice(0, 200);
  if (!text) return { ok: false, error: 'Write the excerpt.' };
  if (String(spec.text || '').trim().length > TEXT_MAX) return { ok: false, error: 'Keep the excerpt to 280 characters.' };
  if (!theme) return { ok: false, error: 'Add a theme.' };
  if (!kind) return { ok: false, error: 'Choose original or quote.' };
  if (blocked(text) || blocked(theme) || blocked(source)) return { ok: false, error: 'Leave out emails, links, phone numbers, and that token name.' };
  if (kind === 'quote') {
    if (!source) return { ok: false, error: 'A quote needs the author or source.' };
    if (!/^https:\/\/\S+$/i.test(sourceUrl)) return { ok: false, error: 'A quote needs an https source URL.' };
  } else if (sourceUrl) {
    return { ok: false, error: 'An original excerpt does not take a source URL.' };
  }
  const groupCode = clean(spec.groupCode, 24).toLowerCase();
  if (groupCode && !/^[a-z0-9-]{4,24}$/.test(groupCode)) return { ok: false, error: 'The invite code is not usable.' };
  return {
    ok: true,
    item: {
      text,
      theme,
      kind,
      source,
      sourceUrl: kind === 'quote' ? sourceUrl : '',
      anonymous: spec.anonymous === true,
      groupCode
    }
  };
}

export function intentTitle(value, allowed = []) {
  const title = clean(value, 80);
  if (!title || blocked(title)) return '';
  if (MAXIM_TITLES.includes(title)) return title;
  if ((allowed || []).includes(title)) return title;
  return '';
}

export function wisdomSplit(amount) {
  return commonsSplit(amount);
}

export function checkState(saved, day) {
  const today = String(day || '');
  if (!saved || saved.day !== today || !Array.isArray(saved.ids)) return { day: today, ids: [] };
  return { day: today, ids: saved.ids.filter((id) => typeof id === 'string') };
}

export function excerptsFrom(body) {
  const rows = Array.isArray(body) ? body : body?.excerpts;
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row && typeof row.text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')) && (row.kind === 'original' || row.kind === 'quote'));
}

export async function loadExcerpts(fetcher = globalThis.fetch) {
  const empty = { note: EXCERPT_NOTE, excerpts: [] };
  if (typeof fetcher !== 'function') return empty;
  try {
    const response = await fetcher('/data/wisdom-excerpts.json');
    if (!response?.ok) return empty;
    const body = await response.json();
    return {
      note: typeof body?.note === 'string' && body.note ? body.note : EXCERPT_NOTE,
      excerpts: excerptsFrom(body)
    };
  } catch {
    return empty;
  }
}

export function wisdomVisible(item, viewer) {
  if (!item) return false;
  if (!item.groupCode) return true;
  if (viewer?.id && viewer.id === item.authorId) return true;
  return Boolean(viewer?.clubGroups?.[item.groupCode]);
}

export function visibleWisdom(books, viewer) {
  const rows = [];
  for (const book of books || []) {
    for (const item of Object.values(book?.wisdomSubmissions || {})) {
      if (wisdomVisible(item, viewer)) rows.push(item);
    }
  }
  return rows;
}

export function memberLines(items) {
  return (items || []).filter((item) => item?.status === 'published' && item.text && item.theme).map((item) => ({
    kind: item.kind,
    title: item.theme,
    text: item.text,
    source: item.anonymous ? 'anonymous' : (item.handle || 'member')
  }));
}

export function rotationFor(day, extras = []) {
  const lines = [
    ...MAXIMS.map((maxim) => ({ kind: 'maxim', title: maxim.title, text: maxim.practice, source: 'Sober Poverty' })),
    ...(extras || []).filter((line) => line?.text && line?.title)
  ];
  const key = String(day || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (Math.imul(hash, 33) + key.charCodeAt(i)) >>> 0;
  return lines[hash % lines.length];
}
