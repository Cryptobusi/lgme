function latin1(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let text = '';
  for (let i = 0; i < view.length; i += 1) text += String.fromCharCode(view[i]);
  return text;
}

function unescapePdf(raw) {
  return String(raw || '')
    .replace(/\\([nrtbf()\\])/g, (_, mark) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[mark] || mark))
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

export function pullPdfText(content) {
  const bits = [];
  const singles = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  let match = singles.exec(content);
  while (match) {
    bits.push(unescapePdf(match[1]));
    match = singles.exec(content);
  }
  const groups = /\[([\s\S]*?)\]\s*TJ/g;
  match = groups.exec(content);
  while (match) {
    const parts = match[1].match(/\(((?:\\.|[^\\)])*)\)/g) || [];
    bits.push(parts.map((part) => unescapePdf(part.slice(1, -1))).join(''));
    match = groups.exec(content);
  }
  return bits.join(' ').replace(/\s+/g, ' ').trim();
}

async function inflate(body) {
  if (typeof DecompressionStream !== 'function') return '';
  const bin = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i += 1) bin[i] = body.charCodeAt(i) & 255;
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate'));
  const inflated = new Uint8Array(await new Response(stream).arrayBuffer());
  return latin1(inflated);
}

export async function extractPdfText(bytes) {
  const raw = latin1(bytes);
  const pages = [];
  const chunks = raw.split('endstream');
  for (const chunk of chunks) {
    const start = chunk.lastIndexOf('stream');
    if (start < 0) continue;
    const header = chunk.slice(Math.max(0, start - 240), start);
    let body = chunk.slice(start + 6).replace(/^\r?\n/, '');
    let text = '';
    if (/FlateDecode/.test(header)) {
      try { text = pullPdfText(await inflate(body)); } catch { text = ''; }
    } else {
      text = pullPdfText(body);
    }
    if (text) pages.push({ page: pages.length + 1, text: text.slice(0, 8000) });
  }
  if (!pages.length) {
    const loose = pullPdfText(raw);
    if (loose) pages.push({ page: 1, text: loose.slice(0, 8000) });
  }
  return pages;
}
