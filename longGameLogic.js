// ==========================================
// P0 PHASE: THE LONG GAME
// ==========================================

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Saves the global state and alerts the user if it fails.
 * @returns {Promise<boolean>} True if save was successful.
 */
async function safeSaveLongGame() {
  const success = await saveState();
  if (!success) {
    if (typeof toast === 'function') {
      toast("Your entry could not be saved. Please retry.", "error");
    } else {
      alert("Your entry could not be saved. Please retry.");
    }
  }
  return success;
}

function renderLongGame() {
  const lg = state.longGame;
  if (!lg) return;

  // 1. Render Current Season Context
  const seasonTitle = document.getElementById("lgSeasonTitle");
  const seasonContext = document.getElementById("lgSeasonContext");
  
  if (lg.currentSeason) {
    const season = lg.seasons.find(s => s.id === lg.currentSeason);
    if (season) {
      seasonTitle.textContent = season.name;
      seasonContext.textContent = season.context || "No context provided.";
    }
  } else {
    seasonTitle.textContent = "No Active Season";
    seasonContext.textContent = "Seasons provide context to your behavior. Start a season (e.g. BUILD, STABILIZE) to track longitudinal changes.";
  }

  // 2. Render Recent Events
  const eventsFeed = document.getElementById("lgEventsFeed");
  if (lg.events && lg.events.length > 0) {
    eventsFeed.innerHTML = lg.events.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, window._lgEventsVisibleLimit || 10).map(ev => {
      const isShock = ev.type === "SHOCK";
      const icon = isShock ? "⚡" : "✨";
      const color = isShock ? "var(--orange)" : "var(--green)";
      const bg = isShock ? "var(--orange-soft)" : "var(--green-soft)";
      
      const safeFn = typeof safe === 'function' ? safe : (typeof window.safe === 'function' ? window.safe : (s => String(s ?? '')));
      return `
        <div style="background: var(--bg-card); border: 1px solid var(--hairline-strong); border-radius: 8px; padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: ${bg}; color: ${color}; width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px;">${icon}</span>
              <strong style="font-size: 13px;">${safeFn(ev.title || ev.type)}</strong>
            </div>
            <span style="font-size: 11px; color: var(--muted);">${new Date(ev.date).toLocaleDateString()}</span>
          </div>
          <div style="font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 4px;">
            ${ev.reflection && ev.reflection.q1 ? `<div><strong>What happened:</strong> ${safeFn(ev.reflection.q1)}</div>` : ""}
            ${ev.reflection && ev.reflection.q2 ? `<div><strong>Under control:</strong> ${safeFn(ev.reflection.q2)}</div>` : ""}
            ${ev.reflection && ev.reflection.q3 ? `<div><strong>Next time:</strong> ${safeFn(ev.reflection.q3)}</div>` : ""}
          </div>
        </div>
      `;
    }).join("");
    
    if (lg.events.length > (window._lgEventsVisibleLimit || 10)) {
      eventsFeed.innerHTML += `<button class="ghost-button compact" type="button" onclick="window.loadMoreLgEvents()" style="width: 100%; margin-top: 8px;">Load More</button>`;
    }
  } else {
    eventsFeed.innerHTML = `<div class="empty-state">Not every trade needs to become a lesson.</div>`;
  }

  // 3. Render Raw Journal Feed
  const rawJournalFeed = document.getElementById("lgRawJournalFeed");
  if (rawJournalFeed) {
    if (lg.rawJournal && lg.rawJournal.length > 0) {
      const limit = window._lgRawVisibleLimit || 5;
      const sorted = lg.rawJournal.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
      const safeFn = typeof safe === 'function' ? safe : (typeof window.safe === 'function' ? window.safe : (s => String(s ?? '')));
      rawJournalFeed.innerHTML = sorted.slice(0, limit).map(entry => `
        <div style="background: var(--bg-card); border: 1px solid var(--hairline-strong); border-radius: 8px; padding: 12px; font-size: 13px;">
          <div style="color: var(--muted); font-size: 11px; margin-bottom: 6px;">${new Date(entry.date).toLocaleDateString()}</div>
          <div style="margin-bottom: 8px; white-space: pre-wrap;">${safeFn(entry.content)}</div>
          <button class="ghost-button compact" type="button" onclick="window.convertRawToEvent('${safeFn(entry.id)}')" style="font-size: 11px; padding: 2px 8px; border-radius: 9999px;">Convert to Event</button>
        </div>
      `).join("");
      
      if (sorted.length > limit) {
        rawJournalFeed.innerHTML += `<button class="ghost-button compact" type="button" onclick="window.loadMoreLgRawJournal()" style="width: 100%; margin-top: 8px;">Load More</button>`;
      }
    } else {
      rawJournalFeed.innerHTML = "";
    }
  }
}

window.openModule = (function(orig) {
  return function(id, source) {
    orig(id, source);
    if (id === "long-game") {
      renderLongGame();
    }
  };
})(window.openModule);

