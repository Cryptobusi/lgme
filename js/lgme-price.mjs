export const MINT = '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump';
export const QUOTE_MS = 15000;
export const SAMPLE_MS = 1000;
export const AVERAGE_COUNT = 3;
export const PAY_LOCK_MS = 60000;
export const PEG_TOLERANCE = 0.02;
export const PRICE_UNAVAILABLE = 'price unavailable, try again';
export const PRICE_UNSETTLED = 'price unsettled, try again shortly';
export const SMALL_USD = 20;
export const FIVE_MIN_MS = 5 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
export const SOURCE_GAP = 0.05;
export const MOVE_GAP = 0.10;
export const PRICE_TIMEOUT_MS = 8000;
export const DEFAULT_CLAMP_BAND = 0.05;
export const PEG_LABEL = 'Pegged to US$ at time of transaction. $lgme is not a stablecoin.';
export const PEG_NOTE = 'Pegged to US$. The price used never moves more than 5% from recent reference prices, for stable value.';
export const HISTORY_UNAVAILABLE = 'history unavailable';
export const NO_COIN = 'No $lgme price is available. Coin settlement is closed. Pay in terms or barter. Both parties consent.';
export const ALT_CHOICES = Object.freeze(['terms', 'barter']);

const GECKO_ORIGIN = 'https://api.geckoterminal.com';
const DEX_ORIGIN = 'https://api.dexscreener.com';

export function round6(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

export function roundPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round((n + Number.EPSILON) * 1e12) / 1e12;
}

export function clampBand(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_CLAMP_BAND;
  if (n > 1) return n / 100;
  return n;
}

export function clampMove(previous, raw, band = DEFAULT_CLAMP_BAND) {
  const prev = Number(previous);
  const next = Number(raw);
  const width = clampBand(band);
  if (!(prev > 0) || !(next > 0) || width >= 1) return { ok: false, error: 'The price band is not usable.' };
  const upper = prev * (1 + width);
  const lower = prev * (1 - width);
  const slack = prev * 1e-12;
  let price = next;
  let clamped = false;
  if (next > upper + slack) {
    price = upper;
    clamped = true;
  } else if (next < lower - slack) {
    price = lower;
    clamped = true;
  }
  return {
    ok: true,
    price: roundPrice(price),
    raw: roundPrice(next),
    previous: roundPrice(prev),
    clamped,
    band: width
  };
}

const DAY_MS = 86400000;

function asMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return n < 1e12 ? n * 1000 : n;
}

function normalizeCandles(candles) {
  return (Array.isArray(candles) ? candles : []).map((row) => ({
    t: asMs(row?.t ?? row?.time ?? row?.[0]),
    close: Number(row?.close ?? row?.[4])
  })).filter((row) => row.t > 0 && row.close > 0).sort((a, b) => a.t - b.t);
}

function priceAt(points, target) {
  let best = null;
  for (const point of points) {
    if (point.t <= target && (!best || point.t > best.t)) best = point;
  }
  return best ? best.close : 0;
}

function overBand(next, prev, band) {
  const width = clampBand(band);
  const upper = prev * (1 + width);
  const lower = prev * (1 - width);
  const slack = Math.abs(prev) * 1e-9;
  return next > upper + slack || next < lower - slack;
}

function bandInterval(name, anchor, band) {
  const width = clampBand(band);
  return { name, anchor: roundPrice(anchor), band: width, low: anchor * (1 - width), high: anchor * (1 + width) };
}

function findHold(points, now, raw, band, holdDays) {
  const series = points.slice();
  if (raw > 0) series.push({ t: now, close: raw });
  series.sort((a, b) => a.t - b.t);
  const start = now - holdDays * DAY_MS;
  let active = null;
  for (const point of series) {
    if (point.t < start || point.t > now) continue;
    const prior = priceAt(series, point.t - DAY_MS);
    if (!(prior > 0) || !overBand(point.close, prior, band)) continue;
    active = {
      anchor: prior,
      at: new Date(point.t).toISOString(),
      until: new Date(point.t + holdDays * DAY_MS).toISOString()
    };
  }
  return active;
}

