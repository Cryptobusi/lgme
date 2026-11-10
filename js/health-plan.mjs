export const PLAN_ORDER = Object.freeze(['easy', 'engaging', 'ultimate']);

export const HEALTH_PLANS = Object.freeze({
  easy: {
    id: 'easy',
    title: 'Easy',
    image: '/images/health-plan-easy.png',
    prompt: [
      'You are the local Health helper on this phone. Draft a personalized Health app for me.',
      'Do not diagnose. Do not send anything. Do not mint credit. Do not rank me.',
      'Easy version. Keep it minimal.',
      'Three daily habits only.',
      'Gentle reminders, one line, easy to ignore.',
      'No streaks, no leaderboard, and no ranking.',
      'The draft stays on this phone until I confirm it.'
    ].join('\n')
  },
  engaging: {
    id: 'engaging',
    title: 'Engaging',
    image: '/images/health-plan-engaging.png',
    prompt: [
      'You are the local Health helper on this phone. Draft a personalized Health app for me.',
      'Do not diagnose. Do not send anything. Do not mint credit. Do not rank me.',
      'Engaging version.',
      'Weekly goals I can finish.',
      'Buddy check-ins with a sponsor or a trainer.',
      'Varied sessions across the week.',
      'No streaks, no leaderboard, and no ranking.',
      'The draft stays on this phone until I confirm it.'
    ].join('\n')
  },
  ultimate: {
    id: 'ultimate',
    title: 'Ultimate',
    image: '/images/health-plan-ultimate.png',
    prompt: [
      'You are the local Health helper on this phone. Draft a personalized Health app for me.',
      'Do not diagnose. Do not send anything. Do not mint credit. Do not rank me.',
      'Ultimate version. A full program.',
      'Intake goals.',
      'A phased 12-week plan.',
      'Trainer review points.',
      'Progress notes I can attach to a verified sponsor report, as hashes only.',
      'Places I can ask the local AI for help.',
      'No streaks, no leaderboard, and no ranking.',
      'The draft stays on this phone until I confirm it.'
    ].join('\n')
  }
});

export const FALLBACK_LABEL = 'Deterministic draft. The on-device model was not running.';

export function draftPlan(id, note = '') {
  const plan = HEALTH_PLANS[id];
  if (!plan) return { ok: false, error: 'Choose Easy, Engaging, or Ultimate.' };
  const focus = String(note || '').trim() || 'a steadier week';
  const lines = {
    easy: [
      `Easy Health for ${focus}.`,
      '1. A short walk.',
      '2. Water with one meal.',
      '3. One stretch before bed.',
      'Gentle reminder: one evening line on this phone. It does not count a streak.'
    ],
    engaging: [
      `Engaging Health for ${focus}.`,
      'This week: three different sessions, not the same one repeated.',
      'Buddy check-in with a sponsor or a trainer, once this week.',
      'A goal you can finish by Sunday.',
      'No streak, no leaderboard, and no ranking.'
    ],
    ultimate: [
      `Ultimate Health for ${focus}.`,
      'Intake goals stay on this phone.',
      'Weeks 1–4: build the three habits. Weeks 5–8: vary the sessions. Weeks 9–12: review with a trainer.',
      'Progress notes can be hashed for a verified sponsor report. The notes stay on this phone.',
      'Ask the local AI for a draft. It only drafts and reminds.',
      'No streak, no leaderboard, and no ranking.'
    ]
  };
  return { ok: true, id, title: plan.title, prompt: plan.prompt, label: FALLBACK_LABEL, lines: lines[id], confirmed: false };
}

export const PLAN_KEY = 'lgme.health.plan';

export function saveConfirmedPlan(storage, draft) {
  const row = { id: draft.id, title: draft.title, lines: draft.lines, note: draft.note || '', confirmed: true, at: new Date().toISOString() };
  storage.setItem(PLAN_KEY, JSON.stringify(row));
  return row;
}
