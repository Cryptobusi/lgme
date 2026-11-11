export const HELP_MAIL = 'cryptovanities@gmail.com';
export const HELP_NOTE = 'Coming soon. Help us build this category.';
export const DEV_TEAM_HREF = '/hosts#dev-interest';

const CLOSED = new Set([
  'campus', 'neighbor', 'neighbors', 'hosts', 'host', 'circles', 'circle', 'stories', 'story',
  'goods', 'services', 'household', 'food', 'tools'
]);

export function helpMail(name) {
  const label = String(name || 'this category').replace(/\s+/g, ' ').trim() || 'this category';
  const subject = `Help develop lgme.app: ${label}`;
  const body = `I want to help build the ${label} category on lgme.app.`;
  return `mailto:${HELP_MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function closedTrade(spec = {}) {
  const names = [spec.category, spec.group, spec.service, spec.market, spec.listCategory]
    .map((value) => String(value || '').trim().toLowerCase());
  return names.some((name) => CLOSED.has(name));
}
