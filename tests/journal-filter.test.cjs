const { test } = require('node:test');
const assert = require('node:assert/strict');
const filter = require('../journalFilterCore.js');

const trades = [
  { id: 'open', accountId: 'a', status: 'open', date: '2026-09-01', symbol: 'NQ', setup: 'Opening Drive', session: 'New York', grade: 'B', emotion: 'Calm', entryPlan: 'Wait for VWAP reclaim', pnl: 0, ruleStatus: 'followed' },
  { id: 'win', accountId: 'a', status: 'closed', date: '2026-09-02', symbol: 'GBPJPY', setup: 'Liquidity Sweep', session: 'London', grade: 'A', emotion: 'Focused', exitNote: 'Followed plan', mistakes: [], pnl: 200, ruleStatus: 'followed' },
  { id: 'loss', accountId: 'b', status: 'closed', date: '2026-09-03', symbol: 'ES', setup: 'Range Fade', session: 'Asian', grade: 'C', emotion: 'FOMO', note: 'Entré too early', mistakes: ['Revenge entry'], pnl: -100, rule: false },
  { id: 'be', accountId: 'b', status: 'closed', date: '2026-09-04', symbol: 'GC', setup: 'Breakout', session: 'Other', grade: 'B', emotion: 'Hesitant', pnl: 0, rule: 'incomplete' }
];

test('search is case, accent and whitespace insensitive across journal text', () => {
  assert.deepEqual(filter.filterTrades(trades, { query: '  ENTRE revenge ' }).map(t => t.id), ['loss']);
  assert.deepEqual(filter.filterTrades(trades, { query: 'vwap NQ' }).map(t => t.id), ['open']);
});

test('advanced filters combine without mutating input records', () => {
  const snapshot = structuredClone(trades);
  assert.deepEqual(filter.filterTrades(trades, { status: 'closed', session: 'London', outcome: 'win', grade: 'A', emotion: 'Focused', setup: 'Liquidity Sweep', rule: 'followed' }).map(t => t.id), ['win']);
  assert.deepEqual(trades, snapshot);
});

test('date range is inclusive and uses the trade entry date', () => {
  assert.deepEqual(filter.filterTrades(trades, { dateFrom: '2026-09-02', dateTo: '2026-09-03' }).map(t => t.id), ['win', 'loss']);
  assert.deepEqual(filter.filterTrades(trades, { dateFrom: '2026-09-04', dateTo: '2026-09-02' }), []);
});

test('legacy session and rule values map to current filter values', () => {
  assert.deepEqual(filter.filterTrades(trades, { session: 'Asia', rule: 'violated' }).map(t => t.id), ['loss']);
  assert.deepEqual(filter.filterTrades(trades, { outcome: 'breakeven', rule: 'incomplete' }).map(t => t.id), ['be']);
});

test('empty filters preserve every record and tolerate missing input', () => {
  assert.deepEqual(filter.filterTrades(trades, {}).map(t => t.id), trades.map(t => t.id));
  assert.deepEqual(filter.filterTrades(null, {}), []);
});

test('an explicit account filter limits cross-account results', () => {
  assert.deepEqual(filter.filterTrades(trades, { account: 'a' }).map(t => t.id), ['open', 'win']);
  assert.deepEqual(filter.filterTrades(trades, { account: 'All' }).map(t => t.id), trades.map(t => t.id));
});
