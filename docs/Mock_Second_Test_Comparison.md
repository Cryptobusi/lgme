# Mock Second Test — Comparison with First

**Status:** Mock. Temporary. Revisit at next milestone.  
**Date:** 13 October 2026

---

## Purpose

Compare a mock second enrollment/voting test against the first public enrollment example, with comments on what changed and what remains temporary.

---

## First test (reference)

- Credential: verified X handle linked by signed message.
- Voting: simplest form `V = √C` (no fixed budget).
- Tape entry: credential_type, handle, wallet, signed_message, signature, timestamp, status.
- Result: pattern practiced; no meaningful Sybil resistance; formula not quadratic.

**Comment:** Useful only to prove the tape-recording path works. Marked temporary from the start.

---

## Mock second test

| Element | First test | Mock second test | Comment |
|---------|------------|------------------|---------|
| Credential | X-verified handle | First Person Credential (PHC + VRC) | Stronger uniqueness; residual trust in issuers and relationship graph. |
| Voting formula | `V = √C` | Fixed budget of 3; cost = `C²` | True quadratic cost; budget resets each epoch. |
| Utility inputs | Caller-supplied (rejected) | Attested observation (signed schema) | Numbers come from tape, not from the voter. |
| Epoch | Unbounded | 30-day full reset | Scores and budget clear at boundary. |
| Claim path | Reference sketches | Implementation outline with zero-division and epoch guards | Closer to testable code. |

---

## What the mock shows

The second test still uses the same tape. The difference is that every input (personhood, votes, utility, epoch boundary) is now required to be showable and attested. An unpublished change is still not a change.

---

## Residual gaps (still temporary)

- PHC issuer set is not yet production.
- Jury selection for peerConsensusScore is sketched, not live.
- Claim formula `f` is not yet fixed.
- No on-chain enforcement of the zero-division or epoch guards.

---

## Revisit at next milestone

- Replace mock with a real second enrollment that uses the stronger credential and attested inputs.
- Inscribe this comparison once the second test is run or abandoned.

An unpublished change is not a change.
