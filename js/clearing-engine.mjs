// Sample clearing-engine canvas. No network. Every name, hash, beacon, topic, and hour is SAMPLE.

export const WORLD = { w: 2780, h: 1720 };
export const SCALE_MIN = 0.35;
export const SCALE_MAX = 1.6;
export const SCALE_STEP = 0.1;
export const FIT_MIN = 0.12;
export const PAN_STEP = 70;

export const THIRD_SEAT = "The Third Seat is the arbiter who can veto: the $lgme self-regulating nonprofit arbiter, which holds a veto as a check on the State and Floor seats.";

export const CARDS = [
  { id: "c1", n: "01", x: 70, y: 120, w: 500, h: 700, tone: "amber", nav: "5-Pillars Origin", title: "Sovereign Origin & the 5 Pillars", kicker: "The Fundamental Human Economic State Vector" },
  { id: "c2", n: "02", x: 730, y: 70, w: 540, h: 780, tone: "cyan", nav: "Local AI & UX", title: "Edge SLM & Frictionless Pre-Fill", kicker: "Private on-device reasoning, opt-in" },
  { id: "c3", n: "03", x: 1430, y: 70, w: 560, h: 760, tone: "purple", nav: "Third Seat Clearing", title: "The Third Seat Clearing Engine", kicker: "Zero-debt mutual credit parity" },
  { id: "c4", n: "04", x: 2150, y: 70, w: 540, h: 720, tone: "green", nav: "Cryptographic DAG", title: "Cryptographic Provenance & DAG", kicker: "Hedera HCS is planned · local keys stay sample" },
  { id: "c5", n: "05", x: 730, y: 980, w: 1260, h: 640, tone: "rose", nav: "Serendipity Loop", title: "Peer Serendipity & Circular Clearing Ring", kicker: "Multilateral loop settlement in Campus Credit" }
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((card) => [card.id, card]));

export const EDGES = [
  { id: "e1", from: "c1", to: "c2", fromSide: "right", toSide: "left", label: "Input Signals & Habits" },
  { id: "e2", from: "c2", to: "c3", fromSide: "right", toSide: "left", label: "Dual-Attestation Request" },
  { id: "e3", from: "c3", to: "c4", fromSide: "right", toSide: "left", label: "Signed Zero-Debt Hash" },
  { id: "e4", from: "c3", to: "c5", fromSide: "bottom", toSide: "top", label: "Coincidence of Wants & Duty Matching" },
  { id: "e5", from: "c5", to: "c5", loop: true, label: "Closed Loop Cleared: Instant Parity Update" }
];

export const CLEARING_STEPS = [
  {
    id: 1,
    peer: "A",
    text: "SAMPLE · You frame Elena's greenhouse",
    hours: "SAMPLE · 3.50 HRS",
    delta: { A: 3.5, B: -3.5, C: 0 }
  },
  {
    id: 2,
    peer: "B",
    text: "SAMPLE · Elena delivers produce and compost to Marcus",
    hours: "SAMPLE · 3.50 HRS",
    delta: { A: 0, B: 3.5, C: -3.5 }
  },
  {
    id: 3,
    peer: "C",
    text: "SAMPLE · Marcus charges the home battery",
    hours: "SAMPLE · 3.50 HRS",
    delta: { A: -3.5, B: 0, C: 3.5 }
  }
];

export const PEERS = [
  { id: "A", mark: "YOU", name: "SAMPLE · You", role: "Sovereign Node", offers: "SAMPLE · Carpentry", needs: "SAMPLE · 10 kWh battery" },
  { id: "B", mark: "EL", name: "SAMPLE · Elena", role: "Elena's Commons", offers: "SAMPLE · Heirloom garden", needs: "SAMPLE · Timber greenhouse" },
  { id: "C", mark: "MA", name: "SAMPLE · Marcus", role: "Marcus Microgrid", offers: "SAMPLE · 10 kWh storage", needs: "SAMPLE · Fresh produce / honey" }
];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function applyClearing(steps = CLEARING_STEPS) {
  const total = { A: 0, B: 0, C: 0 };
  const frames = steps.map((step) => {
    total.A = round2(total.A + step.delta.A);
    total.B = round2(total.B + step.delta.B);
    total.C = round2(total.C + step.delta.C);
    const stepSum = round2(step.delta.A + step.delta.B + step.delta.C);
    return {
      id: step.id,
      peer: step.peer,
      text: step.text,
      hours: step.hours,
      stepSum,
      total: { A: total.A, B: total.B, C: total.C },
      equation: round2(total.A + total.B + total.C)
    };
  });
  return { frames, total: { A: total.A, B: total.B, C: total.C }, sum: round2(total.A + total.B + total.C) };
}

