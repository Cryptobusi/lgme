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
          <span className="font-display text-xl">Charge</span>
          <span className="text-sm text-muted">{showNum(charges)}, paid at the two writes. Not folded into the {showNum(basket)}.</span>
        </li>
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Floor</span>
          <span className="text-sm text-muted">Untouched.</span>
        </li>
      </ol>
      <h3 className="mt-8 font-display text-2xl">The window closes</h3>
      <p className="mt-4 text-muted">
        The next window’s hub discount is {showNum(nextDiscount)}. A new face of {face} would convert at {showNum(nextAt)}. Bob and Amy do not. Their lines stay locked. The new quote does not roll them, and it does not send the difference to the floor.
      </p>
      <ol className="mt-4 divide-y divide-border border-y border-border">
        {path.map((row) => (
          <li key={`${row.name}-lock`} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
            <span className="font-display text-xl">{row.name}</span>
            <span className="text-sm text-muted">
              Locked at {showNum(row.roomAt)}. Charge {showNum(row.charge)} stays. The new {showNum(nextAt)} does not reopen {row.name === "Amy" ? "her" : "him"}.
            </span>
          </li>
        ))}
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Next</span>
          <span className="text-sm text-muted">A new name may take {showNum(nextAt)}. That is a new point, not a rewrite of these two.</span>
        </li>
      </ol>
      <h3 className="mt-8 font-display text-2xl">The date arrives</h3>
      <p className="mt-4 text-muted">
        The book pays the locked conversion. It does not pay the face, and it does not pay the new quote. The charge is not taken twice. What was not converted stays with the name that wrote the paper. The floor is not the backstop.
      </p>
      <ol className="mt-4 divide-y divide-border border-y border-border">
        {path.map((row) => (
          <li key={`${row.name}-due`} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
            <span className="font-display text-xl">{row.name}</span>
            <span className="text-sm text-muted">
              Paid {showNum(row.roomAt)}. Face was {face}. The {showNum(face - row.roomAt)} stays with {row.name === "Amy" ? "her" : "him"}. Charge {showNum(row.charge)} is not taken again.
            </span>
          </li>
        ))}
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Book</span>
          <span className="text-sm text-muted">
            Pays {showNum(basket)}. Not {showNum(face * path.length)}. Not {showNum(nextAt * path.length)}. An empty sliver, if one remains, is the issuer’s loss.
          </span>
        </li>
      </ol>
      <h3 className="mt-8 font-display text-2xl">The remainder</h3>
      <p className="mt-4 text-muted">
        Desert is what is left after the locked lines and the listed charge. Here that remainder is {showNum(desert)}. The {showNum(unconverted)} that was not converted never entered the book. It is not spent, not printed back, and not titled to the floor. Nothing retires.
      </p>
      <ol className="mt-4 divide-y divide-border border-y border-border">
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Floor</span>
          <span className="text-sm text-muted">0 from this hedge. Still senior. Still untouched.</span>
        </li>
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Charge</span>
          <span className="text-sm text-muted">{showNum(charges)} already paid at the writes. Not collected again.</span>
        </li>
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Desert</span>
          <span className="text-sm text-muted">{showNum(desert)}. Naming zero keeps the book from looking closed by a story.</span>
        </li>
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Retire</span>
          <span className="text-sm text-muted">Nothing falls. The {showNum(unconverted)} does not become new units, and it does not roll the old lines at par.</span>
        </li>
      </ol>
      <h3 className="mt-8 font-display text-2xl">The next point</h3>
      <p className="mt-4 text-muted">
        A new accept takes the open window. Face {face}, discount {showNum(nextDiscount)}, converts at {showNum(nextAt)}. Charge {showNum(nextCharge)} is paid at this write. It is not added to the closed {showNum(basket)}. Bob stays {showNum(path[0]?.roomAt ?? 0)}. Amy stays {showNum(path[1]?.roomAt ?? 0)}.
      </p>
      <ol className="mt-4 divide-y divide-border border-y border-border">
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Next</span>
          <span className="text-sm text-muted">Converts at {showNum(nextAt)}. Charge {showNum(nextCharge)}. A new point on the path.</span>
        </li>
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Closed</span>
          <span className="text-sm text-muted">
            {path.map((row) => `${row.name} ${showNum(row.roomAt)}`).join(" and ")} stay shut. Their desert stays {showNum(desert)}.
          </span>
        </li>
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Path</span>
          <span className="text-sm text-muted">
            {path.map((row) => showNum(row.roomAt)).join(", then ")}, then {showNum(nextAt)}. {path.length + 1} points. Two baskets: {showNum(basket)} closed, {showNum(nextAt)} open.
          </span>
        </li>
        <li className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
          <span className="font-display text-xl">Floor</span>
          <span className="text-sm text-muted">Still untouched.</span>
        </li>
      </ol>
    </section>
  );
}

