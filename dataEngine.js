// TRD Journey Data Backup & Export Engine
// Features: JSON Backup & Restore, CSV Trade Logs Export, and Monthly PDF Performance Report Generator

class TRDDataEngine {
  constructor() {
    this.init();
  }

  init() {
    window.exportJSONBackup = () => this.exportJSON();
    window.importJSONBackup = (fileInput) => this.importJSON(fileInput);
    window.exportTradesCSV = () => this.exportCSV();
    window.generateMonthlyReport = () => this.generateReport();
  }

  getTrades() {
    if (window.state && Array.isArray(window.state.trades) && window.state.trades.length > 0) {
      return window.state.trades;
    }
    try {
      const STORAGE_KEY = "trd-journey-os-v1";
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.trades)) return parsed.trades;
      }
    } catch (e) {}
    try {
      const stored = localStorage.getItem("trd_trades_v1");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  async exportJSON() {
    try {
      // Read directly from IndexedDB — the single source of truth used by app.js
      const STORAGE_KEY = "trd-journey-os-v1";
      let stateData = null;
      try {
        if (window.idbGet) {
          stateData = await window.idbGet(STORAGE_KEY);
        }
      } catch (e) {}

      // Fallback: use live window.state if IDB not available yet
      if (!stateData && window.state) {
        stateData = JSON.parse(JSON.stringify(window.state));
      }

      // Final fallback: localStorage (legacy support)
      if (!stateData) {
        const lsRaw = localStorage.getItem(STORAGE_KEY);
        if (lsRaw) stateData = JSON.parse(lsRaw);
      }

      if (!stateData) {
        alert("No data found to back up.");
        return;
      }

      const backupData = {
        app: "TRD Journey",
        backupVersion: 2,
        schemaVersion: stateData.schemaVersion || 110,
        exportedAt: new Date().toISOString(),
        state: stateData
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const dateStr = new Date().toISOString().slice(0, 10);
      this.downloadBlob(blob, `TRD_Journey_Backup_${dateStr}.json`);

      if (window.appleAudioEngine) window.appleAudioEngine.play('checklist');
    } catch (err) {
      alert("Export failed: " + err.message);
    }
  }

  async importJSON(fileInput) {
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
    const file = fileInput.files[0];
    if (window.importJson) {
      window.importJson(file);
    } else {
      alert("System not fully initialized yet.");
    }
    fileInput.value = "";
  }

  exportCSV() {
    if (window.TRDAuth && window.TRDAuth.getSubscription && window.TRDAuth.getSubscription().plan !== 'pro') {
      window.TRDAuth.openUpgradeModal();
      if (window.toast) window.toast("⭐ CSV Trade Data Export is a PRO feature. Upgrade to export.", "warning");
      return;
    }

    const trades = this.getTrades();
    if (!trades.length) {
      alert("No trade records found to export.");
      return;
    }

    const esc = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const headers = ["Open Time", "Close Time", "Duration", "Date", "Symbol", "Direction", "Setup", "Risk ($)", "R-Multiple", "Net PnL ($)", "Grade", "Rule Followed", "Emotion", "MAE (R)", "MFE (R)", "SOP Version", "Entry Plan", "Exit Note"];
    const rows = trades.map(t => {
      const openDisp = t.openTime ? t.openTime.replace("T", " ") : t.date || "";
      const closeDisp = t.closeTime ? t.closeTime.replace("T", " ") : (t.closedAt || "");
      const duration = (window.formatHoldDuration ? window.formatHoldDuration(t.openTime || t.date, t.closeTime || t.closedAt) : "");
      const rVal = t.pnl && t.risk && Number(t.risk) > 0 ? (Number(t.pnl) / Number(t.risk)).toFixed(2) : 0;
      const mae = t.maeR !== undefined && t.maeR !== null ? t.maeR : "";
      const mfe = t.mfeR !== undefined && t.mfeR !== null ? t.mfeR : "";
      const sopVer = t.sopSnapshot?.version || 1;
      return [
        esc(openDisp),
        esc(closeDisp),
        esc(duration),
        esc(t.date || ""),
        esc(t.symbol || ""),
        esc(t.direction || "Long"),
        esc(t.setup || ""),
        t.risk || 0,
        rVal,
        t.pnl || 0,
        esc(t.grade || "A"),
        esc(t.ruleStatus === "incomplete" || t.rule === "incomplete" ? "Incomplete" : (t.rule ? "Yes" : "No")),
        esc(t.emotion || "Calm"),
        esc(mae),
        esc(mfe),
        esc(`v${sopVer}`),
        esc(t.entryPlan || ""),
        esc(t.exitNote || "")
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadBlob(blob, `TRD_Trades_${dateStr}.csv`);

    if (window.appleAudioEngine) window.appleAudioEngine.play('checklist');
  }

  generateReport() {
    if (window.TRDAuth && window.TRDAuth.getSubscription && window.TRDAuth.getSubscription().plan !== 'pro') {
      window.TRDAuth.openUpgradeModal();
      if (window.toast) window.toast("⭐ Monthly Executive PDF Report is a PRO feature. Upgrade to export.", "warning");
      return;
    }

    const trades = this.getTrades();
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    const totalTrades = trades.length;
    const wins = trades.filter(t => t.pnl > 0).length;
    const winRate = totalTrades ? Math.round((wins / totalTrades) * 100) : 0;
    const totalR = trades.reduce((acc, t) => acc + (t.pnl && t.risk ? t.pnl / t.risk : 0), 0);
    const followedRulesCount = trades.filter(t => t.rule === true || t.ruleFollowed === true || (!t.ruleStatus || t.ruleStatus === "followed")).length;
    const complianceRate = totalTrades ? Math.round((followedRulesCount / totalTrades) * 100) : 100;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("⚠️ Pop-up was blocked by your browser. Please allow pop-ups for this site to view and print your Monthly Report.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>TRD Journey - Monthly Performance Report (${dateStr})</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: 800; color: #0071e3; margin: 0; }
          .meta { font-size: 14px; color: #64748b; margin-top: 4px; }
          .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
          .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center; }
          .metric-val { font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 6px; }
          .metric-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px 14px; text-align: left; }
          th { background: #f1f5f9; font-weight: 700; }
          .win { color: #10b981; font-weight: 700; }
          .loss { color: #ef4444; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">TRD Journey Trading Operating System</h1>
            <p class="meta">Monthly Executive Performance Report · ${dateStr}</p>
          </div>
          <button onclick="window.print()" style="padding:8px 16px; background:#0071e3; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:700;">Print / Save PDF</button>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Total Trades</div>
            <div class="metric-val">${totalTrades}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Win Rate</div>
            <div class="metric-val">${winRate}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Cumulative Net R</div>
            <div class="metric-val">${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Disciplined Rule Compliance</div>
            <div class="metric-val">${complianceRate}%</div>
          </div>
        </div>

        <h2>Trade Execution Ledger</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Direction</th>
              <th>Setup</th>
              <th>Risk ($)</th>
              <th>Net R</th>
              <th>PnL ($)</th>
              <th>Rule Followed</th>
            </tr>
          </thead>
          <tbody>
            ${trades.map(t => {
              const r = t.pnl && t.risk ? (t.pnl / t.risk).toFixed(2) : '0.00';
              return `
                <tr>
                  <td>${t.date || ''}</td>
                  <td><strong>${t.symbol || ''}</strong></td>
                  <td>${t.direction || 'Long'}</td>
                  <td>${t.setup || ''}</td>
                  <td>$${t.risk || 0}</td>
                  <td class="${r >= 0 ? 'win' : 'loss'}">${r >= 0 ? '+' : ''}${r}R</td>
                  <td class="${t.pnl >= 0 ? 'win' : 'loss'}">${t.pnl >= 0 ? '+' : ''}$${t.pnl || 0}</td>
                  <td>${t.ruleStatus === "incomplete" || t.rule === "incomplete" ? '🟠 Incomplete' : (t.ruleStatus === "violated" || t.rule === false ? 'No ✕' : 'Yes ✓')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

class ForexFactoryRedNewsEngine {
  // Events come from state.redNews (IDB) — auto-synced from nfs.faireconomy.media XML feed

  getEvents() {
    return Array.isArray(window.state?.redNews) ? window.state.redNews : [];
  }

  getAllRedEvents() {
    return this.getEvents().slice().sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
    );
  }

  filterByCurrency(currency = "All") {
    const list = this.getAllRedEvents();
    if (!currency || currency === "All") return list;
    return list.filter(e => e.currency === currency.toUpperCase());
  }

  getNextRedEvent() {
    const now = new Date();
    for (const evt of this.getAllRedEvents()) {
      const evtDate = new Date(`${evt.date}T${evt.time}:00`);
      if (evtDate > now) return { ...evt, eventDate: evtDate, diffMs: evtDate - now };
    }
    return null;
  }

  isTradeNearRedNews(tradeDateStr, windowMins = 30) {
    if (!tradeDateStr) return null;
    const cleanStr = String(tradeDateStr).trim().replace(" ", "T");
    const dateOnly = cleanStr.split("T")[0];
    const isDateOnly = !cleanStr.includes("T");
    const windowMs = windowMins * 60 * 1000;

    for (const evt of this.getEvents()) {
      const isEvtAllDay = evt.isAllDay || evt.time === "00:00";

      // Issue Fix #3: All-Day or Tentative events on the same day trigger alert regardless of trade time
      if (evt.date === dateOnly && (isDateOnly || isEvtAllDay)) {
        return { event: evt, diffMins: 0, sameDay: true, isAllDay: isEvtAllDay };
      }

      // Proximity check for timed events and timed trades
      if (!isDateOnly && !isEvtAllDay) {
        const tradeTime = new Date(cleanStr);
        const evtTime = new Date(`${evt.date}T${evt.time}:00`);
        if (!isNaN(tradeTime) && !isNaN(evtTime) && Math.abs(tradeTime - evtTime) <= windowMs) {
          return { event: evt, diffMins: Math.round(Math.abs(tradeTime - evtTime) / 60000), sameDay: evt.date === dateOnly, isAllDay: false };
        }
      }
    }
    return null;
  }

  // ── Parse helpers ──────────────────────────────────────────────────────────

  // Convert ForexFactory date "MM-DD-YYYY" → "YYYY-MM-DD"
  _parseDate(raw) {
    const s = (raw || "").trim();
    const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return `${m[3]}-${m[1]}-${m[2]}`;
    return s;
  }

  // Issue Fix #1: Convert ForexFactory ET Date + 12h Time ("8:15am", "11:30pm") → Local YYYY-MM-DD + 24h HH:MM
  // Accommodates midnight date shifts across timezones (e.g. 11:30 PM ET → Next Day in Asia/Australia)
  _parseDateTime(rawDate, rawTime) {
    const dateYMD = this._parseDate(rawDate);
    const s = (rawTime || "").trim().toLowerCase();
    if (!s || s === "tentative" || s === "all day" || s.startsWith("day ")) {
      return { date: dateYMD, time: "00:00", isAllDay: true };
    }

    const m = s.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
    if (!m) return { date: dateYMD, time: "00:00", isAllDay: true };

    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm = m[3];
    if (ampm === "pm" && h !== 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;

    try {
      const probe = new Date(`${dateYMD}T12:00:00Z`);
      const nyHour = parseInt(new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", hour: "numeric", hour12: false
      }).format(probe), 10);
      const nyOffsetHours = 12 - nyHour;
      const offsetStr = `-${String(nyOffsetHours).padStart(2, "0")}:00`;

      const localDate = new Date(`${dateYMD}T${String(h).padStart(2, "0")}:${min}:00${offsetStr}`);
      if (isNaN(localDate.getTime())) throw new Error("Invalid date");

      const yyyy = localDate.getFullYear();
      const mm = String(localDate.getMonth() + 1).padStart(2, "0");
      const dd = String(localDate.getDate()).padStart(2, "0");
      const localYMD = `${yyyy}-${mm}-${dd}`;
      const lh = String(localDate.getHours()).padStart(2, "0");
      const lm = String(localDate.getMinutes()).padStart(2, "0");

      return { date: localYMD, time: `${lh}:${lm}`, isAllDay: false };
    } catch (e) {
      return { date: dateYMD, time: `${String(h).padStart(2, "0")}:${min}`, isAllDay: false };
    }
  }

  // Extract CDATA or text content from an XML element
  _getText(el, tag) {
    const node = el.querySelector(tag);
    if (!node) return "";
    return (node.textContent || "").trim();
  }

  // ── Main sync method ───────────────────────────────────────────────────────
  async syncFromFeed({ onlyHighImpact = true, clearExisting = false } = {}) {
    const FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";
    const CACHE_KEY = "trd_ff_sync_cache_v1";

    // Rate-limit: only fetch once per hour unless clearExisting (force sync) is requested
    try {
      if (!clearExisting) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { ts, xml } = JSON.parse(cached);
          if (Date.now() - ts < 60 * 60 * 1000 && xml) {
            return this._parseAndMerge(xml, { onlyHighImpact, clearExisting });
          }
        }
      }
    } catch (e) {}

    try {
      const res = await fetch(FEED_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();

      // Cache for 1 hour to respect rate limit
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), xml })); } catch (e) {}

      return this._parseAndMerge(xml, { onlyHighImpact, clearExisting });
    } catch (err) {
      return { success: false, error: err.message, added: 0 };
    }
  }

  _parseAndMerge(xmlText, { onlyHighImpact, clearExisting }) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, "text/xml");
      const eventEls = doc.querySelectorAll("event");

      const parsed = [];
      eventEls.forEach(el => {
        const impact = this._getText(el, "impact");
        if (onlyHighImpact && impact !== "High") return;

        const rawDate = this._getText(el, "date");
        const rawTime = this._getText(el, "time");
        const { date, time, isAllDay } = this._parseDateTime(rawDate, rawTime);

        parsed.push({
          id: _deUid(),
          date,
          time,
          isAllDay: !!isAllDay,
          currency: this._getText(el, "country"),
          title: this._getText(el, "title"),
          impact: "red",
          forecast: this._getText(el, "forecast"),
          previous: this._getText(el, "previous"),
          actual: this._getText(el, "actual") || "",
          ffUrl: this._getText(el, "url"),
          autoSynced: true
        });
      });

      if (!window.state) return { success: false, error: "App not ready", added: 0 };
      if (!Array.isArray(window.state.redNews)) window.state.redNews = [];

      if (clearExisting) {
        // Remove previously auto-synced events before re-importing
        window.state.redNews = window.state.redNews.filter(e => !e.autoSynced);
      }

      // Deduplicate: skip events already in state with same date+time+title+currency
      const existing = new Set(
        window.state.redNews.map(e => `${e.date}|${e.time}|${e.currency}|${e.title}`)
      );
      const toAdd = parsed.filter(e => !existing.has(`${e.date}|${e.time}|${e.currency}|${e.title}`));
      window.state.redNews.push(...toAdd);

      if (window.saveState) window.saveState();

      return { success: true, added: toAdd.length, total: parsed.length };
    } catch (err) {
      return { success: false, error: err.message, added: 0 };
    }
  }

  // Delegates to app.js state management
  addEvent(evt) { if (window.addRedNewsEvent) return window.addRedNewsEvent(evt); }
  deleteEvent(id) { if (window.deleteRedNewsEvent) window.deleteRedNewsEvent(id); }
  clearPast() { if (window.clearPastRedNewsEvents) window.clearPastRedNewsEvents(); }
}

// Helper available globally for the engine
function _deUid() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

window.trdDataEngine = new TRDDataEngine();
window.forexFactoryRedNewsEngine = new ForexFactoryRedNewsEngine();

