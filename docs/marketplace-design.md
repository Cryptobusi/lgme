# Marketplace on the lgme desk

SIMULATION. This is a practice market inside `/p2p-exchange-sim`. Nothing here writes to a network, anchors a public chain, sends a message, or moves real money. Each peer keeps their own book. There is no central ledger and no second token.

The page already has separate books, ECDSA P-256 signatures, a hash-linked tape, floors, a third seat, simulated 2FA, and a verified / unverified member check. The market uses those rules. It does not add a new kind of money.

## What changed from the OfferUp notes

The source notes described a local-first market. Several pieces do not fit this desk, so they are replaced here:

- Signatures are ECDSA P-256 with SHA-256, the keys this desk already generates. A second signature scheme is not introduced.
- “Public consensus anchoring” is the local hash-linked tape. A listing’s origin hash and each signature are appended to the signer’s own tape. There is no chain, no topic, and no remote witness.
- The source notes named a public reputation number. This desk does not. Cards and profiles show **Peer standing**, a number from the local book: verification, how many lines have cleared, and whether the balance sits above the floor. It is not a rating other people can edit, and it does not spend or mint.
- Circles are mutual-credit rings or peer groups (Walkway, Soil, Logistics, or a name the member types). They are not a map. An optional short area phrase is text only. The page does not read GPS.
- A deal that would take the floor is refused with **Blocked: Floor stays senior**. An unverified member still cannot send, or hold, more than 20 $lgme in total.
- A no at any step is a third-seat refusal. It is written, it moves no balance, and it carries no penalty. It does not unwind a line that already settled. Silence is not a refusal.
- Photos are compressed in the browser and kept on the listing in local storage. The tape stores the photo hash, not the picture. No image is uploaded.
- Dollar figures from the DC reference list are a suggestion beside the $lgme value. They are not a price and they are not collected.
- Identity stays the simulated member check already on the desk: a display name, a 6-digit code, and a vouch from a verified member. External credential formats, card checkout, and other credit platforms are out of scope.

## Path

Discover → open the item → chat and counter → both sign → pending hold → dual-sign handoff → both tapes.

1. The market is an ad-free two-column grid: photo, title, $lgme value, verified badge, circle, and peer standing.
2. Category pills, search, and filters for value, condition, pickup, and circle.
3. A chat starts with two short pills (“Is this available?”, “Make an offer”), then Offer, Counter, and Accept & Sign.
4. Both signatures create one pending hold. The buyer’s debit is held. The seller’s credit stays pending. Replay of the tape does not move the final balance yet.
5. The buyer shows a single-use QR of the signed acknowledgment. The seller scans it, or pastes it, and countersigns. Settlement then posts a transfer on both tapes and the hold drops.
6. Cancel, expiry, or a refusal releases the hold. The final balances stay where they were.

Same-device settlement is a button on the buyer’s chat when the seller’s book is on this browser. Cross-device settlement reuses the existing code, QR, and file path. The page still does not send the message.

## Listing

Three steps, then a signature:

1. Photo, from the camera or a file. The browser scales it down and keeps the result locally.
2. Title, category, condition, and pickup terms, plus a circle and an optional area phrase.
3. A value in $lgme. A DC reference row can be attached as “Reference only, not a price.”

The signed core is the seller id, title, category, condition, pickup, circle, area, amount, optional reference id, and the photo hash. The origin hash is SHA-256 of that core in canonical form. The seller signs the origin hash with their peer key. The listing id is the origin hash.

A listing lasts 14 days. It leaves the feed when that time has passed. Refresh writes a signed heartbeat on the seller’s tape and extends the listing by another 14 days. A listing that fails the origin hash or the signature is not shown as verified.

Categories: Goods, Services, Household, Food, Tools. Condition: New, Good, Fair, For parts. Pickup: Pickup, Porch, Meet.

## Offer, hold, handoff

An offer or a counter names an amount in $lgme. The party who names it signs that amount. A later counter replaces the amount and clears the other signature, because the terms changed. Accept & Sign adds the missing signature. When both signatures match the same amount, the desk writes a HOLD on both tapes.

The hold counts against the buyer’s available balance and against the unverified send limit. The floor check uses the balance after open holds. A blocked offer is not written as a hold.

The handoff body carries the thread, the hold id, the amount, and a single-use nonce, signed by the buyer. The seller’s countersignature settles it. A second presentation of the same nonce does not settle again. Settlement appends HANDOFF, which releases the hold, and a transfer on each tape: out on the buyer, in on the seller.

## Profile

A profile reads only the local book:

- Clearing history: how many transfers, settlements, and completed handoffs are on the tape.
- Credit use versus the floor: the replayed balance, the floor, and how close the two are.
- Account age, from the genesis line.
- Verification status, from the member check.
- Peer standing, as defined above.

## Navigation

The phone bar is Market, Circles, List (+), Chats, and Wallet. Help and Resources stay one tap away from Wallet and from the Help tab on a wide screen. Ledger, Exchange, Send, and Reconcile stay available from Wallet. The orange theme, the member check, the 6-digit code, and the floor do not change.

## Demo

Resetting the demo restores Alice, Bob, and Charlie as verified members and adds a few listings in their circles, plus one open negotiation and one pending handoff so the chat and the QR can be tried without typing a listing first.