function Home() {
  const [added, setAdded] = useState<Line[]>([]);
  const [act, setAct] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Line[];
        if (Array.isArray(parsed)) setAdded(parsed);
      }
    } catch {
      /* a bad local note is not the tape */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(added));
  }, [added, ready]);

  const tape = [...added].reverse().concat(SEED);

  function record() {
    const text = act.trim();
    if (!text) return;
    const at = new Date().toISOString().slice(0, 10);
    setAdded((current) => [...current, { id: crypto.randomUUID(), at, act: text }]);
    setAct("");
  }

  return (
    <div className="lgme">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="relative">
          <video
            className="pointer-events-none w-full rounded-2xl bg-black"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/lgme-fishbowl.jpg"
          >
            <source src="/lgme-fishbowl.mp4" type="video/mp4" />
          </video>
          <a
            href="https://youtu.be/X1DRDcGlSsE?is=Z318yqkOop9oJi3H"
            target="_blank"
            rel="noreferrer"
            aria-label="Fish tank. Opens in a new window."
            className="absolute inset-0"
          />
        </div>
        <div className="mt-6 flex flex-nowrap items-center gap-2 sm:gap-5">
          {SEALS.map(([src, alt, href]) =>
            href ? (
              <a
                key={src}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${alt} Opens in a new window.`}
                className="min-w-0 flex-1"
              >
                <img src={src} alt={alt} className="aspect-square w-full rounded-full object-cover" />
              </a>
            ) : (
              <img key={src} src={src} alt={alt} className="aspect-square min-w-0 flex-1 rounded-full object-cover" />
            ),
          )}
        </div>
        <section className="soft-say mx-auto mt-8 max-w-3xl">
          <p className="text-[1.25rem] leading-snug sm:text-[1.45rem]">
            You hold your own money. You vote as one real person. Useful work is written down, and its benefits are shared.
          </p>
          <div className="mt-4 space-y-1.5 text-[1.05rem] leading-snug sm:text-[1.2rem]">
            <p>
              <span className="soft-lead">Your own node.</span> You move value from your own wallet. New money follows public rules, not a private board.
            </p>
            <p>
              <span className="soft-lead">One person, one vote.</span> A verified person gets one vote. A stack of tokens does not buy more.
            </p>
            <p>
              <span className="soft-lead">The record decides.</span> Support follows work already done, not the loudest promise or the biggest payment.
            </p>
            <p>
              <span className="soft-lead">Vote by doing.</span> A say comes from building, reviewing, or teaching. Sitting on tokens is not a voice.
            </p>
            <p>
              <span className="soft-lead">A shared basket.</span> Value grows with the network and is shared by the public record of work, not captured by early holders.
            </p>
          </div>
        </section>
        <section className="mx-auto mt-10 max-w-3xl border-t border-border pt-8">
          <p className="font-mono text-xs tracking-widest text-subtle uppercase">Laumon on the working book</p>
          <h2 className="mt-3 font-display text-4xl">How the sheaf improves #legomiego</h2>
          <p className="mt-4 text-muted">
            The third seat is a small book. The state may tax. The firm may issue credit. The person sits beside them and may refuse a line that skipped the order. Floor, Mint, Issue, Tape, Charge, Agent, Thin, Desert, then Retire. Survival is paid first from surplus already named. A promise is not cash. What cannot be shown is not policy.
          </p>
          <p className="mt-4 text-muted">
            The working model is still flatter than that. A room collapses into three numbers. A contribution collapses into a score. A week is judged by whether it settled. Laumon is useful there. Not as a new mint. As a better shape for the book.
          </p>
          <h3 className="mt-8 font-display text-2xl">Sheaves, instead of one average</h3>
          <p className="mt-2 text-muted">
            A policy is not the same object in a rural market and in a hub. Each room keeps its own section: basket, fee, desert. The public tape does not average them. It only glues the sections where the order agrees. Local habit stays local. The rule that travels is seniority and visibility.
          </p>
          <h3 className="mt-8 font-display text-2xl">A moduli space, instead of a rest state</h3>
          <p className="mt-2 text-muted">
            Stop asking where the economy will settle. The allowed books are the points: every triple of floor, fee, and remainder that obeyed the order, including a remainder of zero. The tape records the path from one allowed book to the next. Zero is a point, not a failure.
          </p>
          <h3 className="mt-8 font-display text-2xl">A duality between the person and the basket</h3>
          <p className="mt-2 text-muted">
            Each accepted help must appear as a movement of the basket, and each movement of the basket must have a named accept behind it. A refusal writes nothing on either side. No macro print without a person’s line.
          </p>
          <h3 className="mt-8 font-display text-2xl">A record, instead of one number</h3>
          <p className="mt-2 text-muted">
            Keep one person, one vote. Let the work stay a structure: who did it, what it paid, which floor it touched, when it must be retired. The vote does not buy that structure. The structure is what the vote is allowed to read.
          </p>
          <p className="mt-4 text-muted">
            Rooms keep sections. The tape stores paths, not a final balance. Every basket line has a person’s line, and the other way around. The remainder stays a record. The floor stays first.{" "}
            <a className="text-fg underline decoration-border underline-offset-4" href="https://www.egonomicanonymous.live/laumon">
              The longer reading
            </a>
            .
          </p>
          <h2 className="mt-10 font-display text-4xl">The hedge, in the app’s own numbers</h2>
          <p className="mt-4 text-muted">
            The app already keeps two prices. Discount is the haircut. Charge is the posted price of writing the paper at all. Conversion is face × (1 − discount). They are not one rate. The charge is paid when the line is signed, not taken from the wreck. The floor is not the backstop. What Laumon adds is where the discount is read.
          </p>
          <p className="mt-4 text-muted">
            A face of 100. The hub book is thick, so its discount is 0.03 and the paper converts at 97. This room’s book is thin, so its own discount is 0.08 and the paper converts at 92. If the room borrows the hub’s number, five units are never priced. That five is the risk. It later looks like a loss someone will try to print over, or send to the floor.
          </p>
          <HedgeDesk />
        </section>
        <MockDemo />
        <p className="lgme-slogan mt-5 text-gold">Debit Credit ØtØh IDIDIT!</p>
        <a
          href="https://www.egonomicanonymous.live"
          className="mx-auto mt-6 block max-w-3xl"
          aria-label="I am keeping the book. Opens egonomicanonymous.live"
        >
          <video
            className="heart-pump w-full rounded-2xl"
            autoPlay
            muted
            loop
            playsInline
            poster="/keeping-the-book.jpg"
          >
            <source src="/keeping-the-book.mp4" type="video/mp4" />
          </video>
        </a>

        <article className="mt-10">
          <p className="font-mono text-xs tracking-widest text-subtle uppercase">Copied from the live status</p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Site Status — 10 October 2026</h1>
          <p className="mt-4 text-muted">Beta (#LeGoMiEgo). Public bookkeeping and visibility rules. The person is the third seat.</p>

          <h2 className="mt-10 font-display text-3xl">Central thesis</h2>
          <p className="mt-3 font-display text-2xl leading-snug">“They printed the money. I am keeping the book.”</p>
          <ul className="mt-3 space-y-1 text-muted">
            <li>Same rails. Anyone may issue. No one may hide the print.</li>
            <li>If it cannot be shown, it is not policy.</li>
            <li>Sovereignty is the refusal.</li>
            <li>Precommitment barriers keep the refusal durable. See the egonomic restraint section.</li>
          </ul>

          <h2 className="mt-10 font-display text-3xl">The order</h2>
          <ol className="mt-4 divide-y divide-border border-y border-border">
            {ORDER.map(([name, line]) => (
              <li key={name} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
                <span className="font-display text-xl">{name}</span>
                <span className="text-sm text-muted">{line}</span>
              </li>
            ))}
          </ol>

          <h2 className="mt-10 font-display text-3xl">Status tape</h2>
          <p className="mt-3 text-sm text-muted">Record of the ten recommended steps. Each is a public line.</p>
          <ol className="mt-4 space-y-2 text-sm text-gold">
            {NINE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted">No new mint. No quieter standard for any seat. Floor stays senior. Same rules bind state, firm, and person.</p>

          <h2 className="mt-10 font-display text-3xl">10 October 2026</h2>
          <ul className="mt-4 space-y-2 text-sm text-gold">
            {TEN.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h2 className="mt-10 font-display text-3xl">11 October 2026</h2>
          <ul className="mt-4 space-y-2 text-sm text-gold">
            {ELEVEN.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">No new mint. Floor stays senior. An unpublished change is not a change.</p>
          <p className="mt-6 text-sm text-muted">
            <a className="text-fg underline decoration-border underline-offset-4" href="https://www.egonomicanonymous.live/status">
              The live status
            </a>
            {" · "}
            <a className="text-fg underline decoration-border underline-offset-4" href="https://www.egonomicanonymous.live/status-2026-10-10.md">
              Full report
            </a>
          </p>
        </article>

        <section className="mt-14 border-t border-border pt-10" id="egonomics">
          <h2 className="font-display text-4xl">Egonomic restraint</h2>
          <p className="mt-3 font-mono text-xs tracking-widest text-subtle uppercase">Schelling · Marcum & Smith · Jefferson</p>
          <p className="mt-4 text-muted">
            Preferences reverse. The present self that sets a restraint will often want extraction later. Precommitment barriers (Floor first, public mint, named charge before residual, titled zero, “an unpublished change is not a change”) protect the book from the people who keep it. Ego is kept an asset by humility, curiosity, and veracity. Sovereignty is final authority of the people, exercised as refusal of any line that cannot be shown.
          </p>
          <p className="mt-4 text-muted">
            Barrier checks (11 October 2026): residual redefinition, off-schedule mint, instant Floor change, agent-originated value, and single-seat exceptions all fail the test if unstructured. Each is closed by prior naming, default-closed silence, mechanical Floor seniority, constitutive tape, seat symmetry, and slower recorded amendment.
          </p>
          <p className="mt-4 text-sm text-muted">
            <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Precommitment_One_Page.md">One-page field guide</a>
            {" · "}
            <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Barrier_Checks.md">Barrier checks</a>
            {" · "}
            <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Connecting_the_Seats.md">Connecting the seats</a>
            {" · "}
            <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Schelling_Egonomic_Restraint.md">Schelling</a>
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="font-display text-4xl">Sovereign Provenance Protocol</h2>
          <p className="mt-3">
            <a className="text-gold underline decoration-border underline-offset-4" href="https://lgme.app/spp">
              Whitepaper
            </a>
          </p>
          <p className="mt-3 font-mono text-xs tracking-widest text-subtle uppercase">New section — 11 October 2026</p>
          <p className="mt-4 text-muted">
            The Sovereign Provenance Protocol (SPP) whitepaper has been added, with commentary. It outlines a blueprint for personhood-anchored governance, utility-attested value, and a multi-asset basket treasury.
          </p>
          <p className="mt-4 text-muted">
            Core idea: one human, one vote via ZK Proofs of Personhood; value from Recorded Presentations of real utility rather than speculative narrative; yield from a Basket of productive assets distributed by relative Provenance Score.
          </p>
          <h3 className="mt-8 font-display text-2xl">Commentary summary</h3>
          <p className="mt-3 text-muted">
            Ambitious architectural sketch that correctly prioritizes non-transferable identity over capital concentration. Strongest as a manifesto; weakest as a near-term specification. Personhood/Sybil resistance, objective utility measurement, and the provided Solidity accounting remain open problems. The voting formula is square-root weighting rather than classic quadratic voting. Centralization backdoors (GenesisInjector, Ownable) and missing epoch-aware score decay are concrete gaps.
          </p>
          <p className="mt-4 text-sm text-muted">
            <a className="text-fg underline decoration-border underline-offset-4" href="https://lgme.app/spp">
              View SPP page
            </a>
            {" · "}
            <a className="text-fg underline decoration-border underline-offset-4" href="https://lgme.app/docs/Sovereign_Provenance_Protocol_Whitepaper.md" download>
              Download whitepaper (MD)
            </a>
            {" · "}
            <a className="text-fg underline decoration-border underline-offset-4" href="https://lgme.app/docs/Sovereign_Provenance_Protocol_Commentary.md" download>
              Download commentary (MD)
            </a>
          </p>
          <p className="mt-2 text-sm text-muted">
            <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Sovereign_Provenance_Protocol_Whitepaper.md">
              View on GitHub
            </a>
          </p>
        </section>

        <section id="resources" className="mx-auto mt-14 max-w-3xl border-t border-border pt-10">
          <p className="font-mono text-xs tracking-widest text-subtle uppercase">Resources</p>
          <h2 className="mt-3 font-display text-4xl">Read with the others</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li>
              <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Precommitment_One_Page.md">Precommitment one-page</a>
              . Schelling barriers, test, and leaks.{" "}
              <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Barrier_Checks.md">Barrier checks</a>
              {" · "}
              <a className="text-fg underline decoration-border underline-offset-4" href="https://github.com/Cryptobusi/lgme/blob/main/docs/Connecting_the_Seats.md">Connecting the seats</a>
            </li>
            <li>
              <a className="text-fg underline decoration-border underline-offset-4" href="https://www.edwardfrenkel.com/" target="_blank" rel="noreferrer">Edward Frenkel</a>
              . <em>Love and Math: The Heart of Hidden Reality</em> (2013). The fence is not the painting.{" "}
              <a className="text-fg underline decoration-border underline-offset-4" href="https://en.wikipedia.org/wiki/Love_and_Math" target="_blank" rel="noreferrer">The book</a>
              {" · "}
              <a className="text-fg underline decoration-border underline-offset-4" href="https://www.youtube.com/watch?v=b8e_HMEwKIY" target="_blank" rel="noreferrer">Abel lecture</a>
            </li>
            <li>
              <a className="text-fg underline decoration-border underline-offset-4" href="https://www.egonomicanonymous.live/laumon">Gérard Laumon</a>
              . Sheaves, read onto this book.
            </li>
            <li>
              <a className="text-fg underline decoration-border underline-offset-4" href="https://lgme.app/spp">Sovereign Provenance Protocol</a>
              . The whitepaper and the commentary.
            </li>
            <li>
              <a className="text-fg underline decoration-border underline-offset-4" href="https://youtu.be/KT9P_HnA1mQ" target="_blank" rel="noreferrer">The Last Invention</a>
              . The film. This page does not hold it.
            </li>
            <li>
              <a className="text-fg underline decoration-border underline-offset-4" href="https://www.egonomicanonymous.live">egonomicanonymous.live</a>
              . The book these lines sit beside.
            </li>
          </ul>
          <h3 className="mt-8 font-display text-2xl">What Frenkel changes</h3>
          <p className="mt-4 text-muted">
            He works the Langlands correspondence: a dictionary between continents of mathematics that look separate. A number on one side is a function on the other. <em>Love and Math</em> says the usual class only teaches you to paint the fence. The painting is the hidden unity.
          </p>
          <p className="mt-4 text-muted">
            On this app the fence is the formula, repeated down the page. The painting is one act in several tongues: the person, the conversion, the charge, the basket. If a column is missing, it is not a line. That is the functional change. The aesthetic change is the table at the start of Bob and Amy’s run. The story under it is the same picture, read in order.
          </p>
          <p className="mt-4 text-muted">Floor untouched. Desert of the closed pair is 0. The charge is never folded into the conversion. One row that fails the dictionary writes nothing.</p>
          <h3 className="mt-8 font-display text-2xl">Seeking truths</h3>
          <p className="mt-4 text-muted">
            <em>Love and Math</em> is not a mood. It is a way of looking until the comfortable number gives up the true one. A facility gets better when it will do that. A higher quote is not an improvement. A quote that still matches in the other tongue is.
          </p>
          <ol className="mt-4 divide-y divide-border border-y border-border">
            {[
              ["Wallet", "You hold the money. A movement with no person’s line is not a facility. It is a fence."],
              ["Vote", "One person, one vote. A stack of tokens is not a truer voice."],
              ["Hedge", "Amy at 92 is truer than the hub’s 97. The desk improves by refusing the flattering price."],
              ["Charge", "A second number, paid at the write. Folding it into the discount hides who was spared."],
              ["Basket", "Record 188, the amount that moved. Do not record 194 because it would have looked whole."],
              ["Floor", "Senior, and paid from surplus already named. A hedge gap is not titled to it."],
              ["Refusal", "The unnamed line stays out of the history. A book of only accepts is a painted fence."],
              ["Window", "Bob and Amy stay locked. A later quote, kinder or harsher, is not allowed to become the truth after the fact."],
            ].map(([name, line]) => (
              <li key={name} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
                <span className="font-display text-xl">{name}</span>
                <span className="text-sm text-muted">{line}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-muted">The means are these facilities. The truer way is the one that can be read twice and still say the same thing.</p>
          <h3 className="mt-8 font-display text-2xl">Where there is no mathematics, there is no freedom</h3>
          <p className="mt-3 font-mono text-xs tracking-widest text-subtle uppercase">Editorial — on Frenkel, bad math, and the third seat</p>
          <p className="mt-4 text-muted">
            Edward Frenkel’s warning is not that mathematics is dangerous. It is that bad mathematics, kept in a few hands, is a way to spend other people’s lives. In <em>Love and Math</em> he writes that where there is no mathematics, there is no freedom, and that people need the tools to protect themselves from arbitrary decisions by the powerful few in a math-driven world. He has said the powers that be exploit ignorance, and manipulate us more when we are less able to read the formula. The account of his argument after 2008 is plain: inadequate models, used by bankers and traders, were allowed to stand in for the market. A formula for the cost of living can be revised the same way, and a pension moves while the public is still looking at the fence.
          </p>
          <p className="mt-4 text-muted">
            That is the economic ramification. A bad model does not stay in the paper. It prices a thin room off a thick one. It folds a charge into a discount so a privilege looks like a rate. It books a flattering profit, then sends the tail to someone who never signed it. The crisis was that pattern at full size. The firm kept the model. The state arrived later to socialize what the model would not hold. The person was not in the room.
          </p>
          <p className="mt-4 text-muted">
            The third seat is that room. The state may tax. The firm may issue. The person sits beside them and may refuse a line that cannot be shown. lgme.app is the small desk where that refusal is practiced. It is not a plan for the whole economy. It is the means by which a broader economic life stops taking a formula on faith.
          </p>
          <p className="mt-4 text-muted">
            It can do this, and it must. A model that cannot be refused will be written by whoever is paid to make it flattering. The desk has already watched that happen in miniature. A hub price of 97 offered itself in place of Amy’s 92. A swapped charge offered itself as a friend rate. Both had to write nothing. That discipline is not a demo to leave behind. It is the step.
          </p>
          <ol className="mt-4 divide-y divide-border border-y border-border">
            {[
              ["Show", "Every facility that moves a person’s basket must be readable by that person. Conversion, charge, and floor are three numbers. One blended rate is how the fence gets paid."],
              ["Refuse", "A copied hub price, a friend rate, a missing name: nothing is written. The person does not have to out-argue the model. The line fails its own dictionary."],
              ["Hold", "The floor stays senior and is paid from surplus already named. A clever remainder does not reach backward into survival. That is the opposite of socializing the tail."],
              ["Vote", "One person, one vote. A stack of tokens must not buy a louder reading of the formula. Bad math loves a weighted room."],
              ["Stop", "The seat must not become a second sovereign, a moral score, or a private bureau of the cost of living. It does not set the nation’s prices. It refuses to let a local life be governed by a number the person cannot check."],
            ].map(([name, line]) => (
              <li key={name} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
                <span className="font-display text-xl">{name}</span>
                <span className="text-sm text-muted">{line}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-muted">
            Broader economic life is credit, wages, prices, and the old age that a formula can quietly thin. The third seat cannot repair all of that from one desk. It must still step, because the alternative is the life Frenkel described: decisions made in a language the public is not invited to read. The improvement is not a kinder model. It is a model that can be read twice, by the person it would move, before it moves them.
          </p>
          <p className="mt-4 text-sm text-muted">
            <a className="text-fg underline decoration-border underline-offset-4" href="https://www.motherjones.com/environment/2014/02/inquiring-minds-edward-frenkel-math-doesnt-suck/" target="_blank" rel="noreferrer">Mother Jones, 2014</a>
            {" · "}
            <a className="text-fg underline decoration-border underline-offset-4" href="https://www.edwardfrenkel.com/" target="_blank" rel="noreferrer">Frenkel</a>
            {" · "}
            <em>Love and Math</em>, 2013. This page does not copy the book.
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="font-display text-4xl">Analysis / Comment</h2>
          <p className="mt-3 font-mono text-xs tracking-widest text-subtle uppercase">11 October 2026 — On “The Last Invention”</p>
          <p className="mt-4 text-muted">
            <strong className="text-fg">Source:</strong>{" "}
            <a className="text-fg underline decoration-border underline-offset-4" href="https://youtu.be/KT9P_HnA1mQ" target="_blank" rel="noreferrer">
              #1 The Last Invention: The Whole History of AI, Told by AI
            </a>{" "}
            — Recursive (YouTube, 4 October 2026).{" "}
            <a className="text-fg underline decoration-border underline-offset-4" href="https://youtu.be/KT9P_HnA1mQ" target="_blank" rel="noreferrer">
              Watch the film →
            </a>
          </p>
          <p className="mt-4 text-muted">
            The film traces a clean technical lineage from the 1946 “giant electronic brain” through the winters, Deep Blue, ImageNet/AlexNet, AlphaGo’s move 37, the transformer, ChatGPT, and the 2026 framing of Super Intelligence. The AI narrator correctly notes that the curve has been doubling and that keeping it under control is not a forecast. It is a choice.
          </p>
          <p className="mt-4 text-muted">
            That choice becomes coherent only when the unit of agency remains a non-transferable human identity rather than capital, compute, or narrative. The Sovereign Provenance Protocol is the most natural and sustainable evolution of the history the film records.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
            <li>Where the film shows machines learning from planetary-scale data and outperforming specialists, SPP anchors governance and yield in one verified human anchor (ZK Proof of Personhood). Capital cannot purchase, split, or dilute voice.</li>
            <li>Where the film treats progress as an automatic curve, SPP requires Recorded Presentations: cryptographically attested utility before value is minted. Speculative narrative and pure scale carry zero weight.</li>
            <li>Where the film ends with an open choice, SPP supplies the mechanism: Provenance Scores that are epoch-bounded, challengeable, and used to distribute yield from a multi-asset Basket of productive assets.</li>
            <li>The remaining engineering gaps (enrollment, true quadratic cost, epoch-aware accounting) are the work required so the next doubling does not re-create the plutocracy the protocol is designed to refuse.</li>
          </ul>
          <p className="mt-4 text-muted">
            The film is a high-resolution history of capability. The protocol is the corresponding history of constraint: personhood as the root, utility as the filter, and the person as the third seat that stays senior to both capital and the systems that capital trains. Without that constraint, the choice the narrator names remains rhetorical. With it, the curve can continue while sovereignty remains recorded rather than granted.
          </p>
          <p className="mt-4 text-sm text-muted italic">
            Citation: Recursive. “#1 The Last Invention: The Whole History of AI, Told by AI.” YouTube, 4 Oct. 2026,{" "}
            <a className="text-fg underline decoration-border underline-offset-4" href="https://youtu.be/KT9P_HnA1mQ" target="_blank" rel="noreferrer">
              https://youtu.be/KT9P_HnA1mQ
            </a>
            .
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="font-display text-4xl">Performances</h2>
          <p className="mt-2 text-sm text-muted">Newest first. A line that is not on this page is not a performance.</p>
          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              record();
            }}
          >
            <label className="block text-sm text-muted" htmlFor="act">
              Record a performance
              <input
                id="act"
                value={act}
                onChange={(event) => setAct(event.target.value)}
                className="mt-2 min-h-11 w-full border border-border bg-bg px-3 text-fg outline-none"
              />
            </label>
            <button type="submit" className="mt-3 min-h-11 bg-primary px-5 text-sm text-primary-fg">
              Write the line
            </button>
          </form>
          <ol className="mt-8 space-y-4">
            {tape.map((line) => (
              <li key={line.id} className="border-t border-border pt-4 text-gold">
                <span className="font-mono text-xs text-subtle">{line.at}</span>
                <p className="mt-1">{line.act}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
