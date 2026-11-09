// SPP workflow map. Plain data and view math for /workflow.
// Nodes, edges, and labels follow the approved nine-zone diagram.

export const MAP_W = 3200;
export const MAP_H = 2200;
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 1.6;
export const ZOOM_STEP = 0.2;
export const PAN_STEP = 80;

export const PALETTE = {
  bg: "#0c100c",
  subtle: "#121812",
  elevated: "#182018",
  border: "#2c352b",
  borderStrong: "#4a5a48",
  text: "#f4f1e8",
  secondary: "#c5d0c2",
  tertiary: "#8ea892",
  onColor: "#0c100c",
  success: "#8fd9a8",
  main: "#e2b656",
  check: "#7eb6ff",
  feed: "#6dce8a",
  thin: "#8ea892"
};

const WIDTH = { main: 6, check: 3.5, feed: 3.5, thin: 2 };

export const ZONES = [
  { n: 1, x: 60, y: 80, w: 840, h: 620, t: "Person and onboarding", s: "consent first, on-device by default" },
  { n: 2, x: 980, y: 80, w: 920, h: 620, t: "Big picture: My Picture / Sovereign App", s: "your state at a glance (sample data)" },
  { n: 3, x: 1980, y: 80, w: 1160, h: 620, t: "Activity loop", s: "log, offer, wish, match, do, confirm, record" },
  { n: 4, x: 60, y: 820, w: 1240, h: 620, t: "Three seats: checks and balances", s: "each seat holds one unit and limits the other two" },
  { n: 5, x: 1380, y: 820, w: 720, h: 620, t: "Right of refusal", s: "its power and its practical limits" },
  { n: 9, x: 2180, y: 820, w: 960, h: 620, t: "Public Tape and audit", s: "hashes and counts; private details stay off" },
  { n: 6, x: 60, y: 1560, w: 1040, h: 580, t: "The Floor's defaults and durability", s: "proposed design; outcomes still to be measured" },
  { n: 7, x: 1180, y: 1560, w: 920, h: 580, t: "Exchange on lgme.app", s: "status as of 9 Nov 2026" },
  { n: 8, x: 2180, y: 1560, w: 960, h: 580, t: "Tech substrate", s: "proposed later stack: tools, not a government" }
];

const loopCenters = [
  [2151, 361, "Log Did", "what you did"],
  [2409, 242, "Offer", "Sell / Offers"],
  [2781, 257, "Wish", "what you need"],
  [2986, 395, "Match", "AI suggests, you pick"],
  [2871, 551, "Do the deed", "in person or online"],
  [2522, 609, "Confirm (IdidIt)", "recipient attests"],
  [2201, 525, "Record on Tape", "hashes and counts"]
];

const loopNodes = loopCenters.map((c, i) => ({
  id: "L" + (i + 1),
  x: c[0] - 110,
  y: c[1] - 38,
  w: 220,
  h: 76,
  t: c[2],
  s: [c[3]],
  main: true
}));

