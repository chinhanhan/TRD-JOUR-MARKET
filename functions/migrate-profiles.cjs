// Operator-only compatibility migration before enabling server-side quotas.
// Dry-run by default. Never modifies plan, tier, status, or the journal itself.
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
if (!process.env.GCLOUD_PROJECT) throw Error('Set GCLOUD_PROJECT to the intended Firebase project.');
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const apply = process.argv.includes('--apply');
async function run() {
  const db = getFirestore(); let after = null, scanned = 0, changed = 0, invalid = 0;
  for (;;) {
    let query = db.collection('users').orderBy('__name__').limit(400);
    if (after) query = query.startAfter(after);
    const page = await query.get();
    if (page.empty) break;
    for (const doc of page.docs) {
      scanned++;
      const old = doc.data().subscription || {};
      if (old.plan !== 'pro' || old.tier === 'lifetime' || old.validUntilTimestamp) continue;
      if (!Number.isFinite(Date.parse(old.validUntil))) { invalid++; continue; }
      changed++;
      if (apply) await db.runTransaction(async tx => {
        const current = (await tx.get(doc.ref)).data()?.subscription || {};
        if (current.plan === 'pro' && current.tier !== 'lifetime' && !current.validUntilTimestamp && Number.isFinite(Date.parse(current.validUntil))) {
          tx.update(doc.ref, { 'subscription.validUntilTimestamp': Timestamp.fromDate(new Date(current.validUntil)) });
        }
      });
    }
    after = page.docs.at(-1);
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', scanned, eligible: changed, invalidExpiry: invalid }));
  if (invalid) process.exitCode = 2;
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
