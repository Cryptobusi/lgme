export const ARTICLES = [
  {
    id: 'resources-people',
    kicker: 'The desk',
    title: 'Alice, Bob, and Charlie',
    deck: 'Three people. Floor first. The same rules for each.',
    blocks: [
      { type: 'p', text: 'This is the recorded explainer, kept inside the app.' },
      { type: 'p', text: 'Alice: “I put the walkway clearing and the books on the desk. Floor first.”' },
      { type: 'p', text: 'Bob: “Soil credits are ready. Same rules for me as for anyone.”' },
      { type: 'p', text: 'Charlie: “Logistics is on the shelf. I’ll refuse anything I can’t see.”' },
      { type: 'p', text: 'The explainer’s starting balances were Alice +120, Bob −45, Charlie −75, and the sum was 0.00. The desk you are using now starts Bob at 80 and Charlie at 70, so both begin above their floors.' }
    ]
  },
  {
    id: 'resources-exchanges',
    kicker: 'The fifteen',
    title: 'Fifteen exchanges',
    deck: 'Fourteen lines that can be shown, one refusal, one still open.',
    blocks: [
      { type: 'pre', text: '1 Alice→Bob 75  Soil credits\n2 Bob→Charlie 40  Logistics\n3 Charlie→Alice 55  Walkway + tools\n4 Alice→Charlie 30  Books + childcare\n5 Bob→Alice 25  Tomato starts\n6 Charlie→Bob 35  Bike maintenance\n7 Alice→Bob 20  Childcare reciprocity\n8 Bob→Charlie 15  Film support\n9 Charlie→Alice 45  Sourdough\n10 Alice→Charlie 18  Desk time\n11 Bob→Alice 12  Pull saw\n12 Charlie→Bob 22  Seedlings\n13 Alice→Bob 28  Cello support\n14 Bob→Charlie 16  Ride share  → REFUSED\n15 Charlie→Alice 10  Bookkeeping  → OPEN' }
    ]
  },
  {
    id: 'resources-dashboard',
    kicker: 'After the refusal',
    title: 'Settled dashboard',
    deck: 'The ride share never posted. The bookkeeping line stayed open.',
    blocks: [
      { type: 'table', headers: ['Person', 'Start', 'Settled now', 'Status'], rows: [
        ['Alice', '+120', '+96', 'Positive'],
        ['Bob', '−45', '+43', 'Positive'],
        ['Charlie', '−75', '−107', 'Within limit'],
        ['System', '0', '0.00', 'Zero-sum held']
      ] },
      { type: 'p', text: 'Refusal of the 16-unit ride share never posted. The open 10-unit item was still pending. Floor stays senior. Not written to Hedera.' }
    ]
  },
  {
    id: 'resources-remarks',
    kicker: 'After the refusal',
    title: 'What each person said',
    deck: 'The book is clear where it was shown. The open item is still waiting.',
    blocks: [
      { type: 'p', text: 'Alice +96. “Book is clear on my side. Open item still waiting.”' },
      { type: 'p', text: 'Bob +43. “The refusal was right. Nothing unclear moved.”' },
      { type: 'p', text: 'Charlie −107. “I refused what I couldn’t see. The 10 units stay open.”' }
    ]
  },
  {
    id: 'resources-refusal',
    kicker: 'Closed',
    title: 'The refusal',
    deck: 'Bob to Charlie, 16 units. Nothing taken.',
    blocks: [
      { type: 'p', text: 'Bob → Charlie, 16 units, ride share coordination. Charlie: “Could not be shown.” Nothing was taken. The no stays. It does not move a balance and it carries no penalty.' }
    ]
  },
  {
    id: 'resources-open',
    kicker: 'Still open',
    title: 'The unresolved line',
    deck: 'Charlie to Alice, 10 units. Either side may show it or refuse it.',
    blocks: [
      { type: 'p', text: 'Charlie → Alice, 10 units, final bookkeeping review. It is still waiting. Either side may show the work or refuse it. An open line is not a settled line.' }
    ]
  },
  {
    id: 'resources-resolve',
    kicker: 'Procedure',
    title: 'How an open item is resolved',
    deck: 'Show it, or refuse it. The tape records which.',
    blocks: [
      { type: 'list', items: [
        'The open item stays on the desk. The person keeps the book.',
        'Either side can show the clear record of the work, or refuse it.',
        'If shown and accepted, the 10 units move. Charlie −10, Alice +10. The sum stays zero.',
        'If refused, the refusal is written and nothing moves.',
        'The result is recorded on the local tape. Not written to Hedera.'
      ] },
      { type: 'p', text: 'Floor stays senior. Not written to Hedera.' }
    ]
  },
  {
    id: 'resources-simulator',
    kicker: 'The other desk',
    title: 'Mutual credit',
    deck: 'The same floor, the same refusal, a tape you can export.',
    blocks: [
      { type: 'p', text: 'Mutual credit is a separate page. Balances are replayed from an append-only hash-linked tape. A line that would spend the floor is stored as Blocked: Floor stays senior. A third-seat decline is a refusal: nothing moves, and there is no penalty. Reference figures are suggestions, not prices. Not written to Hedera.' },
      { type: 'link', href: '/mutual-credit', text: 'Open mutual credit' },
      { type: 'link', href: '/how-it-works', text: 'Open how it works' },
      { type: 'link', href: '/docs/SPP_Overview.pptx', text: 'Slides from the explainer' }
    ]
  },
  {
    id: 'resources-manifest',
    kicker: 'Framing',
    title: 'Deployment manifest',
    deck: 'Design research. Not written to Hedera.',
    blocks: [
      { type: 'p', text: 'The deployment manifest is design research. Not written to Hedera. This app keeps each book in the browser.' },
      { type: 'link', href: '/deployment-manifest', text: 'Read the deployment manifest' }
    ]
  },
  {
    id: 'resources-third-seat',
    kicker: 'The person',
    title: 'The third seat',
    deck: 'Read the order. Refuse a line that skipped it. The no stays.',
    blocks: [
      { type: 'p', text: 'The third seat is the person who can read a posted order and refuse a line that skipped it. The refusal is a record. It does not mint and it does not spend. The person who refuses is bound by the same order. It is not an office, and it does not freeze a line that was already shown. Silence is not a refusal.' },
      { type: 'link', href: 'https://www.egonomicanonymous.live/third-seat', text: 'The third seat, on egonomicanonymous.live' },
      { type: 'link', href: '/the-third-seat', text: 'The third seat, on this site' }
    ]
  },
  {
    id: 'resources-market',
    kicker: 'The market',
    title: 'Market',
    deck: 'List, chat, hold, and hand off. The books stay on this device.',
    blocks: [
      { type: 'p', text: 'Beta. The market is this desk. A listing is signed with the peer key. The origin hash is the listing id. Photos are compressed in the browser and stay there. The tape stores the hash, not the picture. Agreed $lgme payments are signed by your Solana wallet. This desk does not write to Hedera.' },
      { type: 'p', text: 'An offer, a counter, and Accept & Sign put a pending hold on both tapes. The buyer’s debit is held and the seller’s credit is pending. Final balances do not move until both people sign the handoff. Cancel or expiry releases the hold.' },
      { type: 'p', text: 'A refusal at any step is a third-seat refusal. It is recorded. It moves no balance and carries no penalty. It does not unwind a line that already settled.' },
      { type: 'p', text: 'Circles are mutual-credit rings, not a map. Peer standing is read from the local book: verification, clearing history, and whether the balance sits above the floor. A line that would take the floor is blocked: Floor stays senior. An unverified member cannot send or hold more than 20 $lgme. A dollar figure from the reference list is a suggestion, not a price.' },
      { type: 'p', text: 'IprovIT is a service you provide, in barter or on agreed terms. It sits beside ihavIT and IwanIT. The member hash, the device unlock (fingerprint / face / device PIN (your phone decides)), and a signed envelope are what secure it. Both tapes record the consent. A contract does not exist until both parties have signed.' },
      { type: 'p', text: 'Found on OfferUp (DC area) is a static list. Each card says: Third-party listing on OfferUp, not verified by lgme. Price and availability may have changed. Deal is between you and the seller. Continue on OfferUp opens that site yourself. Offer on this item can be cash in full, a term plan of 3, 4, 5, or 6 months, and/or an IprovIT service. An OfferUp row makes a draft offer you copy and paste. Nothing is sent automatically.' },
      { type: 'p', text: 'A pinned IwanIT post asks for a working treadmill and elliptical under $500 in the Washington DC area. Pay with cash, terms over 3 to 6 months, or $lgme services (IprovIT). Matches from OfferUp start empty. Each match can be Available, Pending reply, Offer made, or Closed. Make an offer copies a draft. Invite seller to lgme.app copies text and can open the share sheet for https://lgme.app/exchange. Nothing is sent. A concluded deal closes on this book. Reconcile as donation to the floor needs both consents. A payment is real $lgme from your wallet.' },
      { type: 'p', text: 'Continue with tailored options builds a draft and saves it on this device as Draft, awaiting approval. Copy and Open OfferUp or Thumbtack stay off until you tap Approve. An edit sends it back to awaiting approval. Nothing is sent. A second pinned want is for exercise equipment repair or service. Matches from Thumbtack use the caveat Third-party pro on Thumbtack, not verified by lgme. An IprovIT flag is labeled Listed from Thumbtack (not affiliated).' },
      { type: 'p', text: 'When both parties consent, a term plan writes an invoice for each installment on both tapes. Overdue invoices sort to the top. A reminder is a tape entry, not a penalty. A partial payment leaves the rest open. Every invoice and contract offers Reconcile as donation to the floor. Both must consent. It then closes with THANK YOU FOR YOUR SUPPORT. A payment is real $lgme from your wallet.' },
      { type: 'link', href: '/exchange#market', text: 'Open the market' }
    ]
  },
  {
    id: 'resources-story',
    kicker: 'A repair',
    title: 'The broken car',
    deck: 'The food money stays food. Three lines of work meet the bill.',
    blocks: [
      { type: 'p', text: 'A car dies. After rent, 150 remains, and that 150 is food. The repair is real. The register offers a fee, a high interest, and a penalty. She refuses. The no adds nothing. The food stays food.' },
      { type: 'p', text: 'Three lines of work, each the same amount, settle the repair: care for the parents, hours in the shop, and the transmission. No fee is added on top. No penalty is charged for the refusal. If a line is still open, the desk says it is unpaid.' },
      { type: 'link', href: 'https://www.egonomicanonymous.live/story', text: 'The story, on egonomicanonymous.live' },
      { type: 'link', href: '/story', text: 'Story, on this site' }
    ]
  },
  {
    id: 'resources-security',
    kicker: 'This phone',
    title: 'How this desk stays shut',
    deck: 'Online to spend. Read-only when offline. The books stay here.',
    blocks: [
      { type: 'p', text: 'Beta. Agreed payments settle in real $lgme on Solana. Transfers are irreversible. Use at your own risk and start small. This desk never asks for a seed phrase or a Solana private key. Your wallet signs each payment. The local tape records the transaction signature. It does not write to Hedera. Offline, you can read the books. You cannot spend.' },
      { type: 'p', text: 'Spends, invoices, handoffs, and signed chats need the browser online, and both peers must sign a challenge and an acknowledgement within 10 minutes. Offline, you can read the books. You cannot spend.' },
      { type: 'p', text: 'The signing key is kept in this browser as a non-extractable key. A wallet can also unlock with fingerprint / face / device PIN (your phone decides). A passphrase is the fallback, and it is not a short PIN. A 6-digit code remains an optional second factor. Recovery codes are shown once.' },
      { type: 'p', text: 'Each $lgme bundle on this book carries a serial from the opening line. A receipt checks that chain. If the same serial names two next owners, both books get a signed fraud proof and the cheater’s floor and standing move against them.' },
      { type: 'p', text: 'The service worker can keep the app shell for the next visit. It does not make an offline spend valid.' }
    ]
  }
];