export const SPECS = {
  c1: {
    stage: "STAGE 01 · FIVE PILLARS",
    paragraphs: [
      "This card is a picture of a proposed design. The five rows are sample vectors, not a live ledger.",
      "On lgme.app a person logs a deed, an offer, a wish, or a duty. Campus Credit is created only when the recipient confirms the deed. It is non-convertible to $lgme or US$, it is capped, and unused credit is designed to fade. A deed creates it. Spending cancels it. It cannot be bought.",
      "WANT is a demand: missing tools, supplies, or a physical dependency. DID is past proof: hours and work a person says they did, still waiting on the other person's confirmation. SELL is an offer of surplus or time. WISH is a longer shared aim. DUTY / RESPONSIBLE is a pledge to clear a mutual-credit balance and to steward a commons.",
      "The five pillars feed the on-device assistant only after consent. If the person says not now, the rule-based moves still work. Nothing on this card is published."
    ]
  },
  c2: {
    stage: "STAGE 02 · ON-DEVICE PRE-FILL",
    paragraphs: [
      "On-device AI stays opt-in. Consent comes first. The rule on this site is: AI suggests, you decide.",
      "The rows inside the sandbox are SAMPLE. “Saturday Timber Work” is a sample habit. “Clara's Workshop (Beacon #W8)” is a sample beacon, not a real device. “+3.50 HRS” is a sample inference, not a measured match. No accuracy percentage is claimed. No model size is claimed.",
      "The design aim is that a suggestion stays on the device until the person taps. The “0 KB leaves device” line is that aim, not a certified audit. A confirmed attestation can be offered to the Third Seat. The person can refuse the suggestion, forget one learned item, or leave the assistant off.",
      "A dual handshake on this page is a sample button. It does not send a message and it does not write a ledger."
    ]
  },
  c3: {
    stage: "STAGE 03 · THIRD SEAT CLEARING",
    paragraphs: [
      THIRD_SEAT,
      "The arbiter holds a veto as a check on the State seat and the Floor seat. It does not replace a court. Disputes go to peer review first, with legal recourse intact. A private hearing is not a court judgment.",
      "Campus Credit in this design is mutual credit: a confirmed deed issues it, and consumption extinguishes it. The proposal aims at zero interest and at a cap so one participant cannot corner the book. Anything above the cap, in the proposal, is redirected toward the commons. Those limits are design rules. This site does not run them as a live contract.",
      "Komunitin is named only as a comparable mutual-credit pattern. It is not a live integration. A failed sample attestation would go to peer review with the hash the parties already hold. $lgme cannot buy a softer cap, a waiver, or a favorable ruling. Holders receive no yield in this design."
    ]
  },
  c4: {
    stage: "STAGE 04 · PROVENANCE",
    paragraphs: [
      "Every name, hash, and topic on this card is SAMPLE. The dual signature is a sample label, not a real Ed25519 key. The Merkle line is a sample SHA-256 leaf, not a production root. The consensus anchor reads “sample topic”. It is not a Hedera topic id.",
      "Hedera shared listings are PLANNED (testnet). They are not live. $lgme payments on Solana are the live beta, and they use the member's own wallet on a separate ledger from any future listing record. This page does not claim a finality time.",
      "CLPR is to be verified. This page claims no public CLPR specification. Hiero and Chainlink oracles / CCIP are names for a later stack. The local book is designed to keep working if that network is down. A later Hedera copy would mirror hashes and counts. Private details stay off that record.",
      "Counsel still has to read any real pilot before a public network write. This card is not that write."
    ]
  },
  c5: {
    stage: "STAGE 05 · SERENDIPITY 3-WAY CLEARING",
    paragraphs: [
      "When A needs what only C offers, C wants what only B offers, and B wants what A offers, a two-person trade does not clear. The sample ring matches that three-person overlap.",
      "SAMPLE peers only: You (carpentry / a home battery), Elena (a garden / a timber greenhouse), and Marcus (storage / produce). The hour amount on every step is SAMPLE · 3.50 HRS.",
      "Step 1 issues sample credit as You frames Elena's greenhouse. Step 2 moves that sample credit as Elena delivers produce to Marcus. Step 3 closes the ring as Marcus charges the battery. Each step adds to zero by itself. At the end ΔA + ΔB + ΔC = 0.",
      "The loop is cleared in Campus Credit, no US$ needed for this loop. Rent, tax, and any other US$ obligation outside the loop remain due. The result is a sample animation, not a settled payment and not a measured trust score."
    ]
  }
};

