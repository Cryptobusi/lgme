# Attested Utility Inputs

**Status:** Design sketch. Temporary. Revisit at next milestone.  
**Date:** 13 October 2026

---

## Purpose

Provenance Scores must not accept arbitrary caller-supplied values for `objectiveUtility` and `peerConsensusScore`. Both inputs must come from attested sources that are themselves showable on the tape.

---

## Required inputs

| Input | Source | Requirement |
|-------|--------|-------------|
| `objectiveUtility` | Telemetry schema or hardware attestation | Must reference a public schema and a signed measurement or oracle report |
| `peerConsensusScore` | Jury or peer attestation | Must reference a public jury selection or peer-vote record |

Caller-supplied raw numbers are rejected.

---

## Telemetry schema (minimal)

A measurement record on the tape must include:

- schema_id (public identifier of the measurement type)
- value (numeric)
- unit
- timestamp
- attestation (signature or proof from device, oracle, or jury)
- subject (presentation or action identifier)

---

## Jury / peer path

- Jury selection or peer set is recorded before scoring.
- Score is the result of a public process (vote, median, or stated aggregation).
- Outcome is written to the tape with the evidence reference.

---

## Enforcement

- Contracts accept only attested input references (topic IDs or hashes), not raw numbers.
- A presentation whose utility or consensus cannot be resolved to an attested record receives zero score for that component.
- Challenge path (see Epoch Boundaries note) can reduce a score if the underlying attestation is later invalidated.

---

## Revisit at next milestone

- Specify one concrete telemetry schema.
- Define jury selection method (VRF or other).
- Inscribe this note once the schema and jury rules are fixed.

An unpublished change is not a change.
