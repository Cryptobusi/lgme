import { AUTHOR_STATUS, EXAMPLE_STATUS, UNCLAIMED } from './exchange-listing.mjs';
import { sha256Hex, canonicalDevice } from './device-sign.mjs';
import { recommendRate, confirmServiceCredit } from './exercise-arbiter.mjs';
import { addAttestation, evaluateHold } from './high-value.mjs';
import { signDevice } from './device-sign.mjs';

export const TEST_AUTHORS = Object.freeze([
  { id: 'author-mina-vale', handle: 'mina-vale', name: 'Mina Vale', groups: ['campus', 'mental'] },
  { id: 'author-otto-park', handle: 'otto-park', name: 'Otto Park', groups: ['neighbor', 'hosts'] },
  { id: 'author-lila-brook', handle: 'lila-brook', name: 'Lila Brook', groups: ['circles', 'stories'] },
  { id: 'author-nico-fern', handle: 'nico-fern', name: 'Nico Fern', groups: ['mental', 'campus'] },
  { id: 'author-sage-holm', handle: 'sage-holm', name: 'Sage Holm', groups: ['hosts', 'neighbor'] },
  { id: 'author-remy-cole', handle: 'remy-cole', name: 'Remy Cole', groups: ['stories', 'circles'] }
]);

const ROWS = {
  campus: [
    ['offer', 'Intro graphs hour', 'One hour on slopes and intercepts.', 60, 'Baltimore'],
    ['request', 'Lab report reading', 'A second pair of eyes on a lab writeup.', 45, 'Baltimore'],
    ['offer', 'Spanish conversation', 'One hour of spoken practice.', 60, 'College Park'],
    ['request', 'Statistics office hour', 'Help with one problem set.', 45, 'College Park'],
    ['offer', 'Essay outline', 'A one-hour outline, not a ghostwritten paper.', 60, 'Towson'],
    ['request', 'Library research hour', 'Find three sources together.', 60, 'Towson'],
    ['offer', 'Chemistry stoichiometry', 'One hour of worked examples.', 60, 'Annapolis'],
    ['request', 'Public speaking rehearsal', 'Listen once and give notes.', 30, 'Annapolis'],
    ['offer', 'Coding basics hour', 'Variables and loops, one hour.', 60, 'Rockville'],
    ['request', 'Campus tour buddy', 'Walk a new student through the quad.', 45, 'Rockville']
  ],
  neighbor: [
    ['offer', 'Yard hour', 'One hour of raking or weeding.', 60, 'Baltimore'],
    ['request', 'Grocery carry', 'Help carry bags up one flight.', 30, 'Baltimore'],
    ['offer', 'Snow step clearing', 'Clear the front steps only.', 45, 'Frederick'],
    ['request', 'Tool borrow, rake', 'Borrow a rake for a day.', 15, 'Frederick'],
    ['offer', 'Porch plant watering', 'Water porch plants while a neighbor is away.', 20, 'Annapolis'],
    ['request', 'Furniture shift', 'Two people move a table inside one room.', 45, 'Annapolis'],
    ['offer', 'Bike pump and patch', 'Pump a tire and patch a tube.', 30, 'Rockville'],
    ['request', 'Recipe double-check', 'Cook one familiar meal together.', 60, 'Rockville'],
    ['offer', 'Stoop sweep', 'Sweep a shared stoop.', 20, 'Silver Spring'],
    ['request', 'Package watch', 'Hold a package at the door for an hour.', 60, 'Silver Spring']
  ],
  hosts: [
    ['offer', 'Library meeting room', 'A quiet room for a small circle, one evening.', 90, 'Baltimore'],
    ['request', 'Faith hall hour', 'A church hall for a weeknight circle.', 90, 'Baltimore'],
    ['offer', 'Community center gym', 'The gym floor for a stretch hour.', 60, 'Frederick'],
    ['request', 'Veterans post table', 'A table for six, one afternoon.', 90, 'Frederick'],
    ['offer', 'Senior lounge hour', 'The lounge for a seated stretch.', 60, 'Annapolis'],
    ['request', 'Club basement', 'A basement room with chairs.', 90, 'Annapolis'],
    ['offer', 'Library study alcove', 'Four chairs by the window.', 60, 'Rockville'],
    ['request', 'Park shelter', 'A covered picnic shelter if the city allows it.', 90, 'Rockville'],
    ['offer', 'Community kitchen hour', 'A kitchen for one shared meal.', 90, 'Silver Spring'],
    ['request', 'Faith classroom', 'A classroom after the service.', 60, 'Silver Spring']
  ],
  circles: [
    ['offer', 'Tuesday walk circle', 'Six people, one neighborhood loop.', 40, 'Baltimore'],
    ['request', 'New parent circle', 'A small group that trades babysitting hours.', 60, 'Baltimore'],
    ['offer', 'Repair circle', 'Bring one broken small item.', 60, 'Frederick'],
    ['request', 'Book circle', 'One short essay, discussed together.', 60, 'Frederick'],
    ['offer', 'Stretch circle', 'A gentle floor stretch, no instruction claimed.', 30, 'Annapolis'],
    ['request', 'Language circle', 'Practice one language for an hour.', 60, 'Annapolis'],
    ['offer', 'Garden circle', 'One bed, shared tools.', 60, 'Rockville'],
    ['request', 'Music circle', 'Play together, not a performance.', 60, 'Rockville'],
    ['offer', 'Morning mobility circle', 'A slow indoor walk.', 30, 'Silver Spring'],
    ['request', 'Study circle', 'Quiet work side by side.', 90, 'Silver Spring']
  ],
  stories: [
    ['offer', 'Story of a shared meal', 'A short account of one meal cooked together.', 20, 'Baltimore'],
    ['request', 'Story of a first walk', 'Looking for a neighbor who will write it with you.', 20, 'Baltimore'],
    ['offer', 'Story of a tool returned', 'A rake borrowed and brought back.', 15, 'Frederick'],
    ['request', 'Story of a classroom', 'A tutor and a student both agree to the telling.', 20, 'Frederick'],
    ['offer', 'Story of a snow morning', 'Steps cleared before work.', 15, 'Annapolis'],
    ['request', 'Story of a library room', 'How a circle found a place to sit.', 20, 'Annapolis'],
    ['offer', 'Story of a bike repair', 'A tube patched at the curb.', 15, 'Rockville'],
    ['request', 'Story of a welcome walk', 'A new neighbor shown the block.', 20, 'Rockville'],
    ['offer', 'Story of a stretch hour', 'Six people on a gym floor.', 15, 'Silver Spring'],
    ['request', 'Story of a study night', 'Quiet hours at a shared table.', 20, 'Silver Spring']
  ],
  mental: [
    ['offer', 'Journal hour with a partner', 'Write, then read one line aloud if you want.', 60, 'Baltimore'],
    ['request', 'Quiet sit, twenty minutes', 'Sit together. No advice.', 20, 'Baltimore'],
    ['offer', 'Breathing practice', 'A slow count for twenty minutes.', 20, 'Frederick'],
    ['request', 'Gratitude list partner', 'Three lines each, then stop.', 20, 'Frederick'],
    ['offer', 'Walk and talk, no advice', 'One loop. Listening only.', 40, 'Annapolis'],
    ['request', 'Focus block', 'Twenty-five minutes of one task, then a break.', 30, 'Annapolis'],
    ['offer', 'Evening wind-down', 'Lights low, one stretch, then stop.', 20, 'Rockville'],
    ['request', 'Reading aloud', 'One page, then the other person reads.', 30, 'Rockville'],
    ['offer', 'Worry list, then close it', 'Write worries, fold the page, stop.', 20, 'Silver Spring'],
    ['request', 'Check-in circle of two', 'How was the day, in one sentence.', 15, 'Silver Spring']
  ]
};

