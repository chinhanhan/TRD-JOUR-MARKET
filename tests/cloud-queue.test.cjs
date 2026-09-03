const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const core=require('../stateSyncCore.js');
const source=fs.readFileSync(require.resolve('../cloudSync.js'),'utf8');
function fixture(){
 let owner='u', data={ownerUid:'u',trades:[]}, durable=structuredClone(data), remote={},writes=[],gate=null,listener;
 const window={state:data,TRDStateSync:core,addEventListener(){},toast(){},TRDLocalStore:{getOwnerUid:()=>owner,getSnapshot:()=>structuredClone(durable),applyRemote:async value=>{window.state=value;durable=structuredClone(value);return true;}}};
 const ref={get:async()=>({exists:Object.keys(remote).length>0,data:()=>remote}),onSnapshot:f=>{listener=f;return()=>{}},set:async()=>{}};
 window.fbDb={collection:()=>({doc:()=>({...ref,collection:()=>({doc:()=>ref})})}),runTransaction:async fn=>{
  if(gate)await gate;
  await fn({get:ref.get,set:(r,payload)=>{remote=structuredClone(payload);writes.push(payload);}});
 }};
 const timers=[];const context={window,document:{getElementById:()=>null},navigator:{onLine:true},Blob,console:{error(){}},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){}};
 vm.runInNewContext(source,context);
 return {sync:window.TRDCloudSync,window,writes,timers,block:()=>{let release;gate=new Promise(r=>release=r);return()=>{gate=null;release();}},change:()=>{const old=structuredClone(window.state);window.state.trades.push({id:'new',pnl:200});core.stamp(window.state,old);durable=structuredClone(window.state);},switch:()=>{owner='other';window.state={ownerUid:'other',trades:[]};},listener:()=>listener};
}
test('pending edit is flushed after a slow transaction',async()=>{
 const f=fixture();await f.sync.init('u');f.writes.length=0;
 const release=f.block();const first=f.sync.pushToCloudImmediate();f.change();const second=f.sync.pushToCloudImmediate();release();
 await Promise.all([first,second]);assert.equal(f.writes.length,2);assert.equal(f.writes.at(-1).trades.length,1);f.sync.stop();
});
test('account switching cancels old in-flight state application',async()=>{
 const f=fixture();await f.sync.init('u');const release=f.block();const pending=f.sync.pushToCloudImmediate();f.sync.stop();f.switch();release();
 assert.equal(await pending,false);assert.equal(f.window.state.ownerUid,'other');assert.deepEqual(f.window.state.trades,[]);
});
test('oversized text is rejected without destroying local data',()=>{
 const f=fixture(),data={trades:[],note:'x'.repeat(800*1024)};
 assert.throws(()=>f.sync.sanitizeStateForCloud(data),/750KB/);assert.equal(data.note.length,800*1024);
});
test('cloud optimization strips oldest imageData first and retains newest media',()=>{
 const f=fixture(),data={trades:[{id:'new',date:'2026-09-01',images:['x'.repeat(400*1024)]},{id:'old',date:'2025-01-01',imageData:'x'.repeat(400*1024)}]};
 const result=f.sync.sanitizeStateForCloud(data);assert.ok(result.trades[0].images);assert.equal(result.trades[1].imageData,undefined);assert.ok(data.trades[1].imageData);
});
