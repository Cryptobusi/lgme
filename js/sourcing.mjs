export const PICK_CAP = 3;
export const SOURCE_KEY = 'lgme.exchange.sources';
export const FREQUENCIES = Object.freeze(['off', 'daily', 'weekly']);
export const DC_AREA = Object.freeze(['washington', 'dc', 'chantilly', 'hyattsville', 'clarksburg', 'greenbelt', 'springfield', 'gaithersburg', 'fairfax', 'alexandria', 'dmv']);

export const SOURCE_SITES = Object.freeze([
  { id: 'offerup', name: 'OfferUp', template: 'https://offerup.com/search?q={query}&radius={radius}' },
  { id: 'thumbtack', name: 'Thumbtack', template: 'https://www.thumbtack.com/search?query={query}&near={location}' },
  { id: 'craigslist', name: 'Craigslist', template: 'https://www.craigslist.org/search/sss?query={query}&max_price={price}&search_distance={radius}' },
  { id: 'facebook', name: 'Facebook Marketplace', template: 'https://www.facebook.com/marketplace/search/?query={query}&maxPrice={price}' },
  { id: 'ebay', name: 'eBay', template: 'https://www.ebay.com/sch/i.html?_nkw={query}&_udhi={price}' },
  { id: 'nextdoor', name: 'Nextdoor', template: 'https://nextdoor.com/search/finds/?query={query}' },
  { id: 'yelp', name: 'Yelp', template: 'https://www.yelp.com/search?find_desc={query}&find_loc={location}' },
  { id: 'angi', name: 'Angi', template: 'https://www.angi.com/search?search_terms={query}' },
  { id: 'taskrabbit', name: 'TaskRabbit', template: 'https://www.taskrabbit.com/search?query={query}&location={location}' },
  { id: 'freecycle', name: 'Freecycle/Buy Nothing', template: 'https://www.freecycle.org/search?query={query}' }
]);

export const CATEGORY_SITES = Object.freeze({
  'exercise equipment': ['offerup', 'craigslist', 'facebook', 'ebay', 'nextdoor', 'freecycle'],
  'exercise-equipment repair': ['thumbtack', 'yelp', 'angi', 'taskrabbit', 'craigslist', 'nextdoor'],
  goods: ['offerup', 'craigslist', 'facebook', 'ebay', 'nextdoor', 'freecycle'],
  services: ['thumbtack', 'yelp', 'angi', 'taskrabbit', 'craigslist']
});

const BY_ID = new Map(SOURCE_SITES.map((site) => [site.id, site]));

export function parseMoney(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const figure = Number(match[1]);
  return Number.isFinite(figure) ? figure : null;
}

function enc(value) {
  return encodeURIComponent(String(value ?? '').trim());
}

export function queryText(criteria = {}) {
  return [criteria.keywords, criteria.category].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
}

export function customSite(name, template) {
  const title = String(name || '').trim();
  const href = String(template || '').trim();
  if (!title) return { ok: false, error: 'Name the site.' };
  if (!href.startsWith('https://') || !href.includes('{query}')) {
    return { ok: false, error: 'A custom site needs an https search link with {query}.' };
  }
  return { ok: true, site: { id: `custom:${title.toLowerCase()}`, name: title, template: href, custom: true } };
}

export function siteById(id, customSites = []) {
  return BY_ID.get(id) || customSites.find((site) => site.id === id) || null;
}

export function presetsFor(category) {
  const ids = CATEGORY_SITES[category] || CATEGORY_SITES.goods;
  return ids.map((id) => BY_ID.get(id)).filter(Boolean);
}

export function buildSearchUrl(template, criteria = {}) {
  const href = String(template || '');
  if (!href.startsWith('https://')) return '';
  return href
    .replaceAll('{query}', enc(queryText(criteria)))
    .replaceAll('{location}', enc(criteria.location))
    .replaceAll('{price}', enc(criteria.maxPrice ?? ''))
    .replaceAll('{radius}', enc(criteria.radius ?? ''));
}

export function buildLinks(criteria, siteIds, customSites = []) {
  const links = [];
  for (const id of siteIds || []) {
    const site = siteById(id, customSites);
    if (!site) continue;
    const url = buildSearchUrl(site.template, criteria);
    if (!url || url.startsWith('mailto:') || url.startsWith('sms:')) continue;
    links.push({ id: site.id, name: site.name, url, contacted: false });
  }
  return links;
}

