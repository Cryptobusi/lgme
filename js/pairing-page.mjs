import { EXCLUDED_NOTE, HOST_KINDS, NEIGHBOR_DEEDS, addMatchingHour, catalogFor, checkIn, createCircle, createHost, draftStory, hostSteward, joinHost, postDeed, publicCounts, publicStories, publishStory, readBook, verifyDeed, withdrawStory, writeBook } from './pairing.mjs';
import { EXPLAINER, EXPLAINER_TITLE, ROLES, interestRecord } from './community-interest.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { mountSeedBoard } from './seed-board.mjs';

const page = document.body.dataset.page;
const root = document.getElementById('pair');
let book = readBook();
let me = 'member';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'onClick') node.addEventListener('click', value);
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

function save() { writeBook(book); draw(); }

function explainer() {
  return el('article', { class: 'card', id: 'upcoming-communities' }, [
    el('h2', {}, [EXPLAINER_TITLE]),
    el('p', {}, [EXPLAINER]),
    el('p', {}, [el('a', { href: '/disclaimer' }, ['Disclaimer'])])
  ]);
}

function interestForm(kind) {
  const prefix = kind === 'host' ? 'host-interest' : 'dev-interest';
  const title = kind === 'host' ? 'Host a community' : 'Join the developer team';
  const handle = el('input', { id: `${prefix}-handle`, 'data-view-ok': '1', maxlength: '32', placeholder: 'Name or handle' });
  const contact = el('input', { id: `${prefix}-contact`, 'data-view-ok': '1', maxlength: '120', placeholder: 'Email or another contact' });
  const notes = el('textarea', { id: `${prefix}-notes`, 'data-view-ok': '1', maxlength: '280', placeholder: 'Optional notes' });
  const store = el('input', { id: `${prefix}-store`, type: 'checkbox', 'data-view-ok': '1' });
  const share = el('input', { id: `${prefix}-share`, type: 'checkbox', 'data-view-ok': '1' });
  const test = el('input', { id: `${prefix}-test`, type: 'checkbox', 'data-view-ok': '1' });
  const status = el('p', { id: `${prefix}-status`, role: 'status' }, []);
  const roles = ROLES.map(([id, label]) => el('label', { class: 'check' }, [
    el('input', { id: `${prefix}-role-${id}`, type: 'checkbox', 'data-view-ok': '1', value: id }),
    label
  ]));
  return el('article', { class: 'card', id: prefix }, [
    el('h2', {}, [title]),
    el('p', {}, ['Nothing is stored until you check store it. Nothing is shown on the public listing until you also check share it. The contact stays off Hedera.']),
    el('label', {}, ['Name or handle', handle]),
    el('label', {}, ['Contact you choose', contact]),
    el('p', {}, ['Skills or roles']),
    ...roles,
    el('label', {}, ['Notes, optional', notes]),
    el('label', { class: 'check' }, [store, 'Store it on this Exchange book']),
    el('label', { class: 'check' }, [share, 'Share the handle and roles in the public listing']),
    el('label', { class: 'check' }, [test, 'Mark this as a test']),
    el('button', { type: 'button', class: 'primary', id: `${prefix}-send`, 'data-view-ok': '1', onClick: () => sendInterest(kind, prefix, status) }, ['Sign up']),
    status,
    el('p', {}, [el('a', { href: '/disclaimer' }, ['Disclaimer'])])
  ]);
}

async function sendInterest(kind, prefix, status) {
  const roles = ROLES.map(([id]) => document.getElementById(`${prefix}-role-${id}`)).filter((node) => node?.checked).map((node) => node.value);
  const built = await interestRecord({
    kind,
    handle: document.getElementById(`${prefix}-handle`)?.value,
    contact: document.getElementById(`${prefix}-contact`)?.value,
    roles,
    notes: document.getElementById(`${prefix}-notes`)?.value,
    store: document.getElementById(`${prefix}-store`)?.checked === true,
    share: document.getElementById(`${prefix}-share`)?.checked === true,
    test: document.getElementById(`${prefix}-test`)?.checked === true
  });
  if (!built.ok) { status.textContent = built.error; return; }
  const key = await ensureDeviceKey(localStorage);
  const payload = {
    action: 'interest',
    category: 'exchange',
    handle: built.privateRecord.handle,
    kind: built.privateRecord.kind,
    contact: built.privateRecord.contact,
    roles: built.privateRecord.roles,
    notes: built.privateRecord.notes,
    store: true,
    share: built.privateRecord.share,
    test: built.privateRecord.test
  };
  const response = await fetch('/api/hedera/listings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: payload.handle, publicJwk: key.publicJwk, payload, sig: await signDevice(key.privateJwk, payload) })
  });
  const body = await response.json().catch(() => ({}));
  status.textContent = body.ok
    ? `Listed on testnet as ${body.item?.status || 'pending review'}. Message ${body.sequenceNumber || 'queued'}.${body.item?.test ? ' Marked as a test.' : ''} The contact was not written to the topic.`
    : (body.error || 'The sign-up stayed on this phone.');
}

