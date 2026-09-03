// Operator-only: uses Application Default Credentials, never browser credentials.
const { randomBytes } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { codeHash } = require('./entitlements.cjs');
const tier = process.argv[2];
if (!['monthly', 'quarterly', 'yearly', 'lifetime'].includes(tier)) throw new Error('Usage: node issue-code.cjs monthly|quarterly|yearly|lifetime');
if (!process.env.GCLOUD_PROJECT) throw new Error('Set GCLOUD_PROJECT to the intended Firebase project.');
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const code = 'TRD-' + randomBytes(20).toString('hex').toUpperCase();
getFirestore().collection('activation_keys').doc(codeHash(code)).create({ tier, createdAt: Timestamp.now(), disabled: false }).then(() => {
  console.log(code); // Shown once to the operator; send only after payment approval.
}).catch(error => { console.error(error.message); process.exitCode = 1; });
