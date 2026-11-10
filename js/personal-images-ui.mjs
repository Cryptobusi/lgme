import { BUILTINS, IMAGE_SLOTS, choiceFor, exportPersonalVersion, preparePersonalImage, resolveImage, suggestBuiltin } from './personal-images.mjs';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function mountImageSlots(host, { memberId, images, status, save }) {
  const note = el('p', { id: 'image-slot-note', class: 'muted' }, ['These pictures change only what you see. They stay on this phone. They are not uploaded and they are not written to Hedera.']);
  let current = { ...(images || {}) };
  const previews = new Map();

  function paintOne(id) {
    const preview = previews.get(id);
    if (!preview) return;
    const shown = resolveImage(id, current, memberId, memberId);
    preview.src = shown.src;
    preview.alt = shown.alt;
  }

  async function commit(next, message) {
    current = next;
    const saved = await save(current);
    if (saved?.images) current = { ...saved.images };
    for (const id of previews.keys()) paintOne(id);
    status(message);
  }

  const rows = [];
  let group = '';
  for (const slot of IMAGE_SLOTS) {
    if (slot.group !== group) {
      group = slot.group;
      rows.push(el('h3', {}, [group]));
    }
    const preview = el('img', { id: `image-preview-${slot.id}`, width: '96', height: '72', alt: slot.alt, style: 'width:96px;height:72px;object-fit:cover;border-radius:8px;background:#efe8dc' });
    previews.set(slot.id, preview);
    const choices = el('div', { id: `image-choices-${slot.id}`, hidden: 'hidden' });
    const file = el('input', { id: `upload-image-${slot.id}`, type: 'file', accept: 'image/*' });
    const select = el('select', { id: `builtin-image-${slot.id}` }, BUILTINS.map((item) => el('option', { value: item.id }, [item.label])));
    const describe = el('textarea', { id: `describe-image-${slot.id}`, maxlength: '160', placeholder: 'Describe a picture' });
    const suggestion = el('p', { id: `suggest-image-note-${slot.id}`, class: 'muted' }, []);
    file.addEventListener('change', async () => {
      const chosen = file.files?.[0];
      file.value = '';
      if (!chosen) return;
      const prepared = await preparePersonalImage(chosen).catch(() => ({ ok: false, error: 'That photo could not be read on this phone.' }));
      if (!prepared.ok) { status(prepared.error); return; }
      const next = choiceFor(slot.id, { source: 'upload', dataUrl: prepared.dataUrl, note: 'Your photo' });
      if (!next.ok) { status(next.error); return; }
      await commit({ ...current, [slot.id]: next.choice }, `${slot.label} uses your photo. It stays on this phone.`);
    });
    choices.append(
      el('label', {}, ['Upload my photo', file]),
      el('label', {}, ['Licensed pictures', select]),
      el('button', { type: 'button', id: `use-builtin-${slot.id}`, onClick: async () => {
        const next = choiceFor(slot.id, { source: 'builtin', builtin: select.value });
        if (!next.ok) { status(next.error); return; }
        await commit({ ...current, [slot.id]: next.choice }, `${slot.label} uses ${select.selectedOptions[0]?.textContent || 'that picture'}.`);
      } }, ['Use this picture']),
      el('label', {}, ['Describe a picture for the on-device helper', describe]),
      el('button', { type: 'button', id: `suggest-image-${slot.id}`, onClick: async () => {
        const suggested = suggestBuiltin(describe.value);
        suggestion.textContent = suggested.ok ? `${suggested.sentence} Nothing was sent.` : suggested.error;
        if (!suggested.ok) return;
        const next = choiceFor(slot.id, { source: 'suggest', builtin: suggested.builtin, note: describe.value.trim() });
        if (!next.ok) { status(next.error); return; }
        await commit({ ...current, [slot.id]: next.choice }, suggested.sentence);
      } }, ['Suggest']),
      suggestion,
      el('button', { type: 'button', id: `reset-image-${slot.id}`, onClick: async () => {
        const next = { ...current };
        delete next[slot.id];
        await commit(next, `${slot.label} is back to the default.`);
      } }, ['Reset to default'])
    );
    rows.push(el('div', { class: 'image-slot', id: `image-slot-${slot.id}` }, [
      preview,
      el('div', {}, [
        el('p', {}, [slot.label]),
        el('button', { type: 'button', id: `change-image-${slot.id}`, onClick: () => {
          choices.hidden = !choices.hidden;
        } }, ['Change image']),
        choices
      ])
    ]));
  }

  const download = el('button', { type: 'button', id: 'export-personal-images', onClick: () => {
    const file = exportPersonalVersion({ memberId, images: current, confirmedAt: new Date().toISOString() });
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = el('a', { href: url, download: 'personal-version.json' }, ['personal-version.json']);
    link.click();
    URL.revokeObjectURL(url);
    status('Personal version exported on this phone. Nothing was uploaded.');
  } }, ['Export personal version']);

  host.replaceChildren(note, ...rows, download);
  for (const id of previews.keys()) paintOne(id);
}