function draw() {
  book = readBook();
  if (page === 'neighbors') drawNeighbors();
  else if (page === 'hosts') drawHosts();
  else if (page === 'circles') drawCircles();
  else drawStories();
  const group = { neighbors: 'neighbor', hosts: 'hosts', circles: 'circles', stories: 'stories' }[page];
  if (group) mountSeedBoard(root, group);
}

function drawNeighbors() {
  const view = el('div', {}, [
    el('p', { class: 'kicker' }, ['Neighbor help']),
    el('h1', {}, ['Everyday mutual help']),
    el('p', { id: 'excluded-note' }, [EXCLUDED_NOTE])
  ]);
  for (const deed of NEIGHBOR_DEEDS) {
    const row = el('article', { class: 'card' }, [el('h2', {}, [deed.label]), el('p', {}, [deed.unit])]);
    row.append(el('button', { type: 'button', class: 'primary', onClick: () => tap(deed.id, 'IhavIT') }, ['IhavIT']));
    row.append(el('button', { type: 'button', onClick: () => tap(deed.id, 'IwantIT') }, ['IwantIT']));
    view.append(row);
  }
  view.append(el('h2', {}, ['On this phone']));
  for (const deed of book.deeds) {
    const line = el('p', {}, [`${deed.side} · ${deed.label} · ${deed.unit}${deed.verified ? ' · verified' : ''}`]);
    if (!deed.verified) line.append(el('button', { type: 'button', onClick: () => { verifyDeed(book, deed.id, 'neighbor'); save(); } }, ['Verify']));
    view.append(line);
  }
  root.replaceChildren(view);
}

function tap(deedId, side) {
  const result = postDeed(book, { deedId, side, by: me });
  if (!result.ok) return;
  save();
}

function drawHosts() {
  const params = new URLSearchParams(location.search);
  const host = book.hosts.find((row) => row.id === params.get('host'));
  if (host) return drawHost(host);
  const name = el('input', { id: 'host-name', maxlength: '60', placeholder: 'Host name' });
  const kind = el('select', { id: 'host-kind' });
  for (const [id, label] of HOST_KINDS) kind.append(el('option', { value: id }, [label]));
  const invite = el('input', { id: 'host-invite', maxlength: '24', placeholder: 'Invite code' });
  const view = el('div', {}, [
    el('p', { class: 'kicker' }, ['Hosts']),
    el('h1', {}, ['Host a circle']),
    explainer(),
    interestForm('developer'),
    interestForm('host'),
    el('label', {}, ['Name', name]),
    el('label', {}, ['Kind', kind]),
    el('button', { type: 'button', class: 'primary', id: 'create-host', onClick: () => {
      const created = createHost(book, { name: name.value, kind: kind.value, by: me, byName: 'You' });
      if (!created.ok) return;
      save();
      location.search = `?host=${created.host.id}`;
    } }, ['Create host']),
    el('label', {}, ['Join with an invite code', invite]),
    el('button', { type: 'button', onClick: () => {
      const joined = joinHost(book, invite.value.trim().toLowerCase(), { id: me, name: 'You' });
      if (!joined.ok) return;
      save();
      location.search = `?host=${joined.host.id}`;
    } }, ['Join'])
  ]);
  for (const row of book.hosts) view.append(el('p', {}, [el('a', { href: `?host=${row.id}` }, [row.name])]));
  root.replaceChildren(view);
}

function drawHost(host) {
  const steward = hostSteward(host);
  const view = el('div', { id: 'host-page' }, [
    el('p', { class: 'kicker' }, ['Host']),
    el('h1', {}, [host.name]),
    el('p', { id: 'host-steward' }, [`Steward: ${host.members.find((row) => row.id === steward)?.name || steward || 'the creator'}`]),
    el('p', {}, [`Invite code ${host.invite}`]),
    el('h2', {}, ['Members']),
    ...host.members.map((member) => el('p', {}, [`${member.name}${member.trainer ? ' · Trainer' : ''}`])),
    el('button', { type: 'button', id: 'host-trainer', onClick: () => {
      const member = host.members.find((row) => row.id === me) || host.members[0];
      member.trainer = !member.trainer;
      member.trainerAt = member.trainerAt || new Date().toISOString();
      save();
    } }, ["I'd like to be a trainer"])
  ]);
  const date = el('input', { id: 'hour-date', type: 'date' });
  const time = el('input', { id: 'hour-time', type: 'time' });
  const place = el('input', { id: 'hour-place', placeholder: 'Place' });
  view.append(el('h2', {}, ['Matching hour']));
  view.append(date, time, place);
  view.append(el('button', { type: 'button', class: 'primary', id: 'add-hour', onClick: () => {
    addMatchingHour(book, host.id, { date: date.value, time: time.value, place: place.value });
    save();
  } }, ['Add matching hour']));
  for (const event of host.events) {
    const card = el('article', { class: 'card', id: 'matching-hour' }, [
      el('p', {}, [`${event.date} ${event.time} · ${event.place}`]),
      el('button', { type: 'button', onClick: () => { event.rsvps = [...new Set([...event.rsvps, me])]; save(); } }, ['RSVP']),
      el('button', { type: 'button', id: 'check-in', onClick: () => { checkIn(event, me); save(); } }, ['Check in'])
    ]);
    if (event.reminders.includes(me)) card.append(el('p', {}, ['Reminder only. No attendance record.']));
    view.append(card);
  }
  view.append(el('h2', {}, ['Deeds this host can list']));
  for (const deed of catalogFor(host)) {
    view.append(el('p', {}, [`${deed.label} · ${deed.unit}`]));
  }
  if (host.kind === 'senior') view.append(el('p', {}, ['Senior living stays with companion calls, meal drops, and escorted walks.']));
  root.replaceChildren(view);
}

