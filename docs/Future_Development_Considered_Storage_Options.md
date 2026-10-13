# Future Development Considered — Permanent & Verifiable Storage Options

**Status:** Reference note for future development.  
**Date compiled:** 12 October 2026  
**Context:** Evaluation of options for making the “book” (protocol documents, barrier checks, rule snapshots, and utility attestations / Recorded Presentations) permanent, verifiable, and resistant to silent revision. Aligns with the principle: *if it cannot be shown, it is not policy* and *an unpublished change is not a change*.

This note compiles a review of KiloScribe (Hedera HCS / Hashinals) and comparisons with Arweave, IPFS, and Filecoin.

---

## KiloScribe Review (Hedera Hashgraph / HCS)

KiloScribe is a no-code (and API-driven) inscription workspace on Hedera that turns ordinary files into permanent, on-graph **Hashinals** via the Hedera Consensus Service (HCS).

**Key capabilities:**
- Any file type (images, video, audio, HTML, metadata, entire sites/games).
- Clear three-step flow: add file → review network/fees/options → sign and leave with a topic ID + provenance trail + shareable link.
- Built on published standards, especially **HCS-1** (chunked file storage with SHA-256 hash in the topic memo, submit key required, **no admin key** so the data cannot be deleted or rewritten) and **HCS-5** (Hashinals/NFTs).
- Retrieval through a public CDN and Hedera Resource Locators (HRLs of the form `hcs://1/<topic-id>`).
- Additional features: recursive/dynamic content (HCS-3/HCS-6), decentralized LinkPages, on-graph games, and an inscription API.

**Strengths for lgme:**
- Protocol-level immutability for valid HCS-1 inscriptions.
- Ordered, timestamped consensus log with clear provenance.
- Very low cost for documents and modest files (HCS message ~$0.0008 after the 2026 fee update; small whitepapers typically under $1–2).
- Excellent no-code workspace + clean API/SDK for integration.
- Directly supports the “tape” metaphor and “Recorded Presentations.”

**Limitations:**
- Hedera is council-governed (known nodes). Excellent practical infrastructure, but not maximally permissionless.
- Does not itself execute governance or treasury logic (serves as durable data substrate).

**Recommendation:** Strong default for operational tape (status updates, barrier checks, rule versions, user presentations). Cheap, simple, ordered, and non-rewritable without renewal.

---

## Comparison: KiloScribe vs Arweave vs IPFS vs Filecoin

| Aspect | KiloScribe (Hedera HCS) | Arweave | IPFS (alone) | Filecoin |
|--------|-------------------------|---------|--------------|----------|
| **Permanence** | Immutable HCS topics (no admin key). Survives as long as the network does. | One-time payment into endowment designed for ~200+ years under storage-cost decline assumptions (Kryder+). | None by default. Requires continuous pinning. | Time-bounded deals that must be renewed. Verifiable while the deal is active. |
| **Cost model** | Pay-per-message (~$0.0008). Extremely cheap for documents. | One-time upfront (~$10–20/GB recently, AR-denominated and volatile). | Free to add; persistence via recurring pinning fees. | Recurring marketplace rates. ~$2.50/TiB/month per copy (Filecoin Pin / Onchain Cloud). Very cheap for bulk. |
| **Integrity / addressing** | SHA-256 in topic memo + ordered timestamps. HRL. | Transaction ID + content addressing. | CID (content hash). Excellent verification. | On-chain cryptographic proofs of possession (daily in modern tools). Interoperates with IPFS CIDs. |
| **Retrieval** | Public CDN + HRL. Fast for typical sizes. | Gateways (ar.io etc.). | Gateways or native nodes. Speed depends on pinning/caching. | Via IPFS gateways once pinned; proofs are on-chain. |
| **Best for** | Ordered, timestamped, low-cost permanent logs and small-to-medium artifacts. | High-value permanent archives where “pay once, store forever” is the priority. | Content addressing, distribution, caching. | Large datasets, cost-sensitive bulk storage, verifiable IPFS persistence. |
| **Operational overhead** | Low (no-code or simple API). | Low once uploaded (bundlers help). | Medium (manage pins). | Medium–high historically; lower with Filecoin Pin (automates proofs and payments). |
| **Governance** | Council-governed high-throughput network. | More permissionless miner set; permanence rests on endowment economics. | Open protocol; persistence usually depends on commercial services or Filecoin. | Marketplace of independent storage providers. |

### Practical ranking for lgme core needs (canonical documents + utility attestations)

1. **KiloScribe / Hedera HCS** — Best default. Cheapest for this scale, ordered timestamps, true immutability without renewal, simple UX and API.
2. **Arweave** — Strong alternative or complementary layer if multi-century economic permanence for a small set of high-value files is the priority.
3. **Filecoin (via Filecoin Pin)** — Useful if IPFS CIDs + cryptographic daily proofs are desired, or if volume grows large. Treat as durable pinning layer rather than sole source of truth.
4. **Plain IPFS** — Good for distribution and familiar content addressing, but weakest permanence guarantees on its own.

### Recommended pattern
- Make the canonical versions permanent on KiloScribe (or Arweave) for the durable, ordered, non-renewable record.
- Optionally also pin the same files on Filecoin/IPFS for broader reach and extra verification.
- Publish both the HRL/topic ID and the CID. The ordered non-renewable layer is the source of truth that best matches “the book.”

Neither option replaces the governance or treasury logic in the Sovereign Provenance Protocol; all function as durable substrates underneath it.

---

## Suggested next steps (if pursued)

1. Inscribe the current canonical set of documents (SPP whitepaper, commentary, barrier checks, order rules, status snapshot) on KiloScribe and publish the resulting topic IDs / HRLs as authoritative references.
2. Add a short “Provenance” or “Tape” section on the site listing active topic IDs and how to verify them.
3. Optionally mirror the highest-value artifacts to Arweave as secondary permanence insurance.
4. Prototype one automated flow (status or barrier-check update) using the KiloScribe SDK/API.
5. Keep the existing site as the friendly front end; treat inscriptions as the source of truth.

---

*Compiled for reference. Costs and fee schedules are approximate as of October 2026 and subject to change. This note does not constitute a recommendation to adopt any specific system; it records options considered for future development.*