export const NODES = [
  { id: "p1", x: 100, y: 190, w: 340, h: 86, t: "You (sample person)", s: ["open lgme.app"], main: true },
  { id: "c1", x: 100, y: 320, w: 340, h: 86, t: "Consent first", s: ["nothing starts without your yes"], main: true },
  { id: "c2", x: 100, y: 450, w: 340, h: 86, t: "Pre-fill from past accounts", s: ["only with your permission"], main: true },
  { id: "c3", x: 100, y: 580, w: 340, h: 86, t: "On-device AI? (opt-in)", s: ["AI suggests, you decide"], main: true },
  { id: "c4", x: 520, y: 450, w: 340, h: 86, t: "“What it learned” panel", s: ["Forget any item, one by one"], main: true },
  { id: "c5", x: 520, y: 580, w: 340, h: 86, t: "Not now", s: ["rule-based moves still work"] },
  { id: "c6", x: 520, y: 320, w: 340, h: 86, t: "Data stays on device", s: ["nothing is published without a tap"], main: true },
  { id: "d1", x: 1010, y: 190, w: 160, h: 96, t: "Did", s: ["logged deeds"] },
  { id: "d2", x: 1184, y: 190, w: 160, h: 96, t: "Sell / Offers", s: ["what you give"] },
  { id: "d3", x: 1358, y: 190, w: 160, h: 96, t: "Wish", s: ["what you need"] },
  { id: "d4", x: 1532, y: 190, w: 160, h: 96, t: "Duty", s: ["what you owe"] },
  { id: "d5", x: 1706, y: 190, w: 160, h: 96, t: "Responsible", s: ["what you steward"] },
  { id: "rings", x: 1010, y: 320, w: 420, h: 250, t: "Progress rings", s: ["sample"] },
  { id: "notif", x: 1460, y: 320, w: 406, h: 86, t: "Notifications", s: ["confirm requests, matches, fade reminders"] },
  {
    id: "rec",
    x: 1460,
    y: 430,
    w: 406,
    h: 140,
    t: "A few recommended next moves",
    s: ["• Offer a skill you logged (sample)", "• Answer a nearby wish (sample)", "• Confirm a deed you received"],
    main: true
  },
  { id: "views", x: 1010, y: 600, w: 856, h: 76, t: "Three views: Classic · My Picture · Sovereign App", s: ["your choice is remembered on this device"] },
  ...loopNodes,
  {
    id: "state",
    x: 110,
    y: 920,
    w: 400,
    h: 150,
    t: "State",
    s: ["US$ · the tax boundary", "monetary sovereignty (Congress coins money)", "policy: central bank / Treasury"]
  },
  {
    id: "third",
    x: 850,
    y: 920,
    w: 400,
    h: 150,
    t: "Third Seat arbiter",
    s: ["the arbiter who can veto", "$lgme · self-regulating nonprofit", "no yield; cannot buy CC or standing"]
  },
  {
    id: "floor",
    x: 480,
    y: 1250,
    w: 400,
    h: 150,
    t: "Individual / Floor",
    s: ["Campus Credit (CC): mutual credit", "non-convertible, capped, fades unused", "no seigniorage: deeds create it"]
  },
  { id: "r1", x: 1420, y: 920, w: 640, h: 86, t: "Right to say no", s: ["a job, deal, ruling, currency, data request, AI tip"] },
  { id: "r2", x: 1420, y: 1030, w: 640, h: 236, t: "Practical limits" },
  { id: "r3", x: 1420, y: 1290, w: 310, h: 110, t: "Formal vs real", s: ["real only when another", "path to the need exists"] },
  { id: "r4", x: 1750, y: 1290, w: 310, h: 110, t: "Third Seat hears", s: ["coerced-refusal claims", "and broken deeds"] },
  { id: "strip", x: 2220, y: 930, w: 888, h: 56, t: "", hidden: true },
  { id: "t1", x: 2220, y: 1030, w: 280, h: 86, t: "Issuance · cancellation", s: ["and dispute rulings"] },
  { id: "t2", x: 2520, y: 1030, w: 280, h: 86, t: "Private details off-Tape", s: ["people hold their records"] },
  { id: "t3", x: 2820, y: 1030, w: 290, h: 86, t: "Each seat audits", s: ["the other two"] },
  {
    id: "t4",
    x: 2220,
    y: 1150,
    w: 440,
    h: 100,
    t: "Published pilot metrics",
    s: ["deed confirmations, Floor needs met,", "disputes, balance spread (goals, not results)"]
  },
  { id: "t5", x: 2690, y: 1150, w: 420, h: 100, t: "Feedback", s: ["back to the person and the seats"], main: true },
  {
    id: "t6",
    x: 2220,
    y: 1280,
    w: 890,
    h: 100,
    t: "The local book works even if the network is down",
    s: ["a Hedera copy, when added, is a public mirror of hashes"]
  },
  { id: "f1", x: 100, y: 1660, w: 300, h: 96, t: "Transparency", s: ["the Tape as a utility"] },
  { id: "f2", x: 420, y: 1660, w: 300, h: 96, t: "UBI-like Floor", s: ["earned by confirmed deeds"] },
  { id: "f3", x: 740, y: 1660, w: 320, h: 96, t: "AI faculties commoditized", s: ["cheap, assistive, refusable"] },
  { id: "f4", x: 100, y: 1790, w: 460, h: 110, t: "Durability", s: ["laws · mandates · tax incentives", "counsel before any lever"] },
  {
    id: "f5",
    x: 580,
    y: 1790,
    w: 480,
    h: 110,
    t: "Lessons from ESG and UBI pilots",
    s: ["publish outcomes, not disclosures;", "report wellbeing and participation"]
  },
  {
    id: "f6",
    x: 100,
    y: 1930,
    w: 960,
    h: 180,
    t: "IdidIt balances the stress",
    s: ["state ↔ firm · debit ↔ credit", "some needs met by deeds without new", "US$ debt (a hypothesis to test)"]
  },
  { id: "e1", x: 1220, y: 1660, w: 840, h: 80, t: "Exchange on lgme.app", s: ["offers and wishes from the loop become listings"] },
  {
    id: "e2",
    x: 1220,
    y: 1780,
    w: 400,
    h: 130,
    t: "Shared listings",
    s: ["Hedera testnet", "allowlist · caps · fail closed"],
    dashed: true,
    pill: { label: "Planned", live: false }
  },
  {
    id: "e3",
    x: 1660,
    y: 1780,
    w: 400,
    h: 130,
    t: "$lgme payments",
    s: ["Solana, your own wallet", "a separate ledger from listings"],
    pill: { label: "Live beta", live: true }
  },
  {
    id: "e4",
    x: 1220,
    y: 1950,
    w: 840,
    h: 100,
    t: "Walls hold here too",
    s: ["the Floor stays senior · a refusal moves nothing", "$lgme cannot buy CC, standing, or Floor access"]
  },
  { id: "k1", x: 2220, y: 1660, w: 430, h: 86, t: "Hedera HCS", s: ["time-ordered hashes (planned)"] },
  { id: "k2", x: 2680, y: 1660, w: 430, h: 86, t: "Hiero", s: ["open governance of the code"] },
  { id: "k3", x: 2220, y: 1770, w: 430, h: 86, t: "Chainlink oracles / CCIP", s: ["named outside facts, cross-chain"] },
  { id: "k4", x: 2680, y: 1770, w: 430, h: 86, t: "CLPR", s: ["to be verified"], dashed: true },
  { id: "k5", x: 2220, y: 1880, w: 890, h: 76, t: "AI as assistant", s: ["explains, finds, flags; a person decides"] },
  {
    id: "k6",
    x: 2220,
    y: 1990,
    w: 890,
    h: 120,
    t: "Individual sovereignty under the Constitution",
    s: ["design alignment with due process, speech, privacy, reserved powers", "and Congress's coinage power; not a legal claim"],
    main: true
  }
];