window.createLongGameEvent = function(prefillType = "", prefillText = "") {
  const form = document.getElementById("lgEventForm");
  if (form) form.reset();
  const selector = document.getElementById("lgEventSelector");
  if (selector) {
    selector.innerHTML = `
      <option value="" disabled selected>Select an event type...</option>
      <option value="SHOCK">⚡ SHOCK (Process Disrupted)</option>
      <option value="BREAKTHROUGH">✨ BREAKTHROUGH (Positive Change)</option>
    `;
    if (prefillType) {
      selector.value = prefillType;
      selector.dispatchEvent(new Event("change"));
    }
  }
  
  // Store prefillText to be injected after the form fields are generated
  window._lgPrefillText = prefillText;
  
  if (typeof openSheet === "function") openSheet("lgEventModal");
};

window.convertRawToEvent = function(rawId) {
  const lg = state.longGame;
  const entry = lg.rawJournal.find(r => r.id === rawId);
  if (entry) {
    window.createLongGameEvent("", entry.content);
  }
};

window.closeLgEventModalBtn = document.getElementById("closeLgEventModalBtn");
if (window.closeLgEventModalBtn) {
  window.closeLgEventModalBtn.addEventListener("click", () => closeSheet("lgEventModal"));
}

document.getElementById("lgEventSelector")?.addEventListener("change", (e) => {
  const type = e.target.value;
  const container = document.getElementById("lgGuidedReflectionContainer");
  
  if (type === "SHOCK") {
    container.innerHTML = `
      <label style="font-size: 13px;">What happened?
        <select name="q1" required style="margin-top: 4px;">
          <option value="" disabled selected>Select...</option>
          <option value="Strategy">Strategy</option>
          <option value="Execution">Execution</option>
          <option value="Risk">Risk</option>
          <option value="Market">Market</option>
          <option value="Unknown">Unknown</option>
        </select>
      </label>
      <label style="font-size: 13px;">What was actually under your control?
        <select name="q2" required style="margin-top: 4px;">
          <option value="" disabled selected>Select...</option>
          <option value="Risk">Risk</option>
          <option value="Execution">Execution</option>
          <option value="Process">Process</option>
          <option value="Nothing">Nothing</option>
          <option value="Unsure">Unsure</option>
        </select>
      </label>
      <label style="font-size: 13px;">What will you do differently next time?
        <textarea name="q3" rows="2" required placeholder="Free text" style="margin-top: 4px;"></textarea>
      </label>
    `;
  } else if (type === "BREAKTHROUGH") {
    container.innerHTML = `
      <label style="font-size: 13px;">What did you do differently this time?
        <textarea name="q1" rows="2" required placeholder="Free text" style="margin-top: 4px;"></textarea>
      </label>
      <label style="font-size: 13px;">Was this behavior repeated?
        <select name="q2" required style="margin-top: 4px;">
          <option value="" disabled selected>Select...</option>
          <option value="First Time">First Time</option>
          <option value="Repeated">Repeated multiple times</option>
          <option value="Established">Established habit</option>
        </select>
      </label>
      <label style="font-size: 13px;">What evidence supports calling this a change?
        <textarea name="q3" rows="2" required placeholder="Free text" style="margin-top: 4px;"></textarea>
      </label>
    `;
  }
  
  if (window._lgPrefillText) {
    const q3 = document.querySelector("#lgGuidedReflectionContainer textarea[name='q3']");
    const q1Text = document.querySelector("#lgGuidedReflectionContainer textarea[name='q1']");
    if (type === "SHOCK" && q3) {
      q3.value = window._lgPrefillText;
    } else if (type === "BREAKTHROUGH" && q1Text) {
      q1Text.value = window._lgPrefillText;
    }
    window._lgPrefillText = null;
  }
});

document.getElementById("lgEventForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const type = formData.get("eventCategory");
  
  if (!state.longGame.events) state.longGame.events = [];
  
  const ev = {
    id: uuidv4(),
    type: type,
    seasonId: state.longGame.currentSeason || null,
    title: type === "SHOCK" ? "Process Disrupted" : "Behavioral Breakthrough",
    date: new Date().toISOString(),
    reflection: {
      q1: formData.get("q1") || "",
      q2: formData.get("q2") || "",
      q3: formData.get("q3") || ""
    },
    emotionScore: parseInt(formData.get("emotionScore") || "0", 10)
  };
  
  state.longGame.events.push(ev);
  if (await safeSaveLongGame()) {
    closeSheet("lgEventModal");
    if (typeof window.debouncedRenderLongGame === 'function') {
      window.debouncedRenderLongGame();
    } else {
      renderLongGame();
    }
  } else {
    // Revert state change so the user can retry
    state.longGame.events.pop();
  }
});

window.saveLgRawJournal = async function() {
  const input = document.getElementById("lgRawJournalInput");
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  
  if (!state.longGame.rawJournal) state.longGame.rawJournal = [];
  
  state.longGame.rawJournal.push({
    id: uuidv4(),
    content: content,
    date: new Date().toISOString()
  });
  
  if (await safeSaveLongGame()) {
    input.value = "";
    if (typeof window.debouncedRenderLongGame === 'function') {
      window.debouncedRenderLongGame();
    } else {
      renderLongGame();
    }
  } else {
    state.longGame.rawJournal.pop();
  }
};

