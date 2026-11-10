import { deleteLocalHealth } from './health-safeguards.mjs';

const button = document.getElementById('delete-health');
const note = document.getElementById('delete-note');

button?.addEventListener('click', () => {
  const result = deleteLocalHealth(localStorage);
  try { sessionStorage.removeItem('lgme-gym.seat'); } catch { /* this browser has no session store */ }
  if (globalThis.indexedDB) indexedDB.deleteDatabase('lgme-helper');
  if (note) {
    note.textContent = result.removed.length
      ? 'Deleted on this phone. Local salts were discarded.'
      : 'Nothing health-related was stored on this phone. Local salts were discarded.';
  }
});