export const NODE_BY_ID = Object.fromEntries(NODES.map((node) => [node.id, node]));

export const EDGES = [
  { a: "p1", b: "c1", kind: "main" },
  { a: "c1", b: "c2", kind: "main" },
  { a: "c2", b: "c3", kind: "main" },
  { a: "c3", b: "c4", kind: "main", label: "Allow", lx: 488, ly: 560, anchor: "middle" },
  { a: "c3", b: "c5", kind: "thin" },
  { a: "c4", b: "c6", kind: "main" },
  { a: "L1", b: "L2", kind: "main" },
  { a: "L2", b: "L3", kind: "main" },
  { a: "L3", b: "L4", kind: "main" },
  { a: "L4", b: "L5", kind: "main" },
  { a: "L5", b: "L6", kind: "main" },
  { a: "L6", b: "L7", kind: "main" },
  { a: "L7", b: "L1", kind: "thin", dashed: true, label: "next deed", lx: 2140, ly: 452, anchor: "end" },
  { a: "state", b: "third", kind: "check", both: true, label: "no seat writes the rules alone", lx: 680, ly: 978, anchor: "middle" },
  { a: "state", b: "floor", kind: "check", both: true, label: "keeps CC lawful · taxes at the US$ edge", lx: 440, ly: 1200, anchor: "end" },
  { a: "third", b: "floor", kind: "check", both: true, label: "funds review · hears disputes", lx: 920, ly: 1200, anchor: "start" },
  { a: "r1", b: "r2", kind: "thin" },
  { a: "r2", b: "r3", kind: "thin" },
  { a: "r2", b: "r4", kind: "thin" },
  { a: "strip", b: "t1", kind: "thin" },
  { a: "strip", b: "t2", kind: "thin" },
  { a: "strip", b: "t3", kind: "thin" },
  { a: "t1", b: "t4", kind: "thin" },
  { a: "t4", b: "t5", kind: "feed" },
  { a: "f4", b: "f6", kind: "thin" },
  { a: "f5", b: "f6", kind: "thin" },
  { a: "e1", b: "e2", kind: "thin" },
  { a: "e1", b: "e3", kind: "thin" },
  { a: "k5", b: "k6", kind: "thin" }
];

