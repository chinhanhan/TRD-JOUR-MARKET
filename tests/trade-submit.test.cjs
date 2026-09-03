const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
function fixture({ pnl = '200', r = '-1', risk = 100, image = false } = {}) {
  const trade = { id: 'trade', status: 'open', risk, openTime: '2026-09-03T09:30' };
  const values = { pnl, rResult: r, closeTime: '2026-09-03T10:30', rule: 'true', emotion: 'Calm', exitNote: '' };
  const container = { dataset: { closeId: 'trade' }, querySelector: selector => {
    const name = selector.match(/name="([^"]+)"/)[1];
    return name === 'imageFile' ? { files: image ? ['file'] : [] } : { value: values[name] };
  }};
  let release, saves = 0;
  const imageRead = new Promise(resolve => { release = resolve; });
  const errors = [];
  const context = { document: { getElementById: () => container }, console, window: { dispatchEvent() {} }, Event,
    state: { trades: [trade] }, localGeneration: 1, fileToDataUrl: () => imageRead,
    saveState: async () => { saves++; return true; }, toast: (...args) => errors.push(args), t: s => s,
    closeModal() {}, renderAll() {}, sopProgress: () => ({ records: 1 }), sopName: () => 'Test', rValue: t => t.pnl / t.risk };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function closeTradeFromModal('), source.indexOf('function imagesFor(')), context);
  return { trade, context, errors, release, saves: () => saves, submit: () => context.closeTradeFromModal({ preventDefault() {} }) };
}
test('invalid R-only close leaves an open trade untouched', async () => {
  const f = fixture({ pnl: '', r: '2', risk: 0 }); await f.submit();
  assert.equal(f.trade.status, 'open'); assert.equal(f.saves(), 0); assert.equal(f.errors.length, 1);
});
test('double-clicking close commits once and P&L overrides R', async () => {
  const f = fixture({ image: true }); const first = f.submit(); await f.submit(); f.release('data:image/png;base64,test'); await first;
  assert.equal(f.saves(), 1); assert.equal(f.trade.pnl, 200); assert.equal(f.trade.rMultiple, '');
});
test('switching users while a screenshot is read cancels the old submission', async () => {
  const f = fixture({ image: true }); const first = f.submit(); f.context.localGeneration++; f.release('image'); await first;
  assert.equal(f.saves(), 0); assert.equal(f.trade.status, 'open');
});
