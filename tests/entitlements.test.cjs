const {test}=require('node:test');const assert=require('node:assert/strict');const {grant,codeHash,stripeTier}=require('../functions/entitlements.cjs');
test('trusted entitlement extends time once and never downgrades lifetime',()=>{
 const now=Date.parse('2026-09-03T00:00:00Z');const first=grant({},'monthly',now);
 assert.equal(first.validUntil,'2026-10-03T00:00:00.000Z');
 assert.equal(grant(first,'monthly',now).validUntil,'2026-11-02T00:00:00.000Z');
 const lifetime=grant({},'lifetime',now);assert.deepEqual(grant(lifetime,'monthly',now),lifetime);
});
test('replaying a fixed Stripe paid period does not add extra days',()=>{
 const end=Date.parse('2026-10-03T00:00:00Z'),now=end-86400000;
 const first=grant({},'monthly',now,end);assert.deepEqual(grant(first,'monthly',now,end),first);
});
test('only configured Stripe prices and quantities grant access',()=>{
 assert.equal(stripeTier([{quantity:1,price:{id:'price_ok'}}],{price_ok:'yearly'}),'yearly');
 assert.throws(()=>stripeTier([{quantity:1,price:{id:'price_fake'}}],{}));
 assert.throws(()=>stripeTier([{quantity:2,price:{id:'price_ok'}}],{price_ok:'yearly'}));
});
test('redemption uses normalized hashes, not a predictable prefix',()=>{
 assert.throws(()=>codeHash('TRD-PRO-VIP'));
 assert.equal(codeHash('TRD-ABCDEFGHIJKLMNOP'),codeHash(' trd-abcdefghijklmnop '));
 assert.equal(codeHash('TRD-ABCDEFGHIJKLMNOP').length,64);
});
test('a new monthly purchase does not restore revoked lifetime access',()=>{
 const now=Date.parse('2026-09-03T00:00:00Z');
 const revoked={...grant({},'lifetime',now),status:'revoked'};
 assert.equal(grant(revoked,'monthly',now).validUntil,'2026-10-03T00:00:00.000Z');
});