export const PATHS = [
  { pts: [[860, 363], [940, 363], [940, 238], [1010, 238]], kind: "main" },
  { pts: [[1866, 500], [1940, 500], [1940, 361], [2041, 361]], kind: "main", label: "start a move", lx: 1948, ly: 440, anchor: "start" },
  { pts: [[2201, 563], [2201, 925]], kind: "main", label: "record", lx: 2210, ly: 800, anchor: "start" },
  {
    pts: [[2180, 1200], [2140, 1200], [2140, 760], [480, 760], [480, 704]],
    kind: "feed",
    dashed: true,
    label: "audit feedback: back to the person and the seats",
    lx: 1560,
    ly: 748,
    anchor: "middle"
  },
  { pts: [[1000, 760], [1000, 816]], kind: "feed", dashed: true },
  { pts: [[1300, 1130], [1376, 1130]], kind: "thin" },
  { pts: [[300, 1440], [300, 1556]], kind: "thin", label: "the Floor sets defaults", lx: 312, ly: 1505, anchor: "start" },
  {
    pts: [[1560, 1440], [1560, 1500], [900, 1500], [900, 1556]],
    kind: "thin",
    label: "a Floor makes “no” survivable",
    lx: 1230,
    ly: 1490,
    anchor: "middle"
  },
  { pts: [[2660, 1560], [2660, 1444]], kind: "thin", dashed: true, label: "HCS mirrors Tape hashes (planned)", lx: 2672, ly: 1508, anchor: "start" },
  { pts: [[2180, 1703], [2104, 1703]], kind: "thin", dashed: true }
];

export const LIMITS = [
  "Necessity: rent, food, care",
  "Lock-in and network effects",
  "Information gaps",
  "Law, tax, and tender still apply",
  "Collective action is hard",
  "No exit from a confirmed IdidIt",
  "Digital access needs offline paths"
];

export const HASHES = ["a1f3…", "07bc…", "9e42…", "c5d8…", "3b61…", "f0a9…", "6d2e…", "8c17…"];

export const ZONE_KEY = [
  "Person and onboarding: consent first; past-account data is pre-filled only with permission; on-device AI is opt-in, with a “What it learned” panel and per-item Forget.",
  "Big picture: Did, Sell / Offers, Wish, Duty, and Responsible, with progress rings, notifications, and a few recommended next moves.",
  "Activity loop: log a deed, offer, wish, match, do, confirm as an IdidIt, then record hashes and counts on the Tape.",
  "Three seats: the State (US$, tax boundary, sovereignty), the Individual / Floor (Campus Credit), and the Third Seat, the arbiter who can veto ($lgme self-regulating nonprofit), each limiting the other two.",
  "Right of refusal: the right to say no, and the ordinary limits that make a paper right differ from a real one.",
  "The Floor's defaults: transparency, a UBI-like earned Floor, and commoditized AI faculties, made durable through laws, mandates, and tax incentives; IdidIt is hypothesized to balance stress between state and firm and between debit and credit.",
  "Exchange: $lgme payments on Solana are a live beta; shared listings on Hedera testnet are planned and not yet live.",
  "Tech substrate: Hedera HCS, Hiero, Chainlink oracles / CCIP, and CLPR (to be verified), all serving individual sovereignty under the Constitution.",
  "Public Tape and audit: issuance, cancellation, and rulings as hashes and counts; each seat audits the others, and the results flow back to the person and the seats."
];

export const LIVE_ROWS = [
  ["$lgme payments on Solana", "Live beta", "Your own wallet; the page holds no seed phrase"],
  ["My Picture and Sovereign App views", "Live prototype", "Sample data only; nothing is published"],
  ["Shared listings on Hedera testnet", "Planned", "Needs a backend and new lgme infrastructure first"],
  ["Hedera HCS, Hiero, Chainlink", "Proposed", "Named for a later stack"],
  ["CLPR", "To be verified", "No confirmed public specification"]
];

export function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function edgePoint(node, tx, ty) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const sx = dx !== 0 ? (node.w / 2) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (node.h / 2) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}