export function specDocument() {
  const clearing = applyClearing();
  return {
    title: "Lgme.app Sovereign Workflow and Mutual Clearing Engine",
    notice: "Sample data. Proposed design. Not legal, tax, or investment advice. This file was built in the browser. No network call was made.",
    thirdSeat: THIRD_SEAT,
    cards: CARDS.map((card) => ({
      id: card.id,
      n: card.n,
      title: card.title,
      kicker: card.kicker,
      spec: SPECS[card.id]
    })),
    edges: EDGES.map((edge) => ({ from: edge.from, to: edge.to, label: edge.label })),
    clearing: {
      peers: PEERS,
      steps: clearing.frames,
      equation: "ΔA + ΔB + ΔC = 0",
      sum: clearing.sum
    },
    status: [
      { piece: "$lgme payments on Solana", status: "Live beta", note: "Your own wallet. A separate ledger from listings." },
      { piece: "Hedera shared listings", status: "PLANNED (testnet)", note: "Not live." },
      { piece: "CLPR", status: "to be verified", note: "No confirmed public specification." },
      { piece: "On-device AI", status: "Opt-in", note: "Consent first. AI suggests, you decide." }
    ]
  };
}

export function specMarkdown() {
  const doc = specDocument();
  const lines = [
    "# " + doc.title,
    "",
    doc.notice,
    "",
    doc.thirdSeat,
    ""
  ];
  for (const card of doc.cards) {
    lines.push("## " + card.n + " " + card.title, "", card.spec.stage, "");
    for (const paragraph of card.spec.paragraphs) lines.push(paragraph, "");
  }
  lines.push("## Edges", "");
  for (const edge of doc.edges) lines.push("- " + edge.from + " → " + edge.to + ": " + edge.label);
  lines.push("", "## Sample three-way clearing", "", "Equation: ΔA + ΔB + ΔC = " + doc.clearing.sum, "");
  for (const step of doc.clearing.steps) {
    lines.push(step.id + ". " + step.text + " (" + step.hours + ") step sum " + step.stepSum);
  }
  lines.push("", "Cleared in Campus Credit, no US$ needed for this loop.", "");
  for (const row of doc.status) lines.push("- " + row.piece + ": " + row.status + ". " + row.note);
  lines.push("");
  return lines.join("\n");
}

