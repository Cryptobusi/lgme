import { serviceRate } from './exchange-listing.mjs';

export const SOLO_CONFIDENCE = 0.85;
export const SOLO_DAY_CAP = 1;
export const SOLO_WEEK_CAP = 5;
export const SOLO_LABEL = 'self-attested (AI-checked)';

const DAY_MS = 24 * 60 * 60 * 1000;

export function recommendRate({ kind = 'physical', minutes = 30 } = {}) {
  const type = kind === 'mental' ? 'mental' : 'physical';
  const rate = serviceRate(type === 'mental' ? 'mental' : 'strength', minutes);
  return {
    ok: true,
    kind: type,
    minutes: rate.minutes,
    amount: rate.amount,
    skim: rate.skim,
    author: rate.author,
    text: `Suggested credit ${rate.author} for ${rate.minutes} minutes of ${type} exercise. The 1% portion is ${rate.skim}. This is a suggestion. Both people confirm or change it. Nothing is recorded until then.`
  };
}

export function confirmServiceCredit({ giver = false, receiver = false, amount = 0 } = {}) {
  const figure = Math.round(Number(amount) * 100) / 100;
  if (!(figure > 0)) return { ok: false, error: 'The suggested credit has to be greater than zero.' };
  if (giver !== true || receiver !== true) {
    return { ok: true, credit: 0, pending: true, text: 'Both members still have to confirm. No credit was recorded.' };
  }
  return { ok: true, credit: figure, pending: false, text: `Both confirmed ${figure}. The session credit is recorded.` };
}

export function scoreSolo({ minutes = 0, note = '' } = {}) {
  const longEnough = Number(minutes) >= 15;
  const wrote = String(note || '').trim().length >= 8;
  const confidence = longEnough && wrote ? 0.9 : 0.4;
  return { confidence, label: SOLO_LABEL };
}

export function soloCredit({ confidence = 0, amount = 0, prior = [], now = Date.now(), dayCap = SOLO_DAY_CAP, weekCap = SOLO_WEEK_CAP } = {}) {
  const stamps = (prior || []).map((value) => Number(value)).filter((value) => Number.isFinite(value));
  const today = stamps.filter((value) => now - value < DAY_MS).length;
  const week = stamps.filter((value) => now - value < 7 * DAY_MS).length;
  const suggestion = Math.round(Number(amount) * 100) / 100;
  if (!(Number(confidence) >= SOLO_CONFIDENCE)) {
    return { ok: true, credit: 0, label: SOLO_LABEL, text: 'The confidence is under 0.85, so this solo log earns no credit.' };
  }
  if (today >= dayCap || week >= weekCap) {
    return { ok: true, credit: 0, label: SOLO_LABEL, text: `The solo cap is ${dayCap} a day and ${weekCap} a week. This log earns no credit.` };
  }
  if (!(suggestion > 0)) return { ok: false, error: 'The suggested credit has to be greater than zero.' };
  return {
    ok: true,
    credit: suggestion,
    label: SOLO_LABEL,
    needsTap: true,
    text: `${SOLO_LABEL}. Confidence ${confidence}. Suggested ${suggestion}. Tap to confirm. The cap is ${dayCap} a day and ${weekCap} a week.`
  };
}