export function edgeEndpoints(edge, byId = NODE_BY_ID) {
  const a = byId[edge.a];
  const b = byId[edge.b];
  const [x1, y1] = edgePoint(a, b.x + b.w / 2, b.y + b.h / 2);
  const [x2, y2] = edgePoint(b, a.x + a.w / 2, a.y + a.h / 2);
  return { x1, y1, x2, y2 };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function clampZoom(scale) {
  const rounded = Math.round(Number(scale) * 10) / 10;
  if (!Number.isFinite(rounded)) return 1;
  return clamp(rounded, ZOOM_MIN, ZOOM_MAX);
}

export function zoomBy(scale, delta) {
  return clampZoom(Number(scale) + Number(delta));
}

export function fitScale(viewportWidth, mapWidth = MAP_W) {
  const width = Number(viewportWidth);
  if (!Number.isFinite(width) || width <= 4) return 0.2;
  return Math.max(0.2, (width - 4) / mapWidth);
}

export function createView(partial = {}) {
  return {
    scale: partial.scale == null ? 1 : partial.scale,
    scrollLeft: Number(partial.scrollLeft) || 0,
    scrollTop: Number(partial.scrollTop) || 0
  };
}

export function resetView() {
  return createView();
}

export function panBy(view, dx, dy, viewport = {}) {
  const scale = view.scale;
  const maxX = Math.max(0, MAP_W * scale - (Number(viewport.width) || 0));
  const maxY = Math.max(0, MAP_H * scale - (Number(viewport.height) || 0));
  return {
    scale,
    scrollLeft: clamp(view.scrollLeft + dx, 0, maxX),
    scrollTop: clamp(view.scrollTop + dy, 0, maxY)
  };
}

export function arrowKeyDelta(key, step = PAN_STEP) {
  if (key === "ArrowLeft") return { dx: -step, dy: 0 };
  if (key === "ArrowRight") return { dx: step, dy: 0 };
  if (key === "ArrowUp") return { dx: 0, dy: -step };
  if (key === "ArrowDown") return { dx: 0, dy: step };
  return null;
}

export function jumpToZone(view, zoneNumber, viewport = {}) {
  const zone = ZONES.find((item) => item.n === Number(zoneNumber));
  if (!zone) return { ...view };
  return panBy(
    { scale: view.scale, scrollLeft: zone.x * view.scale - 16, scrollTop: zone.y * view.scale - 16 },
    0,
    0,
    viewport
  );
}

export function centerOn(view, worldX, worldY, viewport = {}) {
  return panBy(
    {
      scale: view.scale,
      scrollLeft: worldX * view.scale - (Number(viewport.width) || 0) / 2,
      scrollTop: worldY * view.scale - (Number(viewport.height) || 0) / 2
    },
    0,
    0,
    viewport
  );
}

export function minimapFrame(view, viewport = {}, mapWidth = 200) {
  const width = mapWidth;
  const height = mapWidth * (MAP_H / MAP_W);
  const sx = width / MAP_W;
  const sy = height / MAP_H;
  const scale = view.scale || 1;
  return {
    width,
    height,
    rect: {
      x: (view.scrollLeft / scale) * sx,
      y: (view.scrollTop / scale) * sy,
      w: ((Number(viewport.width) || 0) / scale) * sx,
      h: ((Number(viewport.height) || 0) / scale) * sy
    }
  };
}

function label(text, x, y, anchor) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor || "middle"}" font-size="16" fill="${PALETTE.secondary}" style="paint-order:stroke;stroke:${PALETTE.bg};stroke-width:6;stroke-linejoin:round">${xml(text)}</text>`;
}

function marker(kind) {
  const s = kind === "main" ? 22 : 16;
  return `<marker id="ah-${kind}" markerUnits="userSpaceOnUse" markerWidth="${s}" markerHeight="${s}" refX="${s - 1}" refY="${s / 2}" orient="auto-start-reverse"><path d="M0,0 L${s},${s / 2} L0,${s} z" fill="${PALETTE[kind]}"></path></marker>`;
}

