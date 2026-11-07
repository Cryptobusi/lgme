export const ARTICLES = [
  {
    id: 'resources-people',
    kicker: 'The desk',
    title: 'Alice, Bob, and Charlie',
    deck: 'Three people. Floor first. The same rules for each.',
    blocks: [
      { type: 'p', text: 'SIMULATION. This is the recorded explainer, kept inside the app. It is not a live book.' },
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
      { type: 'p', text: 'Refusal of the 16-unit ride share never posted. The open 10-unit item was still pending. Simulation only. Floor stays senior.' }
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
      { type: 'p', text: 'Bob → Charlie, 16 units, ride share coordination. Charlie: “Could not be shown.” Nothing was taken. The explainer keeps this as a mock refusal record. The no stays. It does not move a balance and it carries no penalty.' }
    ]
  },
  {
    id: 'resources-open',
    kicker: 'Still open',
    title: 'The unresolved line',
    deck: 'Charlie to Alice, 10 units. Either side may show it or refuse it.',
    blocks: [
      { type: 'p', text: 'Charlie → Alice, 10 units, final bookkeeping review. It is still waiting. Either side may show the work or refuse it. The explainer keeps this as a mock open item. An open line is not a settled line.' }
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
        'The result is recorded on the local tape. No real network is used.'
      ] },
      { type: 'p', text: 'Simulation only. Floor stays senior.' }
    ]
  },
  {
    id: 'resources-simulator',
    kicker: 'The other desk',
    title: 'Mutual credit simulator',
    deck: 'The same floor, the same refusal, a tape you can export.',
    blocks: [
      { type: 'p', text: 'The mutual credit simulator is a separate practice page. Balances are replayed from an append-only hash-linked tape. A line that would spend the floor is stored as Blocked: Floor stays senior. A third-seat decline is a refusal: nothing moves, and there is no penalty. Reference figures are suggestions, not prices.' },
      { type: 'link', href: '/mutual-credit-simulator', text: 'Open the mutual credit simulator' },
      { type: 'link', href: '/simulation-explainer', text: 'Open the simulation explainer' },
      { type: 'link', href: '/docs/SPP_Overview.pptx', text: 'Slides from the explainer' }
    ]
  },
  {
    id: 'resources-manifest',
    kicker: 'Framing',
    title: 'Deployment manifest',
    deck: 'Design research. The banner says simulation.',
    blocks: [
      { type: 'p', text: 'The deployment manifest is framed as simulation and design research. Its banner says nothing is written to a network. It is not a live desk, and it is not this practice app. This app keeps each book in the browser.' },
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
  }
];