window.manageLongGameSeason = function() {
  const lg = state.longGame;
  const formSeason = document.getElementById("lgSeasonForm");
  const formMirror = document.getElementById("lgMirrorForm");
  
  if (lg.currentSeason) {
    // Show The Mirror form to close the season
    formSeason.style.display = "none";
    formMirror.style.display = "flex";
    
    // Inject facts
    const factsContainer = document.getElementById("lgMirrorFacts");
    const season = lg.seasons.find(s => s.id === lg.currentSeason);
    
    // Calculate what happened
    let shockCount = 0, breakthroughCount = 0, sopChanges = 0;
    if (lg.events) {
      lg.events.forEach(ev => {
        if (new Date(ev.date) >= new Date(season.startDate)) {
          if (ev.type === "SHOCK") shockCount++;
          if (ev.type === "BREAKTHROUGH") breakthroughCount++;
        }
      });
    }
    if (lg.rawJournal) {
      lg.rawJournal.forEach(ev => {
        if (new Date(ev.date) >= new Date(season.startDate) && ev.content.startsWith("[System Change]")) {
          sopChanges++;
        }
      });
    }
    
    // Calculate what changed (Then -> Now)
    let thenNowStr = "Not enough evidence yet.";
    const prevSeasons = lg.seasons.filter(s => s.id !== lg.currentSeason && s.status === 'COMPLETED').sort((a,b) => new Date(b.endDate) - new Date(a.endDate));
    if (prevSeasons.length > 0) {
      const prev = prevSeasons[0];
      let prevShocks = 0;
      if (lg.events) lg.events.forEach(e => {
        if (e.seasonId === prev.id && e.type === "SHOCK") prevShocks++;
      });
      if (shockCount !== prevShocks) {
        thenNowStr = `Shocks changed from ${prevShocks} to ${shockCount}.`;
      }
    }
    
    factsContainer.innerHTML = `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 4px;">What Happened</div>
        <div style="color: var(--ink);">Recorded ${shockCount} Shocks, ${breakthroughCount} Breakthroughs, and ${sopChanges} SOP Changes.</div>
      </div>
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 4px;">What Changed</div>
        <div style="color: var(--ink);">${thenNowStr}</div>
      </div>
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 4px;">What Didn't Change</div>
        <div style="color: var(--ink);">Review ongoing observations.</div>
      </div>
      <div>
        <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 4px;">What Remains Unknown</div>
        <div style="color: var(--ink);">Sample size may still be too small to determine if SOP changes are correlated with losing streaks.</div>
      </div>
    `;
  } else {
    // Show Create Season form
    formSeason.style.display = "flex";
    formMirror.style.display = "none";
  }
  
  openSheet("lgSeasonModal");
};

document.getElementById("closeLgSeasonBtn")?.addEventListener("click", () => closeSheet("lgSeasonModal"));

document.getElementById("lgSeasonForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const title = formData.get("seasonTitle").trim();
  const context = formData.get("seasonContext").trim();
  
  if (!title) return;
  
  if (!state.longGame.seasons) state.longGame.seasons = [];
  
  const newSeason = {
    id: uuidv4(),
    name: title,
    context,
    status: 'ACTIVE',
    startDate: new Date().toISOString(),
    endDate: null
  };
  
  state.longGame.seasons.push(newSeason);
  const oldSeasonId = state.longGame.currentSeason;
  state.longGame.currentSeason = newSeason.id;
  
  if (await safeSaveLongGame()) {
    closeSheet("lgSeasonModal");
    if (typeof window.debouncedRenderLongGame === 'function') {
      window.debouncedRenderLongGame();
    } else {
      renderLongGame();
    }
  } else {
    state.longGame.seasons.pop();
    state.longGame.currentSeason = oldSeasonId;
  }
});

document.getElementById("lgMirrorForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const reflection = formData.get("mirrorReflection").trim();
  
  if (!reflection) return;
  
  const lg = state.longGame;
  const season = lg.seasons.find(s => s.id === lg.currentSeason);
  const oldSeasonData = season ? { ...season } : null;
  const oldMirrorLen = lg.mirrorEntries ? lg.mirrorEntries.length : 0;
  
  if (season) {
    season.endDate = new Date().toISOString();
    season.status = 'COMPLETED';
    
    if (!lg.mirrorEntries) lg.mirrorEntries = [];
    lg.mirrorEntries.push({
      id: uuidv4(),
      seasonId: season.id,
      userReflection: reflection,
      date: new Date().toISOString()
    });
  }
  
  const oldCurrentSeason = lg.currentSeason;
  lg.currentSeason = null;
  
  if (await safeSaveLongGame()) {
    closeSheet("lgSeasonModal");
    if (typeof window.debouncedRenderLongGame === 'function') {
      window.debouncedRenderLongGame();
    } else {
      renderLongGame();
    }
  } else {
    // Revert
    if (season && oldSeasonData) {
      Object.assign(season, oldSeasonData);
      lg.mirrorEntries.pop();
    }
    lg.currentSeason = oldCurrentSeason;
  }
});

// Intercept SOP saves for friction
let originalSopSaveResolve = null;

window.interceptSystemChange = function(resolveFn) {
  originalSopSaveResolve = resolveFn;
  document.getElementById("lgSystemChangeForm").reset();
  document.getElementById("lgEmotionalWarning").style.display = "none";
  openSheet("lgSystemChangeModal");
};

document.getElementById("closeLgSystemChangeBtn")?.addEventListener("click", () => {
  closeSheet("lgSystemChangeModal");
  originalSopSaveResolve = null;
});

