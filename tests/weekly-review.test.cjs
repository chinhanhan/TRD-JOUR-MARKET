const { test } = require('node:test');
const assert = require('node:assert/strict');
const review = require('../weeklyReviewCore.js');

function trade(id, pnl, extra = {}) {
  return { id, status: 'closed', risk: 100, pnl, setup: 'Sweep', session: 'London', mistakes: [], ...extra };
}

test('uses Net P&L divided by positive risk and ignores open trades', () => {
  assert.equal(review.rValue(trade('a', 250)), 2.5);
  assert.equal(review.rValue(trade('b', 250, { risk: 0 })), 0);
  const result = review.analyze([trade('a', 100), trade('open', -500, { status: 'open', mistakes: ['FOMO'] })]);
  assert.equal(result.sampleSize, 1);
  assert.equal(result.topMistake, null);
});

test('splits one loss across unique mistake tags without double counting', () => {
  const result = review.analyze([
    trade('a', -200, { mistakes: ['FOMO', 'Late Entry', 'FOMO'] }),
    trade('b', -100, { mistakes: ['FOMO'] })
  ]);
  assert.equal(result.topMistake.name, 'FOMO');
  assert.equal(result.topMistake.costR, 2);
  const totalAllocated = result.mistakeCosts.reduce((sum, item) => sum + item.costR, 0);
  assert.equal(totalAllocated, 3);
});

test('small samples ask for more reviewed trades instead of prescribing a change', () => {
  const result = review.analyze([
    trade('a', -100, { mistakes: ['FOMO'] }),
    trade('b', 200),
    trade('c', 100)
  ]);
  assert.equal(result.confidence, 'insufficient');
  assert.equal(result.focus.type, 'sample');
  assert.match(result.focus.title, /2 more reviewed trades/);
});

test('repeated setup and session signals require at least two trades', () => {
  const result = review.analyze([
    trade('a', 500, { setup: 'One-off', session: 'Asia' }),
    trade('b', 100),
    trade('c', 100),
    trade('d', -100, { setup: 'Breakout', session: 'New York' }),
    trade('e', 0, { setup: 'Breakout', session: 'New York' })
  ]);
  assert.equal(result.bestSetup.name, 'Sweep');
  assert.equal(result.bestSetup.count, 2);
  assert.equal(result.bestSession.name, 'London');
  assert.equal(result.bestSession.count, 2);
});

test('sufficient sample produces one focus from the largest observed mistake cost', () => {
  const input = [
    trade('a', -200, { mistakes: ['Late Entry'] }),
    trade('b', -100, { mistakes: ['FOMO'] }),
    trade('c', 100), trade('d', 150), trade('e', 50)
  ];
  const snapshot = structuredClone(input);
  const result = review.analyze(input);
  assert.equal(result.confidence, 'early');
  assert.equal(result.focus.type, 'mistake');
  assert.equal(result.topMistake.name, 'Late Entry');
  assert.match(result.focus.title, /Late Entry/);
  assert.deepEqual(input, snapshot);
});

test('a clean sufficient sample keeps one process focus', () => {
  const trades = Array.from({ length: 10 }, (_, index) => trade(String(index), 100));
  const result = review.analyze(trades);
  assert.equal(result.confidence, 'developing');
  assert.equal(result.focus.type, 'process');
});