export function specJson() {
  return JSON.stringify(specDocument(), null, 2);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function clampScale(scale) {
  const rounded = Math.round(Number(scale) * 100) / 100;
  if (!Number.isFinite(rounded)) return 0.85;
  return clamp(rounded, SCALE_MIN, SCALE_MAX);
}

export function createCanvasView(partial = {}) {
  return {
    scale: partial.scale == null ? 0.85 : partial.scale,
    x: Number(partial.x) || 0,
    y: Number(partial.y) || 0
  };
}

export function panCanvas(view, dx, dy) {
  return { scale: view.scale, x: view.x + dx, y: view.y + dy };
}

export function zoomCanvas(view, delta, originX = 0, originY = 0) {
  const next = clampScale(view.scale + delta);
  const ratio = next / (view.scale || 1);
  return {
    scale: next,
    x: originX - (originX - view.x) * ratio,
    y: originY - (originY - view.y) * ratio
  };
}

export function fitCanvas(viewportW, viewportH, world = WORLD) {
  const pad = 28;
  const raw = Math.min((Math.max(Number(viewportW) || 1, 1) - pad) / world.w, (Math.max(Number(viewportH) || 1, 1) - pad) / world.h);
  const scale = clamp(raw, FIT_MIN, SCALE_MAX);
  return {
    scale,
    x: (viewportW - world.w * scale) / 2,
    y: Math.max(16, (viewportH - world.h * scale) / 2)
  };
}

export function focusCard(card, viewportW, viewportH, scale) {
  const s = scale == null ? 0.85 : scale;
  return {
    scale: s,
    x: viewportW / 2 - (card.x + card.w / 2) * s,
    y: viewportH / 2 - (card.y + card.h / 2) * s
  };
}

export function arrowKeyDelta(key, step = PAN_STEP) {
  if (key === "ArrowLeft") return { dx: step, dy: 0 };
  if (key === "ArrowRight") return { dx: -step, dy: 0 };
  if (key === "ArrowUp") return { dx: 0, dy: step };
  if (key === "ArrowDown") return { dx: 0, dy: -step };
  return null;
}

function sidePoint(card, side) {
  if (side === "left") return { x: card.x, y: card.y + card.h / 2 };
  if (side === "right") return { x: card.x + card.w, y: card.y + card.h / 2 };
  if (side === "top") return { x: card.x + card.w / 2, y: card.y };
  return { x: card.x + card.w / 2, y: card.y + card.h };
}

export function edgeGeometry(edge, cards = CARD_BY_ID) {
  const a = cards[edge.from];
  const b = cards[edge.to];
  if (edge.loop) {
    const y = a.y + a.h - 28;
    return { ...edge, x1: a.x + 48, y1: y, x2: a.x + a.w - 48, y2: y, lx: a.x + a.w / 2, ly: y - 14 };
  }
  const start = sidePoint(a, edge.fromSide);
  const end = sidePoint(b, edge.toSide);
  return {
    ...edge,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    lx: (start.x + end.x) / 2,
    ly: (start.y + end.y) / 2 - (edge.fromSide === "bottom" ? 0 : 16)
  };
}

function pillar(tone, name, text, tag) {
  return `<li class="pillar"><i class="dot ${tone}"></i><div><strong>${name}</strong><span>${text}</span></div><em>${tag}</em></li>`;
}

export function cardInner(card) {
  if (card.id === "c1") {
    return `<p>Every person in this picture keeps five non-extractive sample vectors. Campus Credit, not a sterile credit card, is the unit a confirmed deed would create.</p><ul class="pillars">${pillar("amber", "WANT", "Demands, missing tooling, supplies, and physical dependencies. SAMPLE.", "Demand")}${pillar("green", "DID", "Verified labor hours and finished work. SAMPLE, until the recipient confirms.", "Past proof")}${pillar("cyan", "SELL", "Live surplus, dormant tools, available hours. SAMPLE offer.", "Offer")}${pillar("purple", "WISH", "Shared futures, civic projects, a watershed or a commons. SAMPLE.", "Long-term")}${pillar("rose", "DUTY / RESPONSIBLE", "Mutual-credit clearance pledges and commons stewardship. SAMPLE.", "Pledge parity")}</ul><p class="card-foot"><span>Discrete vectors: 5 · SAMPLE</span><span>Feeds the on-device assistant only after consent →</span></p>`;
  }
  if (card.id === "c2") {
    return `<p>No form to grind through in this picture. An on-device assistant may pre-fill a SAMPLE attestation from signals you allow. AI suggests, you decide. No accuracy figure is claimed.</p><div class="sandbox"><header><span>Secure enclave sandbox · SAMPLE</span><span>Design aim: 0 KB leaves device</span></header><p><span>Past accounts and habits</span><strong>SAMPLE · Saturday Timber Work</strong></p><p><span>Local proximity</span><strong>SAMPLE · Clara's Workshop (Beacon #W8)</strong></p><p><span>Inferred output</span><strong>SAMPLE · +3.50 HRS · dual-sign primed</strong></p></div><button type="button" class="handshake" data-sample-action>OfferUp-style 1-tap dual handshake · SAMPLE</button><p class="card-foot"><span>On-device assistant · opt-in · no size claimed</span><span>Pushes to the Third Seat only if you confirm →</span></p>`;
  }
  if (card.id === "c3") {
    return `<p>${THIRD_SEAT} Peer review comes first. Legal recourse stays intact.</p><div class="quad"><article><h3>Komunitin-style engine</h3><p>SAMPLE comparison. Peer reciprocity and credit lines from attested duty. Not a live integration.</p></article><article><h3>Anti-monopoly limiter</h3><p>SAMPLE rule. A threshold would halt cornering. Excess, in the proposal, redirects to the commons.</p></article><article><h3>Zero-debt parity</h3><p>SAMPLE accounting. Credits come from productive labor and are extinguished on consumption. Zero interest in this design.</p></article><article><h3>Peer review first</h3><p>SAMPLE path. Failed attestations go to peer review with the hash evidence. Courts and other legal recourse remain open.</p></article></div><p class="card-foot"><span>Enforcement: published rule, proposed</span><span>Hedera copy of hashes: PLANNED →</span></p>`;
  }
  if (card.id === "c4") {
    return `<p>SAMPLE attestations only. A later phase could hash them into a Merkle tree and anchor a digest. Hedera shared listings are PLANNED (testnet). $lgme payments on Solana are the Live beta.</p><ol class="steps"><li><span>1. Local dual-sign</span><strong>SAMPLE · Ed25519 (Alice) + Ed25519 (Bob)</strong></li><li><span>2. Merkle attestation</span><strong>SAMPLE · SHA-256 state root leaf</strong></li><li><span>3. Consensus anchor</span><strong>sample topic</strong></li><li><span>4. Settlement parity</span><strong>SAMPLE · Hederica Charter (proposed)</strong></li></ol><p class="card-foot"><span>Finality time: not claimed · CLPR to be verified</span><span>Tamper-evident copy is a design aim</span></p>`;
  }
  return `<p>A two-person trade stalls when each person wants what a third person holds. This SAMPLE ring clears inside Campus Credit. No US$ is needed for this loop.</p><div class="peers" data-peers><article data-peer="A"><b>YOU</b><strong>SAMPLE · You</strong><span>Sovereign Node</span><em>Offers SAMPLE · Carpentry</em><em>Needs SAMPLE · 10 kWh battery</em></article><article data-peer="B"><b>EL</b><strong>SAMPLE · Elena</strong><span>Elena's Commons</span><em>Offers SAMPLE · Heirloom garden</em><em>Needs SAMPLE · Timber greenhouse</em></article><article data-peer="C"><b>MA</b><strong>SAMPLE · Marcus</strong><span>Marcus Microgrid</span><em>Offers SAMPLE · 10 kWh storage</em><em>Needs SAMPLE · Fresh produce / honey</em></article></div><ol class="ring-steps" data-ring-steps><li>Step 1 · SAMPLE · You frame Elena's greenhouse (SAMPLE · 3.50 HRS credit issued).</li><li>Step 2 · SAMPLE · Elena delivers produce and compost to Marcus (SAMPLE · 3.50 HRS transferred).</li><li>Step 3 · SAMPLE · Marcus charges the home battery (loop closes, SAMPLE debt balance 0).</li></ol><p class="equation" data-equation>ΔA + ΔB + ΔC = 0</p><button type="button" data-run-clearing>Run sample clearing</button><p class="card-foot"><span>Result waits on the sample run</span><span>Cleared in Campus Credit, no US$ needed for this loop</span></p>`;
}

export function renderCard(card) {
  return `<article class="node tone-${card.tone}" data-card="${card.id}" style="left:${card.x}px;top:${card.y}px;width:${card.w}px;height:${card.h}px"><header><span class="num">${card.n}</span><div><h2>${card.title}</h2><p>${card.kicker}</p></div><button type="button" data-spec="${card.id}">Spec →</button></header><div class="node-body">${cardInner(card)}</div></article>`;
}

export function renderEdges() {
  return EDGES.map((edge) => {
    const line = edgeGeometry(edge);
    const dashed = edge.loop || edge.id === "e4" ? 'stroke-dasharray="8 7"' : "";
    return `<g data-edge="${edge.id}"><line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" ${dashed}></line><text x="${line.lx}" y="${line.ly}" text-anchor="middle">${edge.label}</text></g>`;
  }).join("");
}

function viewBoxOf(viewport) {
  return { width: viewport.clientWidth, height: viewport.clientHeight };
}

function paint(viewport, world, readout, coords, view) {
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  readout.textContent = Math.round(view.scale * 100) + "%";
  const worldX = Math.round((viewport.clientWidth / 2 - view.x) / view.scale);
  const worldY = Math.round((viewport.clientHeight / 2 - view.y) / view.scale);
  coords.textContent = "X: " + worldX + ", Y: " + worldY;
  const mini = viewport.parentElement.querySelector("[data-mini-rect]");
  if (!mini) return;
  const mw = 168;
  const mh = mw * (WORLD.h / WORLD.w);
  mini.setAttribute("x", String((-view.x / view.scale / WORLD.w) * mw));
  mini.setAttribute("y", String((-view.y / view.scale / WORLD.h) * mh));
  mini.setAttribute("width", String((viewport.clientWidth / view.scale / WORLD.w) * mw));
  mini.setAttribute("height", String((viewport.clientHeight / view.scale / WORLD.h) * mh));
}

function fillDrawer(drawer, cardId) {
  const spec = SPECS[cardId];
  const card = CARD_BY_ID[cardId];
  drawer.querySelector("[data-drawer-title]").textContent = spec.stage;
  const body = drawer.querySelector("[data-drawer-body]");
  body.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = card.n + " · " + card.title;
  body.appendChild(heading);
  for (const paragraph of spec.paragraphs) {
    const p = document.createElement("p");
    p.textContent = paragraph;
    body.appendChild(p);
  }
  if (cardId === "c5") {
    const eq = document.createElement("p");
    eq.className = "equation";
    eq.textContent = "ΔA + ΔB + ΔC = " + applyClearing().sum;
    body.appendChild(eq);
    const run = document.createElement("button");
    run.type = "button";
    run.setAttribute("data-run-clearing", "");
    run.textContent = "Run sample clearing";
    body.appendChild(run);
  }
  drawer.hidden = false;
  drawer.querySelector("[data-close-drawer]").focus();
}

function showClearingFrame(root, frame, finalSum) {
  root.querySelectorAll("[data-peer]").forEach((node) => {
    node.classList.toggle("is-hot", frame && node.getAttribute("data-peer") === frame.peer);
  });
  const equation = root.querySelector("[data-equation]");
  const foot = root.querySelector('[data-card="c5"] .card-foot span');
  if (!equation) return;
  if (!frame) {
    equation.textContent = "ΔA + ΔB + ΔC = " + finalSum;
    if (foot) foot.textContent = "3-way sample clearing · sum " + finalSum;
    return;
  }
  equation.textContent = "ΔA " + frame.total.A + " + ΔB " + frame.total.B + " + ΔC " + frame.total.C + " = " + frame.equation;
  if (foot) foot.textContent = frame.text;
}

export function mountClearing(doc = globalThis.document) {
  if (!doc || !doc.getElementById) return;
  const app = doc.getElementById("clearing-app");
  if (!app) return;
  const viewport = doc.getElementById("clearing-viewport");
  const world = doc.getElementById("clearing-world");
  const readout = doc.getElementById("zoom-readout");
  const coords = doc.getElementById("mini-coords");
  const drawer = doc.getElementById("spec-drawer");
  world.innerHTML = `<svg class="edges" viewBox="0 0 ${WORLD.w} ${WORLD.h}" aria-hidden="true">${renderEdges()}</svg>` + CARDS.map(renderCard).join("");
  const mini = doc.getElementById("clearing-minimap");
  const mw = 168;
  const mh = Math.round(mw * (WORLD.h / WORLD.w));
  mini.innerHTML = `<svg viewBox="0 0 ${mw} ${mh}" role="img" aria-label="Minimap overview">${CARDS.map((card) => `<rect class="tone-${card.tone}" x="${(card.x / WORLD.w) * mw}" y="${(card.y / WORLD.h) * mh}" width="${(card.w / WORLD.w) * mw}" height="${(card.h / WORLD.h) * mh}"></rect>`).join("")}<rect data-mini-rect fill="none" stroke="#f4f1e8" stroke-width="1.4"></rect></svg>`;
  const openingScale = 0.85;
  const topRow = Math.min(...CARDS.map((card) => card.y));
  let view = {
    scale: openingScale,
    x: 28 - CARDS[0].x * openingScale,
    y: 18 - topRow * openingScale
  };
  const apply = () => paint(viewport, world, readout, coords, view);
  const buttons = {
    out: app.querySelector("[data-zoom-out]"),
    inn: app.querySelector("[data-zoom-in]"),
    fit: app.querySelector("[data-fit]")
  };
  buttons.out.addEventListener("click", () => {
    view = zoomCanvas(view, -SCALE_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2);
    apply();
  });
  buttons.inn.addEventListener("click", () => {
    view = zoomCanvas(view, SCALE_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2);
    apply();
  });
  buttons.fit.addEventListener("click", () => {
    view = fitCanvas(viewport.clientWidth, viewport.clientHeight);
    apply();
  });
  app.querySelectorAll("[data-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = CARD_BY_ID[button.getAttribute("data-focus")];
      view = focusCard(card, viewport.clientWidth, viewport.clientHeight, Math.max(view.scale, 0.55));
      apply();
      viewport.focus();
    });
  });
  let drag = null;
  const pointers = new Map();
  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    drag = { x: event.clientX, y: event.clientY, view: { ...view } };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-dragging");
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [p, q] = [...pointers.values()];
      const dist = Math.hypot(p.x - q.x, p.y - q.y);
      if (!viewport.dataset.pinch) viewport.dataset.pinch = String(dist);
      const prev = Number(viewport.dataset.pinch);
      const delta = (dist - prev) / 400;
      viewport.dataset.pinch = String(dist);
      view = zoomCanvas(view, delta, viewport.clientWidth / 2, viewport.clientHeight / 2);
      apply();
      return;
    }
    if (!drag) return;
    view = panCanvas(drag.view, event.clientX - drag.x, event.clientY - drag.y);
    apply();
  });
  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    delete viewport.dataset.pinch;
    drag = null;
    viewport.classList.remove("is-dragging");
  };
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
    const bounds = viewport.getBoundingClientRect();
    view = zoomCanvas(view, delta, event.clientX - bounds.left, event.clientY - bounds.top);
    apply();
  }, { passive: false });
  viewport.addEventListener("keydown", (event) => {
    const delta = arrowKeyDelta(event.key);
    if (!delta) return;
    event.preventDefault();
    view = panCanvas(view, delta.dx, delta.dy);
    apply();
  });
  const openSpec = (id) => fillDrawer(drawer, id);
  world.addEventListener("click", (event) => {
    const spec = event.target.closest("[data-spec]");
    if (spec) {
      event.stopPropagation();
      openSpec(spec.getAttribute("data-spec"));
      return;
    }
    if (event.target.closest("[data-run-clearing]")) return;
    if (event.target.closest("[data-sample-action]")) {
      event.target.textContent = "SAMPLE handshake primed · nothing was sent";
      return;
    }
    const card = event.target.closest("[data-card]");
    if (card) openSpec(card.getAttribute("data-card"));
  });
  drawer.querySelector("[data-close-drawer]").addEventListener("click", () => {
    drawer.hidden = true;
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !drawer.hidden) drawer.hidden = true;
  });
  let timer = 0;
  let stepIndex = -1;
  const result = applyClearing();
  const run = () => {
    window.clearInterval(timer);
    stepIndex = -1;
    timer = window.setInterval(() => {
      stepIndex += 1;
      if (stepIndex >= result.frames.length) {
        window.clearInterval(timer);
        showClearingFrame(app, null, result.sum);
        return;
      }
      showClearingFrame(app, result.frames[stepIndex], result.sum);
    }, 700);
  };
  app.addEventListener("click", (event) => {
    if (event.target.closest("[data-run-clearing]")) run();
  });
  const menu = doc.getElementById("export-menu");
  doc.getElementById("export-spec").addEventListener("click", () => {
    menu.hidden = !menu.hidden;
  });
  menu.addEventListener("click", (event) => {
    const kind = event.target.getAttribute("data-export");
    if (!kind) return;
    const content = kind === "json" ? specJson() : specMarkdown();
    const blob = new Blob([content], { type: (kind === "json" ? "application/json" : "text/markdown") + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = doc.createElement("a");
    link.href = url;
    link.download = kind === "json" ? "lgme-clearing-spec.json" : "lgme-clearing-spec.md";
    link.click();
    URL.revokeObjectURL(url);
    menu.hidden = true;
  });
  mini.addEventListener("pointerdown", (event) => {
    const bounds = mini.getBoundingClientRect();
    const worldX = ((event.clientX - bounds.left) / bounds.width) * WORLD.w;
    const worldY = ((event.clientY - bounds.top) / bounds.height) * WORLD.h;
    view = {
      scale: view.scale,
      x: viewport.clientWidth / 2 - worldX * view.scale,
      y: viewport.clientHeight / 2 - worldY * view.scale
    };
    apply();
  });
  apply();
  const settle = () => {
    const width = viewport.clientWidth;
    if (!(width > 0 && width < 760)) return;
    const scale = (width - 16) / CARDS[0].w;
    const top = Math.min(...CARDS.map((card) => card.y));
    view = {
      scale,
      x: 8 - CARDS[0].x * scale,
      y: 8 - top * scale
    };
    apply();
  };
  settle();
  requestAnimationFrame(settle);
}

if (typeof document !== "undefined" && document.getElementById && document.getElementById("clearing-app")) {
  mountClearing(document);
}
