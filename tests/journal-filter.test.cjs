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

test('closed trades sort by close chronology without mutating input', () => {
  const input = [
    { id: 'older', date: '2026-09-01', closeTime: '2026-09-01T12:00', risk: 100, pnl: 300 },
    { id: 'newer', date: '2026-09-03', closedAt: '2026-09-04', risk: 100, pnl: -100 },
    { id: 'middle', date: '2026-09-02', risk: 100, pnl: 50 }
  ];
  const snapshot = structuredClone(input);
  assert.deepEqual(filter.sortTrades(input, 'newest').map(t => t.id), ['newer', 'middle', 'older']);
  assert.deepEqual(filter.sortTrades(input, 'oldest').map(t => t.id), ['older', 'middle', 'newer']);
  assert.deepEqual(input, snapshot);
});

test('R sorting uses Net P&L divided by risk with deterministic ties', () => {
  const input = [
    { id: 'invalid', date: '2026-09-04', risk: 0, pnl: 9999 },
    { id: 'two-r-old', date: '2026-09-01', risk: 100, pnl: 200 },
    { id: 'loss', date: '2026-09-03', risk: 50, pnl: -50 },
    { id: 'two-r-new', date: '2026-09-02', risk: 50, pnl: 100 }
  ];
  assert.deepEqual(filter.sortTrades(input, 'bestR').map(t => t.id), ['two-r-new', 'two-r-old', 'invalid', 'loss']);
  assert.deepEqual(filter.sortTrades(input, 'worstR').map(t => t.id), ['loss', 'invalid', 'two-r-new', 'two-r-old']);
});

test('unknown sort mode safely falls back to newest first', () => {
  assert.deepEqual(filter.sortTrades(trades, 'unexpected').map(t => t.id), ['be', 'loss', 'win', 'open']);
  assert.deepEqual(filter.sortTrades(null, 'bestR'), []);
});
