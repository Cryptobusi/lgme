import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'vendor') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.mjs') || name.endsWith('.js')) out.push(path);
  }
  return out;
}

test('application code does not import elliptic, and the direct dependency is absent', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies.elliptic, undefined);
  assert.equal(pkg.overrides['@grpc/grpc-js'], '1.14.7');
  assert.equal(pkg.overrides.protobufjs, '8.8.1');
  const files = walk(join(root, 'js')).concat(walk(join(root, 'api')));
  for (const path of files) {
    assert.equal(readFileSync(path, 'utf8').includes("from 'elliptic'"), false, path);
  }
});