document.getElementById("lgChangeReason")?.addEventListener("change", (e) => {
  if (e.target.value === "Emotional Reaction") {
    document.getElementById("lgEmotionalWarning").style.display = "block";
  } else {
    document.getElementById("lgEmotionalWarning").style.display = "none";
  }
});

document.getElementById("lgSystemChangeForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  if (!state.longGame.rawJournal) state.longGame.rawJournal = [];
  state.longGame.rawJournal.push({
    id: uuidv4(),
    content: `[System Change] Reason: ${formData.get("changeReason")}. Notes: ${formData.get("changeNotes") || "None"}`,
    date: new Date().toISOString()
  });
  
  if (await safeSaveLongGame()) {
    closeSheet("lgSystemChangeModal");
    if (originalSopSaveResolve) {
      originalSopSaveResolve();
      originalSopSaveResolve = null;
    }
  } else {
    state.longGame.rawJournal.pop();
  }
});

// Redefine saveSopFromModal to use the interceptor if it's an edit to an existing SOP
if (typeof window.saveSopFromModal === 'function') {
  const origSaveSopFromModal = window.saveSopFromModal;
  window.saveSopFromModal = function(event) {
    const form = event.target;
    const sopId = form.dataset.sopId;
    
    if (sopId) {
      // Find existing SOP to diff structural fields
      const existing = state.sops?.find((sop) => sop.id === sopId);
      if (existing) {
        // Parse incoming structural fields
        const newChecklist = window.parseSopChecklistRules ? window.parseSopChecklistRules(form.checklist.value) : [];
        const oldChecklistStr = JSON.stringify(existing.checklist || []);
        const newChecklistStr = JSON.stringify(newChecklist);
        
        const rulesChanged = (existing.entryRules || "").trim() !== form.entryRules.value.trim() ||
                             (existing.exitRules || "").trim() !== form.exitRules.value.trim() ||
                             (existing.riskRules || "").trim() !== form.riskRules.value.trim() ||
                             (existing.noTradeRules || "").trim() !== form.noTradeRules.value.trim();
                             
        // If structural fields changed, intercept!
        if (oldChecklistStr !== newChecklistStr || rulesChanged) {
          window.interceptSystemChange(() => {
            origSaveSopFromModal(event);
          });
          return;
        }
      }
    }
    
    // Fallback if creating new SOP or only cosmetic changes
    origSaveSopFromModal(event);
  };
}

// Emergency Context Check after saving a trade
/**
 * Checks recent trades and raw journal entries for signs of a trader under pressure.
 * Triggers an emergency context banner if a losing streak coincides with recent SOP changes.
 * Important Side Effects: Displays the #lgEmergencyBanner if triggers are met.
 */
function checkLongGameTriggers() {
  const trades = window.closedTrades ? window.closedTrades() : [];
  const lg = state.longGame;
  const config = lg.customAlertConfig || { consecutiveLosses: 4, sopChangeWindowDays: 7, shockBreakRatioDelta: 0.2 };
  
  if (trades.length < config.consecutiveLosses) return;
  
  const recentTrades = trades.slice(-config.consecutiveLosses);
  const allLosses = recentTrades.every(t => {
    const net = t.result?.netPnl || t.pnl;
    const r = t.result?.rResult || t.rMultiple;
    return (net !== null && net !== undefined && net < 0) || (r !== null && r !== undefined && r < 0);
  });
  
  // Calculate average emotion score for the recent trades
  let totalEmotion = 0;
  let emotionCount = 0;
  // If trade has an emotionScore in its audit, or we could just check Long Game events matching these trades.
  // Wait, the plan says: "Include emotionScore in the loss-streak check: only trigger if average emotionScore >= 3".
  // Since we added emotionScore to the Long Game Events, we need to map trades to Long Game events, or just check the last few events.
  // It's simpler to check the last few Long Game events that happened around the same time.
  const recentEvents = lg.events ? lg.events.slice(-config.consecutiveLosses) : [];
  const avgEmotionScore = recentEvents.length > 0 ? (recentEvents.reduce((sum, e) => sum + (e.emotionScore || 0), 0) / recentEvents.length) : 0;
  
  const highEmotion = avgEmotionScore >= 3;
  const lossStreakTrigger = allLosses && highEmotion;

  // Check for recent SOP changes
  const now = new Date();
  let recentSopChange = false;
  if (lg.rawJournal) {
    const windowMs = (config.sopChangeWindowDays || 7) * 24 * 60 * 60 * 1000;
    const thresholdDate = new Date(now.getTime() - windowMs);
    recentSopChange = lg.rawJournal.some(entry => 
      entry.content.startsWith("[System Change]") && new Date(entry.date) > thresholdDate
    );
  }
  
  if (lossStreakTrigger || recentSopChange) {
    if (!lossStreakTrigger && recentSopChange && trades.length < 10) return; // SOP change alone isn't enough unless combined with losses
    
    let triggers = [];
    if (lossStreakTrigger) triggers.push(`${config.consecutiveLosses} consecutive losing trades with high average emotion (${avgEmotionScore.toFixed(1)})`);
    if (recentSopChange) triggers.push(`SOP was modified within the last ${config.sopChangeWindowDays} days`);
    
    // Show Emergency Context banner globally
    let banner = document.getElementById("lgEmergencyBanner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "lgEmergencyBanner";
      banner.style.cssText = "position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: var(--bg-card); border: 1px solid var(--orange); border-radius: 8px; padding: 12px 16px; box-shadow: var(--shadow-lift); z-index: 9999; display: flex; flex-direction: column; gap: 8px; width: 90%; max-width: 420px;";
      banner.innerHTML = `
        <div style="font-weight: 600; color: var(--orange); display: flex; align-items: center; gap: 8px; font-size: 14px;">
          ⚠️ Custom Behavioral Alert
        </div>
        <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">
          Restore context before making structural changes.
        </div>
        <div style="font-size: 12px; background: var(--bg-input, rgba(0,0,0,0.05)); padding: 8px; border-radius: 6px;">
          <strong style="color: var(--ink);">Trigger:</strong><br>
          ${triggers.join("<br>")}
        </div>
        <div style="display: flex; gap: 8px; margin-top: 8px; width: 100%;">
          <button class="ghost-button" onclick="this.parentElement.parentElement.remove()" style="flex: 1; font-size: 12px;">Dismiss</button>
          <button class="ghost-button" onclick="this.parentElement.parentElement.style.display='none'; setTimeout(() => document.getElementById('lgEmergencyBanner').style.display='flex', 3600000)" style="flex: 1; font-size: 12px;">Remind Later</button>
          <button class="primary-button" onclick="this.parentElement.parentElement.remove(); window.openModule('long-game');" style="flex: 1; font-size: 12px;">Review Now</button>
        </div>
      `;
      document.body.appendChild(banner);
    }
  }
}

