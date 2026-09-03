const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const backup = require('../backupCore.js');
test('backup import rejects unrelated JSON and corrupt records before normalization', () => {
  for (const value of [null, [], { hello: 'world' }, { trades: [null] }, { trades: [{ openTime: 5 }] }]) assert.throws(() => backup.validate(value));
  assert.equal(backup.validate({ state: { trades: [] } }).trades.length, 0);
});
test('backup merge preserves current additions and all behavioral records', () => {
  const current = { ownerUid: 'a', trades: [{id:'new-sync'}], longGame: { events: [{id:'a'}], rawJournal: [{id:'j1'}], weeklyReviews: [{id:'w1'}] }, preferences: {setups:['A']} };
  const incoming = { ownerUid: 'b', trades: [{id:'old',pnl:1}], longGame: { events: [{id:'b'}], rawJournal: [{id:'j2'}], weeklyReviews: [{id:'w2'}] }, preferences: {setups:['B']} };
  const result=backup.merge(current,incoming);
  assert.equal(result.ownerUid,'a');assert.equal(result.trades.length,2);assert.equal(result.longGame.events.length,2);assert.equal(result.longGame.rawJournal.length,2);assert.equal(result.longGame.weeklyReviews.length,2);
  assert.deepEqual(result.preferences.setups,['A','B']);assert.equal(current.trades.length,1);
});
test('untrusted backup metadata cannot inject prototypes or stale sync deletions',()=>{
  const raw=JSON.parse('{"trades":[],"_sync":{"clock":999999999999999},"dailyPlans":{"__proto__":{"polluted":true}}}');
  const value=backup.validate(raw);assert.equal(value._sync,undefined);assert.equal(Object.hasOwn(value.dailyPlans,'__proto__'),false);assert.equal({}.polluted,undefined);
});
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const ctx={window:{},URL};vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('const safe ='),source.indexOf('function parseMarkdown(')),ctx);
test('external media blocks executable URLs while preserving normal screenshots',()=>{
  for(const url of ['javascript:alert(1)','java\nscript:alert(1)','data:text/html,<script>','data:image/svg+xml,<svg>','https://u:p@example.com']) assert.equal(ctx.externalUrl(url,true),'');
  assert.equal(ctx.externalUrl('https://example.com/chart.png',true),'https://example.com/chart.png');
  assert.equal(ctx.externalUrl('data:image/png;base64,YWJj',true),'data:image/png;base64,YWJj');
});
test('hostile IDs stay one inert argument inside inline actions',()=>{
  const id=`x');window.hacked=true;//"<img>`;
  const encoded=ctx.window.safeJs(id);
  const js=encoded.replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  vm.runInContext(`window.argument=${js}`,ctx);
  assert.equal(ctx.window.argument,id);assert.equal(ctx.window.hacked,undefined);assert.ok(!encoded.includes('<img>'));
});
vm.runInContext(source.slice(source.indexOf('function groupBy('),source.indexOf('function dateRange(')),ctx);
test('strategy names matching prototype properties remain ordinary groups',()=>{
 const groups=ctx.groupBy([{setup:'__proto__'},{setup:'constructor'}],'setup');
 assert.equal(groups.__proto__.length,1);assert.equal(groups.constructor.length,1);
});
