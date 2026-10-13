# Epoch Boundaries and Score Decay

**Status:** Design sketch. Temporary. Revisit at next milestone.  
**Date:** 13 October 2026

---

## Purpose

Provenance Scores must not be permanent. Without decay or epoch reset, early or inflated scores lock in yield share indefinitely. Scores must be bounded by public epochs and challengeable.

---

## Epoch definition

- An epoch is a fixed public period (proposal: 30 days).
- Epoch boundaries are recorded on the tape.
- At each boundary:
  - Existing scores decay by a public factor (proposal: 50% retention, or full reset).
  - New score accumulation begins for the next epoch.
  - Yield claims use only the score balance at the close of the prior epoch.

---

## Decay / reset options

| Option | Description | Notes |
|--------|-------------|-------|
| Full reset | Scores zero at epoch end | Simplest; highest incentive to re-contribute |
| Decay (e.g. 50%) | Score × factor carried forward | Smoother; still bounds permanence |
| Challenge reduction | Successful challenge reduces score by stated amount | Must be public and recorded |

Current test: full reset at epoch boundary until a decay factor is chosen.

---

## Challenge path

A score may be reduced only by a public challenge recorded on the tape:

- Challenger posts evidence and proposed reduction.
- Challenge window (proposal: 72 hours).
- Outcome (accepted / rejected) is written to the tape.
- Accepted reduction is applied before the next yield claim.

No silent admin reduction.

---

## Relation to voting formula

The personhood gate (\(\delta_i\)) and voice-credit budget (when true quadratic cost is adopted) are also epoch-scoped. An enrollment or budget that expires at epoch end must be re-established.

---

## Revisit at next milestone

- Confirm epoch length.
- Choose decay factor or confirm full reset.
- Specify exact challenge evidence format and jury (if any).
- Inscribe this note once finalized.

An unpublished change is not a change.