export function applyPegBands({ raw, previous, candles, now, rules = {}, history = true } = {}) {
  const next = Number(raw);
  if (!(next > 0)) return { ok: false, blocked: true, alternatives: [...ALT_CHOICES], error: NO_COIN };
  const band = clampBand(rules.band ?? rules.quoteBand ?? rules.dayBand ?? DEFAULT_CLAMP_BAND);
  const holdDays = Number(rules.holdDays) > 0 ? Number(rules.holdDays) : 7;
  const at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const bands = [];
  const anchors = { quote: null, day: null, week: null, month: null, hold: null };
  if (Number(previous) > 0) {
    bands.push(bandInterval('quote', Number(previous), band));
    anchors.quote = roundPrice(previous);
  }
  const points = normalizeCandles(candles);
  let historyLabel = 'ok';
  if (history === false || !points.length) {
    historyLabel = HISTORY_UNAVAILABLE;
  } else {
    const day = priceAt(points, at - DAY_MS);
    const week = priceAt(points, at - 7 * DAY_MS);
    const month = priceAt(points, at - 30 * DAY_MS);
    const hold = findHold(points, at, next, band, holdDays);
    if (day > 0) {
      bands.push(bandInterval('24h', day, band));
      anchors.day = roundPrice(day);
    }
    if (week > 0) {
      bands.push(bandInterval('7d', week, band));
      anchors.week = roundPrice(week);
    }
    if (month > 0) {
      bands.push(bandInterval('30d', month, band));
      anchors.month = roundPrice(month);
    }
    if (hold) {
      bands.push(bandInterval('hold', hold.anchor, band));
      anchors.hold = roundPrice(hold.anchor);
      anchors.holdAt = hold.at;
      anchors.holdUntil = hold.until;
    }
    if (!(day > 0) && !(week > 0) && !(month > 0) && !hold) historyLabel = HISTORY_UNAVAILABLE;
  }
  if (!bands.length) {
    const price = roundPrice(next);
    return { ok: true, price, raw: price, effectivePrice: price, clamped: false, bounded: [], anchors, history: historyLabel, band };
  }
  let low = -Infinity;
  let high = Infinity;
  for (const item of bands) {
    low = Math.max(low, item.low);
    high = Math.min(high, item.high);
  }
  let chosen = bands;
  if (low > high) {
    const rank = { hold: 0, quote: 1, '24h': 2, '7d': 3, '30d': 4 };
    chosen = [bands.slice().sort((a, b) => (a.high - a.low) - (b.high - b.low) || (rank[a.name] ?? 9) - (rank[b.name] ?? 9))[0]];
    low = chosen[0].low;
    high = chosen[0].high;
  }
  let price = next;
  if (next > high) price = high;
  else if (next < low) price = low;
  const effective = roundPrice(price);
  const bounded = chosen.filter((item) => effective === roundPrice(item.high) || effective === roundPrice(item.low)).map((item) => item.name);
  return {
    ok: true,
    price: effective,
    raw: roundPrice(next),
    effectivePrice: effective,
    clamped: effective !== roundPrice(next),
    bounded,
    anchors,
    history: historyLabel,
    band
  };
}

export function lgmeForUsd(usdAmount, price) {
  const usd = Math.round((Number(usdAmount) + Number.EPSILON) * 100) / 100;
  const px = Number(price);
  if (!(usd > 0) || !(px > 0)) return NaN;
  return round6(usd / px);
}

export function withinLock(lock, atIso) {
  const at = new Date(atIso).getTime();
  const start = new Date(lock?.priceTimestamp || lock?.timestamp || '').getTime();
  if (!Number.isFinite(at) || !Number.isFinite(start)) return false;
  return at >= start && at <= start + QUOTE_MS;
}