function drawBox(node) {
  if (node.hidden) return "";
  const stroke = node.main ? PALETTE.main : PALETTE.borderStrong;
  const lines = (node.s || [])
    .map((line, i) => `<text x="${node.x + 16}" y="${node.y + 58 + i * 22}" font-size="15" fill="${PALETTE.secondary}">${xml(line)}</text>`)
    .join("");
  const pill = node.pill
    ? `<rect x="${node.x + node.w - 126}" y="${node.y + 12}" width="112" height="30" rx="15" fill="${PALETTE.bg}" stroke="${node.pill.live ? PALETTE.success : PALETTE.borderStrong}" ${node.pill.live ? "" : 'stroke-dasharray="5 4"'}></rect><text x="${node.x + node.w - 70}" y="${node.y + 32}" text-anchor="middle" font-size="14" font-weight="600" fill="${node.pill.live ? PALETTE.success : PALETTE.secondary}">${xml(node.pill.label)}</text>`
    : "";
  return `<g data-node="${node.id}"><rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="12" fill="${PALETTE.elevated}" stroke="${stroke}" stroke-width="${node.main ? 3 : 1.5}" ${node.dashed ? 'stroke-dasharray="8 6"' : ""}></rect><text x="${node.x + 16}" y="${node.y + 32}" font-size="20" font-weight="600" fill="${PALETTE.text}">${xml(node.t)}</text>${lines}${pill}</g>`;
}

function drawEdge(edge, index) {
  const { x1, y1, x2, y2 } = edgeEndpoints(edge);
  const text = edge.label ? label(edge.label, edge.lx, edge.ly, edge.anchor || "middle") : "";
  return `<g data-edge="${edge.a}-${edge.b}" data-kind="${edge.kind}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${PALETTE[edge.kind]}" stroke-width="${WIDTH[edge.kind]}" ${edge.dashed ? 'stroke-dasharray="8 7"' : ""} marker-end="url(#ah-${edge.kind})" ${edge.both ? `marker-start="url(#ah-${edge.kind})"` : ""}></line>${text}</g>`;
}

function drawPath(path, index) {
  const points = path.pts.map((pt) => pt[0] + "," + pt[1]).join(" ");
  const text = path.label ? label(path.label, path.lx, path.ly, path.anchor || "middle") : "";
  return `<g data-path="${index}" data-kind="${path.kind}"><polyline points="${points}" fill="none" stroke="${PALETTE[path.kind]}" stroke-width="${WIDTH[path.kind]}" stroke-linejoin="round" ${path.dashed ? 'stroke-dasharray="10 8"' : ""} marker-end="url(#ah-${path.kind})"></polyline>${text}</g>`;
}

