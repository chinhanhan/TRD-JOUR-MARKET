const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { codeHash } = require('../functions/entitlements.cjs');
function fixture() {
  const records = new Map();
  const snap = ref => ({ exists: records.has(ref.path), data: () => structuredClone(records.get(ref.path)) });
  const db = { collection: collection => ({ doc: id => ({ path: `${collection}/${id}` }) }),
    runTransaction: async callback => {
      const writes = [];
      const tx = { get: async ref => snap(ref), set: (ref, value, options) => writes.push([ref.path, value, options?.merge]),
        update: (ref, value) => writes.push([ref.path, value, true]), create: (ref, value) => { assert.ok(!records.has(ref.path)); writes.push([ref.path, value, false]); } };
      const result = await callback(tx);
      for (const [path, value, merge] of writes) records.set(path, merge ? { ...records.get(path), ...value } : value);
      return result;
    } };
  let event, signatureValid = true;
  const stripe = { webhooks: { constructEvent() { if (!signatureValid) throw Error('bad signature'); return event; } },
    checkout: { sessions: { retrieve: async () => stripe.session, list: async () => ({ data: [stripe.session] }) } },
    invoices: { retrieve: async () => stripe.invoice } };
  class HttpsError extends Error { constructor(code, text) { super(text); this.code = code; } }
  const secrets = { STRIPE_PRICE_TIERS: JSON.stringify({ price_ok: 'monthly' }) };
  const modules = {
    'firebase-functions/v2/https': { onCall: (opts, fn) => fn, onRequest: (opts, fn) => fn, HttpsError },
    'firebase-functions/params': { defineSecret: name => ({ value: () => secrets[name] || 'test-only' }) },
    'firebase-admin/app': { initializeApp() {} },
    'firebase-admin/firestore': { getFirestore: () => db, Timestamp: { now: () => 0, fromDate: date => date.toISOString() } },
    'firebase-admin/auth': { getAuth: () => ({ getUser: async () => ({ disabled: false }) }) },
    stripe: function() { return stripe; }, './entitlements.cjs': require('../functions/entitlements.cjs')
  };
  const context = { exports: {}, require: name => { if (!(name in modules)) throw Error(name); return modules[name]; }, console: { error() {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../functions/index.js'), 'utf8'), context);
  return { records, stripe, redeem: context.exports.redeemKey, invalidSignature: () => { signatureValid = false; },
    async webhook(value) { event = value; const response = { status(code) { this.code = code; return this; }, send() {}, json() {} };
      await context.exports.stripeWebhook({ method: 'POST', headers: { 'stripe-signature': 'test' }, rawBody: Buffer.from('test') }, response); return response.code; }
  };
}
test('redemption requires auth and consumes an inventory key once', async () => {
  const f = fixture(), code = 'TRD-ABCDEFGHIJKLMNOP';
  await assert.rejects(f.redeem({ data: { code } }), { code: 'unauthenticated' });
  f.records.set(`activation_keys/${codeHash(code)}`, { tier: 'monthly' });
  await f.redeem({ auth: { uid: 'a' }, data: { code } });
  const expiry = f.records.get('users/a').subscription.validUntil;
  assert.equal((await f.redeem({ auth: { uid: 'a' }, data: { code } })).alreadyRedeemed, true);
  assert.equal(f.records.get('users/a').subscription.validUntil, expiry);
  await assert.rejects(f.redeem({ auth: { uid: 'b' }, data: { code } }), { code: 'already-exists' });
  assert.ok(!f.records.has('users/b'));
});
test('invalid activation attempts are rate limited without granting access', async () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) await assert.rejects(f.redeem({ auth: { uid: 'a' }, data: { code: 'invalid' } }), { code: 'invalid-argument' });
  await assert.rejects(f.redeem({ auth: { uid: 'a' }, data: { code: 'invalid' } }), { code: 'resource-exhausted' });
  assert.ok(!f.records.has('users/a'));
});
test('unverified Stripe webhook cannot write a profile', async () => {
  const f = fixture(); f.invalidSignature();
  assert.equal(await f.webhook({}), 400); assert.equal(f.records.size, 0);
});
test('paid invoice grants only its paid period and is idempotent', async () => {
  const f = fixture(); const paidEnd = Math.floor(Date.now() / 1000) + 86400;
  f.stripe.session = { id: 'cs_1', payment_status: 'paid', client_reference_id: 'a', line_items: { data: [{ quantity: 1, price: { id: 'price_ok' } }] },
    subscription: { id: 'sub_1', status: 'active', current_period_end: paidEnd + 2592000 } };
  f.stripe.invoice = { id: 'in_1', status: 'paid', subscription: 'sub_1', lines: { data: [{ price: { id: 'price_ok' }, period: { end: paidEnd } }] } };
  const event = { id: 'evt_1', type: 'invoice.paid', data: { object: { id: 'in_1' } } };
  assert.equal(await f.webhook(event), 200);
  const expected = new Date(paidEnd * 1000).toISOString();
  assert.equal(f.records.get('users/a').subscription.validUntil, expected);
  assert.equal(await f.webhook({ ...event, id: 'evt_retry' }), 200);
  assert.equal(f.records.get('users/a').subscription.validUntil, expected);
});
