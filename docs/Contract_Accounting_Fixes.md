# Contract Accounting Fixes

**Status:** Design sketch. Temporary. Revisit at next milestone.  
**Date:** 13 October 2026

---

## Purpose

The whitepaper contracts contain concrete accounting issues that must be closed before any deployment. This note records the required fixes so they remain showable.

---

## Required fixes

1. **Zero-division guard**  
   `BasketTreasury.claimYieldAllocation` divides by `globalTotal`. Add a require that `globalTotal > 0` (or return zero).

2. **Unit consistency**  
   Do not mint ERC-20 tokens equal to a share of an ETH `accumulatedYieldPool` without an explicit conversion or unit declaration. State the unit of the yield pool and the unit of the minted claim.

3. **Epoch-aware last-claimed tracking**  
   Current last-claimed tracking subtracts scores but never resets or epochs them. Align with epoch boundaries so claims cannot drift across epochs. Reset or snapshot the relevant score at each epoch close.

4. **Caller-supplied scores**  
   `ProvenanceEngine` accepts `objectiveUtility` and `peerConsensusScore` from the caller. Require these values to come from attested inputs (telemetry schema or jury) rather than arbitrary caller arguments.

5. **Admin / Ownable paths**  
   Several contracts remain Ownable or grant admin roles. Time-lock or remove paths that contradict the stated sovereignty goals (no silent freeze or upgrade). Any remaining admin action must be public and recorded.

---

## Relation to other notes

- Epoch boundaries: see `Epoch_Boundaries_and_Score_Decay.md`.
- Enrollment and voting: see `Enrollment_Design_Note.md`.
- Barrier checks already constrain silent amendment.

---

## Revisit at next milestone

- Implement the five fixes in any reference contracts.
- Add unit tests that fail if the guards are removed.
- Inscribe this note once the fixes are specified in code.

An unpublished change is not a change.