export function buildPegQuote({ usdAmount, price, source, timestamp } = {}) {
  const named = String(source || '');
  if (!named || named === 'manual') {
    return { ok: false, blocked: true, alternatives: [...ALT_CHOICES], error: NO_COIN };
  }
  const px = Number(price);
  const lgmeAmount = lgmeForUsd(usdAmount, px);
  const usd = Math.round((Number(usdAmount) + Number.EPSILON) * 100) / 100;
  if (!(px > 0) || !(usd > 0) || !(lgmeAmount > 0)) {
    return { ok: false, blocked: true, alternatives: [...ALT_CHOICES], error: NO_COIN };
  }
  const priceTimestamp = timestamp || new Date().toISOString();
  return {
    ok: true,
    usdAmount: usd,
    lgmeAmount,
    price: roundPrice(px),
    priceSource: named,
    priceTimestamp,
    expiresAt: new Date(new Date(priceTimestamp).getTime() + QUOTE_MS).toISOString(),
    label: PEG_LABEL
  };
}

function bestPositive(rows, read) {
  let best = 0;
  let bestSize = -1;
  for (const row of rows) {
    const picked = read(row);
    if (!picked || !(picked.price > 0) || !(picked.size > 0)) continue;
    if (picked.size > bestSize) {
      best = picked.price;
      bestSize = picked.size;
    }
  }
  return best;
}

export function bestGeckoPool(body) {
  let best = null;
  for (const row of body?.data || []) {
    const attrs = row?.attributes || {};
    const price = Number(attrs.token_price_usd || attrs.base_token_price_usd);
    const size = Number(attrs.reserve_in_usd || 0);
    if (!(price > 0) || !(size > 0)) continue;
    if (!best || size > best.size) best = { price, size, pool: String(attrs.address || '') };
  }
  return best;
}

export function parseGeckoPools(body) {
  return bestGeckoPool(body)?.price || 0;
}

export function parseGeckoOhlcv(body) {
  const list = body?.data?.attributes?.ohlcv_list || [];
  return list.map((row) => {
    const stamp = Number(row?.[0]);
    return { t: stamp > 1e12 ? stamp : stamp * 1000, close: Number(row?.[4]) };
  }).filter((row) => row.t > 0 && row.close > 0);
}

export function withinPeg(paid, quote, tolerance = PEG_TOLERANCE) {
  const got = Number(paid);
  const locked = Number(quote);
  const band = Number(tolerance);
  if (!(got > 0) || !(locked > 0) || !(band >= 0)) return false;
  return Math.abs(got - locked) <= locked * band + locked * 1e-9;
}

export function averagePrice(samples, now = Date.now()) {
  const rows = (samples || [])
    .filter((row) => row && Number(row.price) > 0 && Number.isFinite(Number(row.t)))
    .map((row) => ({ t: Number(row.t), price: Number(row.price), source: String(row.source || '') }))
    .sort((a, b) => a.t - b.t);
  const last = rows.slice(-AVERAGE_COUNT);
  if (last.length < AVERAGE_COUNT) return { ok: false, stale: true, error: PRICE_UNAVAILABLE };
  const newest = last[last.length - 1].t;
  const oldest = last[0].t;
  if (now - newest > SAMPLE_MS * 2) return { ok: false, stale: true, error: PRICE_UNAVAILABLE };
  if (newest - oldest > SAMPLE_MS * (AVERAGE_COUNT + 1)) return { ok: false, stale: true, error: PRICE_UNAVAILABLE };
  const price = roundPrice(last.reduce((sum, row) => sum + row.price, 0) / AVERAGE_COUNT);
  if (!(price > 0)) return { ok: false, stale: true, error: PRICE_UNAVAILABLE };
  return {
    ok: true,
    price,
    source: last[last.length - 1].source,
    timestamp: new Date(newest).toISOString(),
    samples: AVERAGE_COUNT
  };
}

