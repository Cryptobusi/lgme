import { loadPersonalImages, resolveImage, viewerId } from './personal-images.mjs';

export async function applyPersonalImages(documentRef = globalThis.document, storage = globalThis.localStorage) {
  const viewer = viewerId(storage);
  if (!viewer) return {};
  const saved = await loadPersonalImages(viewer, storage);
  const applied = {};
  for (const node of documentRef.querySelectorAll('[data-image-slot]')) {
    const id = node.getAttribute('data-image-slot');
    const shown = resolveImage(id, saved.images, saved.memberId, viewer);
    if (!shown.custom) continue;
    applied[id] = shown.src;
    if (node.tagName === 'IMG') {
      node.src = shown.src;
      node.removeAttribute('srcset');
      node.alt = shown.alt;
      const picture = node.parentElement?.tagName === 'PICTURE' ? node.parentElement : null;
      picture?.querySelectorAll('source').forEach((source) => source.remove());
      const credit = node.closest('figure')?.querySelector('[data-photo-credit]');
      if (credit) credit.hidden = true;
    } else {
      node.style.backgroundImage = `url("${shown.src}")`;
      node.dataset.personalImage = '1';
    }
  }
  return applied;
}

if (globalThis.document?.querySelector) applyPersonalImages().catch(() => {});
