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

function Home() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 text-fg">
      <p className="font-mono text-xs tracking-widest text-gold uppercase">lgme · #LeGoMiEgo</p>
      <h1 className="mt-2 font-display text-5xl leading-none sm:text-6xl">They printed the money. We are keeping the book.</h1>
      <p className="mt-4 text-muted">Floor stays senior. Same rules bind state, firm, and person. An unpublished change is not a change.</p>

      <div className="mt-6 flex flex-nowrap items-center gap-2 sm:gap-5">
        {SEALS.map(([src, alt, href]) =>
          href ? (
            <a key={src} href={href} target="_blank" rel="noreferrer" aria-label={`${alt} Opens in a new window.`} className="min-w-0 flex-1">
              <img src={src} alt={alt} className="aspect-square w-full rounded-full object-cover" />
            </a>
          ) : (
            <img key={src} src={src} alt={alt} className="aspect-square w-full min-w-0 flex-1 rounded-full object-cover" />
          )
        )}
      </div>

      <p className="lgme-slogan mt-5 text-gold">Debit Credit ØtØh IDIDIT!</p>
      <a
        href="https://www.egonomicanonymous.live"
        className="mx-auto mt-6 block max-w-3xl"
        aria-label="I am keeping the book. Opens egonomicanonymous.live"
      >
        <img src="/keeping-the-book.jpg" alt="I am keeping the book" className="w-full rounded-2xl" />
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

        <h2 className="mt-10 font-display text-3xl">Nine done</h2>
        <ol className="mt-3 space-y-1 text-muted">
          {NINE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>

        <h2 className="mt-10 font-display text-3xl">Ten cases closed</h2>
        <ol className="mt-3 space-y-1 text-muted">
          {TEN.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>

        <p className="mt-8 text-muted">
          <a href="/docs">Full docs</a> · <a href="/exchange">Open the desk</a>
        </p>
      </article>
    </main>
  );
}
