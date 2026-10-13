import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

const ORDER = [
  ["Floor", "Basket paid first from named surplus (~$1,470 example)."],
  ["Mint", "Public schedule only. No private window."],
  ["Issue", "Named credit. Not cash at the register."],
  ["Tape", "Title, mint, lien, conversion, agent act must be shown."],
  ["Charge", "Discount and risk named before residual."],
  ["Agent", "Clerk of the rules. Does not mint."],
  ["Thin", "Width is information. No invented tight price."],
  ["Desert", "Remainder titled, including zero."],
];

const NINE = [
  "Done — Dated Status block published.",
  "Done — Notes stabilized as the single bound order.",
  "Done — Worked invoice shows all five tape lines.",
  "Done — Current basket figure, source, and schedule published on Floor.",
  "Done — Four agent duties listed as a public checklist.",
  "Done — Public contribution split (half floor / half development) posted.",
  "Done — Third Seat sitting checklist published.",
  "Done — Thin-book rule noted on Market.",
  "Done — Zero remainder and named-debt retirement clarified on Desert.",
  "In force — Status remains the running public tape. An unpublished change is not a change.",
];

const TEN = [
  "Done — The clapper control is off the open book. The book picture remains.",
  "Done — The slot reel is off the book.",
  "In force — Observed stays open under the book. The poem, the prose, and #LEGOMIEGO are the public line.",
  "Checked — www.egonomicanonymous.live answers.",
  "Blocked — The connected Vercel account can read the project. It cannot enter the team that owns it.",
  "Stopped — Live execution of the book ends on that site. The record stays. Future performances are written here.",
];

const ELEVEN = [
  "Executed — Face 100. Hub converts at 97. This room converts at 92. Gap 5.",
  "In force — The charge stays a second number, paid at the write. It is not folded into the conversion.",
  "In force — A thin room is not priced off a thick one. The floor is untouched.",
  "Test — Bob accepts at 96, charge 1. Amy accepts at 92, charge 2. Basket 188. A missing name writes nothing.",
  "Learned — The hub price would have left 6 unpriced across the pair. Keep that gap on the write. Do not add the open 90 to the closed 188.",
  "Second test — Local = face × (1 − d). Bob ordinary, 96, gap 1, charge 1. Amy thin, 92, gap 5, charge 2. Basket 188, not 194.",
  "Better — Width class sets the charge before the write. The gap does not choose it afterward.",
  "Next — Swap Bob’s charge with Amy’s. A friend rate writes nothing.",
  "Swap run — Bob, ordinary, asked for charge 2. Amy, thin, asked for charge 1. Both refused.",
  "In force — A friend rate writes nothing. Ordinary stays 1. Thin stays 2.",
  "In force — Barrier checks recorded. Residual, mint window, Floor change, agent action, and single-seat exception all closed under prior naming, default-closed, Floor seniority, constitutive tape, and seat symmetry.",
];

const SEALS = [
  ["/seals/legomiego-coin.jpg", "Gold coin. #legomiego on a burst. Egonomic Anonymous along the rim.", ""],
  ["/seals/hederica.jpg", "Gold seal. Hederica, #legomiego, and @trancesage.", ""],
  [
    "/seals/legomiego-burst.jpg",
    "Gold seal. #legomiego on a burst. Egonomic Anonymous along the rim.",
    "https://youtu.be/nJtP3bpmS5U?is=dgTwaShouLxcOlBs",
  ],
];

const SEED = [
  {
    id: "test-bob-amy",
    at: "2026-10-11",
    act: "Test run. Bob accepts at 96, charge 1. Amy accepts at 92, charge 2. Basket 188. A missing name writes nothing. Learned: do not price the thin room off the hub, and do not add the open 90 to the closed 188.",
  },
  {
    id: "hedge",
    at: "2026-10-11",
    act: "Hedge executed. Face 100. Hub converts at 97. This room converts at 92. Gap 5. The charge stays separate. The floor is untouched.",
  },
  {
    id: "open",
    at: "2026-10-10",
    act: "This desk opens. Future performances are written here until team lgme can publish.",
  },
  {
    id: "stop",
    at: "2026-10-10",
    act: "The book’s live execution stopped. The record stays at egonomicanonymous.live.",
  },
];

