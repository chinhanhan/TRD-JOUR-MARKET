const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const context={window:{},todayISO:()=> '2026-09-03',uid:()=> 'id',defaultPreferences:{defaultSymbol:'X',setups:['S']}};vm.createContext(context);
vm.runInContext(app.slice(app.indexOf('function rValue('),app.indexOf('function formatR(')),context);
vm.runInContext(app.slice(app.indexOf('function normalizeTrade('),app.indexOf('function makeSopId(')),context);
vm.runInContext(app.slice(app.indexOf('function getTradeRuleStatus('),app.indexOf('function ruleTag(')),context);
test('R follows P&L and risk despite stale R inputs',()=>{
 assert.equal(context.rValue({pnl:200,risk:100,rMultiple:-1}),2);
 assert.equal(context.rValue({pnl:200,risk:0}),0);
 assert.equal(context.rValue({pnl:200,risk:Infinity}),0);
 assert.equal(context.rValue({pnl:0,risk:100,rMultiple:3}),0);
});
test('legacy R-only backups migrate without overwriting explicit P&L',()=>{
 assert.equal(context.normalizeTrade({risk:100,rMultiple:2}).pnl,200);
 assert.equal(context.normalizeTrade({risk:100,rMultiple:2,pnl:0}).pnl,0);
 assert.equal(context.normalizeTrade({updatedAt:'2026-09-01',isDemo:true}).updatedAt,'2026-09-01');
 assert.equal(context.normalizeTrade({isDemo:true}).isDemo,true);
});
let html='';context.window={rValue:context.rValue,getTradeRuleStatus:context.getTradeRuleStatus,state:{activeAccountId:'a',accounts:[{id:'a',name:'<unsafe>'}]},TRDAuth:{getSubscription:()=>({plan:'pro'})},open:()=>({document:{write:s=>html=s,close(){}}})};
const engine=fs.readFileSync(require.resolve('../dataEngine.js'),'utf8');vm.runInContext(engine.slice(0,engine.indexOf('class ForexFactoryRedNewsEngine'))+'\nthis.engine = new TRDDataEngine();',context);
test('month report selects closed trades by close date/account and escapes HTML',()=>{
 context.window.state.trades=[
 {id:'1',status:'closed',date:'2025-01-01',closedAt:'2026-09-02',accountId:'a',symbol:'<b>test</b>',pnl:100,risk:100,rule:false},
 {id:'2',status:'open',date:'2026-09-02',accountId:'a',symbol:'OPEN'},
 {id:'3',status:'closed',date:'2026-08-02',accountId:'a',symbol:'OLD'},
 {id:'4',status:'closed',date:'2026-09-02',accountId:'b',symbol:'OTHER'}];
 context.engine.generateReport({month:'2026-09'});
 assert.ok(html.includes('&lt;b&gt;test&lt;/b&gt;'));assert.ok(html.includes('&lt;unsafe&gt;'));
 for(const marker of ['<b>test</b>','OPEN','OLD','OTHER'])assert.ok(!html.includes(marker));
 assert.match(html,/Cumulative Net R[\s\S]*?\+1.00R/);assert.match(html,/Disciplined Rule Compliance[\s\S]*?>0%/);
});
test('empty active state never falls back to another users legacy data',()=>{
 context.window.state.trades=[];assert.equal(context.engine.getTrades().length,0);
});
vm.runInContext(app.slice(app.indexOf('function closedTrades('),app.indexOf('function openTrades(')),context);
vm.runInContext(app.slice(app.indexOf('function metrics('),app.indexOf('function byDate(')),context);
test('drawdown follows closing chronology even when cloud records arrive in ID order',()=>{
 const trades=[
 {id:'a',status:'closed',closeTime:'2026-09-03T12:00',pnl:-200,risk:100},
 {id:'b',status:'closed',closeTime:'2026-09-03T10:00',pnl:-200,risk:100},
 {id:'c',status:'closed',closeTime:'2026-09-03T11:00',pnl:300,risk:100}];
 const result=context.metrics(trades);assert.equal(result.maxDrawdown,-2);assert.equal(result.totalR,-1);
 assert.equal(trades[0].id,'a');
});
context.structuredClone=structuredClone;context.localOwnerUid='a';context.defaultSopDetails={checklist:[],weaknesses:[]};context.parseSopChecklistRules=value=>value||[];
vm.runInContext(app.slice(app.indexOf('function makeSopId('),app.indexOf('async function saveState(')),context);
vm.runInContext(app.slice(app.indexOf('function normalizeState('),app.indexOf('function detectTradingSession(')),context);
test('a trade-only legacy backup does not recreate unrelated default SOPs',()=>{
 const result=context.normalizeState({trades:[{id:'legacy',setup:'Recovered',date:'2026-09-03'}]});
 assert.deepEqual(Array.from(result.preferences.setups),['Recovered']);assert.equal(result.sops.length,1);assert.equal(result.sops[0].name,'Recovered');
});
