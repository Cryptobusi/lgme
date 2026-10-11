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
  const seed = "2026-10-11 — Face 100. Hub 97. Room 92. Gap 5. Charge 0. Floor untouched.";
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
    if (!who) {
      setNote("No name. Nothing written.");
      return;
    }
    const at = new Date().toISOString().slice(0, 10);
    const text = `${at} — ${who}. Face ${showNum(faceV)}. Hub ${showNum(hubAt)}. Room ${showNum(roomAt)}. Gap ${showNum(gap)}. Charge ${showNum(safe(chargeN))}. Floor untouched.`;
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
      <button type="button" className="mt-4 min-h-11 border border-border px-4 text-sm text-fg" onClick={appendLine}>
        Append this line
      </button>
      <button type="button" className="ml-2 mt-4 min-h-11 border border-border px-4 text-sm text-fg" onClick={refuse}>
        Refuse
      </button>
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
      <ul className="mt-4 space-y-2 text-sm text-gold">
        {[...quotes, seed].map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
      <p className="mt-4 text-muted">
        A line with no name is a refusal. A refusal writes nothing. The path stays on this page. It does not write the public tape, and it does not touch the floor.
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
  return (
    <section className="mx-auto mt-10 max-w-3xl border-t border-border pt-8">
      <p className="font-mono text-xs tracking-widest text-subtle uppercase">Mock demo</p>
      <h2 className="mt-3 font-display text-4xl">Bob and Amy. One run.</h2>
      <p className="mt-4 text-muted">
        The hub discount stays {showNum(hubDiscount)}, so a face of {face} would convert at {showNum(hubAt)} if a room borrowed it. Each name is priced on that room’s own discount. The charge is paid at the write. The floor is not used.
      </p>
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