export function lockPayQuote(average, usdAmount = 1, now = Date.now()) {
  if (!average?.ok || !(average.price > 0)) {
    return { ok: false, unsettled: average?.unsettled === true, error: average?.error || PRICE_UNAVAILABLE };
  }
  const usd = Math.round((Number(usdAmount) + Number.EPSILON) * 100) / 100;
  const named = Number(average.lgmeAmount) > 0 && Number(average.usdAmount) === usd ? Number(average.lgmeAmount) : lgmeForUsd(usd, average.price);
  if (!(named > 0) || !(usd > 0)) return { ok: false, error: PRICE_UNAVAILABLE };
  return {
    ok: true,
    locked: true,
    price: average.price,
    source: average.source,
    timestamp: average.timestamp,
    usdAmount: usd,
    lgmeAmount: named,
    rule: average.rule || '',
    plain: average.plain || '',
    lockedAt: now,
    expiresAt: now + PAY_LOCK_MS
  };
}

function pricedRows(samples) {
  return (samples || [])
    .filter((row) => row && Number(row.price) > 0 && Number.isFinite(Number(row.t)))
    .map((row) => ({ t: Number(row.t), price: Number(row.price), source: String(row.source || ''), quotes: row.quotes || [] }))
    .sort((a, b) => a.t - b.t);
}

export function sourceGap(quotes) {
  const prices = (quotes || []).map((row) => Number(row?.price)).filter((price) => price > 0);
  if (prices.length < 2) return { unsettled: false, gap: 0 };
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const gap = (high - low) / low;
  return { unsettled: gap > SOURCE_GAP + 1e-12, gap };
}

export function minuteJump(samples, now = Date.now()) {
  const rows = pricedRows(samples);
  const newest = rows[rows.length - 1];
  if (!newest || now - newest.t > SAMPLE_MS * 2) return { known: false, unsettled: false, gap: 0 };
  const target = now - MINUTE_MS;
  let past = null;
  let distance = Infinity;
  for (const row of rows) {
    const away = Math.abs(row.t - target);
    if (away < distance) {
      past = row;
      distance = away;
    }
  }
  if (!past || distance > 5000) return { known: false, unsettled: false, gap: 0 };
  const gap = Math.abs(newest.price - past.price) / past.price;
  return { known: true, gap, unsettled: gap > MOVE_GAP + 1e-12 };
}

export function fiveMinuteAverage(samples, now = Date.now()) {
  const rows = pricedRows(samples).filter((row) => row.t <= now && now - row.t <= FIVE_MIN_MS);
  if (rows.length < AVERAGE_COUNT) return { ok: false, stale: true, error: PRICE_UNAVAILABLE };
  const newest = rows[rows.length - 1].t;
  const oldest = rows[0].t;
  if (now - newest > SAMPLE_MS * 2) return { ok: false, stale: true, error: PRICE_UNAVAILABLE };
  if (newest - oldest < FIVE_MIN_MS - SAMPLE_MS * 2) return { ok: false, stale: true, error: PRICE_UNAVAILABLE };
  const price = roundPrice(rows.reduce((sum, row) => sum + row.price, 0) / rows.length);
  if (!(price > 0)) return { ok: false, stale: true, error: PRICE_UNAVAILABLE };
  return {
    ok: true,
    price,
    source: rows[rows.length - 1].source,
    timestamp: new Date(newest).toISOString(),
    samples: rows.length
  };
}

function samePrice(left, right) {
  const a = Number(left);
  const b = Number(right);
  if (!(a > 0) || !(b > 0)) return false;
  return Math.abs(a - b) <= a * 1e-9;
}

