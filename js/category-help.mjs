export const HELP_PATH = '/develop';
export const DEV_TEAM_HREF = '/hosts#dev-interest';

export const CATEGORIES = Object.freeze([
  { id: 'health', name: 'Health', href: '/gym', badge: 'Beta' },
  { id: 'campus', name: 'Campus', href: '/campus', badge: 'Early' },
  { id: 'neighbor', name: 'Neighbor help', href: '/neighbors', badge: 'Early' },
  { id: 'hosts', name: 'Hosts', href: '/hosts', badge: 'Early' },
  { id: 'circles', name: 'Circles', href: '/circles', badge: 'Early' },
  { id: 'stories', name: 'Stories', href: '/stories', badge: 'Early' },
  { id: 'exchange', name: 'Exchange', href: '/exchange', badge: 'Early' }
]);

const OPEN = new Set([
  'exchange', 'health', 'campus', 'neighbor', 'neighbors', 'hosts', 'circles', 'stories',
  'goods', 'services', 'household', 'food', 'tools'
]);

export function categoryByName(name) {
  const text = String(name || '').trim().toLowerCase();
  return CATEGORIES.find((item) => item.id === text || item.name.toLowerCase() === text) || null;
}

export function categoryOpen(name) {
  return OPEN.has(String(name || 'exchange').trim().toLowerCase());
}

export function helpPath(name) {
  const item = categoryByName(name);
  const label = item?.name || String(name || '').trim();
  return `${HELP_PATH}?category=${encodeURIComponent(label)}`;
}

export function helpDraft(name) {
  const item = categoryByName(name);
  const label = item?.name || 'Health';
  return {
    kind: 'IwanIT',
    category: label,
    title: `I want to help develop ${label}`,
    body: `I can help build the ${label} category.`,
    skill: '',
    time: ''
  };
}
