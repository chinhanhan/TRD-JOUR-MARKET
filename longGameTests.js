// THE LONG GAME - v1.1 Lightweight Regression Tests
// Run this file in your console via window.runLongGameTests() to verify core functionality without a heavy testing framework.

window.runLongGameTests = function() {
  console.log("=========================================");
  console.log("🧪 THE LONG GAME v1.1 - REGRESSION TESTS");
  console.log("=========================================");
  
  let passed = 0;
  let failed = 0;
  
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Backup original state and mock functions
  const originalState = JSON.parse(JSON.stringify(window.state || {}));
  const originalClosedTrades = window.closedTrades;
  
  // Test Environment Setup
  window.state = { longGame: { events: [], rawJournal: [], seasons: [] } };
  
  // ==========================================
  // TEST 1: EMERGENCY CONTEXT
  // ==========================================
  console.log("\n-- Testing Emergency Context --");
  
  // Scenario A: Losing streak only -> No alert
  window.closedTrades = () => [
    { pnl: -10, status: 'closed' },
    { pnl: -10, status: 'closed' },
    { pnl: -10, status: 'closed' },
    { pnl: -10, status: 'closed' }
  ];
  window.state.longGame.rawJournal = [];
  
  // Mock DOM
  document.body.innerHTML += '<div id="lgEmergencyBanner" style="display:none;"></div><div id="lgEmergencyReason"></div>';
  const banner = document.getElementById("lgEmergencyBanner");
  const reason = document.getElementById("lgEmergencyReason");
  
  if (typeof window.checkLongGameTriggers === 'function') {
    window.checkLongGameTriggers();
    assert(banner.style.display !== "block", "Losing streak only -> No alert");
    
    // Scenario B: Losing streak + meaningful SOP change -> Alert
    window.state.longGame.rawJournal = [{
      content: "[System Change] Reason: Strategy Refinement.",
      date: new Date().toISOString()
    }];
    
    window.checkLongGameTriggers();
    assert(banner.style.display === "block", "Losing streak + meaningful SOP change -> Alert");
    assert(reason.innerHTML.includes("4 consecutive losing trades") && reason.innerHTML.includes("SOP modifications"), "Alert contains understandable explanation");
  } else {
    assert(false, "checkLongGameTriggers is not defined");
  }
  
  // ==========================================
  // TEST 2: OBSERVATION ENGINE
  // ==========================================
  console.log("\n-- Testing Observation Engine --");
  if (typeof window.generateLongGameObservations === 'function') {
    // 1 Occurrence
    window.state.longGame.events = [{
      type: "SHOCK",
      date: new Date().toISOString(),
      reflection: { q1: "FOMO" }
    }];
    let obs = window.generateLongGameObservations();
    let fomoObs = obs.find(o => o.title.includes("FOMO"));
    assert(fomoObs && fomoObs.level === "OBSERVED", "1 occurrence -> OBSERVED");
    
    // 2 Occurrences
    window.state.longGame.events.push({
      type: "SHOCK",
      date: new Date().toISOString(),
      reflection: { q1: "FOMO" }
    });
    obs = window.generateLongGameObservations();
    fomoObs = obs.find(o => o.title.includes("FOMO"));
    assert(fomoObs && fomoObs.level === "REPEATED", "2 occurrences -> REPEATED");
    
    // 4 Occurrences
    window.state.longGame.events.push({ type: "SHOCK", date: new Date().toISOString(), reflection: { q1: "FOMO" } });
    window.state.longGame.events.push({ type: "SHOCK", date: new Date().toISOString(), reflection: { q1: "FOMO" } });
    obs = window.generateLongGameObservations();
    fomoObs = obs.find(o => o.title.includes("FOMO"));
    assert(fomoObs && fomoObs.level === "ESTABLISHED", "4+ occurrences -> ESTABLISHED");
    
    // Empty evidence
    window.state.longGame.events = [];
    obs = window.generateLongGameObservations();
    assert(obs.length === 0, "Insufficient evidence -> no false conclusions");
  } else {
    assert(false, "generateLongGameObservations is not defined");
  }

  // ==========================================
  // TEST 3: THEN -> NOW COMPARISON
  // ==========================================
  console.log("\n-- Testing Then -> Now Comparison --");
  
  // Set up DOM for ThenNow
  document.body.innerHTML += '<div id="lgThenNowFeed"></div>';
  const thenNowFeed = document.getElementById("lgThenNowFeed");
  
  if (typeof window.renderThenNow === 'function') {
    // Missing seasons
    window.renderThenNow();
    assert(thenNowFeed.innerHTML.includes("Not enough evidence yet"), "Missing seasons -> Not enough evidence yet");
    
    // Populate seasons
    window.state.longGame.currentSeason = "curr";
    window.state.longGame.seasons = [
      { id: "prev", name: "PREV", status: "COMPLETED", startDate: "2023-01-01T00:00:00Z", endDate: "2023-02-01T00:00:00Z" },
      { id: "curr", name: "CURR", status: "ACTIVE", startDate: "2023-02-02T00:00:00Z" }
    ];
    
    window.state.longGame.events = [
      { seasonId: "prev", type: "SHOCK" },
      { seasonId: "curr", type: "SHOCK" },
      { seasonId: "curr", type: "SHOCK" },
      { seasonId: "curr", type: "BREAKTHROUGH" }
    ];
    
    window.state.longGame.rawJournal = [
      { date: "2023-01-15T00:00:00Z", content: "[System Change] Changed risk rule." },
      { date: "2023-02-15T00:00:00Z", content: "[System Change] Reverted risk rule." }
    ];
    
    window.renderThenNow();
    const html = thenNowFeed.innerHTML;
    
    assert(html.includes("Shocks: 1") && html.includes("Shocks: 2"), "SHOCK changes represented");
    assert(html.includes("Breakthroughs: 0") && html.includes("Breakthroughs: 1"), "BREAKTHROUGH changes represented");
    assert(html.includes("SOP changes: 1") && (html.match(/SOP changes: 1/g) || []).length >= 2, "SOP changes represented");
    assert(!html.includes("Trader Growth"), "No artificial growth score exists");
  } else {
    assert(false, "renderThenNow is not defined");
  }
  
  // ==========================================
  // TEST 4: CUSTOM ALERTS
  // ==========================================
  console.log("\n-- Testing Custom Alerts --");
  if (typeof window.checkLongGameTriggers === 'function') {
    window.state.longGame.customAlertConfig = {
      consecutiveLosses: 3,
      sopChangeWindowDays: 7,
      shockBreakRatioDelta: 0.2
    };
    
    // Simulate 3 losses with high average emotion (3.33)
    window.closedTrades = () => [
      { pnl: -10, status: 'closed' },
      { pnl: -10, status: 'closed' },
      { pnl: -10, status: 'closed' }
    ];
    window.state.longGame.events = [
      { emotionScore: 4 },
      { emotionScore: 3 },
      { emotionScore: 3 }
    ];
    window.state.longGame.rawJournal = [];
    
    // Clear DOM
    if (document.getElementById("lgEmergencyBanner")) document.getElementById("lgEmergencyBanner").remove();
    
    window.checkLongGameTriggers();
    let updatedBanner = document.getElementById("lgEmergencyBanner");
    assert(updatedBanner && updatedBanner.innerHTML.includes("Custom Behavioral Alert") && updatedBanner.innerHTML.includes("3 consecutive losing trades"), "Custom Alert Triggered for 3 losses with high emotion");
    
    // Test that 3 losses with LOW emotion does not trigger
    window.state.longGame.events = [
      { emotionScore: 1 },
      { emotionScore: 1 },
      { emotionScore: 2 }
    ];
    if (updatedBanner) updatedBanner.remove();
    window.checkLongGameTriggers();
    updatedBanner = document.getElementById("lgEmergencyBanner");
    assert(!updatedBanner, "Custom Alert Ignored for losses with low emotion");
  }

  // ==========================================
  // TEST 5: WEEKLY REVIEW
  // ==========================================
  console.log("\n-- Testing Weekly Review Badge --");
  if (typeof window.renderWeeklyReviewBadge === 'function') {
    const originalDate = Date;
    const mockNow = new Date("2023-10-15T12:00:00Z");
    
    document.body.innerHTML += '<div class="lg-season-panel"><div class="panel-head"></div></div>';
    
    // Setup empty reviews
    window.state.longGame.weeklyReviews = [];
    window.renderWeeklyReviewBadge();
    
    let badgeContainer = document.getElementById("lgWeeklyReviewBadgeContainer");
    assert(badgeContainer && badgeContainer.innerHTML.includes("Review Due"), "Badge shows Review Due when empty");
    
    // Setup recent review
    window.state.longGame.weeklyReviews = [{ date: new Date(mockNow.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() }];
    
    // Need to mock Date for renderWeeklyReviewBadge inside the test, since it uses new Date()
    // but the test is a synchronous execution block. Let's just trust it shows "Last Review: 2d ago" if we don't mock it,
    // actually, let's just use the current Date() instead of mocking.
    window.state.longGame.weeklyReviews = [{ date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }];
    window.renderWeeklyReviewBadge();
    assert(badgeContainer.innerHTML.includes("Last Review: 2d ago"), "Badge shows Last Review: Xd ago when recent");
  }

  // Cleanup
  window.state = originalState;
  window.closedTrades = originalClosedTrades;
  
  console.log("\n=========================================");
  console.log(`🏁 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("=========================================");
  
  return failed === 0;
};