const KEY = "lgme-performances";

type Line = { id: string; at: string; act: string };

function showNum(n: number) {
  return String(Math.round(n * 100) / 100);
}

function HedgeDesk() {
  const [face, setFace] = useState("100");
  const [charge, setCharge] = useState("0");
  const [hub, setHub] = useState("0.03");
  const [room, setRoom] = useState("0.08");
  const [width, setWidth] = useState("thin");
  const [person, setPerson] = useState("");
  const [note, setNote] = useState("");
  const [quotes, setQuotes] = useState<string[]>([]);
  const faceN = Number(face);
  const chargeN = Number(charge);
  const hubN = Number(hub);
  const roomN = Number(room);
  const safe = (n: number) => (Number.isFinite(n) ? n : 0);
  const faceV = safe(faceN);
  const hubAt = faceV * (1 - safe(hubN));
  const roomAt = faceV * (1 - safe(roomN));
  const gap = hubAt - roomAt;
  const tests = [
    "2026-10-11 — Bob. Person accepts. Conversion 96. Charge 1. Basket closed in 188. Stays 4. Floor untouched.",
    "2026-10-11 — Amy. Person accepts. Conversion 92. Charge 2. Basket closed in 188. Stays 8. Floor untouched.",
    "2026-10-11 — No name. Refused. Nothing written.",
    "2026-10-11 — Learned. Do not price Amy off the hub. The pair would have left 6 unpriced. Do not fold the charge into the conversion. Do not add the open 90 to the closed 188.",
    "2026-10-11 — Second test. Local = face × (1 − d). Temptation = 97. Gap = temptation − local.",
    "2026-10-11 — Bob, ordinary. Discount 0.04. Local 96. Gap 1. Charge 1, posted for the class, not fitted to the gap.",
    "2026-10-11 — Amy, thin. Discount 0.08. Local 92. Gap 5. Charge 2, posted for the class, not fitted to the gap.",
    "2026-10-11 — Pair. Basket 188, not 194. Charges 3 kept out. Floor 0.",
    "2026-10-11 — Better. Width class sets the charge before the write. The gap does not choose the charge afterward.",
    "2026-10-11 — Next. Swap Bob’s charge with Amy’s. A friend rate writes nothing.",
    "2026-10-11 — Swap run. Bob, ordinary, asked for charge 2. Amy, thin, asked for charge 1. Both refused.",
    "2026-10-11 — A friend rate writes nothing. Ordinary stays 1. Thin stays 2.",
  ];
  const rows = [
    ["Hub", `Converts at ${showNum(hubAt)}. Not this room.`],
    ["Room", `Converts at ${showNum(roomAt)}. This is the local section.`],
    ["Gap", `${showNum(gap)}. Positive means the hub price leaves this room short.`],
    ["Charge", `${showNum(safe(chargeN))}. Paid at the write. Not folded into the conversion.`],
    ["Window", "Discount, charge, and width lock until the due date."],
    ["Floor", "Untouched."],
  ];

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lgme-hedge-path");
      if (!saved) return;
      const parsed = JSON.parse(saved) as unknown;
      if (Array.isArray(parsed)) setQuotes(parsed.filter((item) => typeof item === "string"));
    } catch {
      /* a bad local note is not the path */
    }
  }, []);

  function appendLine() {
    const who = person.trim();
    if (!who || charge.trim() === "") {
      setNote("A tongue is missing. Nothing written.");
      return;
    }
    if (Math.abs(safe(hubN) - safe(roomN)) < 1e-9) {
      setNote("Copied from the hub. Nothing written.");
      return;
    }
    const posted = width === "thin" ? 2 : 1;
    if (Math.abs(safe(chargeN) - posted) > 1e-9) {
      setNote("Friend rate. Nothing written.");
      return;
    }
    const at = new Date().toISOString().slice(0, 10);
    const text = `${at} — ${who}. Read twice. Conversion ${showNum(roomAt)}, not the hub ${showNum(hubAt)}. Charge ${showNum(safe(chargeN))} kept out. Basket ${showNum(roomAt)}. Floor 0.`;
    const next = [text, ...quotes];
    setQuotes(next);
    localStorage.setItem("lgme-hedge-path", JSON.stringify(next));
    setNote("");
  }

  function refuse() {
    setPerson("");
    setNote("Refused. Nothing written.");
  }

  return (
    <>
      <form className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <label className="col-span-2 block text-sm text-subtle">
          Person
          <input
            value={person}
            autoComplete="name"
            onChange={(event) => setPerson(event.target.value)}
            className="mt-1 min-h-11 w-full border-0 border-b border-border bg-transparent font-display text-xl text-fg outline-none"
          />
        </label>
        {(
          [
            ["Face", face, setFace],
            ["Charge, paid at the write", charge, setCharge],
            ["Hub discount", hub, setHub],
            ["Room discount", room, setRoom],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="block text-sm text-subtle">
            {label}
            <input
              value={value}
              inputMode="decimal"
              onChange={(event) => set(event.target.value)}
              className="mt-1 min-h-11 w-full border-0 border-b border-border bg-transparent font-display text-xl text-fg outline-none"
            />
          </label>
        ))}
        <label className="block text-sm text-subtle">
          Width
          <select
            value={width}
            onChange={(event) => setWidth(event.target.value)}
            className="mt-1 min-h-11 w-full border-0 border-b border-border bg-transparent font-display text-xl text-fg outline-none"
          >
            <option value="ordinary">Ordinary, posted 1</option>
            <option value="thin">Thin, posted 2</option>
          </select>
        </label>
      </form>
      <ol className="mt-4 divide-y divide-border border-y border-border">
        {rows.map(([name, line]) => (
          <li key={name} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
            <span className="font-display text-xl">{name}</span>
            <span className="text-sm text-muted">{line}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-muted">Applied: do not price a thin room off a thick one. Do not fold the two numbers into one rate.</p>
      <table className="mt-4 w-full border-collapse text-left text-sm">
        <thead className="text-subtle">
          <tr>
            <th className="border-b border-border py-2 pr-3 font-medium">Tongue</th>
            <th className="border-b border-border py-2 pr-3 font-medium">This line</th>
            <th className="border-b border-border py-2 pr-3 font-medium">Read again</th>
          </tr>
        </thead>
        <tbody className="text-muted">
          {(
            [
              ["Person", person.trim() || "Missing", person.trim() || "Missing"],
              ["Conversion", showNum(roomAt), `${showNum(roomAt)}, not ${showNum(hubAt)}`],
              ["Charge", charge.trim() === "" ? "Missing" : showNum(safe(chargeN)), charge.trim() === "" ? "Missing" : Math.abs(safe(chargeN) - (width === "thin" ? 2 : 1)) > 1e-9 ? `Friend rate. Posted ${width === "thin" ? 2 : 1}` : "Kept out"],
              ["Basket", showNum(roomAt), showNum(roomAt)],
              ["Floor", "Untouched", "0"],
            ] as const
          ).map((row) => (
            <tr key={row[0]}>
              {row.map((cell, index) => (
                <td key={`${row[0]}-${index}`} className="border-b border-border py-2 pr-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-muted">
        {Math.abs(safe(hubN) - safe(roomN)) < 1e-9
          ? "Copied from the hub. The two readings are the flattering price."
          : charge.trim() !== "" && Math.abs(safe(chargeN) - (width === "thin" ? 2 : 1)) > 1e-9
            ? "Friend rate. The charge does not match the width class."
            : "Read twice. The basket matches the conversion, and it is not the hub price."}
      </p>
      <button type="button" className="mt-4 min-h-11 border border-border px-4 text-sm text-fg" onClick={appendLine}>
        Append this line
      </button>
      <button type="button" className="ml-2 mt-4 min-h-11 border border-border px-4 text-sm text-fg" onClick={refuse}>
        Refuse
      </button>
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
      <p className="mt-6 font-mono text-xs tracking-widest text-subtle uppercase">Test run history</p>
      <ul className="mt-4 space-y-2 text-sm text-gold">
        {[...quotes, ...tests].map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
      <p className="mt-4 text-muted">
        A missing tongue is not a line. A refusal writes nothing. The path stays on this page. It does not write the public tape, and it does not touch the floor.
      </p>
    </>
  );
}

const DEMO = [
  { name: "Bob", discount: 0.04, charge: 1, accept: true },
  { name: "Amy", discount: 0.08, charge: 2, accept: true },
] as const;

function MockDemo() {
  const face = 100;
  const hubDiscount = 0.03;
  const hubAt = face * (1 - hubDiscount);
  const ran = DEMO.map((row) => {
    const roomAt = face * (1 - row.discount);
    return { ...row, roomAt, gap: hubAt - roomAt };
  });
  const path = ran.filter((row) => row.accept);
  const basket = path.reduce((sum, row) => sum + row.roomAt, 0);
  const hubPair = path.length * hubAt;
  const leftOut = hubPair - basket;
  const charges = path.reduce((sum, row) => sum + row.charge, 0);
  const nextDiscount = 0.1;
  const nextAt = face * (1 - nextDiscount);
  const nextCharge = 3;
  const unconverted = path.reduce((sum, row) => sum + (face - row.roomAt), 0);
  const desert = 0;
  return (
    <section className="mx-auto mt-10 max-w-3xl border-t border-border pt-8">
      <p className="font-mono text-xs tracking-widest text-subtle uppercase">Mock demo</p>
      <h2 className="mt-3 font-display text-4xl">Bob and Amy. One run.</h2>
      <p className="mt-4 text-muted">
        The hub discount stays {showNum(hubDiscount)}, so a face of {face} would convert at {showNum(hubAt)} if a room borrowed it. Each name is priced on that room’s own discount. The charge is paid at the write. The floor is not used.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="text-subtle">
            <tr>
              {["Tongue", ...path.map((row) => row.name), "Next", "No name"].map((head) => (
                <th key={head} className="border-b border-border py-2 pr-3 font-medium">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-muted">
            {[
              ["Person", ...path.map(() => "Accepts"), "New accept", "Missing"],
              ["Conversion", ...path.map((row) => showNum(row.roomAt)), showNum(nextAt), showNum(face * 0.92)],
              ["Charge", ...path.map((row) => showNum(row.charge)), showNum(nextCharge), "0"],
              ["Basket", ...path.map(() => `Closed in ${showNum(basket)}`), `${showNum(nextAt)}, still open`, "Not written"],
              ["Stays", ...path.map((row) => `${showNum(face - row.roomAt)} with ${row.name === "Amy" ? "her" : "him"}`), "Not yet due", "Nothing"],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  <td key={`${row[0]}-${index}`} className="border-b border-border py-2 pr-3 align-top">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-muted">The last column fails the dictionary. No name, so the basket does not move. The other three are one act, read across.</p>
      <ol className="mt-4 divide-y divide-border border-y border-border">
        {ran.map((row) => (
          <li key={row.name} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
            <span className="font-display text-xl">{row.name}</span>
            <span className="text-sm text-muted">
              {row.accept
                ? `Accepts. Room discount ${showNum(row.discount)}. Converts at ${showNum(row.roomAt)}. Gap ${showNum(row.gap)}. Charge ${showNum(row.charge)}.${row.gap > 1 ? " The gap is the risk the hub price would have left unpriced." : ""}`
                : "Refuses. Nothing written."}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-muted">
        The path has {path.length} points. {path.map((row) => `${row.name} at ${showNum(row.roomAt)}`).join(", then ")}. A refusal is not a point. No name, no line, no movement of the basket.
      </p>
      <h3 className="mt-8 font-display text-2xl">The basket, after both accepts</h3>
      <ol className="mt-4 divide-y divide-border border-y border-border">
        {path.map((row) => (
          <li key={row.name} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
            <span className="font-display text-xl">{row.name}</span>
            <span className="text-sm text-muted">The basket moves {showNum(row.roomAt)}, not {showNum(hubAt)}.</span>
          </li>
        ))}
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Together</span>
          <span className="text-sm text-muted">
            {showNum(basket)}. A hub pair would have written {showNum(hubPair)}. The {showNum(leftOut)} is the risk that was priced here, not collected later.
          </span>
        </li>
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Charges</span>
          <span className="text-sm text-muted">{showNum(charges)} kept out. Not folded into the conversion.</span>
        </li>
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Unconverted</span>
          <span className="text-sm text-muted">{showNum(unconverted)} stays with the names. Desert {desert}.</span>
        </li>
      </ol>
    </section>
  );
}

function Home() {
  const [lines, setLines] = useState<Line[]>(SEED);
  const [act, setAct] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as unknown;
      if (Array.isArray(parsed)) {
        const restored = parsed.filter(
          (item): item is Line =>
            !!item &&
            typeof item === "object" &&
            typeof (item as Line).id === "string" &&
            typeof (item as Line).at === "string" &&
            typeof (item as Line).act === "string",
        );
        if (restored.length) setLines(restored);
      }
    } catch {
      /* a bad local note is not the path */
    }
  }, []);

  function append() {
    const text = act.trim();
    if (!text) {
      setNote("A tongue is missing. Nothing written.");
      return;
    }
    const next: Line = {
      id: `line-${Date.now()}`,
      at: new Date().toISOString().slice(0, 10),
      act: text,
    };
    const updated = [next, ...lines];
    setLines(updated);
    localStorage.setItem(KEY, JSON.stringify(updated));
    setAct("");
    setNote("");
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p className="font-mono text-xs tracking-widest text-subtle uppercase">lgme · #LeGoMiEgo</p>
      <h1 className="mt-4 font-display text-5xl leading-tight">They printed the money. I am keeping the book.</h1>
      <p className="mt-6 text-muted">
        <a className="text-fg underline decoration-border underline-offset-4" href="#sovereignty">Sovereignty</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="#schelling">Egonomic restraint</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="#marcum">Ego balance</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="#connecting">Connecting</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="#order">The order</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="#third-seat">Third seat</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="#checks">Checks</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="#future">Future development</a>
        {" Floor stays senior. Same rules bind state, firm, and person. If it cannot be shown, it is not policy."}
      </p>
      <p className="mt-4 text-muted">In force — Barrier checks recorded. Residual, mint window, Floor change, agent action, and single-seat exception all closed under prior naming, default-closed, Floor seniority, constitutive tape, and seat symmetry.</p>
      <p className="mt-2 text-muted">L2 in force — Amendment path cannot be shortened in the same act. One full public cycle and a second independent reading required. An attempt to waive writes nothing.</p>

      <section className="mt-12" id="sovereignty">
        <h2 className="font-display text-4xl">Sovereignty</h2>
        <h3 className="mt-4 font-display text-2xl">Final and absolute authority</h3>
        <p className="mt-4 text-muted">Sovereignty simply means final and absolute authority. Therefore, those who have it are not subject to any outside authority on Earth.</p>
        <p className="mt-4 text-muted">The Declaration of Independence was the ultimate expression of the sovereignty of the people. This is exactly what Thomas Jefferson was expressing when he wrote, “Governments are instituted among Men, deriving their just powers from the consent of the governed.”</p>
        <p className="mt-4 text-muted">The people have the ultimate authority. The government is an agent of the people. The sovereign people can therefore “alter or abolish” the government as they see fit and institute a new government, “laying its foundation on such principles and organizing its powers in such form, as to them shall seem most likely to effect their Safety and Happiness.”</p>
        <p className="mt-4 text-muted">In the book the person is the third seat. Same rules bind all three. Sovereignty is the refusal of any line that skipped the order or cannot be shown.</p>
        <p className="mt-4 text-sm text-muted">
          <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Sovereignty_Jefferson.md">Full note →</a>
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-10" id="schelling">
        <h2 className="font-display text-4xl">Egonomic restraint</h2>
        <h3 className="mt-4 font-display text-2xl">Schelling self-management of profits</h3>
        <p className="mt-4 text-muted">Thomas C. Schelling, “Egonomics, or the Art of Self-Management,” <em>American Economic Review</em> 68(2): 290–294 (1978).</p>
        <p className="mt-4 text-muted">The person is two selves in conflict. The present self prefers immediate extraction; the future self prefers durable rules. Preferences reverse, so pure intention fails. The remedy is precommitment: external barriers and bright-line rules the present self cannot casually reverse. Schelling’s opening example is the Christmas club account—the bank creates walls that protect the money from the depositor’s own later self.</p>
        <p className="mt-4 text-muted">In lgme the same logic binds profit. Floor Basket is paid first. Mint is public schedule only. Charge and risk are named before residual. Remainder (including zero) is titled. An unpublished change is not a change. These are Schelling barriers. The present self that would widen the spread or privatize the print must violate a visible categorical rule. The person stays the third seat because the protocol has already restrained the profit impulse.</p>
        <p className="mt-4 text-muted">Barrier checks (11 October 2026): residual redefinition, off-schedule mint, instant Floor change, agent-originated value, and single-seat exceptions all fail the test if unstructured. Each is closed by prior naming, default-closed silence, mechanical Floor seniority, constitutive tape, seat symmetry, and slower recorded amendment.</p>
      </section>

      <section className="mt-14 border-t border-border pt-10" id="marcum">
        <h2 className="font-display text-4xl">Ego balance</h2>
        <h3 className="mt-4 font-display text-2xl">Marcum & Smith — ego as asset or liability</h3>
        <p className="mt-4 text-muted">David Marcum and Steven B. Smith, <em>Egonomics: What Makes Ego Our Greatest Asset (or Most Expensive Liability)</em> (2007/2008).</p>
        <p className="mt-4 text-muted">Four warning signs that ego has become a liability: being comparative, being defensive, showcasing brilliance, seeking acceptance. Three principles that keep it an asset: humility, curiosity, veracity. In credit, senior executives escalate commitment to problem loans because they approved them. The same dynamic appears when an issuer defends a past print or resists a visible correction.</p>
        <p className="mt-4 text-muted">Floor-first, public mint, named residual, and “an unpublished change is not a change” already enforce structural humility and veracity. Curiosity is practiced when every line must be readable in multiple tongues and a missing tongue writes nothing.</p>
        <p className="mt-4 text-sm text-muted">
          <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Marcum_Smith_Egonomics.md">Full summary and citation →</a>
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-10" id="connecting">
        <h2 className="font-display text-4xl">Three seats</h2>
        <h3 className="mt-4 font-display text-2xl">Connecting the seats</h3>
        <p className="mt-4 text-muted">Jefferson: the people hold final and absolute authority. Governments derive just powers from the consent of the governed. The people may alter or abolish.</p>
        <p className="mt-4 text-muted">Schelling: the person is two selves. Precommitment barriers (Floor first, public mint, named charge, titled zero, unpublished change is not a change) protect the book from the people who keep it.</p>
        <p className="mt-4 text-muted">Marcum & Smith: ego is asset or liability. Humility, curiosity, and veracity keep it from defending a past print or redefining residual.</p>
        <p className="mt-4 text-muted">Together the people hold authority, exercise it as refusal of any line that cannot be shown, and make the refusal durable by external barriers and internal balance. Floor stays senior. Same rules bind all three.</p>
        <p className="mt-4 text-sm text-muted">
          <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Connecting_the_Seats.md">Full connecting note →</a>
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-10" id="order">
        <h2 className="font-display text-4xl">The order</h2>
        <h3 className="mt-4 font-display text-2xl">Floor first</h3>
        <ol className="mt-4 divide-y divide-border border-y border-border">
          {ORDER.map(([name, line], index) => (
            <li key={name} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
              <span className="font-display text-xl">{index + 1}. {name}</span>
              <span className="text-sm text-muted">{line}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-muted">An unpublished change is not a change. Same rules bind state, firm, and person.</p>
        <p className="mt-2 text-muted">L2: any change to the amendment path must be posted one full public cycle in advance and confirmed by a second independent reading. An attempt to shorten the cycle writes nothing. <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Nested_Commitment.md">Nested commitment →</a></p>
      </section>

      <section className="mt-14 border-t border-border pt-10" id="third-seat">
        <h2 className="font-display text-4xl">Third seat</h2>
        <h3 className="mt-4 font-display text-2xl">The person keeps the book</h3>
        <p className="mt-4 text-muted">State may tax and print. Firm may issue. The person sits beside them and may refuse any line that skipped the order or cannot be shown.</p>
        <p className="mt-4 text-muted">Same rails. Same prices. Same tape. If it cannot be shown, it is not policy. The third seat does not govern the other two. It checks them.</p>
        <p className="mt-4 text-muted">Sovereignty is the refusal. The book is kept.</p>
      </section>

      <section className="mt-14 border-t border-border pt-10" id="checks">
        <h2 className="font-display text-4xl">Barrier checks</h2>
        <h3 className="mt-4 font-display text-2xl">Ten cases closed</h3>
        <p className="mt-4 text-muted">Cases 1–5 (residual, mint window, Floor change, agent action, single-seat exception) closed by L0/L1. Cases 6–8 (cycle shortening, non-independent reading, cycle redefinition) closed by L2. Case 9 (third-seat refusal) non-contractible. Case 10 (constitutive tape) — an unpublished change is not a change. No remaining private path.</p>
        <p className="mt-4 text-sm text-muted">
          <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Barrier_Checks.md">Full checks →</a>
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-10" id="future">
        <h2 className="font-display text-4xl">Future development considered</h2>
        <h3 className="mt-4 font-display text-2xl">Permanent & verifiable storage options</h3>
        <p className="mt-4 text-muted">Reference evaluation of options for making the book (protocol documents, barrier checks, rule snapshots, and utility attestations) permanent, verifiable, and resistant to silent revision.</p>
        <p className="mt-4 text-muted">Options reviewed: KiloScribe (Hedera HCS / Hashinals), Arweave, IPFS, and Filecoin. Ranking for lgme-scale needs places KiloScribe first as the practical default for an ordered, low-cost, non-renewable tape, with Arweave as a strong complementary permanence layer.</p>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-4xl">The book is kept</h2>
        <p className="mt-4 text-muted">Floor stays senior. Same rules bind state, firm, and person. An unpublished change is not a change. If it cannot be shown, it is not policy.</p>
        <p className="mt-4 text-muted">The person is the third seat. Sovereignty is the refusal. The barriers hold.</p>
        <p className="mt-4 text-muted">Companion book: <a className="text-fg underline decoration-border underline-offset-4" href="https://www.egonomicanonymous.live">egonomicanonymous.live</a> — sovereignty is the refusal.</p>
      </section>

      <p className="mt-10 text-sm text-muted">
        <a className="text-fg underline decoration-border underline-offset-4" href="/spp">Sovereign Provenance Protocol</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="https://www.egonomicanonymous.live">egonomicanonymous.live</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Connecting_the_Seats.md">Connecting the seats</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Precommitment_One_Page.md">Precommitment one-page</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Barrier_Checks.md">Barrier checks</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Nested_Commitment.md">Nested commitment</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Future_Development_Considered_Storage_Options.md">Future development considered (storage)</a>
        {" · "}
        <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Torque_of_the_Book.md">Torque of the Book</a>
      </p>

      <p className="mt-6 text-sm text-muted">
        <a className="text-fg underline decoration-border underline-offset-4" href="#sovereignty">Back to top</a>
      </p>
    </main>
  );
}
