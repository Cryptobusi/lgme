export const DEED_POST_TYPES = Object.freeze(['IwantIT', 'IhavIT', 'IselIT', 'soBeIT']);
export const DEED_CATEGORIES = Object.freeze(['tutoring', 'repair', 'cleanup', 'gear', 'health-fitness']);
export const RECEIPT_NAME = 'IdidIt (verified receipt)';
export const DEFAULT_SUBFLOOR_RULES = Object.freeze({
  skimRate: 0.01,
  deedCapShare: 0.5,
  dailyCapLgme: 20,
  zeroSplit: Object.freeze({ subfloor: 0.5, floor: 0.5 }),
  categories: DEED_CATEGORIES,
  postTypes: DEED_POST_TYPES
});

const POOL_TYPES = new Set([
  'SUBFLOOR_SKIM',
  'SUBFLOOR_DONATION',
  'SUBFLOOR_PAYOUT',
  'SUBFLOOR_HOLD',
  'SUBFLOOR_RELEASE',
  'ZERO_PRICE_SPLIT',
  'DEED_POST',
  'DEED_ATTESTED',
  'THIRD_SEAT_VETO',
  'WISDOM_SUPPORT',
  'COMMONS_WITHHOLD'
]);

export function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lockDeedUnit(spec = {}) {
  const price = Number(spec.priceUsdPerLgme);
  const valueUsd = round2(spec.valueUsd);
  if (!(price > 0)) return { ok: false, error: 'A deed unit needs the $lgme price at commitment.' };
  if (!(valueUsd > 0)) return { ok: false, error: 'A deed unit needs a US$ value at commitment.' };
  return {
    ok: true,
    unit: 'deed-credit',
    lockedAt: spec.at || '',
    priceUsdPerLgme: price,
    valueUsd,
    valueLgme: round2(valueUsd / price),
    fixed: true
  };
}

export function floatedUnit(unit, laterPrice) {
  const price = Number(laterPrice);
  return {
    lockedUsd: unit.valueUsd,
    lockedLgme: unit.valueLgme,
    floatedLgme: price > 0 ? round2(unit.valueUsd / price) : null
  };
}

function blank(category) {
  return {
    category,
    balance: 0,
    holds: 0,
    available: 0,
    requests: 0,
    completed: 0,
    donations: 0,
    skims: 0,
    payouts: 0
  };
}

export function poolEntries(peers) {
  const seen = new Set();
  const rows = [];
  for (const peer of peers || []) {
    for (const entry of peer?.tape || []) {
      if (!POOL_TYPES.has(entry.type)) continue;
      const id = entry.payload?.entryId || entry.hash;
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(entry);
    }
  }
  return rows;
}

export function projectSubfloors(peers) {
  const cats = {};
  const ensure = (name) => cats[name] || (cats[name] = blank(name));
  const rows = poolEntries(peers);
  const vetoed = new Set(rows.filter((entry) => entry.type === 'THIRD_SEAT_VETO' && entry.payload?.postId).map((entry) => entry.payload.postId));
  const holds = new Map();
  let floorReserve = 0;
  let appFund = 0;
  for (const entry of rows) {
    const payload = entry.payload || {};
    if (entry.type === 'THIRD_SEAT_VETO') continue;
    if (entry.type === 'WISDOM_SUPPORT' || entry.type === 'COMMONS_WITHHOLD') {
      if (payload.unit === '$lgme') {
        floorReserve = round2(floorReserve + round2(payload.floorShare || 0));
        appFund = round2(appFund + round2(payload.appShare || 0));
      }
      continue;
    }
    const cat = ensure(payload.category || 'tutoring');
    const amount = round2(payload.amount || 0);
    if (entry.type === 'SUBFLOOR_SKIM') {
      cat.balance = round2(cat.balance + amount);
      cat.skims = round2(cat.skims + amount);
    } else if (entry.type === 'SUBFLOOR_DONATION') {
      cat.balance = round2(cat.balance + amount);
      cat.donations = round2(cat.donations + amount);
    } else if (entry.type === 'ZERO_PRICE_SPLIT') {
      cat.balance = round2(cat.balance + round2(payload.subfloor || 0));
      floorReserve = round2(floorReserve + round2(payload.floor || 0));
    } else if (entry.type === 'SUBFLOOR_HOLD') {
      holds.set(payload.holdId, { category: cat.category, amount, open: true });
    } else if (entry.type === 'SUBFLOOR_RELEASE' || entry.type === 'SUBFLOOR_PAYOUT') {
      const held = holds.get(payload.holdId);
      if (held) held.open = false;
      if (entry.type === 'SUBFLOOR_PAYOUT') {
        cat.balance = round2(cat.balance - amount);
        cat.payouts = round2(cat.payouts + amount);
      }
    } else if (entry.type === 'DEED_POST' && payload.postType === 'IwantIT' && !vetoed.has(payload.postId)) {
      cat.requests += 1;
    } else if (entry.type === 'DEED_ATTESTED') {
      cat.completed += 1;
      if (payload.postType === 'IwantIT') cat.requests = Math.max(0, cat.requests - 1);
    }
  }
  let openHolds = 0;
  for (const held of holds.values()) {
    if (!held.open) continue;
    const cat = ensure(held.category);
    cat.holds = round2(cat.holds + held.amount);
    openHolds = round2(openHolds + held.amount);
  }
  for (const cat of Object.values(cats)) cat.available = round2(cat.balance - cat.holds);
  return { categories: cats, floorReserve, appFund, openHolds };
}

