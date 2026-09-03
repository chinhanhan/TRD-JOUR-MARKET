const crypto = require('node:crypto');
const durations = { monthly: 30, quarterly: 90, yearly: 365 };
function codeHash(code) {
  if (typeof code !== 'string' || !/^[A-Z0-9-]{16,100}$/.test(code.trim().toUpperCase())) throw new Error('Invalid activation code.');
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}
function grant(previous = {}, tier, now, until = null) {
  if (tier !== 'lifetime' && !durations[tier]) throw new Error('Unsupported plan.');
  if (previous.plan === 'pro' && previous.tier === 'lifetime' && previous.status !== 'revoked') return { ...previous };
  const currentUntil = previous.status === 'revoked' ? 0 : Date.parse(previous.validUntil) || 0;
  const end = tier === 'lifetime' ? Date.parse('2099-12-31T23:59:59.999Z') :
    until ? Math.max(currentUntil, until) : Math.max(now, currentUntil) + durations[tier] * 86400000;
  return { ...previous, plan: 'pro', status: 'active', tier, limit: 999999,
    subscribedAt: previous.subscribedAt || new Date(now).toISOString(), validUntil: new Date(end).toISOString() };
}
function stripeTier(items, mapping) {
  if (items.length !== 1 || items[0].quantity !== 1) throw new Error('Unexpected checkout items.');
  const tier = mapping[items[0].price?.id];
  if (!['monthly', 'quarterly', 'yearly', 'lifetime'].includes(tier)) throw new Error('Unrecognized Stripe price.');
  return tier;
}
module.exports = { codeHash, grant, stripeTier };
