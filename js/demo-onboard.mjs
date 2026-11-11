export const DEMO_KEY = 'lgme.demo.member';
export const POSTS_KEY = 'lgme.demo.posts';
export const SEEN_KEY = 'lgme.demo.seen';

export const CHOICES = Object.freeze([
  'IwantIT',
  'IdidIt (verified receipt)',
  'IwanIT help develop',
  'Offer',
  'Browse',
  'Health'
]);

export const DISCLAIMER = Object.freeze([
  'This is a demo on the test network.',
  'Nothing here has real money value yet.',
  'You confirm every step. The helper only drafts.',
  '$lgme is pegged to US$ when a price is shown.'
]);

export function readDemo(storage) {
  try {
    const saved = JSON.parse(storage.getItem(DEMO_KEY) || 'null');
    return saved?.demo === true ? saved : null;
  } catch {
    return null;
  }
}

export function saveDemo(storage, patch) {
  const next = { demo: true, handle: 'demo', at: new Date().toISOString(), ...readDemo(storage), ...patch, email: undefined };
  storage.setItem(DEMO_KEY, JSON.stringify(next));
  return next;
}

export function draftFor(choice, ctx = {}) {
  const who = ctx.handle || 'you';
  const category = ctx.category || 'Health';
  if (choice === 'IwantIT') {
    return { title: 'I want a hand', note: `${who} needs a hand nearby.`, titleHelp: 'Name what you want.', noteHelp: 'One line is enough.' };
  }
  if (choice === 'IdidIt (verified receipt)') {
    return { title: 'I did the session', note: `${who} finished a session.`, titleHelp: 'Name what you did.', noteHelp: 'The other person still confirms.' };
  }
  if (choice === 'IwanIT help develop') {
    return { title: `I want to help develop ${category}`, note: `I can help build the ${category} category.`, titleHelp: 'This is the request title.', noteHelp: 'Skill and time can wait.' };
  }
  if (choice === 'Offer') {
    return { title: 'I can offer help', note: `${who} can help for an hour.`, titleHelp: 'Name what you offer.', noteHelp: 'Say when you can help.' };
  }
  if (choice === 'Browse') {
    return { title: 'Browse open categories', note: 'Look first. Nothing is posted.', titleHelp: 'What you want to look at.', noteHelp: 'Confirm opens the board.' };
  }
  return { title: 'Start a health session', note: 'A session on this phone. The fee and the covenant wait until you need them.', titleHelp: 'Name the session.', noteHelp: 'Nothing is posted yet.' };
}

export function examplePosts(now = Date.now()) {
  return [
    { id: 'ex-health', category: 'Health', title: 'Walking group example', at: new Date(now - 60_000).toISOString(), example: true },
    { id: 'ex-campus', category: 'Campus', title: 'Tutoring hour example', at: new Date(now - 120_000).toISOString(), example: true },
    { id: 'ex-exchange', category: 'Exchange', title: 'Tool loan example', at: new Date(now - 180_000).toISOString(), example: true }
  ];
}

export function readPosts(storage) {
  try { return JSON.parse(storage.getItem(POSTS_KEY) || '[]'); } catch { return []; }
}

export function savePost(storage, post) {
  const posts = [post, ...readPosts(storage)].slice(0, 40);
  storage.setItem(POSTS_KEY, JSON.stringify(posts));
  return posts;
}

export function readSeen(storage) {
  try { return JSON.parse(storage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
}

export function markSeen(storage, category, at = Date.now()) {
  const seen = readSeen(storage);
  seen[category] = at;
  seen.all = at;
  storage.setItem(SEEN_KEY, JSON.stringify(seen));
  return seen;
}

export function newSince(posts, seen = {}) {
  const floor = Number(seen.all) || 0;
  return posts.filter((post) => Date.parse(post.at) > floor);
}

export function countByCategory(posts) {
  const counts = {};
  for (const post of posts) counts[post.category] = (counts[post.category] || 0) + 1;
  return counts;
}
