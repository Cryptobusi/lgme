# First Person Credentials — Enrollment Path Evaluation

**Status:** Design sketch. Temporary. Revisit at next milestone.  
**Date:** 13 October 2026

---

## Purpose

Evaluate the First Person Credentials approach (demonstrated on Hedera) as a candidate to replace the temporary verified X-handle enrollment credential.

---

## What it is

First Person Credentials use two credential types anchored on Hedera:

- **Personhood Credentials (PHCs)** — issued by recognized entities to attest that the holder is a unique verified person within that ecosystem.
- **Verifiable Relationship Credentials (VRCs)** — peer-to-peer credentials exchanged between PHC holders that cryptographically prove real-world connections.

A March 2026 public demonstration by Hedera and DSR Corporation (under Hiero / LF Decentralized Trust) showed the pattern: in-person exchange of VRCs followed by presentation of a proof of personhood to a verification portal. The stack used Hyperledger AnonCreds, a Hedera-rooted DID method, and Hedera Consensus Service as the verifiable data registry.

---

## How it could serve enrollment

1. User obtains a PHC (or accumulates sufficient VRCs) from a recognized issuer or peer network.
2. User links the credential to a Hedera wallet by signing a message whose format is published on the tape.
3. The link (credential reference + wallet + signature) is written to the tape.
4. Voting or yield claims require an active, unrevoked personhood credential that resolves to an attested record.

---

## Residual trust assumption

The scheme requires that:

- Initial PHC issuers do not issue credentials to the same person more than once, and
- The social or in-person verification step (VRC exchange) is not systematically gamed by coordinated groups.

If those assumptions fail, one person can obtain multiple valid credentials. The residual trust is therefore in the issuer set and the integrity of the relationship graph, not in a biometric database or a single platform.

This is stronger than a paid social-media verification but weaker than a hardware-rooted biometric uniqueness check.

---

## Comparison to current pilot

| Aspect | X-handle pilot | First Person Credentials |
|--------|----------------|--------------------------|
| Uniqueness | Weak (paid accounts) | Stronger (issuer + relationship graph) |
| Privacy | Low | Higher (ZK-capable credentials) |
| Native to Hedera | No | Yes (demo on HCS) |
| Residual trust | X platform | PHC issuers + VRC graph |
| Status | Temporary test | Candidate for next milestone |

---

## Revisit at next milestone

- Confirm whether a production or open issuer set exists for PHCs.
- Specify the exact signed-message format that binds a PHC or VRC set to a wallet.
- Define the minimum relationship threshold (if any) required for enrollment.
- Inscribe this note once the choice is made or rejected.

An unpublished change is not a change.
