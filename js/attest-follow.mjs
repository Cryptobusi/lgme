import { badgeText } from './new-marks.mjs';

const DAY = 24 * 60 * 60 * 1000;

export function suggestAttesters({ category = 'Health', trainer = '', members = [] } = {}) {
  const same = members.filter((member) => member && member.optedIn === true && member.category === category && !member.exact);
  const people = [];
  if (trainer) people.push({ id: 'trainer', name: trainer, role: 'trainer' });
  for (const member of same) {
    people.push({ id: member.id, name: member.name, role: 'nearby', area: member.area || 'nearby' });
  }
  return people;
}

export function draftFollowUp(attester, subject) {
  return {
    to: attester?.id || '',
    name: attester?.name || '',
    subject: String(subject || 'Please attest this'),
    sent: false
  };
}

export function sendDraft(draft, confirm) {
  if (confirm !== true) return { ...draft, sent: false };
  return { ...draft, sent: true, sentAt: Date.now() };
}

export function stopReminders(items) {
  return (items || []).map((item) => ({ ...item, stopped: true }));
}

export function reminderState(item, now) {
  if (item?.stopped) return { status: 'pending', remind: false };
  const created = Number.isFinite(Number(item?.created)) ? Number(item.created) : now;
  const age = now - created;
  if (age >= 30 * DAY) return { status: 'expired, not attested', remind: false };
  const last = Number(item?.lastRemind || 0);
  const due = !last || now - last >= DAY;
  return { status: 'pending', remind: due, day: Math.floor(age / DAY) + 1 };
}

export function markReminded(item, now) {
  return { ...item, lastRemind: now, status: reminderState({ ...item, lastRemind: now }, now).status };
}

export function attestBadges(items, now) {
  const counts = { needed: 0, waiting: 0, reminders: 0, attested: 0 };
  for (const item of items || []) {
    const state = reminderState(item, now);
    if (item.attested) counts.attested += 1;
    else if (state.status === 'expired, not attested') counts.needed += 1;
    else counts.waiting += 1;
    if (!item.attested && state.remind) counts.reminders += 1;
  }
  return {
    'Attestation needed': badgeText(counts.needed),
    'Waiting on others': badgeText(counts.waiting),
    'Reminders today': badgeText(counts.reminders),
    Attested: badgeText(counts.attested)
  };
}
