const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('index has unique IDs and every local asset exists', () => {
  const html = read('index.html');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate HTML id found');
  const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)]
    .map(match => match[1].split('?')[0])
    .filter(ref => ref && !/^(?:https?:|#|mailto:|tel:)/.test(ref));
  for (const ref of new Set(refs)) assert.equal(fs.existsSync(path.join(root, ref)), true, `missing local asset: ${ref}`);
});

test('app has no duplicate top-level function declarations', () => {
  const names = [...read('app.js').matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(match => match[1]);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('hosting files and offline cache remain aligned', () => {
  const prepare = read('scripts/prepare-hosting.cjs');
  const worker = read('sw.js');
  const publicBlock = prepare.match(/const publicFiles = \[(.*?)\];/s)?.[1] || '';
  const assetBlock = worker.match(/const ASSETS = \[(.*?)\];/s)?.[1] || '';
  const publicFiles = new Set([...publicBlock.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]));
  const cached = new Set([...assetBlock.matchAll(/'([^']+)'/g)].map(match => match[1].replace(/^\.\//, '') || 'index.html'));
  publicFiles.delete('sw.js');
  assert.deepEqual([...publicFiles].sort(), [...cached].sort());
});

test('runtime assets use the active cache version', () => {
  const version = read('sw.js').match(/CACHE_NAME = 'trd-journey-v(\d+)'/)?.[1];
  assert.ok(version, 'service worker cache version missing');
  const refs = [...read('index.html').matchAll(/\b(?:src|href)="([^"?]+\.(?:js|css|png))(?:\?v=([^"]+))?"/g)]
    .filter(match => !match[1].startsWith('http'));
  for (const [, file, refVersion] of refs) assert.equal(refVersion, version, `${file} cache version is stale`);
});

test('interactive launch controls have one click owner', () => {
  const tags = read('index.html').match(/<[^>]+>/g) || [];
  const launchers = tags.filter(tag => /\bdata-open-capture\b/.test(tag) || /\bclass="[^"]*css3d-card/.test(tag) || /\bid="headerLogTradeBtn"/.test(tag));
  for (const tag of launchers) assert.equal(/\bonclick=/.test(tag), false, `duplicate inline click handler: ${tag}`);
});

test('critical persistence and R rules remain intact', () => {
  const app = read('app.js');
  const first = app.match(/async function saveState\(options = \{\}\) \{\n([^\n]+)/)?.[1].trim();
  assert.equal(first, 'window.state = state;');
  assert.match(app, /return pnl \/ risk;/);
  assert.match(app.match(/async function deleteSop\(.*?\n\}/s)?.[0] || '', /preferences\.setups/);
  assert.doesNotMatch(read('cloudSync.js'), /\balert\s*\(/);
});
