    let cycles = JSON.parse(localStorage.getItem('soverx-cycles') || '[]');
    let currentHandle = localStorage.getItem('soverx-handle') || '';

    if (currentHandle) {
      showApp(currentHandle);
    }

    function enter() {
      const raw = document.getElementById('handle').value.trim();
      const verified = document.getElementById('verified').checked;
      if (!raw) {
        document.getElementById('gate-msg').textContent = 'Handle required.';
        return;
      }
      if (!verified) {
        document.getElementById('gate-msg').textContent = 'Verified checkbox required for trial entry.';
        return;
      }
      const handle = raw.startsWith('@') ? raw : '@' + raw;
      localStorage.setItem('soverx-handle', handle);
      showApp(handle);
    }

    function showApp(handle) {
      document.getElementById('gate').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      document.getElementById('who').textContent = 'Entered as ' + handle + ' (temporary X-handle pilot)';
      renderHistory();
    }

    function run() {
      const type = document.getElementById('type').value;
      const desc = document.getElementById('desc').value.trim() || '(empty)';
      const comment = document.getElementById('comment').value.trim() || '(none)';
      const id = 'cyc-' + Date.now();

      const cycle = { id, type, desc, comment, handle: currentHandle, ts: new Date().toISOString() };
      cycles.unshift(cycle);
      localStorage.setItem('soverx-cycles', JSON.stringify(cycles.slice(0, 20)));

      document.getElementById('out').style.display = 'block';
      document.getElementById('step1').textContent = '1. Order checked: Floor first, public mint, named charge, tape required.';
      document.getElementById('public').textContent = '2. Public: ' + type + ' — ' + desc + ' (' + currentHandle + ')';
      document.getElementById('residual').textContent = '3. Residual: titled (including zero)';
      document.getElementById('floor').textContent = '4. Floor: acknowledged first';
      document.getElementById('refusal').textContent = '5. Refusal check: no private path detected';
      document.getElementById('reward').textContent = '6. Mock reward: 1 $lgme (simulated) — comment: ' + comment;

      renderHistory();
    }

    function renderHistory() {
      const list = document.getElementById('list');
      if (!cycles.length) {
        list.textContent = 'None yet.';
        return;
      }
      list.innerHTML = cycles.map(c =>
        '<div class="cycle"><strong>' + c.type + '</strong> — ' + c.desc + '<br><span class="muted">' + (c.handle || '') + ' · ' + c.comment + ' · ' + c.ts.slice(0,19) + '</span></div>'
      ).join('');
    }

document.getElementById('enter-trial').addEventListener('click', enter);
document.getElementById('run-cycle').addEventListener('click', run);
document.getElementById('soverx-icon').addEventListener('error', function () { this.style.display = 'none'; });
  
