const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../stateSyncCore.js');
const clone = x => structuredClone(x);
const base = () => ({trades:[{id:'t',pnl:100,risk:100}],sops:[{id:'s',name:'S'}],accounts:[],preferences:{setups:['S']},longGame:{events:[]}});

test('deletions propagate to an offline device and do not resurrect on reverse merge', () => {
  const old=base(), local=clone(old); local.trades=[]; core.stamp(local,old);
  assert.equal(core.merge(old,local).trades.length,0);
  assert.equal(core.merge(local,old).trades.length,0);
});
test('concurrent additions survive a transaction merge', () => {
  const old=base(), a=clone(old), b=clone(old);
  a.trades.push({id:'a',pnl:10}); b.trades.push({id:'b',pnl:20}); core.stamp(a,old);core.stamp(b,old);
  assert.deepEqual(core.merge(a,b).trades.map(t=>t.id).sort(),['a','b','t']);
});
test('local images never overwrite newer remote P&L', () => {
  const old=base(); old.trades[0].images=['local-image'];
  const fresh=clone(old);fresh.trades[0].pnl=200;core.stamp(fresh,old);
  fresh.trades[0].imagesCloudStripped=true;delete fresh.trades[0].images;
  const result=core.merge(old,fresh).trades[0];
  assert.equal(result.pnl,200);assert.deepEqual(result.images,['local-image']);
});
test('intentional image deletion is not undone', () => {
  const old=base();old.trades[0].images=['old'];
  const fresh=clone(old);fresh.trades[0].images=[];core.stamp(fresh,old);
  assert.deepEqual(core.merge(old,fresh).trades[0].images,[]);
});
test('independent daily plans and behavioral entries merge', () => {
  const old=base(),a=clone(old),b=clone(old);
  a.dailyPlans={'2026-09-01':{bias:'a'}};b.dailyPlans={'2026-09-02':{bias:'b'}};
  a.longGame.events.push({id:'event-a'});b.longGame.events.push({id:'event-b'});
  core.stamp(a,old);core.stamp(b,old);
  const result=core.merge(a,b);
  assert.equal(Object.keys(result.dailyPlans).length,2);assert.equal(result.longGame.events.length,2);
});
test('SOP deletion removes stale trade references and preference entries', () => {
  const old=base();old.trades[0].sopId='s';
  const a=clone(old);a.sops=[];a.preferences.setups=[];a.trades=[];core.stamp(a,old);
  const result=core.merge(old,a);assert.deepEqual(result.sops,[]);assert.deepEqual(result.trades,[]);assert.deepEqual(result.preferences.setups,[]);
});
test('deleted map fields do not return from another device', () => {
  const old=base();old.dailyPlans={day:{bias:'old'}};
  const a=clone(old);delete a.dailyPlans.day;core.stamp(a,old);
  assert.deepEqual(core.merge(old,a).dailyPlans,{});
});
test('a newer full screenshot survives an older cloud-stripped flag',()=>{
 const old=base();old.trades[0].images=['old'];
 const fresh=clone(old);fresh.trades[0].images=['new'];fresh.trades[0].imagesCloudStripped=true;core.stamp(fresh,old);
 assert.deepEqual(core.merge(old,fresh).trades[0].images,['new']);
});
