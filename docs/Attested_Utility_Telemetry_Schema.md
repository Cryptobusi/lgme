# Attested Utility Inputs — Telemetry Schema

**Status:** Design sketch. Temporary. Revisit at next milestone.  
**Date:** 13 October 2026

---

## Purpose

`objectiveUtility` and `peerConsensusScore` must come from attested sources, not from the caller. This note specifies one concrete telemetry schema that can supply those values.

---

## Schema

Each attested observation is a JSON object with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `observation_id` | string | yes | Unique identifier for this observation |
| `subject` | string | yes | Wallet or agent address being measured |
| `epoch` | string | yes | Epoch identifier (e.g. `2026-10`) |
| `objectiveUtility` | number | yes | Objective utility score (0–1 or raw units) |
| `peerConsensusScore` | number | yes | Peer consensus score (0–1) |
| `source` | string | yes | Source type (`telemetry` or `jury`) |
| `attestor` | string | yes | Wallet or topic that attests the observation |
| `timestamp` | integer | yes | Unix timestamp of the observation |
| `signature` | string | yes | Signature over the canonical message |
| `signed_message` | string | yes | Exact message that was signed |

---

## Signed-message format (exact)

```
lgme attested utility
observation_id: <id>
subject: <wallet>
epoch: <epoch>
objectiveUtility: <number>
peerConsensusScore: <number>
source: <telemetry|jury>
timestamp: <unix>
```

The attestor signs this message. Both the exact message and the signature are written to the tape.

---

## Source rules

- **Telemetry:** values derived from on-chain or off-chain measurements that are themselves attested (e.g. usage counts, settlement success, public signals). The attestor must be a designated measurement topic or oracle.
- **Jury:** values produced by a small, publicly selected jury whose selection method and votes are recorded on the tape. Jury size and selection are left open for the next milestone.

Caller-supplied values are rejected. An observation is valid only if the signature recovers to the declared `attestor` and the attestor is on the published allow-list for that epoch.

---

## Residual trust

- Telemetry attestors must not fabricate measurements.
- Jury members must not collude.
- The allow-list of attestors is itself published on the tape and cannot be changed without a recorded amendment.

---

## Revisit at next milestone

- Finalize jury selection method and size.
- Specify the exact allow-list update path.
- Define the units and range for `objectiveUtility` and `peerConsensusScore`.
- Inscribe this note once the schema is locked.

An unpublished change is not a change.
