import { createLocalStorageStore, campusReport, listPeers } from './p2p-exchange-sim.mjs';

const pilot = await fetch('/data/campus-pilot.json').then((response) => response.json());
const join = `${location.origin}/exchange?group=campus`;
const link = document.getElementById('join-link');
if (link) link.textContent = join;
const qr = document.getElementById('join-qr');
if (qr && globalThis.QRCode) new globalThis.QRCode(qr, { text: join, width: 180, height: 180 });
const cap = document.getElementById('pilot-cap');
if (cap) cap.textContent = `${pilot.capMin}–${pilot.capMax}`;

document.getElementById('print-report')?.addEventListener('click', async () => {
  const store = createLocalStorageStore();
  const peers = [];
  for (const row of await listPeers(store)) {
    const full = await store.get(row.id);
    if (full) peers.push(full);
  }
  const lines = campusReport(peers).filter((row) => row.deeds || row.verified);
  const body = document.getElementById('hours-report');
  body.replaceChildren();
  const table = document.createElement('table');
  table.className = 'gloss';
  table.innerHTML = '<thead><tr><th>Member</th><th>Deeds</th><th>Hours</th><th>Verified</th><th>Merkle root</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const row of lines) {
    const tr = document.createElement('tr');
    for (const [label, value] of [['Member', row.name], ['Deeds', row.deeds], ['Hours', row.hours], ['Verified', row.verified], ['Merkle root', row.merkleRoot || '—']]) {
      const td = document.createElement('td');
      td.dataset.label = label;
      td.textContent = String(value);
      tr.append(td);
    }
    tbody.append(tr);
  }
  if (!lines.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'No verified deeds on this device yet.';
    tr.append(td);
    tbody.append(tr);
  }
  table.append(tbody);
  body.append(table);
  window.print();
});
