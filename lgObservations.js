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
  let prevShocks = 0, prevBreakthroughs = 0;
  let currShocks = 0, currBreakthroughs = 0;
  
  (lg.events || []).forEach(e => {
    if (e.seasonId === prev.id) {
      if (e.type === "SHOCK") prevShocks++;
      if (e.type === "BREAKTHROUGH") prevBreakthroughs++;
    } else if (e.seasonId === currentSeason.id) {
      if (e.type === "SHOCK") currShocks++;
      if (e.type === "BREAKTHROUGH") currBreakthroughs++;
    }
  });
  
  const diffShocks = currShocks - prevShocks;
  const isChanged = diffShocks !== 0 || currBreakthroughs !== prevBreakthroughs;
  
  thenNowFeed.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--hairline-strong); border-radius: 8px; padding: 16px; font-size: 13px;">
      <div style="display: flex; gap: 16px;">
        <div style="flex: 1; border-right: 1px solid var(--hairline-strong); padding-right: 16px;">
          <div style="font-weight: 600; color: var(--muted); margin-bottom: 8px;">THEN (${prev.name})</div>
          <div>Shocks: ${prevShocks}</div>
          <div>Breakthroughs: ${prevBreakthroughs}</div>
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: var(--ink); margin-bottom: 8px;">NOW (${currentSeason.name})</div>
          <div>Shocks: ${currShocks}</div>
          <div>Breakthroughs: ${currBreakthroughs}</div>
        </div>
      </div>
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed var(--hairline-strong); font-weight: 600; text-align: center; color: ${isChanged ? 'var(--blue)' : 'var(--muted)'};">
        ${isChanged ? "Your response changed." : "No meaningful behavioral change detected yet."}
      </div>
    </div>
  `;
}
