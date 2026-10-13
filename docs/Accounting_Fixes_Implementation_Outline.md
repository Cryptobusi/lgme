# Accounting Fixes — Implementation Outline

**Status:** Design sketch. Temporary. Revisit at next milestone.  
**Date:** 13 October 2026

---

## Purpose

Turn the reference sketches in `Accounting_Fixes_Reference.sol` into a concrete implementation outline that can be tested.

---

## Required guards

1. **Zero-division guard** — any claim calculation that divides by total voting power or total attested utility must reject when the denominator is zero.
2. **Unit consistency** — all values that enter a claim (utility scores, voting power, budget remaining) must use the same scale or be explicitly normalized before use.
3. **Epoch-aware last-claimed tracking** — a claim is valid only for the current epoch. A claim recorded in a prior epoch does not block a claim in the current epoch.
4. **Attested inputs only** — `objectiveUtility` and `peerConsensusScore` are read from an attested observation on the tape, never from caller-supplied arguments.

---

## Implementation outline

```
claim(epoch, observation_id):
  1. Require current_epoch == epoch
  2. Load attested observation for observation_id
  3. Require observation.epoch == epoch
  4. Require signature recovers to allow-listed attestor
  5. Require denominator (total voting power or total utility) > 0
  6. Compute claimable = f(observation.objectiveUtility, observation.peerConsensusScore)
  7. Require claimable > 0
  8. Record claim for (subject, epoch)
  9. Emit Claimed event with observation_id and claimable amount
```

---

## Residual trust

- The attestor allow-list must be correctly published.
- The total denominator must be computed from the same attested set.
- No private path can bypass the zero-division or epoch checks.

---

## Revisit at next milestone

- Specify the exact claim formula `f`.
- Define the event schema.
- Add a reference test vector.
- Inscribe this note once the outline is locked.

An unpublished change is not a change.
