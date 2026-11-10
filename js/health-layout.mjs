import { FALLBACK_LABEL, HEALTH_PLANS } from './health-plan.mjs';

const SECTIONS = new Set(['habits', 'week', 'reminders', 'buddies', 'program', 'notes', 'help']);

export function recommendId(goals = '') {
  const text = String(goals || '').toLowerCase();
  if (/12-week|twelve-week|trainer review|sponsor report|intake goal/.test(text)) return 'ultimate';
  if (/weekly|buddy|varied|variety|check-in/.test(text)) return 'engaging';
  return 'easy';
}

function cleanText(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  if (!text || /[<>]|javascript:|<\/?script/i.test(text)) return '';
  return text;
}

export function validateLayout(raw, id) {
  const plan = HEALTH_PLANS[id] || HEALTH_PLANS[raw?.id];
  if (!plan) return { ok: false, error: 'Choose Easy, Engaging, or Ultimate.' };
  const title = cleanText(raw?.title, 60);
  const tone = cleanText(raw?.tone, 80);
  const sections = Array.isArray(raw?.sections) ? raw.sections.slice(0, 6).map((section) => ({
    id: SECTIONS.has(section?.id) ? section.id : 'habits',
    title: cleanText(section?.title, 40),
    body: cleanText(section?.body, 280)
  })).filter((section) => section.title && section.body) : [];
  const reminders = Array.isArray(raw?.reminders) ? raw.reminders.slice(0, 3).map((item) => ({
    days: Array.isArray(item?.days) ? item.days.filter((day) => /^(sun|mon|tue|wed|thu|fri|sat)$/.test(day)).slice(0, 7) : [],
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(item?.time || '')) ? item.time : '',
    text: cleanText(item?.text, 80)
  })).filter((item) => item.time && item.text && item.days.length) : [];
  if (!title || !tone || sections.length < 1) return { ok: false, error: 'The draft was not a page layout.' };
  return {
    ok: true,
    layout: { version: 1, id: plan.id, title, tone, sections, reminders, hedera: false }
  };
}

export function layoutFromText(text, id) {
  const raw = String(text || '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false, error: 'The draft was not a page layout.' };
  try { return validateLayout(JSON.parse(raw.slice(start, end + 1)), id); }
  catch { return { ok: false, error: 'The draft was not a page layout.' }; }
}

export function fallbackLayout(id, goals = '') {
  const focus = cleanText(goals, 80) || 'a steadier week';
  const pages = {
    easy: {
      title: 'Easy Health',
      tone: 'Quiet and short.',
      sections: [
        { id: 'habits', title: 'Three habits', body: `For ${focus}: a short walk, water with one meal, and one stretch before bed.` },
        { id: 'reminders', title: 'Gentle reminder', body: 'One evening line on this phone. It does not count a streak.' }
      ],
      reminders: [{ days: ['mon', 'wed', 'fri'], time: '19:00', text: 'A short walk, if you want.' }]
    },
    engaging: {
      title: 'Engaging Health',
      tone: 'Warm, with room to change the session.',
      sections: [
        { id: 'week', title: 'This week', body: `For ${focus}: three different sessions, not the same one repeated.` },
        { id: 'buddies', title: 'Buddy check-in', body: 'One check-in with a sponsor or a trainer. No ranking.' }
      ],
      reminders: [{ days: ['tue', 'thu'], time: '18:00', text: 'A different session today, if you want.' }]
    },
    ultimate: {
      title: 'Ultimate Health',
      tone: 'A full program, still yours to confirm.',
      sections: [
        { id: 'program', title: '12 weeks', body: `For ${focus}. Weeks 1–4 build three habits. Weeks 5–8 vary the sessions. Weeks 9–12 are a trainer review.` },
        { id: 'notes', title: 'Sponsor notes', body: 'Progress notes stay on this phone. A verified sponsor report can carry a hash only.' },
        { id: 'help', title: 'Ask the helper', body: 'The local AI drafts and reminds. It does not send or post.' }
      ],
      reminders: [{ days: ['mon'], time: '08:00', text: 'Look at this week of the program.' }]
    }
  };
  const built = validateLayout(pages[id], id);
  return { ...built, label: FALLBACK_LABEL, engine: 'rules', recommended: false };
}

export function layoutsFor(goals = '') {
  const recommended = recommendId(goals);
  return ['easy', 'engaging', 'ultimate'].map((id) => {
    const layout = fallbackLayout(id, goals);
    layout.recommended = id === recommended;
    return layout;
  });
}
