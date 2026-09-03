const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../auth.js'),'utf8');
function fixture(cached=null){
 const writes=[];const callbacks=[];const elements={appShell:{style:{}},redeemKeyInput:{value:'VALID-CODE-123456789'},redeemFeedbackMsg:{style:{}}};const user={uid:'u',email:'u@example.test',getIdToken:async()=> 'test-token'};
 const ref={get:async()=>({exists:true,data:()=>({subscription:{plan:'free',limit:20}})}),set:async x=>writes.push(x),onSnapshot:()=>()=>{}};
 const window={location:{href:'https://example.test/?upgrade=success&session_id=fake'},history:{replaceState(){}},fbApp:{options:{projectId:'demo-test'}},fbDb:{collection:()=>({doc:()=>ref})},fbAuth:{onAuthStateChanged:f=>callbacks.push(f)},TRDAppReady:Promise.resolve(),TRDLocalStore:{switchUser:async()=>{},getCachedProfile:async()=>cached,cacheProfile:async()=>{}},toast(){}};
 const ctx={window,URL,fetch:async()=>({ok:true,json:async()=>({result:{alreadyRedeemed:false}})}),document:{readyState:'loading',addEventListener(){},getElementById:id=>elements[id]||null},console,localStorage:{removeItem(){}},sessionStorage:{getItem:()=>null}};
 vm.runInNewContext(source,ctx);const auth=window.TRDAuth;auth.renderAuthenticatedUI=()=>{};auth.renderAnonymousUI=()=>{};auth.closeModal=()=>{};auth.listenAuth();
 return {auth,writes,ref,window,elements,signIn:()=>callbacks[0](user),signOut:()=>callbacks[0](null)};
}
test('a forged success redirect never grants or writes Pro',async()=>{
 const f=fixture();await f.signIn();assert.equal(f.auth.getSubscription().plan,'free');assert.equal(f.writes.length,0);
});
test('subscription getter does not expose a mutable entitlement reference',async()=>{
 const f=fixture();await f.signIn();f.auth.getSubscription().plan='pro';assert.equal(f.auth.getSubscription().plan,'free');
});

test('cached profile opens an existing account even when the network never resolves',async()=>{
 const f=fixture({subscription:{plan:'pro',tier:'lifetime',status:'active'}});
 f.ref.get=()=>new Promise(()=>{});
 await f.signIn();assert.equal(f.auth.getSubscription().plan,'pro');assert.equal(f.writes.length,0);
});
test('expired cached subscriptions fall back to the free limit',async()=>{
 const f=fixture({subscription:{plan:'pro',tier:'monthly',status:'active',validUntil:'2020-01-01'}});
 await f.signIn();assert.equal(f.auth.getSubscription().plan,'free');assert.equal(f.auth.getSubscription().limit,20);
});
test('redemption refreshes the server profile instead of reusing the free cache',async()=>{
 const f=fixture({subscription:{plan:'free',limit:20}});await f.signIn();
 let pushes=0;f.window.TRDCloudSync={schedulePush:()=>pushes++};
 f.ref.get=async options=>{assert.equal(options.source,'server');return {exists:true,data:()=>({subscription:{plan:'pro',tier:'lifetime',status:'active'}})};};
 await f.auth.handleRedeemKey();assert.equal(f.auth.getSubscription().plan,'pro');assert.equal(pushes,1);
 assert.match(f.elements.redeemFeedbackMsg.textContent,/Activation confirmed/);
});
test('signing out during the redemption profile refresh cannot reopen the old account',async()=>{
 const f=fixture({subscription:{plan:'free',limit:20}});await f.signIn();
 let release,started;const pending=new Promise(resolve=>started=resolve);
 f.ref.get=()=>{started();return new Promise(resolve=>release=resolve);};
 let renders=0;f.auth.renderAuthenticatedUI=()=>renders++;
 const redeem=f.auth.handleRedeemKey();await pending;await f.signOut();
 release({exists:true,data:()=>({subscription:{plan:'pro',tier:'lifetime',status:'active'}})});
 await redeem;assert.equal(renders,0);assert.equal(f.auth.getSubscription().plan,'free');
});
