const { test } = require('node:test');
const assert = require('node:assert/strict');
const validation = require('../tradeValidationCore.js');

const validOpen = { currentStatus: 'open', openTime: '2026-09-09T09:30', closeTime: '', risk: 100, pnl: '', maeR: '', mfeR: '' };

test('a valid open trade does not require a result or closing time', () => {
  assert.deepEqual(validation.validateDraft(validOpen), { valid: true, completing: false, errors: [] });
});

test('a completed trade requires both closing time and explicit Net P&L', () => {
  const missingPnl = validation.validateDraft({ ...validOpen, closeTime: '2026-09-09T10:30' });
  assert.deepEqual(missingPnl.errors.map(error => error.code), ['pnl_required']);
  const missingClose = validation.validateDraft({ ...validOpen, pnl: '0' });
  assert.deepEqual(missingClose.errors.map(error => error.code), ['close_time_required']);
  assert.equal(validation.validateDraft({ ...validOpen, closeTime: '2026-09-09T10:30', pnl: '0' }).valid, true);
});

test('closing time cannot precede opening time', () => {
  const result = validation.validateDraft({ ...validOpen, closeTime: '2026-09-09T08:30', pnl: '-100' });
  assert.deepEqual(result.errors.map(error => error.code), ['close_before_open']);
});

test('risk and numeric review fields reject invalid values', () => {
  const result = validation.validateDraft({ ...validOpen, risk: 0, maeR: 'bad', mfeR: 'Infinity' });
  assert.deepEqual(result.errors.map(error => error.code), ['risk_positive', 'maeR_invalid', 'mfeR_invalid']);
});

test('editing an existing closed trade remains a completed record', () => {
  const result = validation.validateDraft({ ...validOpen, currentStatus: 'closed' });
  assert.deepEqual(result.errors.map(error => error.code), ['close_time_required', 'pnl_required']);
});

test('validation does not mutate the submitted draft', () => {
  const draft = { ...validOpen, closeTime: '2026-09-09T08:30', pnl: '-100' };
  const snapshot = structuredClone(draft);
  validation.validateDraft(draft);
  assert.deepEqual(draft, snapshot);
});
