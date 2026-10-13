# Tape and Inscription Plan

**Status:** Ready for execution.  
**Date:** 12 October 2026  
**Purpose:** Make the current canonical set permanent and verifiable on Hedera via KiloScribe (HCS-1), then publish the topic IDs / HRLs as the official tape.

Aligns with: *if it cannot be shown, it is not policy* and *an unpublished change is not a change*.

---

## Canonical set to inscribe first

Inscribe these as separate HCS-1 topics (or one combined archive if preferred):

1. `docs/Sovereign_Provenance_Protocol_Whitepaper.md`
2. `docs/Sovereign_Provenance_Protocol_Commentary.md`
3. `docs/Barrier_Checks.md`
4. `docs/Nested_Commitment.md` (or the order rules excerpt)
5. A short status snapshot (current site status as of inscription date)

Optional later: review doc, presentation, and future barrier-check updates.

---

## How to inscribe (KiloScribe)

1. Go to [kiloscribe.com](https://kiloscribe.com) and connect a Hedera wallet with a small HBAR balance.
2. Choose HCS-1 inscription (no admin key).
3. Upload the file(s).
4. Review network, estimated fee, and options.
5. Sign and submit.
6. Record the resulting **topic ID** and **HRL** (`hcs://1/<topic-id>`).
7. Verify retrieval via the public CDN or HRL.

Cost for these documents is typically well under a few dollars total.

---

## After inscription — update the Tape

Once topic IDs are obtained, add them to the site:

- Replace the placeholder entries in the new **Tape** section on the homepage.
- Optionally create a dedicated `/tape` page or append to this document.
- Keep the friendly site as the front end; the inscriptions are the source of truth.

### Placeholder format (to be filled)

```
Whitepaper     → topic: ___________   HRL: hcs://1/___________
Commentary     → topic: ___________   HRL: hcs://1/___________
Barrier checks → topic: ___________   HRL: hcs://1/___________
Status snapshot→ topic: ___________   HRL: hcs://1/___________
```

---

## Next automation step

After the first manual inscriptions, prototype a small script or bot that:
- Takes a new barrier-check or status update,
- Inscribes it via the KiloScribe API/SDK,
- Appends the topic ID to the tape.

This keeps the book ordered and non-rewritable without manual steps for every update.

---

*This plan is ready. Execute the inscriptions, then update the Tape section with the live topic IDs.*