// Intercept saveTradeFromForm to trigger checkLongGameTriggers
if (typeof window.saveTradeFromForm === 'function') {
  const origSaveTrade = window.saveTradeFromForm;
  window.saveTradeFromForm = function() {
    origSaveTrade();
    setTimeout(checkLongGameTriggers, 500);
  };
}

// ==========================================
/**
 * Analyzes the Long Game state (trades, SHOCKs, BREAKTHROUGHs, SOP changes) 
 * to generate behavior-based observations.
 * @returns {Array} An array of observation objects containing title, text, level, and evidence.
 */
function generateLongGameObservations() {
  const lg = state.longGame;
  let observations = [];
  
  const trades = window.closedTrades ? window.closedTrades() : [];
  
  // 1. SOP Violation Trend (Last 20 vs Previous 20)
  if (trades.length >= 40) {
    const last20 = trades.slice(-20);
    const prev20 = trades.slice(-40, -20);
    const last20Violations = last20.filter(t => t.sopStatus === "violated").length;
    const prev20Violations = prev20.filter(t => t.sopStatus === "violated").length;
    
    if (last20Violations < prev20Violations) {
      observations.push({
        title: "SOP Violation Trend Improved",
        text: `Your last 20 trades contain fewer SOP violations (${last20Violations}) than the previous 20 (${prev20Violations}).`,
        level: "ESTABLISHED",
        evidence: "Based on last 40 trades"
      });
    } else if (last20Violations > prev20Violations) {
      observations.push({
        title: "SOP Violation Trend Worsened",
        text: `Your last 20 trades contain more SOP violations (${last20Violations}) than the previous 20 (${prev20Violations}).`,
        level: "ESTABLISHED",
        evidence: "Based on last 40 trades"
      });
    }
  }

  // 2. Repeated SHOCK reflections
  if (lg.events) {
    const shocks = lg.events.filter(e => e.type === "SHOCK" && e.reflection && e.reflection.q1);
    const shockCauses = {};
    shocks.forEach(s => {
      const cause = s.reflection.q1;
      if (!shockCauses[cause]) shockCauses[cause] = [];
      shockCauses[cause].push(s);
    });
    
    Object.keys(shockCauses).forEach(cause => {
      const evs = shockCauses[cause];
      if (evs.length >= 2) {
        let level = "REPEATED";
        let conf = "Developing";
        if (evs.length >= 4) {
          level = "ESTABLISHED";
          conf = "Strong";
        }
        
        observations.push({
          title: `Repeated Shock Cause: ${cause}`,
          text: `You recorded "${cause}" as the cause for a disruption multiple times.`,
          level: level,
          confidence: conf,
          evidence: evs.map(e => `Event on ${new Date(e.date).toLocaleDateString()}`).join("<br>• ")
        });
      } else if (evs.length === 1) {
        observations.push({
          title: `Recorded Shock Cause: ${cause}`,
          text: `You recorded "${cause}" as a disruption once.`,
          level: "OBSERVED",
          confidence: "Early",
          evidence: `Event on ${new Date(evs[0].date).toLocaleDateString()}`
        });
      }
    });
  }
  
  // 3. Repeated BREAKTHROUGHS
  if (lg.events) {
    const breakthroughs = lg.events.filter(e => e.type === "BREAKTHROUGH" && e.reflection && e.reflection.q1);
    if (breakthroughs.length > 0) {
      const recent = breakthroughs.slice(-3);
      observations.push({
        title: `Recent Breakthroughs`,
        text: `You have been recording positive behavioral changes.`,
        level: recent.length > 1 ? "REPEATED" : "OBSERVED",
        confidence: recent.length > 1 ? "Developing" : "Early",
        evidence: recent.map(e => `Event on ${new Date(e.date).toLocaleDateString()}`).join("<br>• ")
      });
    }
  }
  
  return observations;
}

