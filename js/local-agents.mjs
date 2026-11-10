export const AGENT_KEY = 'lgme.localAgents';
export const PERMISSION_KEY = 'lgme.agentPermissionAsked';
export const MAX_AGENTS = 10;

export const STARTERS = Object.freeze([
  'Help me set a goal: 3 sessions a week for the next 4 weeks, and check in with me each Sunday.',
  'Remind me at 6:30 AM on Mon/Wed/Fri to start a workout, with one Sober Poverty maxim as my intent.',
  'Notify me when someone in my group shares an update or asks me to verify a session.',
  'Each evening, summarize my progress in plain words and suggest one small next step.',
  'When I finish a workout, draft a short thank-you to my verifier for me to review.',
  'Watch the exchange for IhavIT offers matching what I want, and tell me (never accept for me).'
]);

const ACTIONS = new Set(['reminder', 'notification', 'summary', 'draft']);

function idFor(now, text) {
  return `agent-${now}-${text.length}`;
}

export function parseAgent(text, now = Date.now()) {
  const goal = String(text || '').trim().slice(0, 400);
  if (!goal) return { ok: false, error: 'Write what the helper should do.' };
  let action = 'reminder';
  let trigger = { kind: 'time', at: now + 24 * 60 * 60 * 1000 };
  let name = 'Helper';
  const minutes = goal.match(/\bin\s+(\d+)\s+minute/i);
  const clock = goal.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (/\bdraft\b/i.test(goal) || /thank-you/i.test(goal)) action = 'draft';
  else if (/\bsummar/i.test(goal)) action = 'summary';
  else if (/\bnotify\b/i.test(goal) || /\btell me\b/i.test(goal) || /\bwatch\b/i.test(goal)) action = 'notification';
  else if (/\bremind\b/i.test(goal) || /\bcheck in\b/i.test(goal)) action = 'reminder';
  if (!ACTIONS.has(action)) return { ok: false, error: 'A helper can only remind, notify, summarize, or draft.' };
  if (minutes) {
    name = 'Reminder';
    trigger = { kind: 'time', at: now + Number(minutes[1]) * 60 * 1000 };
  } else if (/finish a workout/i.test(goal)) {
    name = 'Thank-you draft';
    action = 'draft';
    trigger = { kind: 'event', name: 'workout-finish' };
  } else if (/group shares|verify a session/i.test(goal)) {
    name = 'Group updates';
    action = 'notification';
    trigger = { kind: 'event', name: 'group-update' };
  } else if (/IhavIT|never accept/i.test(goal)) {
    name = 'Offer watch';
    action = 'notification';
    trigger = { kind: 'event', name: 'matching-offer' };
  } else if (/evening/i.test(goal)) {
    name = 'Evening summary';
    action = 'summary';
    trigger = { kind: 'weekly', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], time: '18:00' };
  } else if (/Sunday/i.test(goal)) {
    name = 'Weekly goal';
    trigger = { kind: 'weekly', days: ['Sun'], time: '18:00' };
  } else if (clock) {
    name = 'Workout reminder';
    let hour = Number(clock[1]);
    const minute = clock[2];
    const ampm = (clock[3] || '').toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter((day) => new RegExp(day, 'i').test(goal));
    trigger = { kind: 'weekly', days: days.length ? days : ['Mon', 'Wed', 'Fri'], time: `${String(hour).padStart(2, '0')}:${minute}` };
  }
  return {
    ok: true,
    agent: {
      id: idFor(now, goal),
      name,
      goal,
      action,
      trigger,
      paused: false,
      done: false,
      accepts: false,
      sends: false
    }
  };
}

export function needsPermission(agent) {
  return agent?.action === 'reminder' || agent?.action === 'notification';
}

export function listAgents(storage) {
  try {
    const rows = JSON.parse(storage.getItem(AGENT_KEY) || '[]');
    return Array.isArray(rows) ? rows.slice(0, MAX_AGENTS) : [];
  } catch {
    return [];
  }
}

function write(storage, rows) {
  storage.setItem(AGENT_KEY, JSON.stringify(rows.slice(0, MAX_AGENTS)));
}

export function saveAgent(storage, text, now = Date.now()) {
  const parsed = parseAgent(text, now);
  if (!parsed.ok) return parsed;
  const rows = listAgents(storage);
  if (rows.length >= MAX_AGENTS) return { ok: false, error: 'You can keep up to 10 helpers.' };
  rows.push(parsed.agent);
  write(storage, rows);
  return { ok: true, agent: parsed.agent, rows };
}

export function pauseAgent(storage, id) {
  const rows = listAgents(storage).map((agent) => agent.id === id ? { ...agent, paused: !agent.paused } : agent);
  write(storage, rows);
  return rows.find((agent) => agent.id === id) || null;
}

export function deleteAgent(storage, id) {
  const rows = listAgents(storage).filter((agent) => agent.id !== id);
  write(storage, rows);
  return rows;
}

export function editAgent(storage, id, text, now = Date.now()) {
  const parsed = parseAgent(text, now);
  if (!parsed.ok) return parsed;
  const rows = listAgents(storage).map((agent) => agent.id === id ? { ...parsed.agent, id } : agent);
  write(storage, rows);
  return { ok: true, rows };
}

export function dueAgents(agents, now = Date.now()) {
  return (agents || []).filter((agent) => {
    if (agent.paused || agent.done) return false;
    return agent.trigger?.kind === 'time' && Number(agent.trigger.at) <= now;
  });
}

export function markFired(storage, id) {
  const rows = listAgents(storage).map((agent) => agent.id === id ? { ...agent, done: agent.trigger?.kind === 'time', lastFired: Date.now() } : agent);
  write(storage, rows);
  return rows;
}

export function agentNotice(agent) {
  if (agent.action === 'draft') return `Draft only. Not sent. ${agent.goal}`;
  if (agent.action === 'summary') return `Summary: ${agent.goal}`;
  if (agent.action === 'notification') return `Update: ${agent.goal} Nothing was accepted or sent.`;
  return `Reminder: ${agent.goal}`;
}

export function scheduleNote(scope = globalThis) {
  if (typeof scope.TimestampTrigger === 'function') {
    return 'This phone can show the reminder at the time. If that is unavailable, it appears the next time you open the app.';
  }
  return 'While this page is open, the reminder appears at its time. If you leave, it appears the next time you open the app.';
}
