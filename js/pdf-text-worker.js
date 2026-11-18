import { extractPdfText } from './pdf-text.mjs';

self.onmessage = async (event) => {
  try {
    const pages = await extractPdfText(event.data);
    self.postMessage({ ok: true, pages });
  } catch (error) {
    self.postMessage({ ok: false, error: 'The manual text stayed unread.', pages: [] });
  }
};