function drawCircles() {
  const name = el('input', { id: 'circle-name', maxlength: '60', placeholder: 'Circle name' });
  const privacy = el('select', { id: 'circle-privacy' }, [
    el('option', { value: 'open' }, ['Open interest']),
    el('option', { value: 'high' }, ['High-privacy'])
  ]);
  const condition = el('input', { id: 'circle-condition', maxlength: '40', placeholder: 'Condition label, kept in the group' });
  const view = el('div', {}, [
    el('p', { class: 'kicker' }, ['Circles']),
    el('h1', {}, ['A circle']),
    explainer(),
    interestForm('developer'),
    interestForm('host'),
    el('p', {}, ['Open interest can be named in public counts. High-privacy is never on a public board, and its label never leaves the group.']),
    el('label', {}, ['Name', name]),
    el('label', {}, ['Privacy', privacy]),
    condition,
    el('button', { type: 'button', class: 'primary', id: 'create-circle', onClick: () => {
      const created = createCircle(book, { name: name.value, privacy: privacy.value, condition: condition.value, by: me });
      if (!created.ok) return;
      save();
    } }, ['Create circle'])
  ]);
  for (const circle of book.circles) {
    view.append(el('article', { class: 'card', id: circle.privacy === 'high' ? 'high-privacy' : 'open-circle' }, [
      el('h2', {}, [circle.name]),
      el('p', {}, [circle.privacy === 'high' ? 'High-privacy. The condition label stays in the group. Not anchored.' : 'Open interest.']),
      circle.privacy === 'high' ? el('p', { class: 'muted' }, ['No attendance tracking.']) : null
    ]));
  }
  root.replaceChildren(view);
}

function drawStories() {
  const deed = book.deeds[0];
  const draft = deed ? draftStory(deed) : 'I gave a ride. I received a meal.';
  const text = el('textarea', { id: 'story-text', maxlength: '280' });
  text.value = draft;
  const audience = el('select', { id: 'story-audience' }, [
    el('option', { value: 'circle' }, ['One circle']),
    el('option', { value: 'host' }, ['Host']),
    el('option', { value: 'public' }, ['Public stories page'])
  ]);
  const consent = el('input', { id: 'story-consent', type: 'checkbox' });
  const other = el('input', { id: 'story-other', type: 'checkbox' });
  const view = el('div', {}, [
    el('p', { class: 'kicker' }, ['Stories']),
    el('h1', {}, ['Stories']),
    el('p', {}, ['Not written to Hedera. You can withdraw a story anytime.']),
    el('label', {}, ['Draft', text]),
    el('label', {}, ['Audience', audience]),
    el('label', { class: 'check' }, [consent, 'I consent to this story']),
    el('label', { class: 'check' }, [other, 'The other person also consents to be named']),
    el('button', { type: 'button', class: 'primary', id: 'publish-story', onClick: () => {
      const circle = audience.value === 'circle' ? book.circles.find((row) => row.privacy === 'high') || book.circles[0] : null;
      const result = publishStory(book, { text: text.value, audience: audience.value, circleId: circle?.id || '', consent: consent.checked, otherConsent: other.checked });
      const note = document.getElementById('story-status');
      if (!result.ok) { if (note) note.textContent = result.error; return; }
      save();
    } }, ['Publish'])
  ]);
  view.append(el('p', { id: 'story-status', role: 'status' }, []));
  const counts = publicCounts(book);
  view.append(el('h2', {}, ['Verified deeds']));
  const countHost = el('div', { id: 'public-counts' });
  for (const [label, count] of Object.entries(counts.byCategory)) countHost.append(el('p', {}, [`${label}: ${count}`]));
  if (counts.privateReceipts) countHost.append(el('p', {}, [`Private circles: ${counts.privateReceipts}`]));
  for (const [label, count] of Object.entries(counts.byHost)) countHost.append(el('p', {}, [`${label}: ${count}`]));
  if (!book.deeds.some((row) => row.verified)) countHost.append(el('p', {}, ['No verified deeds yet.']));
  view.append(countHost);
  view.append(el('h2', {}, ['Public stories']));
  for (const story of publicStories(book)) {
    view.append(el('article', { class: 'card' }, [
      el('p', {}, [story.text]),
      el('button', { type: 'button', onClick: () => { withdrawStory(book, story.id); save(); } }, ['Withdraw'])
    ]));
  }
  root.replaceChildren(view);
}

draw();
