# Enrollment and Sybil Resistance — Design Note

**Status:** Outline for future development.  
**Date:** 12 October 2026  
**Context:** The SPP commentary flags personhood-anchored governance as the right direction, but enrollment and Sybil resistance remain unsolved. This note records the minimal constraints and open questions so the next design pass has a clear starting point.

---

## Goal

One real person → one vote (or one unit of voting power that cannot be cheaply multiplied).  
The third seat is the person. The person must be distinguishable from bots, multiple wallets, and paid Sybils without creating a new central administrator.

---

## Minimal constraints (must hold)

1. **Personhood, not account.** Voting power attaches to a verified person, not to a wallet or key.
2. **No private window.** Enrollment rules and the list of enrolled persons (or their commitments) must be showable. An unpublished enrollment change is not a change.
3. **Sybil cost.** Creating additional identities must be expensive in time, money, or external verification, not merely in wallet generation.
4. **Revocation path.** A person can be removed only by a public, recorded process (not a silent admin key).
5. **Zero-knowledge where possible.** Prove personhood or uniqueness without revealing unnecessary personal data.

---

## Open design questions

- **Credential type:** What external signal is acceptable? (Government ID + ZK proof, biometric commitment, social recovery with stake, proof-of-personhood protocol, or a hybrid.)
- **Epoch boundaries:** How often can a person re-enroll or refresh their credential? How does decay work if a credential expires?
- **Oracle / verifier set:** Who (or what) attests personhood, and how is that attestation itself shown and challengeable?
- **Quadratic cost:** Once personhood is established, the voting formula still needs a true quadratic cost (not just square-root weighting). How is the cost paid and shown?
- **Privacy vs. showability:** How much of the enrollment record is public versus committed and selectively disclosed?

---

## Suggested next steps

1. Choose one minimal viable credential path for a pilot (e.g., ZK proof of a government ID or an existing proof-of-personhood system).
2. Define the public tape entries required for enrollment (commitment, timestamp, verifier signature or proof, revocation status).
3. Draft the exact voting formula that applies a quadratic cost once personhood is proven.
4. Inscribe the design note and any pilot rules on the tape so the enrollment path is itself showable.

---

## Relation to other notes

- Storage substrate: see `Future_Development_Considered_Storage_Options.md` and `Tape_and_Inscription_Plan.md`.
- Barrier checks and L2 amendment path already constrain how enrollment rules can be changed.
- Provenance scores (epochs, decay, non-gameable oracles) are a related but separate open item.

*This is an outline, not a specification. The next design pass should pick one credential path and write the showable rules.*
