import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) walk(path, out);
    else if (name.name.endsWith('.mjs')) out.push(path);
  }
  return out;
}

test('every API import points at a file that exists', () => {
  const missing = [];
  for (const file of walk(join(root, 'api'))) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/from '(\.[^']+)'/g)) {
      const target = resolve(dirname(file), match[1]);
      if (!existsSync(target)) missing.push(`${file.slice(root.length)} -> ${match[1]}`);
    }
  }
  assert.deepEqual(missing, []);
  const page = readFileSync(join(root, 'barrier-checks.html'), 'utf8');
  assert.match(page, /Up to \$100 bilateral/);
  assert.match(readFileSync(join(root, 'exchange.html'), 'utf8'), /href="\/barrier-checks"/);
  assert.match(readFileSync(join(root, 'help.html'), 'utf8'), /href="\/barrier-checks"/);
  const worker = readFileSync(join(root, 'sw.js'), 'utf8');
  assert.equal(worker.includes('/docs/SPP_Overview.pptx'), false);
  assert.equal(worker.includes('/docs/breach-response-plan.md'), false);
});
