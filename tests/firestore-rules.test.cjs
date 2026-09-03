const {test}=require('node:test');const fs=require('node:fs');
const enabled=Boolean(process.env.FIRESTORE_EMULATOR_HOST);
test('Firestore blocks cross-user data access and client entitlement changes',{skip:!enabled},async()=>{
 const {initializeTestEnvironment,assertSucceeds,assertFails}=require('../functions/node_modules/@firebase/rules-unit-testing');
 const {doc,setDoc,getDoc,updateDoc,Timestamp}=require('../functions/node_modules/firebase/firestore');
 const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
 const env=await initializeTestEnvironment({projectId:'demo-trd-audit',firestore:{host,port:Number(port),rules:fs.readFileSync('firestore.rules','utf8')}});
 try{
  const a=env.authenticatedContext('a',{email:'a@example.test'}).firestore();const b=env.authenticatedContext('b',{email:'b@example.test'}).firestore();const guest=env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(a,'users/a'),{email:'a@example.test',createdAt:'now',subscription:{plan:'free',status:'active',limit:20}}));
  await assertFails(updateDoc(doc(a,'users/a'),{'subscription.plan':'pro'}));
  await assertFails(setDoc(doc(b,'users/b'),{email:'b@example.test',subscription:{plan:'pro',status:'active',limit:999999}}));
  await assertSucceeds(setDoc(doc(a,'users/a/data/state'),{ownerUid:'a',trades:[]}));
  await assertFails(getDoc(doc(b,'users/a/data/state')));await assertFails(getDoc(doc(guest,'users/a/data/state')));
  await assertFails(setDoc(doc(a,'users/a/data/state'),{ownerUid:'b',trades:[]}));
  await assertFails(setDoc(doc(a,'activation_keys/fake'),{tier:'lifetime'}));
  await assertFails(setDoc(doc(a,'redeemed_keys/fake'),{usedBy:'a'}));
  await assertFails(getDoc(doc(a,'redeemed_keys/fake')));
  await assertSucceeds(updateDoc(doc(a,'users/a'),{tradeCount:1,lastActiveAt:'now'}));
  const trades = n => Array.from({length:n},(_,i)=>({id:String(i)}));
  await assertSucceeds(setDoc(doc(a,'users/a/data/state'),{ownerUid:'a',trades:trades(20)}));
  await assertFails(setDoc(doc(a,'users/a/data/state'),{ownerUid:'a',trades:trades(21)}));
  // Forged profile counters cannot grant extra records.
  await assertSucceeds(updateDoc(doc(a,'users/a'),{tradeCount:0}));
  await assertFails(setDoc(doc(a,'users/a/data/state'),{ownerUid:'a',trades:trades(21)}));
  await env.withSecurityRulesDisabled(async admin=>{
    await updateDoc(doc(admin.firestore(),'users/a'),{subscription:{plan:'pro',status:'active',tier:'monthly',validUntilTimestamp:Timestamp.fromMillis(Date.now()+86400000)}});
  });
  await assertSucceeds(setDoc(doc(a,'users/a/data/state'),{ownerUid:'a',trades:trades(30)}));
  await env.withSecurityRulesDisabled(async admin=>{
    await updateDoc(doc(admin.firestore(),'users/a'),{'subscription.validUntilTimestamp':Timestamp.fromMillis(1)});
  });
  await assertSucceeds(setDoc(doc(a,'users/a/data/state'),{ownerUid:'a',trades:trades(30)}));
  await assertSucceeds(setDoc(doc(a,'users/a/data/state'),{ownerUid:'a',trades:trades(29)}));
  await assertFails(setDoc(doc(a,'users/a/data/state'),{ownerUid:'a',trades:trades(31)}));

 }finally{await env.cleanup();}
});