export function mockListings() {
  const out = [];
  let n = 0;
  for (const [group, rows] of Object.entries(ROWS)) {
    rows.forEach((row, index) => {
      const author = TEST_AUTHORS[n % TEST_AUTHORS.length];
      n += 1;
      const [side, title, summary, durationMin, place] = row;
      out.push({
        id: `${group}-${String(index + 1).padStart(2, '0')}`,
        title,
        summary,
        durationMin,
        place,
        side,
        group,
        service: group === 'mental' ? 'mental' : group,
        authorHandle: author.handle,
        handle: author.handle,
        status: UNCLAIMED,
        tags: [group, side]
      });
    });
  }
  return out;
}

export function authorPayloads() {
  return TEST_AUTHORS.map((author) => ({
    id: author.id,
    title: author.name,
    summary: `Fictional test author. Groups: ${author.groups.join(', ')}.`,
    durationMin: 15,
    place: 'Baltimore',
    side: 'offer',
    group: author.groups[0],
    service: 'author',
    authorHandle: author.handle,
    handle: 'desk-examples',
    status: AUTHOR_STATUS,
    tags: author.groups.slice(0, 4)
  }));
}

export async function examplePayloads() {
  const tradeHash = await sha256Hex(canonicalDevice({ kind: 'hour-trade', hours: 1, sides: ['tutoring', 'yard'], receipt: 'IdidIt' }));
  const rate = recommendRate({ kind: 'mental', minutes: 30 });
  const confirmed = confirmServiceCredit({ giver: true, receiver: true, amount: rate.author });
  const mentalHash = await sha256Hex(canonicalDevice({ kind: 'mental', minutes: rate.minutes, credit: confirmed.credit, receipt: 'IdidIt' }));
  const at = '2026-11-11T00:20:00.000Z';
  const opened = evaluateHold([], { id: 'example-over-100', fromId: 'payer', toId: 'payee', kind: 'usd', amount: 120, at });
  let record = opened.record;
  const hashes = [];
  for (const handle of ['ada-test', 'bo-test', 'cy-test']) {
    const key = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']).then(async (pair) => ({
      publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
      privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey)
    }));
    const payload = { action: 'attest', entryId: record.id, at };
    const sig = await signDevice(key.privateJwk, payload);
    const added = await addAttestation(record, { handle, publicJwk: key.publicJwk, sig, at });
    record = added.record;
    hashes.push(added.hash);
  }
  const attestHash = await sha256Hex(canonicalDevice({ kind: 'over-100', usd: 120, attestations: hashes, receipt: 'IdidIt' }));
  const common = { durationMin: 60, place: 'Baltimore', side: 'offer', status: EXAMPLE_STATUS, handle: 'desk-examples', service: 'example' };
  return [
    { ...common, id: 'example-hour-trade', group: 'campus', title: 'Tutoring for yard help', summary: 'One hour of tutoring traded for one hour of yard help. IdidIt verified receipt.', tags: ['example', 'trade'], receiptHash: tradeHash, authorHandle: 'mina-vale' },
    { ...common, id: 'example-mental', group: 'mental', title: 'Mental exercise, both confirmed', summary: `Thirty minutes. Suggested credit ${confirmed.credit}. Both confirmed. IdidIt verified receipt.`, tags: ['example', 'mental'], receiptHash: mentalHash, authorHandle: 'nico-fern', durationMin: rate.minutes },
    { ...common, id: 'example-over-100', group: 'campus', title: 'Over 100 dollars, three attestations', summary: 'One hundred twenty dollars. Three device attestations. IdidIt verified receipt.', tags: ['example', 'attest'], receiptHash: attestHash, authorHandle: 'sage-holm' }
  ];
}
