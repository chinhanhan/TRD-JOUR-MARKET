const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');

const window = {
  onerror: () => {},
  onunhandledrejection: () => {},
  addEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  TRDAuth: {},
  TRDCloudSync: {},
  safe: () => {},
  idbGet: () => {},
  idbSet: () => {},
  AudioContext: class {}
};
const document = {
  documentElement: { classList: { toggle: () => {} }, setAttribute: () => {} },
  querySelector: () => ({ classList: { toggle: () => {} }, value: '', addEventListener: () => {} }),
  querySelectorAll: () => [],
  getElementById: () => ({ classList: { toggle: () => {} }, addEventListener: () => {} }),
  body: { classList: { toggle: () => {} }, addEventListener: () => {} },
  addEventListener: () => {}
};
const localStorage = { getItem: () => null, setItem: () => {} };
const navigator = { serviceWorker: null };
const location = { reload: () => {} };
const indexedDB = {};
const fetch = () => new Promise(() => {});
const AudioContext = window.AudioContext;

try {
  eval(code);
  console.log("No ReferenceError found on load!");
} catch (e) {
  console.error(e);
}
