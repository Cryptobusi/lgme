# Session handoff — 25 October 2026 (late evening)

Saved for next session.

## Current production tip

### egonomicanonymous.live
- Repo: Cryptobusi/crystal-quartz-valley-beacon
- Branch: main
- HEAD: ebb7207a — "Rewrite Why Must We: proposition first"
- Vercel: dpl_Ciu4aT59u21z2FGXt8NHvfqoMvzM — READY
- Live: https://www.egonomicanonymous.live

### lgme.app
- Repo: Cryptobusi/lgme
- Branch: main
- HEAD: 1de3c074 — "Rewrite Why Must We: proposition first"
- Live: https://lgme.app

## Pages confirmed live

| Page | egonomicanonymous.live | lgme.app | Notes |
|------|------------------------|----------|-------|
| Synthesis | /synthesis | /synthesis | William James / Merovingian / Third Seat. Fully rendered. |
| Why Must We | /why-must-we | /why-must-we | Proposition first. Critical line mandatory; SPP is the invariant reform. |

## lgme.app menu (index.html)
- Top menu is a toggle: click the "Menu" bar to open/close. No Open/Close button.
- Why Must We is in the menu and also appears as a link directly below the ARCHIVE section.

## Build note (critical)
TanStack / Vite on crystal-quartz-valley-beacon fails on non-ASCII characters in route files.
Keep new page content pure ASCII (no Unicode minus, special dashes, Greek, etc.).
The Why Must We page was rewritten to pure ASCII so the build succeeds.

## Earlier issues resolved this session
- lgme.app index.html was briefly corrupted (PLACEHOLDER_FOR_FULL). Restored.
- Intermediate Synthesis and Why Must We deploys failed; final commits are READY.
- Menu toggle implemented without a separate Open/Close button.

## Quick links
- https://www.egonomicanonymous.live/synthesis
- https://www.egonomicanonymous.live/why-must-we
- https://lgme.app/synthesis
- https://lgme.app/why-must-we
- https://lgme.app/

## Open items
None blocking. Menu and both new pages are live and functional.

End of handoff.
