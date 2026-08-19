const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Add safeClosest
if (!code.includes('safeClosest')) {
  code = code.replace(
    'window.safe = safe;',
    'const safeClosest = (target, selector) => (target && typeof target.closest === "function") ? target.closest(selector) : null;\nwindow.safe = safe;'
  );
}

// Replace e.target.closest
code = code.replace(/e\.target\.closest\(/g, 'safeClosest(e.target, ');
code = code.replace(/event\.target\.closest\(/g, 'safeClosest(event.target, ');

// Cleanup try/catch in openTradeCapture
const badStr = `window.openTradeCapture = function() {
  try {
    resetTradeForm();
    openSheet("tradeFormSheet");
  } catch (e) {
    console.error("openTradeCapture ERROR: " + e.message + "\\n\\n" + e.stack);
  }
};`;
const goodStr = `window.openTradeCapture = function() {
  resetTradeForm();
  openSheet("tradeFormSheet");
};`;
code = code.replace(badStr, goodStr);

fs.writeFileSync('app.js', code);