function haystack(item) {
  return [item?.title, item?.category, item?.type, item?.kind, item?.note, item?.service, item?.description, item?.city, item?.location, item?.area]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function placeText(item) {
  return [item?.city, item?.location, item?.area].filter(Boolean).join(' ').toLowerCase();
}

function near(criteria, item) {
  const location = String(criteria.location || '').toLowerCase();
  if (!location) return true;
  const place = placeText(item);
  const tokens = location.split(/[^a-z0-9]+/).filter((token) => token.length > 1);
  if (tokens.some((token) => place.includes(token))) return true;
  const radius = Number(criteria.radius);
  const wantsArea = tokens.some((token) => token === 'dc' || token === 'washington' || token === 'dmv');
  if (Number.isFinite(radius) && radius > 0 && wantsArea) {
    return DC_AREA.some((name) => place.includes(name));
  }
  return false;
}

export function matchCriteria(items, criteria = {}) {
  const words = String(criteria.keywords || '').toLowerCase().split(/\s+/).filter((word) => word.length > 1);
  const category = String(criteria.category || '').toLowerCase();
  const max = parseMoney(criteria.maxPrice);
  return (items || []).filter((item) => {
    const text = haystack(item);
    if (words.length && !words.every((word) => text.includes(word))) return false;
    if (!words.length && category) {
      const folded = category.replace(/-/g, ' ');
      const bits = folded.split(/\s+/).filter((word) => word.length > 2);
      if (bits.length && !bits.some((word) => text.includes(word))) return false;
    }
    if (!near(criteria, item)) return false;
    if (max != null) {
      const price = parseMoney(item?.price);
      if (price != null && price > max) return false;
    }
    return true;
  });
}

export function capPicks(catalog, max = PICK_CAP) {
  const limit = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : PICK_CAP;
  const categories = (catalog?.categories || []).map((row) => ({
    category: row.category,
    request: row.request,
    picks: (row.picks || []).slice(0, limit)
  }));
  return { updated: catalog?.updated || '', categories };
}

export function dueRequests(requests, now = Date.now()) {
  return (requests || []).filter((row) => {
    if (!row || row.frequency === 'off' || !FREQUENCIES.includes(row.frequency)) return false;
    const last = Date.parse(row.lastSeen || 0);
    const span = row.frequency === 'weekly' ? 7 : 1;
    return !Number.isFinite(last) || now - last >= span * 86400000;
  });
}

export async function detectLocalAi(scope = {}) {
  const labels = [];
  let canSuggest = false;
  const model = scope.LanguageModel;
  if (model && typeof model.availability === 'function') {
    try {
      const status = await Promise.race([
        model.availability(),
        new Promise((resolve) => setTimeout(() => resolve('unavailable'), 500))
      ]);
      if (status === 'available' || status === 'readily') {
        labels.push('Chrome built-in language model');
        canSuggest = true;
      } else if (status === 'after-download' || status === 'downloadable') {
        labels.push('Chrome built-in language model, not downloaded');
      }
    } catch { /* the check stays on this device */ }
  }
  if (scope.ai) {
    labels.push('window.ai');
    canSuggest = true;
  }
  if (scope.navigator?.gpu) labels.push('WebGPU');
  const note = canSuggest
    ? 'On-device AI can suggest search terms. Nothing is sent off this device.'
    : 'No on-device AI was found. Preset site lists are used.';
  return { labels, canSuggest, note };
}

function knownFromText(text) {
  const found = String(text || '').toLowerCase();
  return SOURCE_SITES.filter((site) => found.includes(site.name.toLowerCase()) || found.includes(site.id)).map((site) => site.id);
}

export async function suggestSites(criteria, options = {}) {
  const detected = options.detected || await detectLocalAi(options.scope || {});
  const presets = presetsFor(criteria?.category).map((site) => site.id);
  if (!options.optedIn || !detected.canSuggest) {
    return { source: 'presets', siteIds: presets, note: detected.note };
  }
  try {
    const prompt = options.prompt;
    if (typeof prompt !== 'function') return { source: 'presets', siteIds: presets, note: detected.note };
    const answer = await prompt(`Suggest sites and search terms for ${queryText(criteria)}. Reply with site names only.`);
    const picked = knownFromText(answer);
    if (!picked.length) return { source: 'presets', siteIds: presets, note: 'On-device AI did not name a known site. Preset lists are used.' };
    return { source: 'on-device', siteIds: picked, note: 'Suggested on this device. Nothing was sent.' };
  } catch {
    return { source: 'presets', siteIds: presets, note: 'On-device AI did not answer. Preset lists are used.' };
  }
}