export function demandScore(row) {
  return (row?.requests || 0) + (row?.completed || 0);
}

export function rankCategories(snapshot) {
  return Object.values(snapshot?.categories || {}).sort((a, b) => {
    const diff = demandScore(b) - demandScore(a);
    if (diff) return diff;
    return a.balance - b.balance;
  });
}

export function firstClaimCategory(snapshot, fallback = 'tutoring') {
  const ranked = rankCategories(snapshot);
  return ranked[0]?.category || fallback;
}

export function paidAndHeldToday(peers, personId, day) {
  let paid = 0;
  let held = 0;
  const seen = new Set();
  for (const peer of peers || []) {
    for (const entry of peer?.tape || []) {
      const payload = entry.payload || {};
      const id = payload.entryId || entry.hash;
      if (seen.has(id)) continue;
      if (String(entry.at || '').slice(0, 10) !== day) continue;
      if (payload.toId !== personId && payload.providerId !== personId) continue;
      seen.add(id);
      const amount = round2(payload.amount || 0);
      if (entry.type === 'SUBFLOOR_HOLD') held = round2(held + amount);
      if (entry.type === 'SUBFLOOR_RELEASE') held = round2(held - amount);
      if (entry.type === 'SUBFLOOR_PAYOUT') {
        paid = round2(paid + amount);
        held = round2(held - amount);
      }
    }
  }
  return { paid, held: round2(Math.max(0, held)) };
}

export function planDeedPost(spec, pool, rules = DEFAULT_SUBFLOOR_RULES) {
  const skimRate = Number(rules.skimRate ?? DEFAULT_SUBFLOOR_RULES.skimRate);
  const share = Number(rules.deedCapShare ?? DEFAULT_SUBFLOOR_RULES.deedCapShare);
  const dailyCap = Number(rules.dailyCapLgme ?? DEFAULT_SUBFLOOR_RULES.dailyCapLgme);
  const listUsd = round2(spec.listUsd ?? spec.valueUsd);
  const priceUsd = spec.priceUsd == null || spec.priceUsd === '' ? listUsd : round2(spec.priceUsd);
  if (priceUsd === 0) {
    const unit = lockDeedUnit({ priceUsdPerLgme: spec.priceUsdPerLgme, valueUsd: spec.unitValueUsd, at: spec.at });
    if (!unit.ok) return unit;
    return {
      ok: true,
      postType: 'soBeIT',
      donationRequest: true,
      discountPaused: false,
      unit,
      askLgme: unit.valueLgme,
      askUsd: unit.valueUsd,
      payLgme: 0,
      providerLgme: 0,
      skimLgme: 0,
      coverLgme: 0
    };
  }
  if (!DEED_POST_TYPES.includes(spec.postType)) return { ok: false, error: 'Choose IwantIT, IhavIT, IselIT, or soBeIT.' };
  if (!DEED_CATEGORIES.includes(spec.category)) return { ok: false, error: 'Choose tutoring, repair, cleanup, gear, or health and fitness.' };
  const unit = lockDeedUnit({ priceUsdPerLgme: spec.priceUsdPerLgme, valueUsd: listUsd, at: spec.at });
  if (!unit.ok) return unit;
  if (spec.postType === 'soBeIT') {
    return {
      ok: true,
      postType: 'soBeIT',
      donationRequest: false,
      directDonation: true,
      discountPaused: false,
      unit,
      payLgme: unit.valueLgme,
      providerLgme: 0,
      skimLgme: 0,
      coverLgme: 0
    };
  }
  let discountUsd = 0;
  if (spec.postType === 'IselIT') {
    if (spec.proBono) discountUsd = listUsd;
    else if (spec.discountUsd != null && spec.discountUsd !== '') discountUsd = round2(spec.discountUsd);
  }
  const gapLgme = discountUsd > 0 ? round2(discountUsd / Number(spec.priceUsdPerLgme)) : 0;
  const available = round2(pool?.available ?? 0);
  const dailyLeft = round2(dailyCap - round2(spec.paidToday || 0) - round2(spec.heldToday || 0));
  let cover = 0;
  let paused = false;
  if (gapLgme > 0) {
    if (available <= 0 || dailyLeft <= 0) paused = true;
    else {
      cover = round2(Math.min(gapLgme, round2(available * share), dailyLeft));
      if (!(cover > 0)) paused = true;
    }
  }
  const payLgme = paused ? unit.valueLgme : round2(unit.valueLgme - cover);
  const skimLgme = round2(payLgme * skimRate);
  return {
    ok: true,
    postType: spec.postType,
    donationRequest: false,
    directDonation: false,
    discountPaused: paused,
    unit,
    payLgme,
    providerLgme: round2(payLgme - skimLgme),
    skimLgme,
    coverLgme: paused ? 0 : cover
  };
}

export function splitZeroProceeds(amount, rules = DEFAULT_SUBFLOOR_RULES) {
  const figure = round2(amount);
  const subfloor = round2(figure * (rules.zeroSplit?.subfloor ?? 0.5));
  return { subfloor, floor: round2(figure - subfloor) };
}
