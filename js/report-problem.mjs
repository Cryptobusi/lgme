const form = document.getElementById('report-problem');
const status = document.getElementById('report-status');
if (form && status) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const note = document.getElementById('report-note').value.replace(/\s+/g, ' ').trim();
    if (note.length < 8) {
      status.textContent = 'Add a few words. Leave out email addresses and links.';
      return;
    }
    const response = await fetch('/api/develop/want', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'IwanIT',
        category: 'Health',
        title: 'Report a problem',
        body: note,
        skill: '',
        time: ''
      })
    });
    const body = await response.json().catch(() => ({}));
    status.textContent = body.ok ? 'Sent to the owner. Nothing else was posted.' : (body.error || 'Nothing was sent.');
  });
}
