const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const core=require('../stateSyncCore.js');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
function fixture(){
 const writes=[],errors=[];let fail=false;
 const context={document:{querySelectorAll:()=>[],getElementById:()=>null},window:{TRDStateSync:core,toast:(...a)=>errors.push(a),TRDCloudSync:{schedulePush(){},stop(){}}},structuredClone,console:{error(){}},renderAll(){},resetTradeForm(){},normalizeState:x=>x,idbSet:async(key,value)=>{if(fail)throw new Error('disk full');writes.push({key,value});},loadState:async()=>({trades:[],longGame:{events:[]}})};
 vm.createContext(context);vm.runInContext(`const STORAGE_KEY='trd-journey-os-v1';let state={trades:[]};let localOwnerUid='a',localGeneration=0,observedState={},durableState=null;let localWriteQueue=Promise.resolve(),accountSwitchQueue=Promise.resolve();const storageKeyFor=uid=>STORAGE_KEY+':'+(uid?'user:'+uid:'guest');`,context);
 vm.runInContext(source.slice(source.indexOf('async function saveState('),source.indexOf('function activeSop()')),context);
 return {context,writes,errors,fail:()=>fail=true};
}
test('first save synchronizes window state and commits under its own UID',async()=>{
 const f=fixture();await f.context.saveState();assert.equal(f.writes[0].key,'trd-journey-os-v1:user:a');assert.equal(f.context.window.state.ownerUid,'a');
 await f.context.window.TRDLocalStore.switchUser('b');assert.equal(f.writes.at(-1).key,'trd-journey-os-v1:user:b');
 assert.equal(f.context.window.TRDLocalStore.getSnapshot().ownerUid,'b');
});
test('failed persistence returns false and does not claim a durable snapshot',async()=>{
 const f=fixture();f.fail();assert.equal(await f.context.saveState(),false);assert.equal(f.context.window.TRDLocalStore.getSnapshot(),null);assert.equal(f.errors.length,1);
});
test('remote update explicitly persists without capturing an undefined save callback',async()=>{
 const f=fixture();assert.equal(await f.context.window.TRDLocalStore.applyRemote({ownerUid:'a',trades:[{id:'cloud'}]},'a'),true);
 assert.equal(f.writes[0].value.trades[0].id,'cloud');
 assert.equal(await f.context.window.TRDLocalStore.applyRemote({trades:[{id:'wrong'}]},'b'),false);
});