export function pegQuote({ usd, samples, quotes, now = Date.now() } = {}) {
  const dollars = Math.round((Number(usd) + Number.EPSILON) * 100) / 100;
  if (!(dollars > 0)) return { ok: false, error: PRICE_UNAVAILABLE };
  const board = sourceGap(quotes);
  if (board.unsettled) return { ok: false, unsettled: true, error: PRICE_UNSETTLED };
  const jump = minuteJump(samples, now);
  if (jump.unsettled) return { ok: false, unsettled: true, error: PRICE_UNSETTLED };
  const short = averagePrice(samples, now);
  if (!short.ok) return short;
  if (dollars <= SMALL_USD) {
    return {
      ok: true,
      price: short.price,
      lgmeAmount: lgmeForUsd(dollars, short.price),
      usdAmount: dollars,
      source: short.source,
      timestamp: short.timestamp,
      rule: '3-second average',
      plain: 'Up to $20 uses the 3-second average.'
    };
  }
  const long = fiveMinuteAverage(samples, now);
  if (!long.ok) return long;
  const useShort = short.price <= long.price;
  const picked = useShort ? short : long;
  const plain = samePrice(short.price, long.price)
    ? 'Over $20. The 3-second and 5-minute averages match.'
    : useShort
      ? 'Over $20. The 3-second average asked for more $lgme, so that price was used.'
      : 'Over $20. The 5-minute average asked for more $lgme, so that price was used.';
  return {
    ok: true,
    price: picked.price,
    lgmeAmount: lgmeForUsd(dollars, picked.price),
    usdAmount: dollars,
    source: picked.source,
    timestamp: picked.timestamp,
    rule: useShort ? '3-second average' : '5-minute average',
    plain
  };
}

export function pushSpot(samples, spot, now = Date.now()) {
  if (spot?.ok && Number(spot.price) > 0 && spot.unsettled !== true) {
    samples.push({
      t: now,
      price: Number(spot.price),
      source: String(spot.source || ''),
      quotes: Array.isArray(spot.quotes) ? spot.quotes : []
    });
  }
  const cutoff = now - FIVE_MIN_MS - MINUTE_MS;
  while (samples.length && Number(samples[0]?.t) < cutoff) samples.shift();
  return samples;
}

export function lockOpen(lock, now = Date.now()) {
  return Boolean(lock?.ok && Number.isFinite(Number(lock.expiresAt)) && now <= Number(lock.expiresAt));
}

export function matchesPeg(paid, quotes, tolerance = PEG_TOLERANCE) {
  return (quotes || []).some((quote) => withinPeg(paid, quote, tolerance));
}

export function parsePumpCoin(body) {
  const cap = Number(body?.usd_market_cap);
  if (cap > 0) return cap / 1e9;
  const price = Number(body?.usd_price || body?.price);
  return price > 0 ? price : 0;
}

export function parseJupiterPrice(body, mint) {
  const row = body?.data?.[mint] || body?.[mint];
  const price = Number(row?.usdPrice || row?.price);
  return price > 0 ? price : 0;
}

export function parseBirdeyePrice(body) {
  const price = Number(body?.data?.value ?? body?.data?.price);
  return price > 0 ? price : 0;
}

export function parseDexPairs(body) {
  return bestPositive(body?.pairs || [], (pair) => ({
    price: Number(pair?.priceUsd),
    size: Number(pair?.liquidity?.usd || 0)
  }));
}

function sourceList(mint) {
  return [
    {
      id: 'geckoterminal',
      origin: GECKO_ORIGIN,
      url: `${GECKO_ORIGIN}/api/v2/networks/solana/tokens/${mint}/pools?page=1`,
      parse: parseGeckoPools
    },
    {
      id: 'dexscreener',
      origin: DEX_ORIGIN,
      url: `${DEX_ORIGIN}/latest/dex/tokens/${mint}`,
      parse: parseDexPairs
    }
  ];
}