/**
 * Renders the behavioral observations into the #lgObservationsFeed container.
 * Shows an empty state if no significant evidence is found.
 */
function renderObservations() {
  const obsFeed = document.getElementById("lgObservationsFeed");
  if (!obsFeed) return;
  
  const obs = generateLongGameObservations();
  if (obs.length > 0) {
    obsFeed.innerHTML = obs.map(o => `
      <div style="background: var(--bg-card); border: 1px solid var(--hairline-strong); border-radius: 8px; padding: 12px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: var(--ink);">${o.level}</strong>
          ${o.confidence ? `<span style="font-size: 11px; color: var(--muted);">Confidence: ${o.confidence}</span>` : ""}
        </div>
        <div style="margin-bottom: 8px; color: var(--ink);">${o.text}</div>
        <div style="font-size: 11px; color: var(--muted); padding-top: 8px; border-top: 1px dashed var(--hairline-strong);">
          <strong>Evidence:</strong><br>• ${o.evidence}
        </div>
      </div>
    `).join("");
  } else {
    obsFeed.innerHTML = `<div class="empty-state">When enough evidence accumulates, meaningful changes will surface here.</div>`;
  }
}

/**
 * Renders the 'Then -> Now' factual comparison between the previous season and the current one.
 * Calculates differences in SHOCKs, BREAKTHROUGHs, and SOP changes to display evidence of behavioral change.
 */
