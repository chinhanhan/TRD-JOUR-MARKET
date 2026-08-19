// TRD Journey Firebase SaaS Configuration & Service Initializer
const firebaseConfig = {
  apiKey: "AIzaSyDTByH_DbTtJkMnEf2Dh7-A8b8lUDCtq0Y",
  authDomain: "trd-journal-market.firebaseapp.com",
  projectId: "trd-journal-market",
  storageBucket: "trd-journal-market.firebasestorage.app",
  messagingSenderId: "552331942827",
  appId: "1:552331942827:web:dfa8db08ac895031f850ee",
  measurementId: "G-FDC3H1JQR3"
};

// Initialize Firebase SDK
if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  window.fbApp = firebase.app();
  window.fbAuth = firebase.auth();
  window.fbDb = firebase.firestore();
  window.fbStorage = firebase.storage();
  if (typeof firebase.analytics === 'function') {
    window.fbAnalytics = firebase.analytics();
  }
  console.log("⚡ [TRD Cloud] Firebase Services initialized successfully.");
} else {
  console.warn("⚠️ [TRD Cloud] Firebase SDK not loaded yet.");
}
