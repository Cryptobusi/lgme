import { sha256Hex, canonicalDevice } from './device-sign.mjs';
import { LISTINGS_OPERATOR, LISTINGS_TOPIC } from './exchange-listing.mjs';

export const EXPLAINER_TITLE = 'Upcoming communities';
export const EXPLAINER = 'A circle is the people: a small group of members who trade help and exercise together. A host is the place, such as a church or faith group, a library, a community center, a veterans post, senior living, or a club, that gives them somewhere to meet. One host can hold several circles, and a circle can move from one host to another. These are not open yet. Joining a team or offering a host does not create a ranking and does not move $lgme.';

export const DEVELOPER_STATUS = 'Volunteer - pending review';
export const HOST_STATUS = 'Host interest - pending review';
export const ROLES = Object.freeze([
  ['code', 'Code'],
  ['design', 'Design'],
  ['testing', 'Testing'],
  ['writing', 'Writing'],
  ['outreach', 'Community or host outreach'],
  ['health', 'Health or trainer content'],
  ['other', 'Other']
]);

const HANDLE = /^[a-z0-9-]{1,32}$/;
const ROLE_IDS = new Set(ROLES.map((row) => row[0]));

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function interestRecord(spec = {}) {
  const kind = spec.kind === 'host' ? 'host' : spec.kind === 'developer' ? 'developer' : '';
  if (!kind) return { ok: false, error: 'Choose the developer team or a host.' };
  if (spec.store !== true) return { ok: false, error: 'Check store it before this is saved.' };
  const handle = clean(spec.handle, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  if (!HANDLE.test(handle)) return { ok: false, error: 'Use a short handle: letters, numbers, and dashes.' };
  const contact = clean(spec.contact, 120);
  if (contact.length < 3) return { ok: false, error: 'Add a contact you choose. It stays off the public topic.' };
  const roles = [...new Set((Array.isArray(spec.roles) ? spec.roles : []).map((role) => String(role)))].filter((role) => ROLE_IDS.has(role));
  if (!roles.length) return { ok: false, error: 'Pick at least one role.' };
  const notes = clean(spec.notes, 280);
  const share = spec.share === true;
  const test = spec.test === true;
  const privateRecord = { kind, handle, contact, roles, notes, share, test };
  const hash = await sha256Hex(canonicalDevice(privateRecord));
  const status = kind === 'host' ? HOST_STATUS : DEVELOPER_STATUS;
  const offer = kind === 'host' ? 'Host a community' : 'Developer team';
  const id = `${kind === 'host' ? 'host' : 'dev'}-${hash.slice(0, 12)}`;
  const title = share
    ? clean(`${test ? 'Test · ' : ''}${handle} · ${roles.join(', ')}`, 80)
    : clean(`${test ? 'Test · ' : ''}${status}`, 80);
  const body = {
    v: 1,
    network: 'testnet',
    kind: 'interest',
    id,
    category: 'exchange',
    offer,
    title,
    service: kind === 'host' ? 'host-interest' : 'developer-team',
    status,
    roles: share ? roles : [],
    share,
    test,
    standing: true,
    hash,
    topic: LISTINGS_TOPIC,
    payer: LISTINGS_OPERATOR
  };
  const packed = JSON.stringify(body);
  if (packed.includes(contact) || /@/.test(packed)) return { ok: false, error: 'The public listing cannot carry the contact.' };
  return {
    ok: true,
    sent: false,
    privateRecord: { ...privateRecord, id, hash, at: spec.at || new Date().toISOString() },
    body
  };
}

export function publicInterest(record) {
  if (!record?.body) return null;
  const copy = { ...record.body };
  delete copy.contact;
  delete copy.notes;
  return copy;
}