export function renderWorkflowSvg() {
  const rings = [0.72, 0.45, 0.58];
  const ringNames = ["Did", "Wish", "Duty"];
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const ringSvg = rings
    .map((frac, i) => {
      const cx = 1100 + i * 120;
      const cy = 470;
      return `<g data-ring="${ringNames[i]}"><circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${PALETTE.border}" stroke-width="12"></circle><circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${[PALETTE.main, PALETTE.check, PALETTE.feed][i]}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${frac * circ} ${circ}" transform="rotate(-90 ${cx} ${cy})"></circle><text x="${cx}" y="${cy + 80}" text-anchor="middle" font-size="16" fill="${PALETTE.secondary}">${ringNames[i]}</text></g>`;
    })
    .join("");
  const limits = LIMITS.map(
    (text, i) => `<text x="${1440 + (i < 4 ? 0 : 310)}" y="${1094 + (i % 4) * 40}" font-size="16" fill="${PALETTE.secondary}">${xml("• " + text)}</text>`
  ).join("");
  const hashes = HASHES.map(
    (hash, i) => `<g data-hash="${i}"><rect x="${2220 + i * 112}" y="930" width="104" height="56" rx="8" fill="${PALETTE.elevated}" stroke="${PALETTE.main}" stroke-width="2"></rect><text x="${2272 + i * 112}" y="964" text-anchor="middle" font-size="16" fill="${PALETTE.text}" font-family="ui-monospace, monospace">${xml(hash)}</text></g>`
  ).join("");
  const ledger = [
    ["Giver", "+1 CC"],
    ["Receiver", "−1 CC"],
    ["Circuit", "sum 0"]
  ]
    .map(
      (row, i) => `<g data-ledger="${row[0]}"><rect x="${540 + i * 170}" y="1950" width="150" height="90" rx="10" fill="${PALETTE.bg}" stroke="${i === 2 ? PALETTE.check : PALETTE.borderStrong}" stroke-width="${i === 2 ? 3 : 1.5}"></rect><text x="${615 + i * 170}" y="1984" text-anchor="middle" font-size="15" fill="${PALETTE.secondary}">${xml(row[0])}</text><text x="${615 + i * 170}" y="2020" text-anchor="middle" font-size="22" font-weight="600" fill="${PALETTE.text}">${xml(row[1])}</text></g>`
    )
    .join("");
  const zones = ZONES.map(
    (zone) => `<g data-zone="${zone.n}"><rect x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" rx="20" fill="${PALETTE.subtle}" stroke="${PALETTE.border}" stroke-width="1.5"></rect><circle cx="${zone.x + 38}" cy="${zone.y + 42}" r="22" fill="${PALETTE.main}"></circle><text x="${zone.x + 38}" y="${zone.y + 50}" text-anchor="middle" font-size="22" font-weight="600" fill="${PALETTE.onColor}">${zone.n}</text><text x="${zone.x + 72}" y="${zone.y + 51}" font-size="26" font-weight="600" fill="${PALETTE.text}">${xml(zone.t)}</text><text x="${zone.x + 72}" y="${zone.y + 78}" font-size="16" fill="${PALETTE.tertiary}">${xml(zone.s)}</text></g>`
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_W} ${MAP_H}" font-family="Figtree, Segoe UI, sans-serif" role="img" aria-label="Workflow map of SPP and lgme.app in nine numbered zones"><defs>${["main", "check", "feed", "thin"].map(marker).join("")}</defs><rect x="0" y="0" width="${MAP_W}" height="${MAP_H}" fill="${PALETTE.bg}"></rect><text x="60" y="52" font-size="30" font-weight="600" fill="${PALETTE.text}">Sovereign Provenance Protocol on lgme.app: comprehensive workflow</text><text x="3140" y="52" text-anchor="end" font-size="17" fill="${PALETTE.tertiary}">Proposed design · sample data · neutral summary, not legal, tax, or investment advice</text>${zones}${PATHS.map(drawPath).join("")}${EDGES.map(drawEdge).join("")}${NODES.map(drawBox).join("")}${ringSvg}<text x="2580" y="390" text-anchor="middle" font-size="22" font-weight="600" fill="${PALETTE.text}">One confirmed deed = one CC</text><text x="2580" y="420" text-anchor="middle" font-size="16" fill="${PALETTE.secondary}">capped · fades if unused · you may refuse at any step</text><text x="2580" y="446" text-anchor="middle" font-size="16" fill="${PALETTE.secondary}">offers and wishes also list on the Exchange (zone 7)</text><text x="680" y="1090" text-anchor="middle" font-size="20" font-weight="600" fill="${PALETTE.text}">Checks and balances</text><text x="680" y="1116" text-anchor="middle" font-size="16" fill="${PALETTE.secondary}">on seigniorage and monetary policy</text><text x="680" y="1140" text-anchor="middle" font-size="16" fill="${PALETTE.secondary}">one-way walls: no conversion between units</text>${limits}<text x="2220" y="922" font-size="15" fill="${PALETTE.tertiary}">Public Tape (made-up sample hashes)</text>${hashes}${ledger}<text x="540" y="2080" font-size="14" fill="${PALETTE.tertiary}">proposed accounting, not a published pilot result</text><text x="1220" y="2090" font-size="15" fill="${PALETTE.tertiary}">Swap demo categories: tutoring, repair, cleanup, gear (sample)</text></svg>`;
}

export function renderZoneKeyHtml() {
  const items = ZONE_KEY.map((item, i) => `<li><span>${i + 1}.</span> ${xml(item)}</li>`).join("");
  return `<ol class="zone-key">${items}</ol><p class="fine">Thin gray arrows are supporting links. Dashed outlines and dashed arrows mark planned or unverified pieces.</p>`;
}

