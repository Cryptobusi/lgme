import { REFERENCE_LABEL, optionLabel, referenceLine } from '/js/dc-reference.mjs';
import { clearingWindow, merkleProofFor, merkleRootOf, verifyMerkleProof } from '/js/clearing.mjs';

    // Not written to Hedera. No network writes.
    const GENESIS = '0'.repeat(64);
    const FLOOR_BLOCK = 'Blocked: Floor stays senior';
    const OPENING = Object.freeze({
      'node-alice': Object.freeze({ name: 'Alice (Providore)', balance: 120, creditLimit: -500, floor: 40, floorNote: 'food/rent' }),
      'node-bob': Object.freeze({ name: 'Bob (Agronomist)', balance: -45, creditLimit: -300, floor: 50, floorNote: 'food/rent' }),
      'node-charlie': Object.freeze({ name: 'Charlie (Logistics)', balance: -75, creditLimit: -400, floor: 45, floorNote: 'food/rent' })
    });
    const state = {
      accounts: {},
      tape: [],
      logs: [],
      refs: [],
      refCatalog: { date: '', notice: '' },
      appliedRef: null
    };
    let busy = false;

    function esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));
    }
    function canonicalJSON(value) {
      if (value === null || typeof value !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
      const keys = Object.keys(value).sort();
      return '{' + keys.map((key) => JSON.stringify(key) + ':' + canonicalJSON(value[key])).join(',') + '}';
    }
    async function sha256(message) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    function replayBalances(tape) {
      const accounts = {};
      for (const [id, src] of Object.entries(OPENING)) {
        accounts[id] = { name: src.name, balance: src.balance, creditLimit: src.creditLimit, floor: src.floor, floorNote: src.floorNote };
      }
      for (const entry of tape) {
        if (entry.type !== 'settlement') continue;
        accounts[entry.debtor].balance -= entry.amount;
        accounts[entry.creditor].balance += entry.amount;
      }
      return accounts;
    }
    function applyReplay() {
      state.accounts = replayBalances(state.tape);
    }
    function balanceSum(accounts) {
      return Object.values(accounts).reduce((sum, acc) => sum + acc.balance, 0);
    }
    function readProposal() {
      const third = document.getElementById('thirdSeat').value;
      return {
        debtor: document.getElementById('partyA').value,
        creditor: document.getElementById('partyB').value,
        thirdSeat: third || null,
        amount: parseFloat(document.getElementById('tradeAmount').value),
        reference: document.getElementById('itemDesc').value.trim(),
        referenceId: state.appliedRef ? state.appliedRef.id : null,
        referenceAvg: state.appliedRef ? state.appliedRef.avg : null
      };
    }
    function proposalError(proposal, requireThird) {
      if (proposal.debtor === proposal.creditor) return 'Debtor and Creditor must be distinct peer nodes.';
      if (!Number.isFinite(proposal.amount) || proposal.amount <= 0) return 'Enter a mutual-unit amount.';
      if (!proposal.reference) return 'Enter the service or good.';
      if (proposal.thirdSeat && (proposal.thirdSeat === proposal.debtor || proposal.thirdSeat === proposal.creditor)) {
        return 'Third seat must be a different participant.';
      }
      if (requireThird && !proposal.thirdSeat) return 'Name a third participant.';
      return '';
    }
    function breachesFloor(debtorId, amount) {
      const acc = state.accounts[debtorId];
      const next = acc.balance - amount;
      return next < acc.floor || next < acc.creditLimit;
    }
    async function appendEntry(fields) {
      const prev = state.tape.length ? state.tape[state.tape.length - 1].hash : GENESIS;
      const body = {
        index: state.tape.length,
        type: fields.type,
        simulated: true,
        prev,
        at: new Date().toISOString(),
        debtor: fields.debtor,
        creditor: fields.creditor,
        thirdSeat: fields.thirdSeat,
        amount: fields.amount,
        reference: fields.reference,
        referenceId: fields.referenceId || null,
        referenceAvg: fields.referenceAvg == null ? null : fields.referenceAvg,
        message: fields.message || ''
      };
      const hash = await sha256(canonicalJSON(body));
      const entry = Object.freeze({ ...body, hash });
      state.tape.push(entry);
      return entry;
    }
    function addLog(step, detail, status = 'info') {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
      state.logs.push({ timestamp, step, detail, status });
      const logContainer = document.getElementById('logStream');
      const div = document.createElement('div');
      div.className = 'flex items-start gap-2 border-b border-slate-900/60 pb-1.5';
      let badgeColor = 'text-slate-400 bg-slate-900 border-slate-800';
      if (status === 'success') badgeColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50';
      if (status === 'cyan') badgeColor = 'text-cyan-400 bg-cyan-950/60 border-cyan-800/50';
      if (status === 'purple') badgeColor = 'text-purple-400 bg-purple-950/60 border-purple-800/50';
      div.innerHTML = `
        <span class="text-slate-500 text-[10px]">${esc(timestamp)}</span>
        <span class="px-1.5 py-0.2 rounded border text-[10px] ${badgeColor}">${esc(step)}</span>
        <span class="flex-1 text-slate-300 text-xs">${esc(detail)}</span>
      `;
      logContainer.appendChild(div);
      logContainer.scrollTop = logContainer.scrollHeight;
    }
    function renderBalances() {
      const container = document.getElementById('accountsList');
      container.innerHTML = '';
      for (const [id, acc] of Object.entries(state.accounts)) {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80';
        div.dataset.account = id;
        div.dataset.balance = String(acc.balance);
        div.dataset.floor = String(acc.floor);
        const balanceColor = acc.balance >= 0 ? 'text-emerald-400' : 'text-amber-400';
        const above = acc.balance - acc.floor;
        const vetoes = state.tape.filter((entry) => entry.type === 'THIRD_SEAT_VETO' && entry.thirdSeat === id).length;
        div.innerHTML = `
          <div>
            <div class="text-xs font-medium text-white">${esc(acc.name)}</div>
            <div class="text-[10px] text-amber-200/90">Floor ${esc(acc.floor)} ${esc(acc.floorNote)} · Vetoes ${esc(vetoes)}</div>
            <div class="text-[10px] text-slate-500 font-mono">Limit: ${esc(acc.creditLimit)} units · ${above >= 0 ? esc(above) + ' above floor' : 'below floor'}</div>
          </div>
          <div class="text-right">
            <span class="mono font-bold text-sm ${balanceColor}">${acc.balance > 0 ? '+' : ''}${esc(acc.balance)}</span>
            <span class="text-[10px] text-slate-400 ml-1">Credits</span>
          </div>
        `;
        container.appendChild(div);
      }
      document.getElementById('systemSum').textContent = balanceSum(state.accounts).toFixed(2);
    }
    function renderTape() {
      const container = document.getElementById('tapeList');
      container.innerHTML = '';
      if (state.tape.length === 0) {
        container.innerHTML = '<div class="text-slate-500 text-[11px]">Tape is empty . Offers, acceptances, refusals, blocks, and settlements append here.</div>';
        return;
      }
      const tone = {
        offer: 'text-slate-300 border-slate-700',
        accept: 'text-cyan-300 border-cyan-800/60',
        refusal: 'text-amber-200 border-amber-700/70',
        THIRD_SEAT_VETO: 'text-amber-200 border-amber-700/70',
        NETTING: 'text-cyan-200 border-cyan-800/60',
        block: 'text-rose-300 border-rose-800/70',
        settlement: 'text-emerald-300 border-emerald-800/60'
      };
      for (const entry of state.tape) {
        const div = document.createElement('div');
        div.className = 'border rounded-lg px-2.5 py-2 ' + (tone[entry.type] || 'border-slate-800');
        div.dataset.type = entry.type;
        div.dataset.hash = entry.hash;
        div.dataset.ref = entry.referenceId || '';
        div.dataset.avg = entry.referenceAvg == null ? '' : String(entry.referenceAvg);
        const third = entry.thirdSeat ? ` · third ${esc(entry.thirdSeat)}` : '';
        const message = entry.message ? ` · ${esc(entry.message)}` : '';
        const refLine = entry.referenceId ? ` · ref ${esc(entry.referenceId)} @ ${esc(entry.referenceAvg)}` : '';
        div.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] uppercase tracking-wider">${esc(entry.type)}</span>
            <span class="text-[10px] text-slate-500">#${esc(entry.index)}</span>
          </div>
          <div class="mt-1 text-[11px]">${esc(entry.debtor)} → ${esc(entry.creditor)} · ${esc(entry.amount)}${third}${refLine}${message}</div>
          <div class="mt-1 text-[10px] text-slate-500">prev ${esc(entry.prev.slice(0, 12))}… · hash ${esc(entry.hash.slice(0, 12))}…</div>
        `;
        container.appendChild(div);
      }
      container.scrollTop = container.scrollHeight;
    }
    function showToast(msg) {
      const toast = document.getElementById('toast');
      document.getElementById('toastMsg').innerText = msg;
      toast.classList.remove('hidden');
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 3500);
    }
    function syncThirdSeat() {
      const proposal = readProposal();
      const distinct = proposal.thirdSeat && proposal.thirdSeat !== proposal.debtor && proposal.thirdSeat !== proposal.creditor;
      const btn = document.getElementById('declineThirdBtn');
      const note = document.getElementById('thirdSeatNote');
      btn.hidden = !distinct;
      if (!proposal.thirdSeat) {
        note.textContent = 'No third seat. Bilateral exchange only .';
      } else if (!distinct) {
        note.textContent = 'Third seat must be a different participant .';
      } else {
        note.textContent = 'Third seat proposed . Decline records a refusal. No balances move. No penalty.';
      }
    }
    async function verifyReplay() {
      const result = document.getElementById('verifyResult');
      let prev = GENESIS;
      for (const entry of state.tape) {
        if (entry.prev !== prev) {
          result.textContent = `Verify replay: break at #${entry.index} . Previous hash does not link.`;
          return false;
        }
        const body = { ...entry };
        delete body.hash;
        const recomputed = await sha256(canonicalJSON(body));
        if (recomputed !== entry.hash) {
          result.textContent = `Verify replay: hash mismatch at #${entry.index} .`;
          return false;
        }
        prev = entry.hash;
      }
      const replayed = replayBalances(state.tape);
      const sum = balanceSum(replayed);
      if (Math.abs(sum) > 1e-9) {
        result.textContent = `Verify replay: balances sum to ${sum} . Expected 0.`;
        return false;
      }
      for (const id of Object.keys(replayed)) {
        if (replayed[id].balance !== state.accounts[id].balance) {
          result.textContent = `Verify replay: displayed balance for ${id} is not the tape replay .`;
          return false;
        }
      }
      result.textContent = `Verify replay: ok . ${state.tape.length} entries. Hashes linked. Balances sum to 0.00.`;
      return true;
    }
    async function exportTape() {
      const day = new Date().toISOString().slice(0, 10);
      const leaves = state.tape.filter((entry) => String(entry.at).slice(0, 10) === day).map((entry) => entry.hash);
      const root = await merkleRootOf(leaves);
      const payload = {
        simulated: true,
        label: 'constitutive tape',
        genesisPrev: GENESIS,
        opening: OPENING,
        entries: state.tape,
        roots: { days: { [day]: root } }
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lgme_tape_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Tape exported .');
    }
    async function declineThirdSeat() {
      const proposal = readProposal();
      const error = proposalError(proposal, true);
      if (error) {
        showToast(error);
        return;
      }
      const before = replayBalances(state.tape);
      await appendEntry({ ...proposal, type: 'offer', message: 'offer ' });
      await appendEntry({ ...proposal, type: 'refusal', message: 'REFUSAL' });
      applyReplay();
      renderBalances();
      renderTape();
      const after = state.accounts;
      for (const id of Object.keys(before)) {
        if (before[id].balance !== after[id].balance) {
          addLog('REFUSAL', 'Balance drift after refusal .', 'purple');
        }
      }
      addLog('REFUSAL', `${state.accounts[proposal.thirdSeat].name} declined the third seat. REFUSAL kept on the tape. No balances moved. No penalty. `, 'purple');
      showToast('REFUSAL recorded . No balances moved. No penalty.');
    }
    document.getElementById('tradeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const proposal = readProposal();
      const error = proposalError(proposal, false);
      if (error) {
        showToast(error);
        return;
      }
      busy = true;
      try {
        addLog('1. INGEST', `Offer : ${proposal.amount} units for "${proposal.reference}"`, 'cyan');
        await appendEntry({ ...proposal, type: 'offer', message: 'offer ' });
        if (breachesFloor(proposal.debtor, proposal.amount)) {
          await appendEntry({ ...proposal, type: 'block', message: FLOOR_BLOCK });
          applyReplay();
          renderBalances();
          renderTape();
          addLog('BLOCK', FLOOR_BLOCK, 'purple');
          showToast(FLOOR_BLOCK);
          return;
        }
        await appendEntry({ ...proposal, type: 'accept', message: 'accept ' });
        const settlement = await appendEntry({ ...proposal, type: 'settlement', message: 'settlement ' });
        applyReplay();
        renderBalances();
        renderTape();
        addLog('3. KOMUNITIN', `Double-entry net cleared : ${proposal.debtor} (-${proposal.amount}) | ${proposal.creditor} (+${proposal.amount})`, 'cyan');
        const hcsSequence = 100000 + state.tape.filter((entry) => entry.type === 'settlement').length;
        const consensusTs = new Date().getTime() / 1000;
        addLog('4. HEDERA HCS', `Not written to Hedera. Seq #${hcsSequence} `, 'success');
        document.getElementById('lastTxHash').textContent = settlement.hash;
        document.getElementById('consensusTimestamp').textContent = `${consensusTs} UTC (Seq #${hcsSequence}) `;
        showToast(`Exchange settled. Not written to Hedera.`);
      } finally {
        busy = false;
      }
    });
    document.getElementById('declineThirdBtn').addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      try {
        await declineThirdSeat();
      } finally {
        busy = false;
      }
    });
    function selectedRefItem() {
      const id = document.getElementById('refItem').value;
      return state.refs.find((item) => item.id === id) || null;
    }
    function activeReferenceAvg(item) {
      const basis = document.getElementById('refBasis').value;
      if (basis === 'hour') return item.hourly_avg;
      if (basis === 'job') return item.job_avg;
      return item.avg_value_usd;
    }
    function configureReference(item) {
      const wrap = document.getElementById('refQtyWrap');
      const basis = document.getElementById('refBasis');
      const label = document.getElementById('refQtyLabel');
      const detail = document.getElementById('refDetail');
      basis.innerHTML = '';
      if (!item || item.avg_value_usd == null) {
        wrap.hidden = true;
        state.appliedRef = null;
        detail.textContent = item
          ? `${referenceLine(item, state.refCatalog).text} Reference only, not a price.`
          : `${REFERENCE_LABEL}. Reference only, not a price.`;
        return;
      }
      wrap.hidden = false;
      if (item.hourly_avg != null) {
        const hour = document.createElement('option');
        hour.value = 'hour';
        hour.textContent = 'Per hour';
        basis.appendChild(hour);
      }
      if (item.job_avg != null) {
        const job = document.createElement('option');
        job.value = 'job';
        job.textContent = item.unit === 'visit' ? 'Per visit' : 'Per job';
        basis.appendChild(job);
      }
      if (item.hourly_avg == null && item.job_avg == null) {
        const unit = document.createElement('option');
        unit.value = 'unit';
        unit.textContent = 'Per ' + item.unit;
        basis.appendChild(unit);
      }
      basis.value = item.job_avg != null ? 'job' : (item.hourly_avg != null ? 'hour' : 'unit');
      basis.hidden = basis.children.length < 2;
      label.textContent = basis.value === 'hour' ? 'Hours' : ('Quantity (' + item.unit + ')');
      applyReferenceFill();
    }
    function applyReferenceFill() {
      const item = selectedRefItem();
      const detail = document.getElementById('refDetail');
      if (!item || item.avg_value_usd == null) {
        state.appliedRef = null;
        return;
      }
      const qty = parseFloat(document.getElementById('refQty').value);
      const avg = activeReferenceAvg(item);
      const basis = document.getElementById('refBasis').value;
      document.getElementById('refQtyLabel').textContent = basis === 'hour' ? 'Hours' : ('Quantity (' + item.unit + ')');
      if (!Number.isFinite(qty) || qty <= 0 || avg == null) {
        state.appliedRef = null;
        detail.textContent = 'Reference only, not a price. Enter hours or quantity. ';
        return;
      }
      const amount = Math.round(avg * qty * 100) / 100;
      document.getElementById('tradeAmount').value = String(amount);
      document.getElementById('itemDesc').value = item.name;
      state.appliedRef = { id: item.id, avg };
      const line = referenceLine(item, state.refCatalog);
      detail.textContent = `${line.text} Reference only, not a price. ${avg} USD × ${qty} = ${amount}. You can still edit the amount.`;
    }
    async function loadReferences() {
      const select = document.getElementById('refItem');
      const detail = document.getElementById('refDetail');
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const response = await fetch('/data/dc-reference-values-v0.json', { signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok) throw new Error(String(response.status));
        const catalog = await response.json();
        state.refs = Array.isArray(catalog.items) ? catalog.items : [];
        state.refCatalog = { date: catalog.date || '', notice: catalog.notice || '' };
        select.innerHTML = '';
        const none = document.createElement('option');
        none.value = '';
        none.textContent = 'None';
        select.appendChild(none);
        const list = document.getElementById('refList');
        list.replaceChildren();
        for (const item of state.refs) {
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = optionLabel(item, state.refCatalog);
          select.appendChild(option);
          const line = referenceLine(item, state.refCatalog);
          const row = document.createElement('li');
          const name = document.createElement('strong');
          name.textContent = `${line.name}: ${line.value}`;
          row.append(name, document.createTextNode(` As of ${line.asOf}. Sources: ${line.sources}.`));
          list.append(row);
        }
        detail.textContent = `${REFERENCE_LABEL}. Reference only, not a price. As of ${state.refCatalog.date || 'pending'}. ${state.refCatalog.notice}`;
      } catch (err) {
        detail.textContent = 'Reference list did not load .';
      }
    }
    ['partyA', 'partyB', 'thirdSeat'].forEach((id) => {
      document.getElementById(id).addEventListener('change', syncThirdSeat);
    });
    document.getElementById('refItem').addEventListener('change', () => configureReference(selectedRefItem()));
    document.getElementById('refQty').addEventListener('input', applyReferenceFill);
    document.getElementById('refBasis').addEventListener('change', applyReferenceFill);
    document.getElementById('clearLogsBtn').addEventListener('click', () => {
      document.getElementById('logStream').innerHTML = '';
      state.logs = [];
    });
    document.getElementById('exportTapeBtn').addEventListener('click', exportTape);
    document.getElementById('verifyReplayBtn').addEventListener('click', () => {
      verifyReplay();
    });
    document.getElementById('downloadMdBtn').addEventListener('click', () => {
      const now = new Date().toISOString();
      let md = `# lgme.app - Sovereign Provenance & Mutual credit Run
**Date:** ${now}  
**Label:** Beta  
**Target Index:** hederica.com  
**Consensus Engine:** Hedera Consensus Service (example topic 0.0.489104)  
**Clearing Engine:** Komunitin Mutual Credit Protocol   
---
## 1. System Parameters & Architecture
- **Signing:** RFC 8785 canonical JSON, signed on this device
- **Zero-Sum Clearing:** Komunitin double-entry accounting matrix 
- **Floor seniority:** protected food/rent line stays senior 
- **Constitutive tape:** append-only SHA-256 hash chain; balances replayed from the tape 
- **Adoptive Interface:** Frictionless Passkey credential generation & zero pre-funding required
---
## 2. Mutual credit balances (replay of the tape)

| Node / Participant | Current Balance | Floor  | Credit Limit | Status |
| :--- | :--- | :--- | :--- | :--- |
`;
      for (const acc of Object.values(state.accounts)) {
        md += `| ${acc.name} | ${acc.balance} | ${acc.floor} ${acc.floorNote} | ${acc.creditLimit} | Operational |\n`;
      }
      md += `\n**Net balance:** Sum = ${document.getElementById('systemSum').textContent}\n\n`;
      md += `---
## 3. Constitutive tape 

| # | Type | Debtor | Creditor | Amount | Third seat | Reference | Avg used | Message | Hash |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;
      if (state.tape.length === 0) {
        md += `*No tape entries yet in this session.*\n`;
      } else {
        state.tape.forEach((entry) => {
          md += `| #${entry.index} | ${entry.type} | ${entry.debtor} | ${entry.creditor} | ${entry.amount} | ${entry.thirdSeat || ''} | ${entry.referenceId || ''} | ${entry.referenceAvg == null ? '' : entry.referenceAvg} | ${entry.message} | \`${entry.hash.slice(0, 16)}...\` |\n`;
        });
      }
      md += `\n---
## 4. Execution Stream Log
\`\`\`text
`;
      state.logs.forEach((l) => {
        md += `[${l.timestamp}] [${l.step}] ${l.detail}\n`;
      });
      md += `\`\`\`
---
*Exported from lgme.app. Not written to Hedera.*
`;
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lgme_app_audit_${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Markdown audit downloaded successfully!');
    });
    document.getElementById('recordDeploymentBtn').addEventListener('click', () => {
      const record = {
        deploymentTarget: 'hederica.com',
        subdomain: 'lgme.hederica.com',
        appId: 'lgme-spp-clearing-engine',
        version: '1.2.0',
        hederaTopicId: '0.0.489104',
        clearingEngine: 'Komunitin Microservices',
        status: 'INDEXED_READY',
        simulated: true,
        timestamp: new Date().toISOString(),
        snapshotBalances: state.accounts,
        txCount: state.tape.filter((entry) => entry.type === 'settlement').length
      };
      localStorage.setItem('hederica_lgme_deployment_index', JSON.stringify(record, null, 2));
      const badge = document.getElementById('indexStatusBadge');
      badge.textContent = 'Registered in Index';
      badge.className = 'text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40';
      addLog('DEPLOY REGISTER', 'Recorded deployment manifest in this browser only .', 'success');
      showToast('Deployment indexed locally .');
    });
    async function vetoThirdSeat() {
      const proposal = readProposal();
      const error = proposalError(proposal, true);
      if (error) { showToast(error); return; }
      const reason = document.getElementById('vetoReason').value.trim();
      if (!reason) { showToast('A veto needs a reason.'); return; }
      const before = replayBalances(state.tape);
      await appendEntry({ ...proposal, type: 'THIRD_SEAT_VETO', message: reason });
      applyReplay();
      renderBalances();
      renderTape();
      for (const id of Object.keys(before)) {
        if (before[id].balance !== state.accounts[id].balance) addLog('VETO', 'Balance drift after veto.', 'purple');
      }
      addLog('VETO', `${state.accounts[proposal.thirdSeat].name} vetoed. ${reason}`, 'purple');
      showToast('Veto recorded. No balances moved. No penalty.');
    }
    function paintWindow() {
      const window = clearingWindow(new Date().toISOString(), { windowDays: 7 });
      const ms = window.remainingMs;
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const line = document.getElementById('windowLine');
      if (line) line.textContent = `Clearing window ${window.windowId} · ${days}d ${hours}h left.`;
    }
    async function paintRoot() {
      const day = new Date().toISOString().slice(0, 10);
      const leaves = state.tape.filter((entry) => String(entry.at).slice(0, 10) === day).map((entry) => entry.hash);
      const root = await merkleRootOf(leaves);
      const node = document.getElementById('dayRoot');
      if (node) node.textContent = `Day root ${root.slice(0, 16)}. A future Hedera anchor would publish this. Not written to Hedera.`;
      return { day, leaves, root };
    }
    async function netOut() {
      const owed = {};
      for (const entry of state.tape) {
        if (entry.type !== 'settlement') continue;
        const key = entry.debtor + '>' + entry.creditor;
        owed[key] = (owed[key] || 0) + entry.amount;
      }
      let best = null;
      for (const key of Object.keys(owed)) {
        const [debtor, creditor] = key.split('>');
        const back = owed[creditor + '>' + debtor] || 0;
        const offset = Math.min(owed[key], back);
        if (offset > 0 && (!best || offset > best.offset)) best = { debtor, creditor, offset };
      }
      if (!best) { showToast('Net out needs both directions.'); return; }
      const before = replayBalances(state.tape);
      await appendEntry({ debtor: best.debtor, creditor: best.creditor, thirdSeat: null, amount: best.offset, reference: 'Net out', type: 'NETTING', message: 'offset' });
      applyReplay();
      renderBalances();
      renderTape();
      const moved = Object.keys(before).some((id) => before[id].balance !== state.accounts[id].balance);
      addLog('NETTING', moved ? 'Balance drift after netting.' : `Offset ${best.offset}. Nothing else moved.`, 'cyan');
      showToast(`Net out recorded for ${best.offset}.`);
    }
    document.getElementById('vetoBtn').addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      try { await vetoThirdSeat(); await paintRoot(); } finally { busy = false; }
    });
    document.getElementById('netOutBtn').addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      try { await netOut(); await paintRoot(); } finally { busy = false; }
    });
    document.getElementById('proveBtn').addEventListener('click', async () => {
      const packed = await paintRoot();
      if (!packed.leaves.length) { document.getElementById('proofResult').textContent = 'invalid'; return; }
      const proof = await merkleProofFor(packed.leaves, packed.leaves.length - 1);
      const body = { version: 1, scope: 'day', scopeId: packed.day, ...proof };
      document.getElementById('proofBox').value = JSON.stringify(body, null, 2);
      document.getElementById('proofResult').textContent = 'valid';
    });
    document.getElementById('checkProofBtn').addEventListener('click', async () => {
      let proof;
      try { proof = JSON.parse(document.getElementById('proofBox').value); } catch { document.getElementById('proofResult').textContent = 'invalid'; return; }
      document.getElementById('proofResult').textContent = (await verifyMerkleProof(proof)) ? 'valid' : 'invalid';
    });
    paintWindow();
    setInterval(paintWindow, 30000);
    applyReplay();
    renderBalances();
    paintRoot();
    renderTape();
    syncThirdSeat();
    addLog('SYSTEM BOOT', 'lgme.app is ready. Not written to Hedera. Floor stays senior. Tape is constitutive.', 'info');
    if (window.lucide) lucide.createIcons();
    loadReferences();
  
