const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const Stripe = require('stripe');
const { codeHash, grant, stripeTier } = require('./entitlements.cjs');
initializeApp();
const db = getFirestore();
const stripeKey = defineSecret('STRIPE_SECRET_KEY');
const webhookKey = defineSecret('STRIPE_WEBHOOK_SECRET');
const priceTiers = defineSecret('STRIPE_PRICE_TIERS');
const withExpiry = value => ({ ...value, validUntilTimestamp: Timestamp.fromDate(new Date(value.validUntil)) });

exports.redeemKey = onCall({ region: 'us-central1', maxInstances: 5 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const uid = request.auth.uid;
  // Limits are committed separately so rejected codes still consume an attempt.
  await db.runTransaction(async tx => {
    const ref = db.collection('redemption_limits').doc(uid), snap = await tx.get(ref);
    const old = snap.data() || {}, now = Date.now();
    const count = now - (old.startedAt || 0) < 600000 ? old.count || 0 : 0;
    if (count >= 10) throw new HttpsError('resource-exhausted', 'Too many attempts. Try again in ten minutes.');
    tx.set(ref, { startedAt: count ? old.startedAt : now, count: count + 1 });
  });
  let hash;
  try { hash = codeHash(request.data?.code); }
  catch { throw new HttpsError('invalid-argument', 'Invalid activation code.'); }
  return db.runTransaction(async tx => {
    const keyRef = db.collection('activation_keys').doc(hash);
    const userRef = db.collection('users').doc(uid);
    const [keySnap, userSnap] = await Promise.all([tx.get(keyRef), tx.get(userRef)]);
    const key = keySnap.data();
    if (!key || key.disabled || (key.expiresAt && key.expiresAt.toMillis() <= Date.now())) throw new HttpsError('not-found', 'Code is invalid or expired.');
    if (key.redeemedBy) {
      if (key.redeemedBy === uid) return { alreadyRedeemed: true };
      throw new HttpsError('already-exists', 'This code has already been used.');
    }
    const subscription = withExpiry(grant(userSnap.data()?.subscription, key.tier, Date.now()));
    // Do not replace a lifetime purchase's provenance with a shorter code.
    if (userSnap.data()?.subscription?.tier !== 'lifetime') subscription.provider = 'redeem_code';
    tx.update(keyRef, { redeemedBy: uid, redeemedAt: Timestamp.now() });
    tx.set(userRef, { subscription }, { merge: true });
    return { alreadyRedeemed: false };
  });
});

async function fulfill(stripe, checkout, eventId, invoice = null) {
  // Fetch authoritative Checkout state, never trust a browser's return URL.
  const session = await stripe.checkout.sessions.retrieve(checkout.id, { expand: ['line_items', 'subscription'] });
  if (!['paid', 'no_payment_required'].includes(session.payment_status)) return;
  const uid = session.client_reference_id;
  if (!uid || uid.includes('/')) throw new Error('Checkout is missing a valid account reference.');
  const user = await getAuth().getUser(uid);
  if (user.disabled) throw new Error('Account is disabled.');
  const items = session.line_items?.data || (await stripe.checkout.sessions.listLineItems(session.id)).data;
  const tier = stripeTier(items, JSON.parse(priceTiers.value()));
  let until = null;
  const sub = typeof session.subscription === 'string' ? await stripe.subscriptions.retrieve(session.subscription) : session.subscription;
  if (sub) {
    if (!['active', 'trialing'].includes(sub.status)) return;
    if (tier === 'lifetime') throw new Error('Lifetime must use a one-time price.');
    const end = sub.current_period_end || sub.items?.data?.[0]?.current_period_end;
    if (!end) throw new Error('Subscription period is unavailable.');
    until = end * 1000;
  }
  if (invoice) {
    const prices = new Set(items.map(item => item.price.id));
    const periods = (invoice.lines?.data || []).filter(line => prices.has(line.price?.id || line.pricing?.price_details?.price)).map(line => line.period?.end).filter(Number.isFinite);
    if (!periods.length) throw new Error('Paid invoice period is unavailable.');
    until = Math.max(...periods) * 1000;
  }
  const identity = invoice?.id || session.id;
  const paidRef = db.collection('billing_fulfillments').doc(identity);
  const eventRef = db.collection('billing_events').doc(eventId);
  const userRef = db.collection('users').doc(uid);
  await db.runTransaction(async tx => {
    const [paid, profile] = await Promise.all([tx.get(paidRef), tx.get(userRef)]);
    if (paid.exists) return;
    const old = profile.data()?.subscription || {};
    const subscription = withExpiry(grant(old, tier, Date.now(), until));
    if (old.tier !== 'lifetime') Object.assign(subscription, { provider: 'stripe', stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
      stripeSubscriptionId: sub?.id || null, checkoutSessionId: session.id });
    tx.set(userRef, { subscription }, { merge: true });
    tx.create(paidRef, { uid, tier, checkoutSessionId: session.id, eventId, fulfilledAt: Timestamp.now() });
    tx.set(eventRef, { type: invoice ? 'invoice.paid' : 'checkout', processedAt: Timestamp.now() });
  });
}

exports.stripeWebhook = onRequest({ region: 'us-central1', maxInstances: 5, secrets: [stripeKey, webhookKey, priceTiers] }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
  const stripe = new Stripe(stripeKey.value());
  let event;
  try { event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], webhookKey.value()); }
  catch { res.status(400).send('Invalid signature'); return; }
  try {
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      await fulfill(stripe, event.data.object, event.id);
    } else if (event.type === 'invoice.paid') {
      const invoice = await stripe.invoices.retrieve(event.data.object.id);
      const subId = invoice.subscription || invoice.parent?.subscription_details?.subscription;
      if (subId && invoice.status === 'paid') {
        const sessions = await stripe.checkout.sessions.list({ subscription: typeof subId === 'string' ? subId : subId.id, limit: 1 });
        if (!sessions.data.length) throw new Error('Subscription has no linked Checkout yet.');
        await fulfill(stripe, sessions.data[0], event.id, invoice);
      }
    }
    // Cancellation stops renewal in Stripe. Existing paid access expires at its
    // stored paid-through date. Refund/revocation is an explicit admin action.
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Billing event could not be applied', event.id, error.message);
    res.status(500).send('Verification failed; retry required');
  }
});
