import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { linksFromAnswer, rankPages } from '../js/introduction.mjs';

const pages = [
  { title: 'Glossary', href: '/glossary', summary: 'Debit, credit, and Creo.' },
  { title: 'Health data', href: '/gym/health-data', summary: 'What the health beta stores on this phone.' },
  { title: 'Disclaimer', href: '/disclaimer', summary: 'Use is voluntary.' }
];

test('search stays on real pages', () => {
  assert.deepEqual(rankPages(pages, 'creo glossary').map((page) => page.href), ['/glossary']);
  assert.deepEqual(rankPages(pages, ''), []);
  const picked = linksFromAnswer(pages, 'See /glossary and https://example.com/trust');
  assert.deepEqual(picked.map((page) => page.href), ['/glossary']);
  const page = readFileSync(new URL('../introduction.html', import.meta.url), 'utf8');
  assert.match(page, /Debit = you owe/);
  assert.match(page, /id="intro-mic"/);
  assert.equal(page.includes('getUserMedia'), false);
});