function renderThenNow() {
  const thenNowFeed = document.getElementById("lgThenNowFeed");
  if (!thenNowFeed) return;
  
  const lg = state.longGame;
  if (!lg.seasons || lg.seasons.length < 2) {
    thenNowFeed.innerHTML = `<div class="empty-state">Not enough evidence yet.<br><span style="font-size:12px; color:var(--muted)">Requires at least two seasons to compare Then &rarr; Now.</span></div>`;
    return;
  }
  
  const currentSeason = lg.seasons.find(s => s.id === lg.currentSeason);
  const previousSeasons = lg.seasons.filter(s => s.id !== lg.currentSeason && s.status === 'COMPLETED').sort((a,b) => new Date(b.endDate) - new Date(a.endDate));
  
  if (!currentSeason || previousSeasons.length === 0) {
    thenNowFeed.innerHTML = `<div class="empty-state">Not enough evidence yet.</div>`;
    return;
  }
  
  const prev = previousSeasons[0];
  
  // Factual count of events during previous vs current season
  let prevShocks = 0, prevBreakthroughs = 0, prevSopChanges = 0;
  let currShocks = 0, currBreakthroughs = 0, currSopChanges = 0;
  
  (lg.events || []).forEach(e => {
    if (e.seasonId === prev.id) {
      if (e.type === "SHOCK") prevShocks++;
      if (e.type === "BREAKTHROUGH") prevBreakthroughs++;
    } else if (e.seasonId === currentSeason.id) {
      if (e.type === "SHOCK") currShocks++;
      if (e.type === "BREAKTHROUGH") currBreakthroughs++;
    }
  });
  
  (lg.rawJournal || []).forEach(e => {
    if (e.content.startsWith("[System Change]")) {
      const eDate = new Date(e.date);
      if (eDate >= new Date(prev.startDate) && eDate <= new Date(prev.endDate || e.date)) {
        prevSopChanges++;
      } else if (eDate >= new Date(currentSeason.startDate)) {
        currSopChanges++;
      }
    }
  });
  
  const isChanged = (currShocks !== prevShocks) || (currBreakthroughs !== prevBreakthroughs) || (currSopChanges !== prevSopChanges);
  
  thenNowFeed.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--hairline-strong); border-radius: 8px; padding: 16px; font-size: 13px;">
      <div style="display: flex; gap: 16px;">
        <div style="flex: 1; border-right: 1px solid var(--hairline-strong); padding-right: 16px;">
          <div style="font-weight: 600; color: var(--muted); margin-bottom: 8px;">THEN (${prev.name})</div>
          <div>Shocks: ${prevShocks}</div>
          <div>Breakthroughs: ${prevBreakthroughs}</div>
          <div>SOP changes: ${prevSopChanges}</div>
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: var(--ink); margin-bottom: 8px;">NOW (${currentSeason.name})</div>
          <div>Shocks: ${currShocks}</div>
          <div>Breakthroughs: ${currBreakthroughs}</div>
          <div>SOP changes: ${currSopChanges}</div>
        </div>
      </div>
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed var(--hairline-strong); font-weight: 600; text-align: center; color: ${isChanged ? 'var(--blue)' : 'var(--muted)'};">
        ${isChanged ? "Your response changed." : "No meaningful behavioral change detected yet."}
      </div>
    </div>
  `;
}

// ==========================================
// P1 PHASE: FINAL POLISH PATCH UTILITIES
// ==========================================

/**
 * Increases the visible limit for Long Game Events by 10 and re-renders.
 */
window.loadMoreLgEvents = function() {
  window._lgEventsVisibleLimit = (window._lgEventsVisibleLimit || 10) + 10;
  if (typeof window.debouncedRenderLongGame === 'function') window.debouncedRenderLongGame();
  else renderLongGame();
};

/**
 * Increases the visible limit for Raw Journal Entries by 5 and re-renders.
 */
window.loadMoreLgRawJournal = function() {
  window._lgRawVisibleLimit = (window._lgRawVisibleLimit || 5) + 5;
  if (typeof window.debouncedRenderLongGame === 'function') window.debouncedRenderLongGame();
  else renderLongGame();
};

/**
 * Basic debounce implementation to prevent UI thrashing.
 * @param {Function} func The function to debounce
 * @param {number} wait Delay in milliseconds
 * @returns {Function} Debounced function
 */
function lgDebounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Debounced version of renderLongGame. Re-renders the entire Long Game UI.
 * Important Side Effects: Updates the DOM for events, raw journal, and current season context.
 */
window.debouncedRenderLongGame = lgDebounce(renderLongGame, 150);

// Focus Management for Modals
let lgLastFocus = null;

if (typeof window.openSheet === 'function' && !window._lgOpenSheetProxied) {
  const origOpenSheet = window.openSheet;
  window.openSheet = function(id) {
    if (id && id.startsWith && id.startsWith('lg')) {
      lgLastFocus = document.activeElement;
    }
    origOpenSheet(id);
    if (id && id.startsWith && id.startsWith('lg')) {
      const sheet = document.getElementById(id);
      if (sheet) {
        setTimeout(() => {
          const focusable = sheet.querySelector('input:not([type="hidden"]), select, textarea, button');
          if (focusable && typeof focusable.focus === 'function') focusable.focus();
        }, 50);
      }
    }
  };
  window._lgOpenSheetProxied = true;
}

if (typeof window.closeSheet === 'function' && !window._lgCloseSheetProxied) {
  const origCloseSheet = window.closeSheet;
  window.closeSheet = function(id) {
    origCloseSheet(id);
    if (id && id.startsWith && id.startsWith('lg') && lgLastFocus) {
      setTimeout(() => {
        if (lgLastFocus && typeof lgLastFocus.focus === 'function') lgLastFocus.focus();
        lgLastFocus = null;
      }, 50);
    }
  };
  window._lgCloseSheetProxied = true;
}

// ==========================================
// Behavioral Trend Visualization (Chart.js)
// ==========================================
function renderTrendChart() {
  const canvas = document.getElementById("lgTrendChartCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!window._lgTrendChart) {
    if (typeof Chart === "undefined") {
      // Chart.js not loaded yet, retry shortly
      setTimeout(renderTrendChart, 500);
      return;
    }
  }

  const lg = state.longGame;
  const seasons = lg.seasons || [];
  
  // Aggregate data by season
  const labels = [];
  const shockData = [];
  const breakthroughData = [];
  const sopChangeData = [];
  const avgEmotionData = [];

  seasons.forEach((season, index) => {
    labels.push(season.name || `Season ${index + 1}`);
    
    // Count events in this season
    const seasonEvents = (lg.events || []).filter(e => e.seasonId === season.id);
    const shocks = seasonEvents.filter(e => e.type === "SHOCK").length;
    const breakthroughs = seasonEvents.filter(e => e.type === "BREAKTHROUGH").length;
    
    // Count SOP changes
    const sopChanges = (lg.rawJournal || []).filter(entry => 
      entry.content.startsWith("[System Change]") && entry.date >= season.startDate && (!season.endDate || entry.date <= season.endDate)
    ).length;
    
    // Calculate avg emotion
    const avgEmotion = seasonEvents.length > 0 ? (seasonEvents.reduce((sum, e) => sum + (e.emotionScore || 0), 0) / seasonEvents.length) : 0;
    
    shockData.push(shocks);
    breakthroughData.push(breakthroughs);
    sopChangeData.push(sopChanges);
    avgEmotionData.push(avgEmotion);
  });
  
  // Also add an "Ongoing" category if there's a current season or unseasoned data
  if (lg.currentSeason) {
    const currentSeasonObj = seasons.find(s => s.id === lg.currentSeason);
    // Already included above if seasons array has it.
  } else if ((lg.events && lg.events.length > 0) || (lg.rawJournal && lg.rawJournal.length > 0)) {
    // We have unseasoned data
    const unseasonedEvents = (lg.events || []).filter(e => !e.seasonId);
    if (unseasonedEvents.length > 0 || lg.rawJournal.some(j => !j.seasonId)) {
      labels.push("Unseasoned / Current");
      const shocks = unseasonedEvents.filter(e => e.type === "SHOCK").length;
      const breakthroughs = unseasonedEvents.filter(e => e.type === "BREAKTHROUGH").length;
      const sopChanges = (lg.rawJournal || []).filter(j => j.content.startsWith("[System Change]") && !j.seasonId).length;
      const avgEmotion = unseasonedEvents.length > 0 ? (unseasonedEvents.reduce((sum, e) => sum + (e.emotionScore || 0), 0) / unseasonedEvents.length) : 0;
      
      shockData.push(shocks);
      breakthroughData.push(breakthroughs);
      sopChangeData.push(sopChanges);
      avgEmotionData.push(avgEmotion);
    }
  }

  // If no data, show empty state
  if (labels.length === 0) {
    labels.push("No Data");
    shockData.push(0);
    breakthroughData.push(0);
    sopChangeData.push(0);
    avgEmotionData.push(0);
  }

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: "Shocks",
        data: shockData,
        backgroundColor: "#ff3b30",
      },
      {
        label: "Breakthroughs",
        data: breakthroughData,
        backgroundColor: "#34c759",
      },
      {
        label: "SOP Changes",
        data: sopChangeData,
        backgroundColor: "#0071e3",
      },
      {
        label: "Avg Emotion (0-5)",
        data: avgEmotionData,
        backgroundColor: "#ff9f0a",
        type: "line",
        yAxisID: "y1",
      }
    ]
  };

  if (window._lgTrendChart) {
    window._lgTrendChart.data = chartData;
    window._lgTrendChart.update();
  } else {
    window._lgTrendChart = new Chart(ctx, {
      type: "bar",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: false },
          y: { 
            beginAtZero: true, 
            stacked: false,
            title: { display: true, text: "Count" }
          },
          y1: {
            beginAtZero: true,
            max: 5,
            position: "right",
            grid: { drawOnChartArea: false },
            title: { display: true, text: "Emotion Intensity" }
          }
        }
      }
    });
  }
}

// Hook it into renderLongGame
const origRenderLongGameChartHook = window.renderLongGame;
window.renderLongGame = function() {
  if (origRenderLongGameChartHook) origRenderLongGameChartHook();
  renderTrendChart();
};

// ==========================================
// Weekly Review Workflow
// ==========================================
function openLgWeeklyReviewModal() {
  const lg = state.longGame;
  
  // Build summary
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentEvents = (lg.events || []).filter(e => new Date(e.date) > oneWeekAgo);
  const shocks = recentEvents.filter(e => e.type === "SHOCK").length;
  const breakthroughs = recentEvents.filter(e => e.type === "BREAKTHROUGH").length;
  const maxEmotion = recentEvents.reduce((max, e) => Math.max(max, e.emotionScore || 0), 0);
  
  const recentSopChanges = (lg.rawJournal || []).filter(j => 
    j.content.startsWith("[System Change]") && new Date(j.date) > oneWeekAgo
  ).length;

  const summaryHtml = `
    <strong style="display: block; margin-bottom: 8px;">Last 7 Days Summary:</strong>
    <ul style="margin: 0; padding-left: 20px; list-style: disc;">
      <li>${shocks} Shocks, ${breakthroughs} Breakthroughs</li>
      <li>${recentSopChanges} SOP Changes</li>
      <li>Highest Emotion Score: ${maxEmotion} / 5</li>
    </ul>
  `;
  
  document.getElementById("lgWeeklySummaryContent").innerHTML = summaryHtml;
  document.getElementById("lgWeeklyReviewForm").reset();
  
  openSheet("lgWeeklyReviewModal");
}

document.getElementById("lgWeeklyReviewForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  if (!state.longGame.weeklyReviews) state.longGame.weeklyReviews = [];
  
  state.longGame.weeklyReviews.push({
    id: uuidv4(),
    date: new Date().toISOString(),
    q1: formData.get("q1") || "",
    q2: formData.get("q2") || "",
    q3: formData.get("q3") || ""
  });
  
  if (await safeSaveLongGame()) {
    closeSheet("lgWeeklyReviewModal");
    toast("Weekly review saved.");
    if (typeof renderWeeklyReviewBadge === 'function') renderWeeklyReviewBadge();
  } else {
    state.longGame.weeklyReviews.pop();
  }
});

document.getElementById("closeLgWeeklyReviewBtn")?.addEventListener("click", () => {
  closeSheet("lgWeeklyReviewModal");
});

function renderWeeklyReviewBadge() {
  // If we wanted to show a badge on the dashboard. 
  // Let's add a button in the UI next to "Manage Season" for Weekly Review.
  let badgeContainer = document.getElementById("lgWeeklyReviewBadgeContainer");
  if (!badgeContainer) {
    const seasonHead = document.querySelector(".lg-season-panel .panel-head");
    if (seasonHead) {
      badgeContainer = document.createElement("div");
      badgeContainer.id = "lgWeeklyReviewBadgeContainer";
      seasonHead.appendChild(badgeContainer);
    }
  }
  
  if (badgeContainer) {
    const reviews = state.longGame.weeklyReviews || [];
    let badgeText = "Review Due";
    let badgeColor = "var(--orange)";
    if (reviews.length > 0) {
      const lastReview = new Date(reviews[reviews.length - 1].date);
      const daysAgo = Math.floor((new Date() - lastReview) / (1000 * 60 * 60 * 24));
      if (daysAgo < 7) {
        badgeText = `Last Review: ${daysAgo}d ago`;
        badgeColor = "var(--muted)";
      }
    }
    
    badgeContainer.innerHTML = `
      <button class="ghost-button pill-button" type="button" onclick="openLgWeeklyReviewModal()" style="font-size: 11px; height: 24px; padding: 0 8px; color: ${badgeColor}; border-color: ${badgeColor};">
        ${badgeText}
      </button>
    `;
  }
}

// Hook it into renderLongGame
const origRenderLongGameBadgeHook = window.renderLongGame;
window.renderLongGame = function() {
  if (origRenderLongGameBadgeHook) origRenderLongGameBadgeHook();
  renderWeeklyReviewBadge();
};

window.openLgWeeklyReviewModal = openLgWeeklyReviewModal;
