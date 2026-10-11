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