export function renderLiveTableHtml() {
  const rows = LIVE_ROWS.map(
    (row) => `<tr><td data-label="Piece">${xml(row[0])}</td><td data-label="Status">${xml(row[1])}</td><td data-label="Note">${xml(row[2])}</td></tr>`
  ).join("");
  return `<table class="live"><thead><tr><th>Piece</th><th>Status</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function viewportOf(stage) {
  return { width: stage.clientWidth, height: stage.clientHeight };
}

function paint(stage, mini, readout, view) {
  const canvas = stage.querySelector("[data-canvas]");
  canvas.style.width = MAP_W * view.scale + "px";
  canvas.style.height = MAP_H * view.scale + "px";
  stage.scrollLeft = view.scrollLeft;
  stage.scrollTop = view.scrollTop;
  readout.textContent = Math.round(view.scale * 100) + "%";
  const frame = minimapFrame(view, viewportOf(stage), mini.clientWidth || 180);
  const rect = mini.querySelector("[data-mini-rect]");
  if (rect) {
    rect.setAttribute("x", String(frame.rect.x));
    rect.setAttribute("y", String(frame.rect.y));
    rect.setAttribute("width", String(Math.max(8, frame.rect.w)));
    rect.setAttribute("height", String(Math.max(8, frame.rect.h)));
  }
}

export function mountWorkflow(doc = globalThis.document) {
  if (!doc || !doc.getElementById) return;
  const app = doc.getElementById("workflow-app");
  if (!app) return;
  const stage = doc.getElementById("workflow-stage");
  const canvas = stage.querySelector("[data-canvas]");
  const mini = doc.getElementById("workflow-minimap");
  const readout = doc.getElementById("zoom-readout");
  canvas.innerHTML = renderWorkflowSvg();
  doc.getElementById("zone-key").innerHTML = renderZoneKeyHtml();
  doc.getElementById("live-table").innerHTML = renderLiveTableHtml();
  const frame = minimapFrame(createView(), { width: 0, height: 0 }, 180);
  mini.innerHTML = `<svg viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="Minimap of the workflow">${ZONES.map(
    (zone) => `<rect x="${(zone.x / MAP_W) * frame.width}" y="${(zone.y / MAP_H) * frame.height}" width="${(zone.w / MAP_W) * frame.width}" height="${(zone.h / MAP_H) * frame.height}" fill="${PALETTE.subtle}" stroke="${PALETTE.main}" stroke-width="1"></rect>`
  ).join("")}<rect data-mini-rect x="0" y="0" width="20" height="12" fill="none" stroke="${PALETTE.text}" stroke-width="1.5"></rect></svg>`;
  let view = createView();
  const apply = () => {
    view = panBy(view, 0, 0, viewportOf(stage));
    paint(stage, mini, readout, view);
  };
  const setScale = (scale) => {
    view = { ...view, scale };
    apply();
  };
  app.querySelector("[data-zoom-out]").addEventListener("click", () => setScale(zoomBy(view.scale, -ZOOM_STEP)));
  app.querySelector("[data-zoom-in]").addEventListener("click", () => setScale(zoomBy(view.scale, ZOOM_STEP)));
  app.querySelector("[data-fit]").addEventListener("click", () => setScale(fitScale(stage.clientWidth)));
  app.querySelector("[data-reset]").addEventListener("click", () => {
    view = resetView();
    apply();
  });
  app.querySelectorAll("[data-zone]").forEach((button) => {
    button.addEventListener("click", () => {
      view = jumpToZone(view, button.getAttribute("data-zone"), viewportOf(stage));
      paint(stage, mini, readout, view);
      stage.focus();
    });
  });
  let drag = null;
  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, view: { ...view } };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("is-dragging");
  });
  stage.addEventListener("pointermove", (event) => {
    if (!drag) return;
    view = panBy(drag.view, drag.x - event.clientX, drag.y - event.clientY, viewportOf(stage));
    paint(stage, mini, readout, view);
  });
  const endDrag = () => {
    drag = null;
    stage.classList.remove("is-dragging");
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("scroll", () => {
    view = { ...view, scrollLeft: stage.scrollLeft, scrollTop: stage.scrollTop };
    const box = minimapFrame(view, viewportOf(stage), mini.clientWidth || 180);
    const rect = mini.querySelector("[data-mini-rect]");
    if (!rect) return;
    rect.setAttribute("x", String(box.rect.x));
    rect.setAttribute("y", String(box.rect.y));
    rect.setAttribute("width", String(Math.max(8, box.rect.w)));
    rect.setAttribute("height", String(Math.max(8, box.rect.h)));
  });
  stage.addEventListener("keydown", (event) => {
    const delta = arrowKeyDelta(event.key);
    if (!delta) return;
    event.preventDefault();
    view = panBy(view, delta.dx, delta.dy, viewportOf(stage));
    paint(stage, mini, readout, view);
  });
  mini.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    const bounds = mini.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    const worldX = (localX / bounds.width) * MAP_W;
    const worldY = (localY / bounds.height) * MAP_H;
    view = centerOn(view, worldX, worldY, viewportOf(stage));
    paint(stage, mini, readout, view);
  });
  apply();
}

if (typeof document !== "undefined" && document.getElementById && document.getElementById("workflow-app")) {
  mountWorkflow(document);
}
