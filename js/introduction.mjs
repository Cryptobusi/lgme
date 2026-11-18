import { draftWithHelper, pickHelperSync } from './one-tap.mjs';
import { VOICE_BLOCKED, incognitoOn, voiceInputAllowed } from './incognito.mjs';

export function rankPages(pages, query) {
  const words = String(query || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1);
  if (!words.length) return [];
  return pages
    .map((page) => {
      const hay = `${page.title} ${page.summary} ${page.href}`.toLowerCase();
      const score = words.reduce((total, word) => total + (hay.includes(word) ? 1 : 0), 0);
      return { page, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title))
    .map((row) => row.page);
}

export function linksFromAnswer(pages, answer) {
  const text = String(answer || '');
  const lower = text.toLowerCase();
  const found = [];
  for (const page of pages) {
    if (text.includes(page.href) || lower.includes(String(page.title || '').toLowerCase())) found.push(page);
  }
  return found.filter((page, index) => found.indexOf(page) === index);
}

function paint(list, pages) {
  list.replaceChildren();
  if (!pages.length) {
    const item = document.createElement('li');
    item.textContent = 'Nothing matched.';
    list.append(item);
    return;
  }
  for (const page of pages) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = page.href;
    link.textContent = page.title;
    const summary = document.createElement('span');
    summary.className = 'sum';
    summary.textContent = page.summary || '';
    item.append(link, summary);
    list.append(item);
  }
}

async function boot() {
const list = document.getElementById('intro-list');
const hits = document.getElementById('intro-hits');
const note = document.getElementById('intro-note');
const form = document.getElementById('intro-find');
const field = document.getElementById('intro-q');
if (list && form && field) {
  let pages = [];
  const catalog = await fetch('/data/page-index.json').then((response) => response.json()).catch(() => []);
  pages = Array.isArray(catalog) ? catalog.filter((page) => page && page.href && page.title) : [];
  paint(list, pages);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = field.value.trim();
    const local = rankPages(pages, query);
    if (!query) {
      hits.replaceChildren();
      note.textContent = '';
      return;
    }
    note.textContent = 'Looking on this phone.';
    const helper = pickHelperSync();
    let matched = local;
    if (helper.ready) {
      const lines = pages.map((page) => `${page.href} ${page.title}`).join('\n').slice(0, 6000);
      const answer = await draftWithHelper(helper, {
        template: local.slice(0, 8).map((page) => page.href).join('\n'),
        prompt: `Read only. Reply with hrefs from this list and no others. Query: ${query}\n${lines}`,
        scope: window
      });
      const picked = linksFromAnswer(pages, answer?.text || '');
      if (picked.length) matched = picked;
    }
    paint(hits, matched.slice(0, 12));
    note.textContent = matched.length ? `${matched.length} on this phone. Nothing was sent.` : 'Nothing matched. Nothing was sent.';
  });
  const mic = document.getElementById('intro-mic');
  mic?.addEventListener('click', () => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      note.textContent = 'Voice is not on this device. Typing still works.';
      return;
    }
    const heard = new Speech();
    const onDevice = 'processLocally' in heard;
    if (incognitoOn(localStorage) && !onDevice) {
      note.textContent = voiceInputAllowed({ incognito: true, processLocally: false }).message || VOICE_BLOCKED;
      return;
    }
    if (incognitoOn(localStorage) && onDevice) heard.processLocally = true;
    heard.lang = navigator.language || 'en-US';
    heard.interimResults = true;
    heard.continuous = false;
    heard.onresult = (event) => {
      let said = '';
      const results = event.results || [];
      for (let index = 0; index < results.length; index += 1) said += results[index]?.[0]?.transcript || '';
      if (said.trim()) field.value = said.trim();
    };
    heard.onerror = () => { note.textContent = 'The microphone did not start. Typing still works.'; };
    try { heard.start(); } catch { note.textContent = 'Mic blocked: allow microphone in site settings'; }
  });
}
}
if (typeof document !== 'undefined') boot();