async function readJson(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response?.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHistory(pool, fetchImpl, timeoutMs) {
  if (!pool) return { ok: false, candles: [], history: HISTORY_UNAVAILABLE };
  for (const frame of ['day', 'hour']) {
    const url = `${GECKO_ORIGIN}/api/v2/networks/solana/pools/${pool}/ohlcv/${frame}?aggregate=1&limit=40&currency=usd&token=base`;
    const body = await readJson(fetchImpl, url, timeoutMs);
    const candles = body ? parseGeckoOhlcv(body) : [];
    if (candles.length) return { ok: true, candles, source: `geckoterminal-${frame}`, history: 'ok' };
  }
  return { ok: false, candles: [], history: HISTORY_UNAVAILABLE, source: '' };
}

export async function fetchLgmePrice({ fetchImpl = globalThis.fetch, timeoutMs = PRICE_TIMEOUT_MS, now = () => new Date().toISOString(), mint = MINT } = {}) {
  let hit = null;
  let pool = '';
  for (const source of sourceList(mint)) {
    const body = await readJson(fetchImpl, source.url, timeoutMs);
    if (!body) continue;
    if (source.id === 'geckoterminal') {
      const best = bestGeckoPool(body);
      if (best?.pool) pool = best.pool;
      if (best?.price > 0 && !hit) hit = { price: best.price, source: source.id };
    } else if (!hit) {
      const price = source.parse(body);
      if (price > 0) hit = { price, source: source.id };
    }
    if (hit && (pool || source.id === 'dexscreener')) break;
  }
  if (!hit) return { ok: false, blocked: true, alternatives: [...ALT_CHOICES], error: NO_COIN };
  const history = await fetchHistory(pool, fetchImpl, timeoutMs);
  return {
    ok: true,
    price: hit.price,
    source: hit.source,
    timestamp: now(),
    mint,
    pool,
    candles: history.candles,
    history: history.history,
    historySource: history.source || ''
  };
}

function spotSources(mint) {
  return [
    { id: 'pump', url: `https://frontend-api-v3.pump.fun/coins/${mint}`, parse: parsePumpCoin },
    { id: 'dexscreener', url: `https://api.dexscreener.com/latest/dex/tokens/${mint}`, parse: parseDexPairs },
    { id: 'jupiter', url: `https://lite-api.jup.ag/price/v3?ids=${mint}`, parse: (body) => parseJupiterPrice(body, mint) },
    { id: 'birdeye', url: `https://public-api.birdeye.so/defi/price?address=${mint}`, parse: parseBirdeyePrice },
    { id: 'geckoterminal', url: `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`, parse: parseGeckoPools }
  ];
}

export async function fetchSpotPrice({ fetchImpl = globalThis.fetch, timeoutMs = 2500, mint = MINT, now = () => new Date().toISOString() } = {}) {
  for (const source of spotSources(mint)) {
    const body = await readJson(fetchImpl, source.url, timeoutMs);
    const price = body ? source.parse(body) : 0;
    if (price > 0) return { ok: true, price, source: source.id, timestamp: now(), mint };
  }
  return { ok: false, stale: true, error: PRICE_UNAVAILABLE };
}

export async function fetchSpotBoard({ fetchImpl = globalThis.fetch, timeoutMs = 2500, mint = MINT, now = () => new Date().toISOString() } = {}) {
  const found = await Promise.all(spotSources(mint).map(async (source) => {
    const body = await readJson(fetchImpl, source.url, timeoutMs);
    const price = body ? source.parse(body) : 0;
    return price > 0 ? { source: source.id, price } : null;
  }));
  const quotes = found.filter(Boolean);
  if (!quotes.length) return { ok: false, stale: true, error: PRICE_UNAVAILABLE, quotes: [] };
  const gap = sourceGap(quotes);
  if (gap.unsettled) return { ok: false, unsettled: true, error: PRICE_UNSETTLED, quotes, timestamp: now(), mint };
  const ordered = [...quotes].sort((a, b) => a.price - b.price);
  const mid = ordered[Math.floor(ordered.length / 2)];
  return { ok: true, price: mid.price, source: mid.source, quotes, timestamp: now(), mint };
}
