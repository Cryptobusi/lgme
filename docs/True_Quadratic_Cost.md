# True Quadratic Cost

**Status:** Design sketch. Temporary. Revisit at next milestone.  
**Date:** 13 October 2026

---

## Purpose

The current pilot uses the simplest square-root form `V = √C`. A true quadratic cost requires a fixed voice-credit budget per person per epoch, where the cost of casting `C` credits is `C²` and the remaining budget cannot be reused.

---

## Target formula

For each enrolled person `i` in an epoch:

- Fixed voice-credit budget `B_i` (proposal: equal budget for all enrolled persons).
- Credits spent on a vote: `C_i` where `0 ≤ C_i ≤ √B_i`.
- Cost: `C_i²` deducted from `B_i`.
- Voting power: `V_i = C_i` (or `V_i = √(credits spent)` depending on final convention).

The personhood gate (`δ_i`) still applies. Unenrolled or expired persons contribute zero.

---

## Open parameters (must be fixed)

| Parameter | Proposal | Notes |
|-----------|----------|-------|
| Budget size | Equal per enrolled person | Exact number deferred |
| Payment medium | Voice credits only (not tokens) | Prevents wealth amplification |
| Epoch reset | Full reset of remaining budget at epoch boundary | Aligns with score decay note |
| Cost display | Cost shown before confirmation | Public and showable |

---

## Relation to current pilot

The simplest form (`V = √C`) remains in use for the pilot only. It does not enforce a fixed budget or quadratic cost. Both the credential and the formula are marked temporary.

---

## Revisit at next milestone

- Fix the numerical budget size.
- Confirm the exact voting-power convention.
- Specify how remaining budget is shown on the tape.
- Inscribe this note once the parameters are chosen.

An unpublished change is not a change.
