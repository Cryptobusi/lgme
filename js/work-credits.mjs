export function emptyBook() {
  return { balances: {}, history: [], pairs: {}, quizzes: {}, quizDays: {} };
}

function gate(spec) {
  if (spec.bot) return { paused: true, error: 'Credit is paused until a person confirms.' };
  if (!spec.signedIn || !spec.deviceVerified) return { paused: false, error: 'Creo is only for a signed-in, device-verified member.' };
  return null;
}

export function toHundredths(amount) {
  return Math.round(Number(amount) * 100);
}

export function formatCredits(hundredths) {
  const n = Number(hundredths) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(n));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function add(book, member, amount, why, when) {
  const next = structuredClone(book);
  next.balances[member] = (next.balances[member] || 0) + amount;
  next.history.push({ member, amount, why, when });
  return next;
}

export function awardAttestation(book, spec, rules) {
  const blocked = gate(spec);
  if (blocked) return { book, entries: [], ...blocked };
  if (!spec.logger || !spec.attester || spec.logger === spec.attester) return { book, entries: [], error: 'You cannot attest your own receipt.' };
  const pair = [spec.logger, spec.attester].sort().join('|');
  const key = `${pair}:${spec.day}`;
  if ((book.pairs[key] || 0) >= rules.pairCapPerDay) return { book, entries: [], error: 'This pair already earned the daily attestation credit.' };
  const units = toHundredths(rules.attestation);
  let next = add(book, spec.logger, units, 'Attested receipt', spec.day);
  next = add(next, spec.attester, units, 'Attested a receipt', spec.day);
  next.pairs[key] = (book.pairs[key] || 0) + 1;
  return { book: next, entries: next.history.slice(-2), paused: false };
}

export function awardVerified(book, spec, rules) {
  const blocked = gate(spec);
  if (blocked) return { book, entry: null, ...blocked };
  const amount = toHundredths(rules[spec.kind]);
  if (!amount || !spec.member) return { book, entry: null, error: 'That verified act has no credit.' };
  const next = add(book, spec.member, amount, spec.kind, spec.day);
  return { book: next, entry: next.history.at(-1), paused: false };
}

export function awardQuiz(book, spec, rules) {
  const blocked = gate(spec);
  if (blocked) return { book, entry: null, ...blocked };
  const topicKey = `${spec.member}:${spec.topic}`;
  if (book.quizzes[topicKey]) return { book, entry: null, error: 'This topic was already credited.' };
  if (!spec.passed) return { book, entry: null, error: 'Answer the questions first.' };
  const dayKey = `${spec.member}:${spec.day}`;
  const lifeKey = spec.member;
  if ((book.quizDays[dayKey] || 0) >= rules.quizDailyCap) return { book, entry: null, error: 'The daily learning cap is reached.' };
  if ((book.quizDays[lifeKey] || 0) >= rules.quizLifetimeCap) return { book, entry: null, error: 'The learning cap is reached.' };
  const next = add(book, spec.member, toHundredths(rules.quiz), `Quiz: ${spec.topic}`, spec.day);
  next.quizzes[topicKey] = true;
  next.quizDays[dayKey] = (book.quizDays[dayKey] || 0) + 1;
  next.quizDays[lifeKey] = (book.quizDays[lifeKey] || 0) + 1;
  return { book: next, entry: next.history.at(-1), paused: false };
}

export function spendCredit(book, member, amount, why, when) {
  if ((book.balances[member] || 0) < amount) return { book, ok: false, error: 'Not enough credits.' };
  const next = add(book, member, -amount, why, when);
  return { book: next, ok: true };
}

export const QUIZZES = Object.freeze({
  'help-start': Object.freeze([
    { q: 'Where does the book stay?', a: 'On this device' },
    { q: 'Is a deed the same as $lgme?', a: 'No' },
    { q: 'Who confirms a deed?', a: 'Two people' }
  ])
});

export function scoreQuiz(topic, answers) {
  const quiz = QUIZZES[topic] || [];
  if (quiz.length < 3 || quiz.length > 5) return false;
  return quiz.every((item, index) => String(answers?.[index] || '').trim().toLowerCase() === item.a.toLowerCase());
}
