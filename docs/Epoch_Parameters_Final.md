# Epoch Parameters

**Status:** Design sketch. Temporary. Revisit at next milestone.  
**Date:** 13 October 2026

---

## Purpose

Lock the epoch length and the decay/reset rules so that scores and budgets have a clear boundary.

---

## Recommended parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Epoch length | 30 days | Aligns with prior epoch boundaries note |
| Score decay | Full reset at epoch boundary | No partial carry-over |
| Voice-credit budget reset | Full reset to 3 | Matches True Quadratic Cost note |
| Observation validity | Bound to declared epoch | Expired observations ignored |
| Amendment cycle | One full public cycle + second reading | Unchanged L2 rule |

---

## Boundary rule

An epoch ends at 00:00 UTC on the first day of the next month. All claims, votes, and observations recorded after that timestamp belong to the new epoch. A missing timestamp writes nothing.

---

## Residual trust

- The clock source used for the boundary must be publicly checkable.
- No private path can extend an epoch or carry scores across the boundary without a recorded amendment.

---

## Revisit at next milestone

- Confirm 30-day length or switch to calendar month.
- Confirm full reset versus a published decay factor.
- Inscribe this note once the parameters are locked.

An unpublished change is not a change.
