# Enrollment and Sybil Resistance — Design Note

**Status:** Outline for future development. Pilot credential chosen. Tape schema defined. Simplest quadratic form in use as test.  
**Date:** 13 October 2026  
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

## Pilot credential (temporary)

**Chosen for test:** Verified X (Twitter) handle linked to a wallet by a signed message, recorded on the tape.

**Disclaimer:** This is a low-friction temporary pilot only. A verified X handle is not proof of unique personhood. One person can control multiple verified accounts; accounts can be bought, sold, or rented; verification is a paid subscription to X. It does not satisfy the Sybil-resistance requirements above. It will be revisited and replaced at the next milestone. An unpublished change is not a change.

---

## Public tape entries (X-handle pilot)

| Field              | Required | Description                                      |
|--------------------|----------|--------------------------------------------------|
| credential_type    | Yes      | Must be `x-verified-handle`                      |
| handle             | Yes      | X username (no @)                                |
| wallet             | Yes      | Hedera account ID or address                     |
| signed_message     | Yes      | Proof of control (see format below)              |
| signature          | Yes      | Signature over the message                       |
| timestamp          | Yes      | Unix seconds when recorded                       |
| status             | Yes      | `active` or `revoked`                            |
| revocation_reason  | Optional | If status = revoked                              |
| note               | Optional | Must include “temporary pilot”                   |

An unpublished enrollment change is not a change.

---

## Signed-message format

Plain text, exact match required:

```
lgme enrollment pilot
handle: <username>
wallet: <hedera-account-or-address>
timestamp: <unix-seconds>
```

The holder signs this message with the wallet key. The signature and the exact message are both written to the tape.

---

## Voting formula — current test (simplest)

For the present pilot the simplest square-root form is used:

\[
V_i = \sqrt{C_i}
\]

\[
V_{\text{total}} = \sum_i \sqrt{C_i} \cdot \delta_i
\]

where \(C_i\) is a non-negative number the person assigns to the proposal and \(\delta_i = 1\) only if the person has an active enrollment record (otherwise 0).

**This is not a true quadratic cost.** It is square-root weighting only. There is no fixed voice-credit budget and no rising cost of additional votes. It is used solely as the simplest testable form. It will be replaced by a true quadratic-cost formula at the next milestone.

---

## Target quadratic formula (for next milestone)

Once a stronger personhood credential exists, replace the test formula with:

\[
V_i = \sqrt{C_i}
\]

where the cost of spending \(C_i\) voice credits is \(C_i^2\) units of a fixed, equal, non-transferable budget allocated per person per epoch. All spends recorded on the tape.

---

## Revisit at next milestone

The following temporary items must be replaced or upgraded:

1. **Enrollment credential** — verified X handle (current pilot). Replace with a stronger uniqueness signal (ZK government ID, existing PoP system, or hybrid).
2. **Voting formula** — simplest square-root weighting (current test). Replace with true quadratic cost (fixed budget, cost = credits²).
3. Any other pilot shortcuts that do not meet the minimal constraints above.

An unpublished change is not a change.

---

## Open design questions

- **Credential type:** What external signal is acceptable? (Government ID + ZK proof, biometric commitment, social recovery with stake, proof-of-personhood protocol, or a hybrid.)
- **Epoch boundaries:** How often can a person re-enroll or refresh their credential? How does decay work if a credential expires?
- **Oracle / verifier set:** Who (or what) attests personhood, and how is that attestation itself shown and challengeable?
- **Quadratic cost:** Once personhood is established, the voting formula still needs a true quadratic cost (not just square-root weighting). How is the cost paid and shown?  
  *Target formula sketched above; budget size and payment medium still open. Current test uses simplest form.*
- **Privacy vs. showability:** How much of the enrollment record is public versus committed and selectively disclosed?

---

## Suggested next steps

1. Choose one minimal viable credential path for a pilot (e.g., ZK proof of a government ID or an existing proof-of-personhood system).  
   *Current pilot uses verified X handle; stronger path still required.*
2. Define the public tape entries required for enrollment (commitment, timestamp, verifier signature or proof, revocation status).  
   *Done for the X-handle pilot.*
3. Draft the exact voting formula that applies a quadratic cost once personhood is proven.  
   *Simplest form in use as test; true quadratic cost targeted for next milestone.*
4. Inscribe the design note and any pilot rules on the tape so the enrollment path is itself showable.

---

## Relation to other notes

- Storage substrate: see `Future_Development_Considered_Storage_Options.md` and `Tape_and_Inscription_Plan.md`.
- Barrier checks and L2 amendment path already constrain how enrollment rules can be changed.
- Provenance scores (epochs, decay, non-gameable oracles) are a related but separate open item.

*This is an outline, not a specification. Temporary pilot items (X-handle credential and simplest voting formula) must be revisited at the next milestone.*
