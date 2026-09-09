const { test } = require('node:test');
const assert = require('node:assert/strict');
const drafts = require('../tradeDraftCore.js');

test('draft storage is isolated by signed-in user and guest', () => {
  assert.equal(drafts.storageKey('alice'), 'trd-journey-trade-draft-v1:user:alice');
  assert.equal(drafts.storageKey('bob'), 'trd-journey-trade-draft-v1:user:bob');
  assert.equal(drafts.storageKey(null), 'trd-journey-trade-draft-v1:guest');
});

test('draft keeps approved form fields without screenshot file data', () => {
  const draft = drafts.createDraft({
    savedAt: 1000,
    values: { symbol: 'GBPJPY', risk: '100', note: 'Wait for confirmation', imageFile: 'secret', unknown: 'no', hasPlan: true, mistakes: ['FOMO'] },
    preflight: [{ text: 'Risk checked', checked: true }],
    advancedOpen: true
  });
  assert.equal(draft.values.symbol, 'GBPJPY');
  assert.equal(draft.values.hasPlan, true);
  assert.deepEqual(draft.values.mistakes, ['FOMO']);
  assert.equal(Object.hasOwn(draft.values, 'imageFile'), false);
  assert.equal(Object.hasOwn(draft.values, 'unknown'), false);
  assert.deepEqual(draft.preflight, [{ text: 'Risk checked', checked: true }]);
  assert.equal(draft.advancedOpen, true);
});

test('valid draft can be read and sanitized', () => {
  const raw = JSON.stringify({ version: 1, savedAt: 1000, values: { symbol: 'EURUSD', hasPlan: 1 }, preflight: [], advancedOpen: false, polluted: true });
  const draft = drafts.readDraft(raw, { now: 2000 });
  assert.equal(draft.values.symbol, 'EURUSD');
  assert.equal(draft.values.hasPlan, true);
  assert.equal(Object.hasOwn(draft, 'polluted'), false);
});

test('expired, future, malformed and incompatible drafts are rejected', () => {
  assert.equal(drafts.readDraft('{bad json'), null);
  assert.equal(drafts.readDraft({ version: 2, savedAt: 1000, values: {} }, { now: 2000 }), null);
  assert.equal(drafts.readDraft({ version: 1, savedAt: 1000, values: {} }, { now: 1000 + drafts.MAX_AGE_MS + 1 }), null);
  assert.equal(drafts.readDraft({ version: 1, savedAt: 70001, values: {} }, { now: 10000 }), null);
});

test('draft creation does not mutate submitted values', () => {
  const input = { values: { symbol: 'XAUUSD', mistakes: ['Late Entry'] }, preflight: [{ text: 'Rule', checked: false }] };
  const snapshot = structuredClone(input);
  drafts.createDraft(input);
  assert.deepEqual(input, snapshot);
});
