const { test } = require('node:test');
const assert = require('node:assert/strict');
const symbols = require('../symbolAnalysisCore.js');

const trades = [
  { id: 'a', status: 'closed', date: '2026-01-01', closedAt: '2026-02-02', symbol: ' gbp jpy ', pnl: 200, risk: 100, session: 'London', direction: 'Long' },
  { id: 'b', status: 'closed', date: '2026-02-03', closedAt: '2026-02-03', symbol: 'GBPJPY', pnl: -100, risk: 100, session: 'London', direction: 'Short' },
  { id: 'c', status: 'closed', date: '2026-02-04', closedAt: '2026-02-04', symbol: 'GBPJPY', pnl: 0, risk: 100, session: 'London', direction: 'Long' },
  { id: 'd', status: 'open', date: '2026-02-05', symbol: 'gbpjpy', pnl: 0, risk: 100, session: 'London', direction: 'Long' },
  { id: 'e', status: 'closed', date: '2026-02-06', closedAt: '2026-02-06', symbol: '', pnl: 50, risk: 50, session: 'Asia', direction: 'Long' }
];

test('normalizes case and whitespace without guessing aliases', () => {
  assert.equal(symbols.normalizeSymbol(' xau usd '), 'XAUUSD');
  assert.notEqual(symbols.normalizeSymbol('GOLD'), symbols.normalizeSymbol('XAUUSD'));
});

test('win rate excludes breakeven trades while count retains them', () => {
  const result = symbols.metrics(trades.slice(0, 4));
  assert.equal(result.count, 3);
  assert.equal(result.wins, 1);
  assert.equal(result.losses, 1);
  assert.equal(result.breakevens, 1);
  assert.equal(result.winRate, 0.5);
  assert.equal(result.expectancy, 1 / 3);
});

test('invalid risk is disclosed and excluded from R-based metrics', () => {
  const result = symbols.metrics([
    { status: 'closed', pnl: 100, risk: 100 },
    { status: 'closed', pnl: -500, risk: 0 }
  ]);
  assert.equal(result.losses, 1);
  assert.equal(result.invalidRiskCount, 1);
  assert.equal(result.validRCount, 1);
  assert.equal(result.averageR, 1);
  assert.equal(result.profitFactor, Infinity);
});

test('all-breakeven samples expose no decisive trades', () => {
  const result = symbols.metrics([{ status: 'closed', pnl: 0, risk: 100 }]);
  assert.equal(result.decisiveCount, 0);
  assert.equal(result.winRate, 0);
});

test('analysis dates use close date and ignore outcome, status and query filters', () => {
  const result = symbols.analyze(trades, {
    dateFrom: '2026-02-02', dateTo: '2026-02-04', session: 'London',
    outcome: 'loss', status: 'open', query: 'nothing'
  });
  assert.equal(result.rows[0].label, 'GBPJPY');
  assert.equal(result.rows[0].count, 3);
  assert.equal(result.rows[0].openCount, 0);
});

test('an explicit account remains part of the analysis context', () => {
  const accountTrades = [
    { status: 'closed', symbol: 'NQ', accountId: 'a', closedAt: '2026-02-02', pnl: 100, risk: 100 },
    { status: 'closed', symbol: 'ES', accountId: 'b', closedAt: '2026-02-02', pnl: 100, risk: 100 }
  ];
  assert.deepEqual(symbols.analyze(accountTrades, { account: 'b' }).rows.map(row => row.label), ['ES']);
});

test('open trades are shown as exposure but excluded from performance', () => {
  const result = symbols.analyze(trades, { session: 'London' });
  assert.equal(result.openCount, 1);
  assert.equal(result.rows[0].count, 3);
  assert.equal(result.rows[0].openCount, 1);
});

test('missing symbols remain visible but are not rankable', () => {
  const result = symbols.analyze(trades, {});
  const missing = result.rows.find(row => row.key === '');
  assert.equal(missing.label, 'Unspecified symbol');
  assert.equal(missing.rankable, false);
  assert.equal(result.rows.at(-1).key, '');
});

test('sample confidence uses 30 and 50 trade thresholds', () => {
  assert.equal(symbols.sampleLevel(29), 'insufficient');
  assert.equal(symbols.sampleLevel(30), 'preliminary');
  assert.equal(symbols.sampleLevel(49), 'preliminary');
  assert.equal(symbols.sampleLevel(50), 'established');
});

test('sorting defaults to expectancy and supports requested alternatives', () => {
  const rows = [
    { label: 'A', rankable: true, expectancy: 0.2, winRate: 0.8, totalPnL: 20, count: 10 },
    { label: 'B', rankable: true, expectancy: 0.5, winRate: 0.4, totalPnL: 50, count: 5 }
  ];
  assert.deepEqual(symbols.sortRows(rows).map(row => row.label), ['B', 'A']);
  assert.deepEqual(symbols.sortRows(rows, 'winRate').map(row => row.label), ['A', 'B']);
  assert.deepEqual(symbols.sortRows(rows, 'count').map(row => row.label), ['A', 'B']);
});
