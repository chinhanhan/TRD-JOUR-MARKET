/**
 * @typedef {Object} SopSnapshot
 * @property {number} version
 * @property {string} sopId
 * @property {string} sopName
 * @property {string} savedAt
 * @property {Array<string>} checklist
 */

/**
 * @typedef {Object} Trade
 * @property {string} id
 * @property {string} status
 * @property {string} date
 * @property {string} [closedAt]
 * @property {string} [openTime]
 * @property {string} [closeTime]
 * @property {string} symbol
 * @property {string} direction
 * @property {string} sopId
 * @property {string} accountId
 * @property {string} setup
 * @property {string} grade
 * @property {number} risk
 * @property {number|string} pnl
 * @property {number|null} [maeR]
 * @property {number|null} [mfeR]
 * @property {boolean|string} rule
 * @property {string} ruleStatus
 * @property {string} emotion
 * @property {SopSnapshot|null} [sopSnapshot]
 */

const STORAGE_KEY = "trd-journey-os-v1";
const LEGACY_KEY = "trd-journey-v1";
const LANGUAGE_KEY = "trd-journey-language";
const IMAGE_LIMIT = 120 * 1024;

const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = () => localISO(new Date());
const money = (value) => {
  const num = Number(value || 0);
  if (isNaN(num) || Math.abs(num) < 0.005) return "$0.00";
  const absStr = Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return num < 0 ? `-$${absStr}` : `$${absStr}`;
};
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);

function parseMarkdown(text) {
  if (!text) return "";
  let html = String(text);
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // Highlight
  html = html.replace(/==([^=]+)==/g, "<mark>$1</mark>");
  
  const lines = html.split("\n");
  const processedLines = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.startsWith("- ")) {
      if (!inList) { processedLines.push("<ul>"); inList = true; }
      processedLines.push(`<li>${line.substring(2)}</li>`);
    } else {
      if (inList) { processedLines.push("</ul>"); inList = false; }
      if (line.startsWith("> ")) {
        processedLines.push(`<blockquote>${line.substring(2)}</blockquote>`);
      } else if (line.startsWith("# ")) {
        processedLines.push(`<h3>${line.substring(2)}</h3>`);
      } else {
        processedLines.push(line ? `${line}<br>` : "");
      }
    }
  }
  if (inList) processedLines.push("</ul>");

  return processedLines.join("");
}

window.insertMarkdown = function(btn, prefix, suffix) {
  const container = btn.closest(".markdown-editor-container");
  if (!container) return;
  const textarea = container.querySelector("textarea");
  if (!textarea) return;
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const before = text.substring(0, start);
  const selected = text.substring(start, end);
  const after = text.substring(end);
  
  textarea.value = before + prefix + selected + suffix + after;
  textarea.focus();
  // Put cursor in the middle or after
  textarea.setSelectionRange(start + prefix.length, end + prefix.length);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
};

const starterTrades = [
  { id: "1", date: "2026-05-13", symbol: "NQ", setup: "Opening Drive", direction: "Long", grade: "A", risk: 100, pnl: 230, rule: true, emotion: "Focused", note: "Clean drive after range break.", checklist: { hasPlan: true, hasTrigger: true, hasStop: true, hasTarget: true, emotionControlled: true }, tradingViewUrl: "https://www.tradingview.com/chart/" },
  { id: "2", date: "2026-05-14", symbol: "ES", setup: "Range Fade", direction: "Short", grade: "B", risk: 100, pnl: -80, rule: true, emotion: "Calm", note: "Exit respected.", checklist: { hasPlan: true, hasTrigger: true, hasStop: true, hasTarget: false, emotionControlled: true } },
  { id: "3", date: "2026-05-15", symbol: "NQ", setup: "Liquidity Sweep", direction: "Long", grade: "A", risk: 120, pnl: 300, rule: true, emotion: "Focused", note: "Sweep into HTF level.", checklist: { hasPlan: true, hasTrigger: true, hasStop: true, hasTarget: true, emotionControlled: true } },
  { id: "4", date: "2026-05-18", symbol: "CL", setup: "Breakout Retest", direction: "Long", grade: "C", risk: 80, pnl: -110, rule: false, emotion: "FOMO", note: "Entered before retest completed.", checklist: { hasPlan: false, hasTrigger: false, hasStop: true, hasTarget: false, emotionControlled: false } },
  { id: "5", date: "2026-05-19", symbol: "NQ", setup: "Pullback Continuation", direction: "Short", grade: "A", risk: 100, pnl: 170, rule: true, emotion: "Calm", note: "One pullback, one decision.", checklist: { hasPlan: true, hasTrigger: true, hasStop: true, hasTarget: true, emotionControlled: true } },
  { id: "6", date: "2026-05-20", symbol: "GC", setup: "Liquidity Sweep", direction: "Short", grade: "B", risk: 90, pnl: -45, rule: true, emotion: "Hesitant", note: "Reduced size after late signal.", checklist: { hasPlan: true, hasTrigger: true, hasStop: true, hasTarget: false, emotionControlled: false } },
  { id: "7", date: "2026-05-21", symbol: "NQ", setup: "Opening Drive", direction: "Long", grade: "A", risk: 100, pnl: 260, rule: true, emotion: "Focused", note: "Held to target without moving stop.", checklist: { hasPlan: true, hasTrigger: true, hasStop: true, hasTarget: true, emotionControlled: true }, imageUrl: "https://s3.tradingview.com/snapshots/x/x8KQ6Y1R.png" }
];

const defaultPreferences = {
  defaultSymbol: "NQ",
  riskPerTrade: 100,
  dailyMaxLossR: -2,
  maxTradesPerDay: 3,
  setups: ["Opening Drive", "Pullback Continuation", "Liquidity Sweep", "Range Fade", "Breakout Retest"],
  dailyRules: ["Only A setups before 11:30", "Stop trading at -2R", "No revenge trades", "One setup, one decision"],
  backupReminder: true,
  enableSounds: true,
  carouselDragSensitivity: 0.18,
  carouselSnapFriction: 0.04,
  checklistLabels: {
    hasPlan: "Plan",
    hasTrigger: "Trigger",
    hasStop: "Invalidation Stop",
    hasTarget: "Planned Target",
    emotionControlled: "Emotional Control"
  },
  lastBackupAt: ""
};

const defaultSopDetails = {
  market: "Futures",
  timeframe: "Intraday",
  status: "active",
  levelNotes: "",
  entryRules: "Define location, trigger, invalidation, and target before entry.",
  exitRules: "Exit at invalidation or planned target. Do not move stop impulsively.",
  riskRules: "Risk stays within the planned R. No averaging down.",
  noTradeRules: "No trade when the setup is unclear, rushed, or emotionally forced.",
  checklist: ["Location", "Trigger", "Invalidation", "Target", "Emotion controlled"],
  weaknesses: ["Early entry", "Moving stop", "Holding without target"]
};

let journalView = "timeline";

let state = null;
let selectedDay = todayISO();
let activeModule = null;
let language = localStorage.getItem(LANGUAGE_KEY) || "en";
let theme = localStorage.getItem("trd-journey-theme") || "light";
document.documentElement.setAttribute("data-theme", theme);
let interactionState = {
  sourceModule: null,
  transitionTimer: null
};

const dictionary = {
  en: {
    switchLanguage: "中文",
    homeTitle: "Choose your next move.",
    homeCopy: "Plan quietly. Execute cleanly. Review what the data actually says.",
    today: "Today",
    journal: "Journal",
    review: "Review",
    system: "System",
    back: "Back",
    logTrade: "Log Trade",
    planReady: "Plan ready",
    planMissing: "Plan missing",
    open: "Open",
    closed: "closed",
    last: "Last",
    processLeak: "process leak",
    risk: "Risk",
    backupReady: "Backup ready",
    openTrades: "Open Trades",
    liveExecution: "Live execution",
    startTrade: "Start Trade",
    noOpenTrades: "No open trades.",
    reviewPrompt: "Close open trades to complete review.",
    working: "Working",
    leaking: "Leaking",
    nextFocus: "Next Focus",
    noData: "No data",
    addTrades: "Add closed trades",
    closeTrade: "Close Trade",
    rResult: "R Result",
    rHint: "Use R when you want statistics before exact dollars.",
    pnlWins: "If both are filled, Net P&L is used.",
    needsResult: "Add Net P&L or R Result to close this trade.",
    tradeClosed: "Trade closed.",
    languageSaved: "Language updated.",
    maxDailyLoss: "Max daily loss",
    maxTrades: "Max trades"
  },
  zh: {
    switchLanguage: "EN",
    homeTitle: "选择下一步。",
    homeCopy: "安静计划。干净执行。复盘真实数据。",
    today: "今日",
    journal: "交易记录",
    review: "复盘",
    system: "系统",
    back: "返回",
    logTrade: "记录交易",
    planReady: "计划已完成",
    planMissing: "缺少计划",
    open: "进行中",
    closed: "已完成",
    last: "上一笔",
    processLeak: "流程泄漏",
    risk: "风险",
    backupReady: "可备份",
    openTrades: "进行中交易",
    liveExecution: "执行中",
    startTrade: "开始记录",
    noOpenTrades: "暂无进行中交易。",
    reviewPrompt: "完成进行中交易后再结束复盘。",
    working: "有效的部分",
    leaking: "泄漏的部分",
    nextFocus: "下一步专注",
    noData: "暂无数据",
    addTrades: "添加已完成交易",
    closeTrade: "结束交易",
    rResult: "R 结果",
    rHint: "还没有精确金额时，可以先用 R 统计。",
    pnlWins: "如果同时填写，优先使用 Net P&L。",
    needsResult: "请填写 Net P&L 或 R Result 后再结束交易。",
    tradeClosed: "交易已结束。",
    languageSaved: "语言已更新。",
    maxDailyLoss: "每日最大亏损",
    maxTrades: "最大交易数"
  }
};

function t(key) {
  return dictionary[language]?.[key] || dictionary.en[key] || key;
}

function defaultState() {
  const base = {
    version: 1,
    schemaVersion: 110,
    preferences: structuredClone(defaultPreferences),
    trades: [],
    dailyPlans: {
      [todayISO()]: { bias: "Wait for confirmation near key levels.", levels: "Previous high / low, session open", allowedSetups: "Opening Drive, Liquidity Sweep", maxLossR: -2, maxTrades: 3 }
    },
    dailyReviews: {},
    redNews: [],
    longGame: {
      currentSeason: null,
      seasons: [],
      events: [],
      rawJournal: [],
      observations: [],
      mirrorEntries: [],
      customAlertConfig: {
        consecutiveLosses: 4,
        sopChangeWindowDays: 7,
        shockBreakRatioDelta: 0.2
      },
      weeklyReviews: []
    }
  };
  return ensureSopState(base);
}

const DB_NAME = "trd-journey-db";
const DB_VERSION = 1;
const STORE_NAME = "app-state";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key, val) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(val, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Expose IDB helpers globally so dataEngine.js can use them for backup/restore
window.idbGet = idbGet;
window.idbSet = idbSet;

async function migrateDatabase(raw) {
  if (!raw) return raw;
  let currentSchema = raw.schemaVersion || 1;
  
  if (currentSchema < 110) {
    console.info(`Migrating database from v${currentSchema} to v110...`);
    try {
      localStorage.setItem(`trd_backup_pre_migration_v${currentSchema}_${Date.now()}`, JSON.stringify(raw));
    } catch(e) {
      console.warn("Could not create pre-migration backup in localStorage", e);
    }
    
    // Future migration steps can be chained here (e.g., if currentSchema === 1)
    
    raw.schemaVersion = 110;
  }
  
  return raw;
}

async function loadState() {
  try {
    let idbSaved = await idbGet(STORAGE_KEY);
    if (idbSaved) {
      const oldSchema = idbSaved.schemaVersion || 1;
      idbSaved = await migrateDatabase(idbSaved);
      if (oldSchema < 110) await idbSet(STORAGE_KEY, idbSaved);
      return normalizeState(idbSaved);
    }
  } catch (e) {
    console.error("IDB load failed", e);
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      let parsed = JSON.parse(saved);
      parsed = await migrateDatabase(parsed);
      await idbSet(STORAGE_KEY, parsed);
      return normalizeState(parsed);
    } catch (e) {
      console.error("localStorage load failed", e);
    }
  }
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    try {
      let parsed = { trades: JSON.parse(legacy) };
      parsed = await migrateDatabase(parsed);
      await idbSet(STORAGE_KEY, parsed);
      return normalizeState(parsed);
    } catch (e) {
      console.error("Legacy load failed", e);
    }
  }
  return defaultState();
}

function normalizeState(raw) {
  if (!raw) raw = {};
  if (raw.state && typeof raw.state === "object") {
    raw = raw.state;
  }
  return ensureSopState({
    version: 1,
    schemaVersion: raw.schemaVersion || 110,
    preferences: {
      ...structuredClone(defaultPreferences),
      ...(raw.preferences || {}),
      checklistLabels: {
        ...structuredClone(defaultPreferences.checklistLabels),
        ...(raw.preferences?.checklistLabels || {})
      }
    },
    trades: (raw.trades || []).map(normalizeTrade),
    dailyPlans: raw.dailyPlans || {},
    dailyReviews: raw.dailyReviews || {},
    redNews: Array.isArray(raw.redNews) ? raw.redNews : [],
    sops: raw.sops || [],
    accounts: raw.accounts || [],
    activeSopId: raw.activeSopId || "",
    activeAccountId: raw.activeAccountId || "",
    backtests: [],
    rewardMission: raw.rewardMission || null,
    unlockedBadges: raw.unlockedBadges || {},
    experience: {
      xp: raw.experience?.xp || 0,
      level: raw.experience?.level || 1,
      achievements: raw.experience?.achievements || [],
      dailyXpLog: raw.experience?.dailyXpLog || {}
    },
    longGame: {
      currentSeason: raw.longGame?.currentSeason || null,
      seasons: raw.longGame?.seasons || [],
      events: raw.longGame?.events || [],
      rawJournal: raw.longGame?.rawJournal || [],
      observations: raw.longGame?.observations || [],
      mirrorEntries: raw.longGame?.mirrorEntries || [],
      customAlertConfig: raw.longGame?.customAlertConfig || {
        consecutiveLosses: 4,
        sopChangeWindowDays: 7,
        shockBreakRatioDelta: 0.2
      },
      weeklyReviews: raw.longGame?.weeklyReviews || []
    }
  });
}

function normalizeTrade(trade) {
  const status = trade.status === "open" ? "open" : "closed";
  const dateVal = trade.date || todayISO();
  const openTimeVal = trade.openTime
    ? (trade.openTime.includes("T") ? trade.openTime : `${trade.openTime}T09:30`)
    : `${dateVal}T09:30`;
  const closeTimeVal = trade.closeTime
    ? (trade.closeTime.includes("T") ? trade.closeTime : `${trade.closeTime}T10:30`)
    : (status === "closed" ? (trade.closedAt ? (trade.closedAt.includes("T") ? trade.closedAt : `${trade.closedAt}T10:30`) : `${dateVal}T10:30`) : "");

  return {
    id: String(trade.id || uid()),
    status,
    date: dateVal,
    closedAt: trade.closedAt || (status === "closed" ? dateVal : ""),
    openTime: openTimeVal,
    closeTime: closeTimeVal,
    symbol: trade.symbol || defaultPreferences.defaultSymbol,
    setup: trade.setup || defaultPreferences.setups[0],
    direction: trade.direction || "Long",
    grade: trade.grade || "B",
    risk: (() => { const n = Number(trade.risk); return (!isNaN(n) && isFinite(n)) ? n : 0; })(),
    rMultiple: (() => { if (trade.rMultiple === undefined || trade.rMultiple === "") return ""; const n = Number(trade.rMultiple); return (!isNaN(n) && isFinite(n)) ? n : ""; })(),
    pnl: (() => { if (trade.pnl === "" || trade.pnl == null) return 0; const n = Number(trade.pnl); return (!isNaN(n) && isFinite(n)) ? n : 0; })(),
    rule: (trade.ruleStatus === "incomplete" || trade.rule === "incomplete" || trade.rule === "Incomplete") ? "incomplete" : (trade.ruleStatus === "violated" || trade.rule === false || trade.rule === "false" ? false : true),
    ruleStatus: (() => {
      // Priority: explicit ruleStatus > derive from rule field
      if (trade.ruleStatus === "incomplete" || trade.ruleStatus === "violated" || trade.ruleStatus === "followed") return trade.ruleStatus;
      if (trade.rule === "incomplete" || trade.rule === "Incomplete" || trade.rule === "orange") return "incomplete";
      if (trade.rule === false || trade.rule === "false" || trade.rule === "No" || trade.rule === "broken") return "violated";
      return "followed";
    })(),
    emotion: trade.emotion || "Calm",
    note: trade.note || "",
    entryPlan: trade.entryPlan || trade.entryNote || "",
    entryNote: trade.entryNote || "",
    stopPlan: trade.stopPlan || "",
    targetPlan: trade.targetPlan || "",
    exitNote: trade.exitNote || "",
    checklist: { hasPlan: false, hasTrigger: false, hasStop: false, hasTarget: false, emotionControlled: false, ...(trade.checklist || {}) },
    audit: { compliance: "", stopLoss: "", takeProfit: "", emotionScore: 0, notes: "", ...(trade.audit || {}) },
    mistakes: Array.isArray(trade.mistakes) ? trade.mistakes : (typeof trade.mistakes === "string" ? trade.mistakes.split(",").map(m => m.trim()) : []),
    tradingViewUrl: trade.tradingViewUrl || "",
    imageUrl: trade.imageUrl || "",
    imageData: trade.imageData || "",
    sopId: trade.sopId || "",
    accountId: trade.accountId || "",
    reflection: trade.reflection || "",
    images: Array.isArray(trade.images) ? trade.images : [],
    preFlightChecklist: trade.preFlightChecklist || null,
    sopSnapshot: trade.sopSnapshot || null,
    maeR: (() => { if (trade.maeR === undefined || trade.maeR === "" || trade.maeR === null) return null; const n = Number(trade.maeR); return (!isNaN(n) && isFinite(n)) ? -Math.abs(n) : null; })(),
    mfeR: (() => { if (trade.mfeR === undefined || trade.mfeR === "" || trade.mfeR === null) return null; const n = Number(trade.mfeR); return (!isNaN(n) && isFinite(n)) ? Math.abs(n) : null; })()
  };
}

function makeSopId(name) {
  return `sop-${String(name || "sop").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || uid()}`;
}

function makeAccountId(sopId, name) {
  return `acct-${sopId.replace(/^sop-/, "")}-${String(name || "main").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || uid()}`;
}

function ensureSopState(rawState) {
  const setupNames = [...new Set([
    ...(rawState.preferences?.setups || defaultPreferences.setups),
    ...(rawState.trades || []).map((trade) => trade.setup).filter(Boolean)
  ])];
  const existingSops = (rawState.sops || []).map((sop) => ({
    id: sop.id || makeSopId(sop.name),
    version: Number(sop.version || 1),
    name: sop.name || "Untitled SOP",
    createdAt: sop.createdAt || todayISO(),
    archivedAt: sop.archivedAt || "",
    ...structuredClone(defaultSopDetails),
    ...sop,
    checklist: parseSopChecklistRules(sop.checklist || defaultSopDetails.checklist),
    weaknesses: Array.isArray(sop.weaknesses) ? sop.weaknesses : String(sop.weaknesses || defaultSopDetails.weaknesses.join("\n")).split("\n").map((item) => item.trim()).filter(Boolean)
  }));
  const sopsByName = new Map(existingSops.map((sop) => [sop.name, sop]));
  for (const setup of setupNames) {
    if (!sopsByName.has(setup)) {
      const id = makeSopId(setup);
      const sop = { id, name: setup, createdAt: todayISO(), archivedAt: "", ...structuredClone(defaultSopDetails) };
      existingSops.push(sop);
      sopsByName.set(setup, sop);
    }
  }
  const existingAccounts = (rawState.accounts || []).map((account) => ({
    id: account.id || makeAccountId(account.sopId || existingSops[0]?.id || "sop-main", account.name),
    sopId: account.sopId || existingSops[0]?.id || "",
    name: account.name || "Main Account",
    type: account.type || "Main",
    startingBalance: Number(account.startingBalance ?? account.currentBalance ?? 1000),
    currentBalance: Number(account.currentBalance ?? account.startingBalance ?? 1000),
    status: account.status || "active",
    createdAt: account.createdAt || todayISO(),
    archivedAt: account.archivedAt || ""
  }));
  for (const sop of existingSops) {
    if (!existingAccounts.some((account) => account.sopId === sop.id)) {
      existingAccounts.push({ id: makeAccountId(sop.id, "Main Account"), sopId: sop.id, name: "Main Account", type: "Main", startingBalance: 1000, currentBalance: 1000, status: "active", createdAt: todayISO(), archivedAt: "" });
    }
  }
  const firstSop = existingSops[0];
  const trades = (rawState.trades || []).map((trade) => {
    const sop = existingSops.find((item) => item.id === trade.sopId) || sopsByName.get(trade.setup) || firstSop;
    const account = existingAccounts.find((item) => item.id === trade.accountId && item.sopId === sop?.id) || existingAccounts.find((item) => item.sopId === sop?.id);
    return { ...trade, sopId: sop?.id || "", accountId: account?.id || "" };
  });
  const activeSopId = existingSops.some((sop) => sop.id === rawState.activeSopId) ? rawState.activeSopId : firstSop?.id || "";
  const activeAccount = existingAccounts.find((account) => account.id === rawState.activeAccountId && account.sopId === activeSopId) || existingAccounts.find((account) => account.sopId === activeSopId);
  return {
    ...rawState,
    sops: existingSops,
    accounts: existingAccounts,
    trades,
    activeSopId,
    activeAccountId: activeAccount?.id || ""
  };
}

async function saveState() {
  try {
    await idbSet(STORAGE_KEY, JSON.parse(JSON.stringify(state)));
    return true;
  } catch (e) {
    console.error("IDB save failed", e);
    return false;
  }
}

// ── Red News Management ─────────────────────────────────────────────────────
function addRedNewsEvent(evt) {
  if (!state.redNews) state.redNews = [];
  const entry = {
    id: uid(),
    date: evt.date || todayISO(),
    time: evt.time || "00:00",
    currency: (evt.currency || "USD").toUpperCase(),
    title: evt.title || "News Event",
    impact: "red",
    forecast: evt.forecast || "",
    previous: evt.previous || "",
    actual: evt.actual || ""
  };
  state.redNews.push(entry);
  saveState();
  return entry;
}

function deleteRedNewsEvent(id) {
  if (!state.redNews) return;
  state.redNews = state.redNews.filter(e => e.id !== id);
  saveState();
}

function clearPastRedNewsEvents() {
  if (!state.redNews) return;
  const cutoff = todayISO();
  state.redNews = state.redNews.filter(e => e.date >= cutoff);
  saveState();
}

function activeSop() {
  return state.sops.find((sop) => sop.id === state.activeSopId && !sop.archivedAt) || state.sops.filter(s => !s.archivedAt)[0];
}

function accountsForSop(sopId = state.activeSopId) {
  return state.accounts.filter((account) => account.sopId === sopId && !account.archivedAt);
}

function activeAccount() {
  return state.accounts.find((account) => account.id === state.activeAccountId && !account.archivedAt) || accountsForSop().filter(a => !a.archivedAt)[0];
}

function visibleTrades() {
  const sopId = state.activeSopId || activeSop()?.id;
  const accountId = state.activeAccountId || activeAccount()?.id;
  return state.trades.filter((trade) => trade.sopId === sopId && (!accountId || trade.accountId === accountId));
}

function activeSopTrades() {
  return visibleTrades();
}

function sopTrades(sopId) {
  return state.trades.filter((trade) => trade.sopId === sopId);
}

function accountName(id) {
  if (!id) return activeAccount()?.name || "Main Account";
  return state.accounts.find((account) => account.id === id)?.name || "Archived Account";
}

function accountLabel(account = activeAccount()) {
  if (!account) return "No account";
  return `${account.name}${account.type ? ` · ${account.type}` : ""}`;
}

function sopName(id) {
  if (!id) return activeSop()?.name || "Main SOP";
  return state.sops.find((sop) => sop.id === id)?.name || "Archived SOP";
}

function closedTrades(trades = visibleTrades()) {
  return trades.filter((trade) => trade.status !== "open");
}

function openTrades(trades = visibleTrades()) {
  return trades.filter((trade) => trade.status === "open");
}

function getTradeRuleStatus(trade) {
  if (!trade) return "followed";
  if (trade.ruleStatus) return trade.ruleStatus;
  if (trade.rule === "incomplete" || trade.rule === "Incomplete" || trade.rule === "orange") return "incomplete";
  if (trade.rule === false || trade.rule === "false" || trade.rule === "No" || trade.rule === "broken") return "violated";
  return "followed";
}

function ruleTag(trade) {
  const status = getTradeRuleStatus(trade);
  if (status === "incomplete") {
    return '<span class="tag orange" title="SOP incomplete / sandbox trade">🟠 SOP Incomplete</span>';
  }
  if (status === "violated") {
    return '<span class="tag bad" title="SOP rule broken">🔴 Violated</span>';
  }
  return '<span class="tag good" title="Strictly followed SOP">🟢 Followed</span>';
}

function rValue(trade) {
  if (!trade) return 0;
  if (trade.rMultiple !== undefined && trade.rMultiple !== "" && !isNaN(Number(trade.rMultiple))) {
    const val = Number(trade.rMultiple);
    return Number.isFinite(val) ? val : 0;
  }
  const riskNum = Number(trade.risk || 0);
  if (riskNum > 0) {
    const res = Number(trade.pnl || 0) / riskNum;
    return Number.isFinite(res) ? res : 0;
  }
  const pnlNum = Number(trade.pnl || 0);
  if (pnlNum !== 0) return pnlNum > 0 ? 1 : -1;
  return 0;
}

function formatR(value) {
  const num = Number(value || 0);
  if (isNaN(num) || Math.abs(num) < 0.005) return "0.00R";
  const fixed = num.toFixed(2);
  if (fixed === "-0.00" || fixed === "0.00") return "0.00R";
  const sign = Number(fixed) > 0 ? "+" : "";
  return `${sign}${fixed}R`;
}

function formatLossR(value) {
  const num = Number(value || 0);
  if (isNaN(num) || Math.abs(num) < 0.005) return "0.00R";
  const fixed = num.toFixed(2);
  if (fixed === "-0.00" || fixed === "0.00") return "0.00R";
  return `${fixed}R`;
}

function formatDollar(val) {
  const num = Number(val || 0);
  if (isNaN(num)) return "$0.00";
  const absNum = Math.abs(num);
  const fixedStr = absNum < 0.005 ? "0.00" : absNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = Math.abs(num) < 0.005 ? "" : num > 0 ? "+" : "-";
  return `${sign}$${fixedStr}`;
}

function formatHoldDuration(openTimeStr, closeTimeStr) {
  if (!openTimeStr || !closeTimeStr) return "";
  let sStr = String(openTimeStr).trim().replace(" ", "T");
  let eStr = String(closeTimeStr).trim().replace(" ", "T");
  const hasTime = sStr.includes("T") || eStr.includes("T");
  if (sStr.length === 16 && sStr.includes("T")) sStr += ":00";
  if (eStr.length === 16 && eStr.includes("T")) eStr += ":00";
  const start = new Date(sStr.includes("T") ? sStr : `${sStr}T00:00:00`);
  const end = new Date(eStr.includes("T") ? eStr : `${eStr}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return "";
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (!hasTime) {
    const daysOnly = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return daysOnly > 0 ? `${daysOnly}d` : "Same day";
  }
  if (diffMins < 1) return "<1m";
  const days = Math.floor(diffMins / (60 * 24));
  const hours = Math.floor((diffMins % (60 * 24)) / 60);
  const mins = diffMins % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || !parts.length) parts.push(`${mins}m`);
  return parts.join(" ");
}

function formatTimeDisplay(isoStr) {
  if (!isoStr) return "";
  const s = String(isoStr).trim().replace(" ", "T");
  if (s.includes("T")) {
    const [d, t] = s.split("T");
    const datePart = d.length >= 10 ? d.slice(5).replace(/-/g, ".") : d;
    const timePart = (t || "").slice(0, 5);
    return timePart ? `${datePart} ${timePart}` : datePart;
  }
  return s.length >= 10 ? s.slice(5).replace(/-/g, ".") : s;
}

function nowDatetimeLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

function metrics(trades = closedTrades()) {
  const source = closedTrades(trades);
  const rList = source.map(rValue);
  const pnlList = source.map((t) => Number(t.pnl || (rValue(t) * Number(t.risk || 0)) || 0));

  const winningTrades = source.filter((t) => rValue(t) > 0 || Number(t.pnl || 0) > 0);
  const losingTrades = source.filter((t) => rValue(t) < 0 || Number(t.pnl || 0) < 0);

  const grossWinR = winningTrades.reduce((sum, t) => sum + rValue(t), 0);
  const grossLossR = losingTrades.reduce((sum, t) => sum + rValue(t), 0);

  const grossWinDollars = winningTrades.reduce((sum, t) => sum + Number(t.pnl || (rValue(t) * Number(t.risk || 0)) || 0), 0);
  const grossLossDollars = losingTrades.reduce((sum, t) => sum + Number(t.pnl || (rValue(t) * Number(t.risk || 0)) || 0), 0);

  let curve = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const r of rList) {
    curve += r;
    peak = Math.max(peak, curve);
    maxDrawdown = Math.min(maxDrawdown, curve - peak);
  }
  return {
    count: source.length,
    totalR: rList.reduce((sum, r) => sum + r, 0),
    totalPnL: pnlList.reduce((sum, p) => sum + p, 0),
    grossWinR,
    grossLossR,
    grossWinDollars,
    grossLossDollars,
    expectancy: rList.length ? rList.reduce((sum, r) => sum + r, 0) / rList.length : 0,
    winRate: rList.length ? winningTrades.length / rList.length : 0,
    profitFactor: Math.abs(grossLossR) ? grossWinR / Math.abs(grossLossR) : grossWinR ? Infinity : 0,
    maxDrawdown
  };
}

function byDate(date) {
  if (!date) return [];
  const targetDate = String(date).trim().split("T")[0].split(" ")[0];
  return visibleTrades().filter((trade) => {
    if (!trade.date) return false;
    const tradeD = String(trade.date).trim().split("T")[0].split(" ")[0];
    return tradeD === targetDate;
  });
}

function closedByDate(date) {
  if (!date) return [];
  const targetDate = String(date).trim().split("T")[0].split(" ")[0];
  return closedTrades().filter((trade) => {
    const rawD = trade.closedAt || trade.date;
    if (!rawD) return false;
    const tradeD = String(rawD).trim().split("T")[0].split(" ")[0];
    return tradeD === targetDate;
  });
}

function groupBy(trades, key) {
  return trades.reduce((map, trade) => {
    const raw = trade[key];
    const value = (raw === undefined || raw === null || raw === "") ? "Unknown" : String(raw);
    map[value] ||= [];
    map[value].push(trade);
    return map;
  }, {});
}

function dateRange(start, end) {
  if (!start || !end) return [];
  const days = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  if (isNaN(cursor.getTime()) || isNaN(last.getTime())) return [];
  let safetyCount = 0;
  while (cursor <= last && safetyCount < 366) {
    days.push(localISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
    safetyCount++;
  }
  return days;
}

function weekRange(date = todayISO()) {
  const d = new Date(`${date}T00:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  const start = localISO(d);
  d.setDate(d.getDate() + 6);
  return [start, localISO(d)];
}

function monthRange(date = todayISO()) {
  const d = new Date(`${date}T00:00:00`);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return [localISO(start), localISO(end)];
}

function tradesInRange(start, end) {
  const cleanStart = String(start || "").split("T")[0].split(" ")[0];
  const cleanEnd = String(end || "").split("T")[0].split(" ")[0];
  return closedTrades().filter((trade) => {
    const raw = trade.closedAt || trade.date;
    if (!raw) return false;
    const d = String(raw).split("T")[0].split(" ")[0];
    return d >= cleanStart && d <= cleanEnd;
  });
}

function processLeakRate(trades = visibleTrades()) {
  const source = closedTrades(trades);
  if (!source.length) return 0;
  const leaks = source.filter((trade) => getTradeRuleStatus(trade) === "violated" || trade.grade === "C").length;
  return leaks / source.length;
}

function streak() {
  const days = [...new Set(closedTrades().map((trade) => trade.closedAt || trade.date))].sort();
  let current = 0;
  let direction = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const total = metrics(closedByDate(days[i])).totalR;
    const sign = total > 0 ? 1 : total < 0 ? -1 : 0;
    if (!direction) direction = sign;
    if (sign === direction && sign !== 0) current += 1;
    else break;
  }
  return { count: current, direction };
}

function sopProgress(sopId = state.activeSopId) {
  const trades = sopId === state.activeSopId ? visibleTrades() : sopTrades(sopId);
  const closed = closedTrades(trades);
  const m = metrics(closed);
  const screenshots = trades.filter((trade) => imageFor(trade)).length;
  const aGrades = closed.filter((trade) => trade.grade === "A").length;
  const followed = closed.filter((trade) => getTradeRuleStatus(trade) === "followed").length;
  const incomplete = closed.filter((trade) => getTradeRuleStatus(trade) === "incomplete").length;
  const validForRule = Math.max(closed.length - incomplete, 1);
  return {
    records: trades.length,
    closed: closed.length,
    screenshots,
    expectancy: m.expectancy,
    totalR: m.totalR,
    winRate: m.winRate,
    ruleRate: closed.length ? followed / validForRule : 0,
    aGradeRate: closed.length ? aGrades / closed.length : 0,
    incompleteCount: incomplete,
    lastUsed: trades.slice().sort((a, b) => (b.closedAt || b.date).localeCompare(a.closedAt || a.date))[0]?.date || ""
  };
}

function sopLevel(progress) {
  const score = progress.records + progress.screenshots * 2 + Math.round(progress.ruleRate * 10) + Math.round(progress.aGradeRate * 8);
  if (progress.records >= 100 && progress.ruleRate >= 0.75) return { level: 5, name: "Mature", score };
  if (progress.records >= 50 && progress.ruleRate >= 0.65) return { level: 4, name: "Refined", score };
  if (progress.records >= 25) return { level: 3, name: "Clear", score };
  if (progress.records >= 10) return { level: 2, name: "Tested", score };
  return { level: 1, name: "Draft", score };
}

function sopWeaknessProfile(sopId = state.activeSopId) {
  const closed = closedTrades(sopId === state.activeSopId ? visibleTrades() : sopTrades(sopId));
  if (!closed.length) return "Needs more records";
  const leaks = closed.filter((trade) => getTradeRuleStatus(trade) === "violated" || trade.grade === "C");
  const emotionRows = Object.entries(groupBy(leaks.length ? leaks : closed, "emotion"))
    .map(([name, list]) => ({ name, count: list.length, ...metrics(list) }))
    .sort((a, b) => b.count - a.count || a.expectancy - b.expectancy);
  return emotionRows[0] ? `${emotionRows[0].name} is the clearest leak` : "Execution looks clean";
}

function sopUpgradeSuggestion(sopId = state.activeSopId) {
  const sop = state.sops.find((item) => item.id === sopId);
  const progress = sopProgress(sopId);
  if (!progress.records) return "Collect the first clean example.";
  if (progress.screenshots < Math.min(progress.records, 5)) return "Attach more screenshots to build evidence.";
  if (progress.ruleRate < 0.75) return "Tighten the checklist around the repeated rule break.";
  if ((sop?.weaknesses || []).length < 3) return "Name one more weakness after the next review.";
  return "Refine one entry rule with your best example.";
}

function timelineGroups(trades = visibleTrades()) {
  return trades.slice().sort((a, b) => (b.closedAt || b.date).localeCompare(a.closedAt || a.date)).reduce((groups, trade) => {
    const day = trade.closedAt || trade.date;
    groups[day] ||= [];
    groups[day].push(trade);
    return groups;
  }, {});
}

function updateChecklistLabelsInUI() {
  const labels = state.preferences.checklistLabels || defaultPreferences.checklistLabels;
  const planEl = document.getElementById("labelHasPlanText");
  const triggerEl = document.getElementById("labelHasTriggerText");
  const stopEl = document.getElementById("labelHasStopText");
  const targetEl = document.getElementById("labelHasTargetText");
  const emotionEl = document.getElementById("labelEmotionControlledText");
  
  if (planEl) planEl.textContent = labels.hasPlan;
  if (triggerEl) triggerEl.textContent = labels.hasTrigger;
  if (stopEl) stopEl.textContent = labels.hasStop;
  if (targetEl) targetEl.textContent = labels.hasTarget;
  if (emotionEl) emotionEl.textContent = labels.emotionControlled;
}

const BADGES = [
  {
    id: "risk_guardian",
    name: "Risk Guardian",
    icon: "🛡️",
    desc: "100% rule compliance on 5 consecutive trades",
    category: "Discipline",
    target: 5,
    getProgress: () => getDisciplineStreak()
  },
  {
    id: "zen_master",
    name: "Zen Master",
    icon: "🧘",
    desc: "10 trades executed under Calm or Focused emotions",
    category: "Mindset",
    target: 10,
    getProgress: () => closedTrades().filter(t => t.emotion === "Calm" || t.emotion === "Focused").length
  },
  {
    id: "precision_shooter",
    name: "Precision Shooter",
    icon: "🎯",
    desc: "Achieve a +3.00R or higher single winning trade",
    category: "Execution",
    target: 1,
    getProgress: () => closedTrades().filter(t => rValue(t) >= 3.0).length
  },
  {
    id: "profit_surfer",
    name: "Profit Surfer",
    icon: "🚀",
    desc: "Accumulate +10.00R in net total profit",
    category: "Growth",
    target: 10,
    getProgress: () => Math.max(0, Math.round(metrics().totalR || 0))
  },
  {
    id: "hot_streak",
    name: "Hot Streak",
    icon: "🔥",
    desc: "Achieve a 3-day winning streak",
    category: "Streak",
    target: 3,
    getProgress: () => {
      const s = streak();
      return s.direction > 0 ? s.count : 0;
    }
  },
  {
    id: "evidence_collector",
    name: "Evidence Collector",
    icon: "📸",
    desc: "Attach chart screenshots to 5 trades",
    category: "Journaling",
    target: 5,
    getProgress: () => visibleTrades().filter(t => imageFor(t)).length
  },
  {
    id: "journal_master",
    name: "Journal Master",
    icon: "💎",
    desc: "Log and review 20 total trades",
    category: "Mastery",
    target: 20,
    getProgress: () => closedTrades().length
  }
];

function evaluateBadges() {
  if (!state.unlockedBadges) state.unlockedBadges = {};
  let newlyUnlocked = false;

  BADGES.forEach(badge => {
    const progress = badge.getProgress();
    if (progress >= badge.target && !state.unlockedBadges[badge.id]) {
      state.unlockedBadges[badge.id] = todayISO();
      newlyUnlocked = true;
      toast(`🏆 Achievement Unlocked: ${badge.name}!`, "win");
      if (window.appleAudioEngine) window.appleAudioEngine.play('win');
    }
  });

  if (newlyUnlocked) saveState();
}

function renderBadgeShowcase() {
  const grid = document.getElementById("badgeShowcaseGrid");
  const tag = document.getElementById("badgeUnlockCountTag");
  if (!grid) return;

  if (!state.unlockedBadges) state.unlockedBadges = {};
  let unlockedCount = 0;

  const html = BADGES.map(badge => {
    const progress = badge.getProgress();
    const isUnlocked = Boolean(state.unlockedBadges[badge.id]) || progress >= badge.target;
    if (isUnlocked) unlockedCount++;

    const pct = Math.min(100, Math.round((progress / badge.target) * 100));
    const statusText = isUnlocked
      ? `Unlocked on ${state.unlockedBadges[badge.id] || todayISO()}`
      : `${progress} / ${badge.target} (${pct}%)`;

    return `
      <div class="badge-card ${isUnlocked ? 'unlocked' : 'locked'}">
        <div class="badge-icon-wrap">${badge.icon}</div>
        <div class="badge-content">
          <div class="badge-title-row">
            <strong>${safe(badge.name)}</strong>
            <span class="badge-category-tag">${safe(badge.category)}</span>
          </div>
          <p class="badge-desc">${safe(badge.desc)}</p>
          <div class="badge-progress-bar">
            <div class="badge-progress-fill" style="width: ${pct}%"></div>
          </div>
          <div class="badge-status-text">
            <span>${isUnlocked ? '🏆 Completed' : 'In Progress'}</span>
            <span>${statusText}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.innerHTML = html;
  if (tag) tag.textContent = `${unlockedCount} / ${BADGES.length} Unlocked`;
}

function renderAll() {
  updateChecklistLabelsInUI();
  applyLanguage();
  populateStaticLabels();
  populateSetupOptions();
  populateSopControls();
  populateSettings();
  populateWorkflowForms();
  renderHomeSummary();
  renderHomeVisuals();
  renderMetrics();
  renderCharts();
  renderInsights();
  renderJournal();
  renderSopJourney();
  renderTodayOpenTrades();
  renderAnalytics();
  renderSessionHeatmap();
  renderMaeMfeScatterChart();
  renderWorkflow();
  renderCycles();
  renderPlaybook();
  renderReflections();
  renderThemeButtons();
  applyLanguage();
  
  // Custom panels collapse
  initCollapsiblePanels();
  updateWorkflowTiles();
  renderActivityRings();
  initNewsBar();

  // Phase 9 Mindfulness & Reward System
  updateRewardMission();
  updateMindfulnessBanner();
  renderDisciplineHeatmap();

  renderMissions();
  evaluateBadges();
  renderBadgeShowcase();

  // SaaS Quota Badge real-time refresh
  if (window.TRDAuth && typeof window.TRDAuth.updateQuotaBadge === "function") {
    window.TRDAuth.updateQuotaBadge();
  }

  // Initialize AnimatedList gradients and Intersection Observer
  setTimeout(() => {
    if (window.observeAnimatedItems) window.observeAnimatedItems();
    if (window.initScrollListGradients) window.initScrollListGradients();
  }, 50);
}

function renderHomeSummary() {
  if (!document.getElementById("home")) return;
  const [weekStart, weekEnd] = weekRange();
  const weekTrades = tradesInRange(weekStart, weekEnd);
  const week = metrics(weekTrades);
  const all = metrics();
  const planReady = Boolean(state.dailyPlans[todayISO()]);
  const openCount = openTrades().length;
  const closed = closedTrades();
  const lastTrade = [...closed].sort((a, b) => (b.closedAt || b.date).localeCompare(a.closedAt || a.date))[0];
  const sop = activeSop();
  const progress = sopProgress(sop?.id);
  const level = sopLevel(progress);
  setText("homeTodayValue", formatR(week.totalR));
  setText("homeTodayMeta", `${planReady ? t("planReady") : t("planMissing")} | ${t("open")}: ${openCount}`);
  setText("homeJournalValue", `Level ${level.level} ${level.name}`);
  setText("homeJournalMeta", `${sop?.name || "SOP"} | ${progress.records} records${lastTrade ? ` | ${t("last")}: ${lastTrade.symbol}` : ""}`);
  setText("homeReviewValue", formatR(all.expectancy));
  setText("homeReviewMeta", `${Math.round(processLeakRate() * 100)}% ${t("processLeak")}`);
  setText("homeSystemValue", `${state.sops.length} SOPs`);
  setText("homeSystemMeta", `${accountsForSop().length} accounts | ${t("backupReady")}`);
}

function populateStaticLabels() {
  const todayLabel = document.getElementById("todayLabel");
  if (todayLabel) {
    todayLabel.textContent = new Date().toLocaleDateString(language === "zh" ? "zh-CN" : "en", { weekday: "long", month: "long", day: "numeric" });
  }
  const guardText = document.getElementById("guardrailText");
  if (guardText) {
    guardText.textContent = `${t("maxDailyLoss")}: ${state.preferences.dailyMaxLossR}R`;
  }
  const guardMeta = document.getElementById("guardrailMeta");
  if (guardMeta) {
    guardMeta.textContent = `${t("maxTrades")}: ${state.preferences.maxTradesPerDay} | ${t("risk")}: ${money(state.preferences.riskPerTrade)}`;
  }
}

function renderHomeVisuals() {
  if (!document.getElementById("home")) return;
  renderMiniSparkline("homeTodaySparkline", equitySeries());
  const openCount = openTrades().length;
  const closedCount = closedTrades().length;
  const total = Math.max(openCount + closedCount, 1);
  document.getElementById("homeJournalStatus").innerHTML = `
    <i style="width:${Math.max((openCount / total) * 100, openCount ? 12 : 0)}%"></i>
    <b style="width:${Math.max((closedCount / total) * 100, closedCount ? 12 : 0)}%"></b>
  `;
  document.getElementById("homeLeakMeter").style.setProperty("--leak", `${Math.round(processLeakRate() * 100)}%`);
  document.getElementById("homeSystemHealth").classList.toggle("is-warning", state.sops.length < 2);
  renderHomeRedNewsWidget();
}

function renderMiniSparkline(id, values) {
  const svg = document.getElementById(id);
  if (!svg) return;
  const width = 160;
  const height = 42;
  const pad = 4;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const spread = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / spread) * (height - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  svg.innerHTML = `<polyline points="${points}"></polyline>`;
}

function populateSetupOptions() {
  const setupSelect = document.getElementById("setupSelect");
  if (setupSelect) {
    const current = setupSelect.value;
    setupSelect.innerHTML = state.preferences.setups.map((setup) => `<option>${safe(setup)}</option>`).join("");
    setupSelect.value = state.preferences.setups.includes(current) ? current : state.preferences.setups[0];
  }
  const filter = document.getElementById("setupFilter");
  if (filter) {
    const filterValue = filter.value;
    filter.innerHTML = `<option value="All">All setups</option>${state.preferences.setups.map((setup) => `<option>${safe(setup)}</option>`).join("")}`;
    filter.value = ["All", ...state.preferences.setups].includes(filterValue) ? filterValue : "All";
  }
}

function populateSopControls() {
  const active = activeSop();
  const sopSelect = document.getElementById("activeSopSelect");
  const accountSelect = document.getElementById("accountFilterSelect");
  const tradeSopSelect = document.getElementById("tradeSopSelect");
  const tradeAccountSelect = document.getElementById("tradeAccountSelect");
  if (!active) {
    if (sopSelect) sopSelect.innerHTML = "";
    if (accountSelect) accountSelect.innerHTML = "";
    if (tradeSopSelect) tradeSopSelect.innerHTML = "";
    if (tradeAccountSelect) tradeAccountSelect.innerHTML = "";
    return;
  }
  const sopOptions = state.sops.filter((sop) => !sop.archivedAt).map((sop) => `<option value="${safe(sop.id)}">${safe(sop.name)}</option>`).join("");
  ["activeSopSelect", "tradeSopSelect"].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const current = select.value;
    select.innerHTML = sopOptions;
    select.value = state.sops.some((sop) => sop.id === current) ? current : active.id;
  });
  const accounts = accountsForSop(active.id).filter((account) => !account.archivedAt);
  if (!accounts.some((account) => account.id === state.activeAccountId)) state.activeAccountId = accounts[0]?.id || "";
  const accountOptions = accounts.map((account) => `<option value="${safe(account.id)}">${safe(account.name)}</option>`).join("");
  const filter = document.getElementById("accountFilterSelect");
  if (filter) {
    filter.innerHTML = accountOptions;
    filter.value = state.activeAccountId || accounts[0]?.id || "";
  }
  if (tradeAccountSelect) {
    tradeAccountSelect.innerHTML = accountOptions;
    tradeAccountSelect.value = state.activeAccountId || accounts[0]?.id || "";
  }
}

function populateSettings() {
  const form = document.getElementById("settingsForm");
  form.defaultSymbol.value = state.preferences.defaultSymbol;
  form.riskPerTrade.value = state.preferences.riskPerTrade;
  form.dailyMaxLossR.value = state.preferences.dailyMaxLossR;
  form.maxTradesPerDay.value = state.preferences.maxTradesPerDay;
  form.setups.value = state.preferences.setups.join("\n");
  form.dailyRules.value = state.preferences.dailyRules.join("\n");
  form.backupReminder.checked = state.preferences.backupReminder !== false;
  form.enableSounds.checked = state.preferences.enableSounds !== false;
  
  const sens = state.preferences.carouselDragSensitivity ?? 0.18;
  const fric = state.preferences.carouselSnapFriction ?? 0.04;
  form.carouselDragSensitivity.value = sens;
  form.carouselSnapFriction.value = fric;
  document.getElementById("carouselDragSensVal").textContent = sens;
  document.getElementById("carouselSnapFricVal").textContent = fric;

  const labels = state.preferences.checklistLabels || defaultPreferences.checklistLabels;
  form.checklistLabelPlan.value = labels.hasPlan;
  form.checklistLabelTrigger.value = labels.hasTrigger;
  form.checklistLabelStop.value = labels.hasStop;
  form.checklistLabelTarget.value = labels.hasTarget;
  form.checklistLabelEmotion.value = labels.emotionControlled;
  
  if (typeof updateStorageDiagnostics === "function") {
    updateStorageDiagnostics();
  }
}

async function updateStorageDiagnostics() {
  const usedEl = document.getElementById("storageUsedMb");
  const quotaEl = document.getElementById("storageQuotaMb");
  const imgCountEl = document.getElementById("storageImageCount");
  if (!usedEl || !quotaEl || !imgCountEl) return;

  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const bytes = estimate.usage || 0;
      const usedStr = bytes >= 1024 * 1024
        ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
        : `${(bytes / 1024).toFixed(1)} KB`;
      const quotaGb = estimate.quota ? `${((estimate.quota) / (1024 * 1024 * 1024)).toFixed(1)} GB` : "No limit";
      usedEl.textContent = usedStr;
      quotaEl.textContent = `${quotaGb} (IndexedDB G-Level)`;
    } else {
      usedEl.textContent = "Active";
      quotaEl.textContent = "IndexedDB G-Level";
    }

    let totalImages = 0;
    (state?.trades || []).forEach((t) => {
      if (Array.isArray(t.images)) totalImages += t.images.length;
      else if (t.imageData || t.imageUrl) totalImages += 1;
    });
    imgCountEl.textContent = `${totalImages} 张 (Canvas 高清压缩)`;

  } catch (e) {
    usedEl.textContent = "IndexedDB Active";
  }
}

window.updateStorageDiagnostics = updateStorageDiagnostics;

function populateWorkflowForms() {
  const day = selectedDay || todayISO();
  const plan = state.dailyPlans[day] || {};
  const review = state.dailyReviews[day] || {};
  const planForm = document.getElementById("planForm");
  const reviewForm = document.getElementById("reviewForm");
  planForm.workflowDate.value = day;
  planForm.bias.value = plan.bias || "";
  planForm.levels.value = plan.levels || "";
  planForm.allowedSetups.value = plan.allowedSetups || state.preferences.setups.slice(0, 2).join(", ");
  planForm.maxLossR.value = plan.maxLossR ?? state.preferences.dailyMaxLossR;
  planForm.maxTrades.value = plan.maxTrades ?? state.preferences.maxTradesPerDay;
  reviewForm.workflowDate.value = day;
  reviewForm.keep.value = review.keep || "";
  reviewForm.remove.value = review.remove || "";
  reviewForm.focus.value = review.focus || "";
}

function setWorkflowDate(day) {
  selectedDay = day || todayISO();
  populateWorkflowForms();
  renderWorkflow();
  renderCycles();
}

function renderMetrics() {
  const m = metrics();
  setText("expectancyMetric", formatR(m.expectancy));
  setText("winRateMetric", `${Math.round(m.winRate * 100)}%`);
  setText("profitFactorMetric", Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "inf");
  setText("drawdownMetric", formatR(m.maxDrawdown));
  setText("tradeCountLabel", `${m.count} trades`);
  document.getElementById("expectancyMetric")?.closest(".metric-item")?.classList.toggle("negative", m.expectancy < 0);
  document.getElementById("drawdownMetric")?.closest(".metric-item")?.classList.toggle("negative", m.maxDrawdown < 0);
}

function renderCharts() {
  const closedCount = closedTrades().length;
  const chartSvg = document.getElementById("equityChart");
  const zeroState = document.getElementById("equityZeroState");
  
  if (closedCount === 0) {
    if (chartSvg) chartSvg.style.display = "none";
    if (zeroState) zeroState.style.display = "flex";
  } else {
    if (chartSvg) chartSvg.style.display = "block";
    if (zeroState) zeroState.style.display = "none";
    renderLineChart("equityChart", equitySeries(), { negative: false });
  }
  renderLineChart("drawdownChart", drawdownSeries(), { negative: true });
}

function equitySeries() {
  let total = 0;
  return [{ value: 0, label: "Start" }, ...closedTrades().map((trade) => {
    total += rValue(trade);
    return { value: total, label: trade.date, detail: `${trade.symbol} (${formatR(rValue(trade))})` };
  })];
}

function drawdownSeries() {
  let total = 0;
  let peak = 0;
  return [{ value: 0, label: "Start" }, ...closedTrades().map((trade) => {
    total += rValue(trade);
    peak = Math.max(peak, total);
    return { value: total - peak, label: trade.date, detail: `${trade.symbol} DD` };
  })];
}

function renderLineChart(id, seriesData, options = {}) {
  const svg = document.getElementById(id);
  if (!svg) return;
  const width = 760;
  const height = id === "equityChart" ? 300 : 260;
  const pad = 32;
  const pointsData = seriesData.map(item => typeof item === 'number' ? { value: item } : item);
  const values = pointsData.map(item => item.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const spread = Math.max(max - min, 1);
  const points = pointsData.map((item, index) => {
    const x = pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((item.value - min) / spread) * (height - pad * 2);
    return { x, y, ...item };
  });
  const zeroY = height - pad - ((0 - min) / spread) * (height - pad * 2);
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${pad},${zeroY} ${line} ${width - pad},${zeroY}`;
  const last = points[points.length - 1];

  const themeFillColor = options.negative ? "#ff453a" : options.positive ? "#30d158" : "#0071e3";

  svg.innerHTML = `
    <defs>
      <linearGradient id="${id}Gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${themeFillColor}" stop-opacity="0.25" />
        <stop offset="100%" stop-color="${themeFillColor}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <line class="grid-line" x1="${pad}" y1="${pad}" x2="${width - pad}" y2="${pad}"></line>
    <text class="axis-label" x="${pad}" y="${pad - 10}">${formatR(max)}</text>
    <line class="zero-line" x1="${pad}" y1="${zeroY}" x2="${width - pad}" y2="${zeroY}"></line>
    <text class="axis-label" x="${pad}" y="${zeroY - 8}">0R</text>
    <text class="axis-label" x="${pad}" y="${height - 8}">${formatR(min)}</text>
    <polygon class="chart-area-fill" points="${area}" fill="url(#${id}Gradient)"></polygon>
    <polyline class="chart-line ${options.negative ? "red" : ""}" points="${line}"></polyline>
    ${points.map((p, index) => `<circle class="chart-dot ${index === points.length - 1 ? "last" : ""}" cx="${p.x}" cy="${p.y}" r="${index === points.length - 1 ? 5.5 : 4}"></circle>`).join("")}
    ${last ? `<circle class="chart-pulse" cx="${last.x}" cy="${last.y}" r="11"></circle>` : ""}
    
    <!-- Hover items -->
    <line class="chart-crosshair" id="${id}Crosshair" x1="0" y1="${pad}" x2="0" y2="${height - pad}"></line>
    <circle class="chart-active-dot" id="${id}ActiveDot" cx="0" cy="0"></circle>
  `;

  svg.onmousemove = (e) => {
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (width / rect.width);
    let nearest = points[0];
    let minDist = Infinity;
    for (const p of points) {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }
    
    const tooltip = document.getElementById("chartTooltip");
    const crosshair = document.getElementById(`${id}Crosshair`);
    const activeDot = document.getElementById(`${id}ActiveDot`);

    if (nearest && minDist < 40) {
      // Update Crosshair & Dot
      if (crosshair) {
        crosshair.setAttribute("x1", nearest.x);
        crosshair.setAttribute("x2", nearest.x);
        crosshair.style.opacity = 1;
      }
      if (activeDot) {
        activeDot.setAttribute("cx", nearest.x);
        activeDot.setAttribute("cy", nearest.y);
        activeDot.style.opacity = 1;
      }

      // Update Tooltip
      if (tooltip) {
        const label = nearest.label ? `<strong>${safe(nearest.label)}</strong><br>` : "";
        const detail = nearest.detail ? `<span style="opacity:0.8">${safe(nearest.detail)}</span><br>` : "";
        tooltip.innerHTML = `${label}${detail}Total: <strong>${formatR(nearest.value)}</strong>`;
        const tooltipX = rect.left + (nearest.x / width) * rect.width;
        const tooltipY = rect.top + (nearest.y / height) * rect.height;
        tooltip.style.left = tooltipX + "px";
        tooltip.style.top = tooltipY + "px"; // Hover slightly above
        tooltip.classList.remove("hidden");
      }
    } else {
      if (crosshair) crosshair.style.opacity = 0;
      if (activeDot) activeDot.style.opacity = 0;
      if (tooltip) tooltip.classList.add("hidden");
    }
  };

  svg.onmouseleave = () => {
    const tooltip = document.getElementById("chartTooltip");
    const crosshair = document.getElementById(`${id}Crosshair`);
    const activeDot = document.getElementById(`${id}ActiveDot`);
    if (crosshair) crosshair.style.opacity = 0;
    if (activeDot) activeDot.style.opacity = 0;
    if (tooltip) tooltip.classList.add("hidden");
  };
}

function renderInsights() {
  const all = metrics();
  const [weekStart, weekEnd] = weekRange();
  const weekTrades = tradesInRange(weekStart, weekEnd);
  const week = metrics(weekTrades);
  const grouped = Object.entries(groupBy(closedTrades(), "setup")).map(([name, list]) => ({ name, ...metrics(list) }));
  const bestSetup = grouped.sort((a, b) => b.expectancy - a.expectancy)[0];
  const worstSetup = grouped.sort((a, b) => a.expectancy - b.expectancy)[0];
  const bestTrade = [...closedTrades()].sort((a, b) => rValue(b) - rValue(a))[0];
  const worstTrade = [...closedTrades()].sort((a, b) => rValue(a) - rValue(b))[0];
  const s = streak();
  const cards = [
    ["Total Profit", formatR(all.grossWinR), formatDollar(all.grossWinDollars), "totalProfit"],
    ["Total Loss", formatLossR(all.grossLossR), formatDollar(all.grossLossDollars), "totalLoss"],
    ["Week R", formatR(week.totalR), `${week.count} trades this week`, "weekR"],
    ["Current Streak", s.count ? `${s.count} ${s.direction > 0 ? "winning" : "losing"} days` : "No streak", "Based on active trading days", "streak"],
    ["Best Setup", bestSetup ? bestSetup.name : "No data", bestSetup ? formatR(bestSetup.expectancy) : "Add trades", "bestSetup"],
    ["Weakest Setup", worstSetup ? worstSetup.name : "No data", worstSetup ? formatR(worstSetup.expectancy) : "Add trades", "worstSetup"],
    ["Largest Win", bestTrade ? formatR(rValue(bestTrade)) : "0.00R", bestTrade ? bestTrade.symbol : "No trades", "largestWin"],
    ["Largest Loss", worstTrade ? formatR(rValue(worstTrade)) : "0.00R", worstTrade ? worstTrade.symbol : "No trades", "largestLoss"],
    ["Process Leak", `${Math.round(processLeakRate() * 100)}%`, "Rule breaks, C trades, weak checklist", "processLeak"],
    ["Total R", formatR(all.totalR), "All recorded trades", "totalR"]
  ];
  if (openTrades().length) cards.unshift([t("openTrades"), String(openTrades().length), t("reviewPrompt"), ""]);
  document.getElementById("summaryCards").innerHTML = cards.map(([title, value, note, key]) => insightCard(title, value, note, key)).join("");
  document.getElementById("statusGrid").innerHTML = [
    ["Plan", state.dailyPlans[todayISO()] ? "Ready" : "Missing", "Pre-market plan"],
    ["Open", `${openTrades(byDate(todayISO())).length}`, "In-progress trades"],
    ["Closed", `${closedByDate(todayISO()).length}`, "Completed today"],
    ["Review", state.dailyReviews[todayISO()] ? "Done" : "Pending", "Daily close"],
  ].map(([title, value, note]) => `<article class="status-card"><span>${title}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
}

function summaryCardsFor(trades, start, end) {
  const m = metrics(trades);
  const setups = Object.entries(groupBy(trades, "setup")).map(([name, list]) => ({ name, ...metrics(list) }));
  const best = setups.sort((a, b) => b.expectancy - a.expectancy)[0];
  const weak = setups.sort((a, b) => a.expectancy - b.expectancy)[0];
  return [
    insightCard("Period", formatPeriodString(start, end), `${trades.length} trades`),
    insightCard("Total Profit", formatR(m.grossWinR), formatDollar(m.grossWinDollars)),
    insightCard("Total Loss", formatLossR(m.grossLossR), formatDollar(m.grossLossDollars)),
    insightCard("Total R", formatR(m.totalR), `${Math.round(m.winRate * 100)}% win rate`),
    insightCard("Best Setup", best?.name || "No data", best ? formatR(best.expectancy) : "Add trades"),
    insightCard("Weakest Setup", weak?.name || "No data", weak ? formatR(weak.expectancy) : "Add trades"),
    insightCard("Process Leak", `${Math.round(processLeakRate(trades) * 100)}%`, "Lower is better")
  ];
}

function monthlyCards(trades, start, end) {
  const m = metrics(trades);
  const days = dateRange(start, end);
  const activeDays = days.filter((day) => byDate(day).length || closedByDate(day).length);
  const dayStats = activeDays.map((day) => ({ day, totalR: metrics(closedByDate(day)).totalR }));
  const best = [...dayStats].sort((a, b) => b.totalR - a.totalR)[0];
  const worst = [...dayStats].sort((a, b) => a.totalR - b.totalR)[0];
  const reviews = days.filter((day) => state.dailyReviews[day]).length;

  const formatDateNote = (d) => d ? d.replace(/-/g, ".") : "No data";

  return [
    insightCard("Period", formatPeriodString(start, end), `${trades.length} trades`),
    insightCard("Total Profit", formatR(m.grossWinR), formatDollar(m.grossWinDollars)),
    insightCard("Total Loss", formatLossR(m.grossLossR), formatDollar(m.grossLossDollars)),
    insightCard("Total R", formatR(m.totalR), `${Math.round(m.winRate * 100)}% win rate`),
    insightCard("Active Days", String(activeDays.length), "Days with trades"),
    insightCard("Best Day", best ? formatR(best.totalR) : "0.00R", formatDateNote(best?.day)),
    insightCard("Worst Day", worst ? formatR(worst.totalR) : "0.00R", formatDateNote(worst?.day)),
    insightCard("Review Rate", `${Math.round(reviews / Math.max(activeDays.length, 1) * 100)}%`, "Reviewed active days")
  ];
}

function insightCard(title, value, note, insightKey = "") {
  const num = String(value);
  const klass = num.startsWith("-") ? "negative" : num.startsWith("+") ? "positive" : "";
  const clickAttr = insightKey ? ` data-insight="${safe(insightKey)}" style="cursor:pointer;"` : "";
  
  const isPeriod = title === "Period" || title.toLowerCase().includes("period");
  const isDateVal = isPeriod || /\d{2}[-.\/]\d{2}/.test(num);
  const isLongVal = num.length > 9 || isDateVal;

  const cardKlass = isPeriod ? " card-period" : "";
  const valKlass = isPeriod ? " is-period" : isLongVal ? " is-long" : "";

  return `<article class="insight-card${cardKlass}"${clickAttr}><span>${safe(title)}</span><strong class="value ${klass}${valKlass}">${safe(value)}</strong><small>${safe(note)}</small></article>`;
}

function renderJournal() {
  const setupFilter = document.getElementById("setupFilter")?.value || "All";
  const ruleFilter = document.getElementById("ruleFilterSelect")?.value || "All";
  const scoped = visibleTrades();
  
  let filtered = setupFilter === "All" ? scoped : scoped.filter((trade) => trade.setup === setupFilter);
  if (ruleFilter !== "All") {
    filtered = filtered.filter((trade) => getTradeRuleStatus(trade) === ruleFilter);
  }

  const open = openTrades(filtered).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const closed = closedTrades(filtered).slice().sort((a, b) => (b.closedAt || b.date).localeCompare(a.closedAt || a.date));
  
  document.getElementById("openTradeCards").innerHTML = open.length ? open.map(tradeCard).join("") : emptyState(t("noOpenTrades"));
  document.getElementById("tradeRows").innerHTML = closed.map(tradeRow).join("");
  document.getElementById("mobileTradeCards").innerHTML = closed.map(tradeCard).join("");
}

function renderSopJourney() {
  const active = activeSop();
  if (!active) {
    setText("activeSopTitle", "No SOP");
    setText("activeJourneyMeta", "Create an SOP to begin.");
    setText("activeAccountBalance", "$0");
    setText("activeAccountName", "No account");
    document.getElementById("sopCards").innerHTML = "";
    return;
  }
  const account = activeAccount();
  const progress = sopProgress(active.id);
  const level = sopLevel(progress);
  setText("activeSopTitle", active.name);
  setText("activeJourneyMeta", `${accountLabel(account)} | ${progress.records} records in this account`);
  setText("activeAccountBalance", money(account?.currentBalance ?? account?.startingBalance ?? 0));
  setText("activeAccountName", accountLabel(account));
  document.getElementById("sopCards").innerHTML = state.sops.filter((sop) => !sop.archivedAt).map((sop) => {
    const sopProgressValue = sopProgress(sop.id);
    const sopLevelValue = sopLevel(sopProgressValue);
    const active = sop.id === state.activeSopId;
    return `
    <div class="sop-card ${active ? "active" : ""}" data-sop-expand="${safe(sop.id)}">
      <div class="sop-card-header">
        <span>${safe(sop.market || "SOP")} · ${safe(sop.timeframe || "Journey")}</span>
        <strong>${safe(sop.name)}</strong>
        <small>Level ${sopLevelValue.level} ${sopLevelValue.name} · ${sopProgressValue.records} records</small>
        <i style="width:${Math.min(100, sopLevelValue.level * 20)}%"></i>
      </div>
      <div class="sop-card-details">
        <div class="sop-details-section">
          <strong>📋 Entry Rules:</strong>
          <p>${safe(sop.entryRules || "Follow SOP guidelines.")}</p>
        </div>
        <div class="sop-details-section">
          <strong>Weaknesses:</strong>
          <p>${safe((sop.weaknesses || []).join(", ") || "None registered.")}</p>
        </div>
        <div class="row-actions sop-card-actions">
          ${active ? `<button class="primary-button compact" disabled type="button">Active SOP</button>` : `<button class="primary-button compact" data-sop="${safe(sop.id)}" type="button">Select SOP</button>`}
          <button class="ghost-button compact" data-edit-sop="${safe(sop.id)}" type="button">Edit Settings</button>
        </div>
      </div>
    </div>`;
  }).join("");
  document.getElementById("sopGrowthPanel").innerHTML = maturityPanel(active, progress, level);
  renderAccountManager();
  renderSopTimeline();
  document.querySelectorAll("[data-journal-view]").forEach((button) => button.classList.toggle("active", button.dataset.journalView === journalView));
  document.getElementById("sopTimeline").classList.toggle("hidden", journalView !== "timeline");
  document.getElementById("journalTablePanel").classList.toggle("hidden", journalView !== "table");
}

function maturityPanel(sop, progress, level) {
  const percent = maturityPercent(progress, level);
  const message = progress.records
    ? `${sop.name} is becoming clearer. Keep collecting clean evidence.`
    : "Start with one clean record. The SOP will get clearer quietly.";
  const why = [
    `${progress.records} records captured in this account`,
    `${progress.closed} closed trades available for review`,
    `${progress.screenshots} screenshot${progress.screenshots === 1 ? "" : "s"} / chart evidence`,
    `${Math.round(progress.ruleRate * 100)}% rule-follow rate`
  ];
  return `<article class="maturity-card">
    <div>
      <span class="tag info">SOP Maturity</span>
      <h3>Level ${level.level} · ${safe(level.name)}</h3>
      <p>${safe(message)}</p>
    </div>
    <div class="maturity-meter" aria-label="SOP maturity ${percent}%">
      <i style="width:${percent}%"></i>
    </div>
    <details class="mini-disclosure">
      <summary>Why this level?</summary>
      <ul>${why.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>
      <p>${safe(sopUpgradeSuggestion(sop.id))}</p>
    </details>
  </article>`;
}

function maturityPercent(progress, level) {
  const thresholds = [0, 10, 25, 50, 100];
  const current = thresholds[level.level - 1] || 0;
  const next = thresholds[level.level] || Math.max(progress.records, 100);
  const levelBase = (level.level - 1) * 20;
  const inLevel = Math.min(1, Math.max(0, (progress.records - current) / Math.max(next - current, 1)));
  return Math.round(Math.min(100, levelBase + inLevel * 20));
}

function renderAccountManager() {
  const target = document.getElementById("accountManagerPanel");
  if (!target) return;
  const accounts = accountsForSop().filter((account) => !account.archivedAt);
  target.innerHTML = accounts.map((account) => `
    <article class="account-card ${account.id === state.activeAccountId ? "active" : ""}">
      <button class="account-select" data-account="${safe(account.id)}" type="button">
        <span>${safe(account.type || "Account")}</span>
        <strong>${safe(account.name)}</strong>
        <small>${money(account.currentBalance)} current · ${money(account.startingBalance)} start</small>
      </button>
      <button class="text-button" data-edit-account="${safe(account.id)}" type="button">Edit</button>
    </article>
  `).join("") || emptyState("No accounts yet.");
}

function renderSopTimeline() {
  const target = document.getElementById("sopTimeline");
  if (!target) return;
  const zeroState = document.getElementById("timelineZeroState");
  const groups = timelineGroups(visibleTrades());
  const days = Object.keys(groups);
  
  if (!days.length) {
    target.style.display = "none";
    if (zeroState) zeroState.style.display = "flex";
  } else {
    target.style.display = "grid";
    if (zeroState) zeroState.style.display = "none";
    target.innerHTML = days.map((day) => `
      <section class="timeline-day">
        <div class="timeline-date"><strong>${safe(new Date(`${day}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" }))}</strong><span>${groups[day].length} records</span></div>
        <div class="timeline-records">${groups[day].map(timelineCard).join("")}</div>
      </section>
    `).join("");
  }
}

function timelineCard(trade) {
  const img = imageFor(trade);
  return `<article class="timeline-card ${trade.status === "open" ? "open" : ""}">
    <div>
      <div class="timeline-card-head">
        <strong>${safe(trade.symbol)} ${safe(trade.direction)}</strong>
        ${resultTag(trade)}
      </div>
      <p>${safe(trade.setup)} · ${safe(accountName(trade.accountId))}</p>
    </div>
    <div class="timeline-evidence">
      ${img ? `<img class="thumbnail" src="${img}" alt="Chart screenshot" />` : ""}
      ${trade.tradingViewUrl ? '<span class="tag info">TV</span>' : ""}
      <span class="tag">${safe(trade.grade)}</span>
      ${ruleTag(trade)}
    </div>
    <div class="muted" style="margin:8px 0; font-size:0.88rem; line-height:1.5;">${parseMarkdown(safe(trade.status === "open" ? trade.entryPlan || "In progress" : trade.exitNote || trade.note || "Record completed."))}</div>
    <div class="row-actions">
      <button class="text-button" data-detail="${trade.id}">View</button>
      <button class="text-button" data-edit="${trade.id}">${trade.status === "open" ? "Update" : "Edit"}</button>
      ${trade.status === "open" ? `<button class="text-button" data-close-trade="${trade.id}">Close Trade</button>` : ""}
      <button class="delete-button" data-delete="${trade.id}">Delete</button>
    </div>
  </article>`;
}

function renderTodayOpenTrades() {
  const target = document.getElementById("todayOpenTradeCards");
  if (!target) return;
  const open = openTrades(byDate(todayISO())).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  target.innerHTML = open.length ? open.map(tradeCard).join("") : emptyState(t("noOpenTrades"));
}

function renderReviewInsightCards() {
  const closed = closedTrades();
  const target = document.getElementById("reviewInsightCards");
  if (!target) return;
  const sop = activeSop();
  const progress = sopProgress(sop?.id);
  const level = sopLevel(progress);
  if (!closed.length) {
    target.innerHTML = [
      insightCard("Working", sop?.name || t("noData"), "Start collecting evidence for this SOP."),
      insightCard("Weakness", "Not enough records", "Close trades to reveal patterns."),
      insightCard("Upgrade", "Add first example", "Screenshot one clean execution.")
    ].join("");
    return;
  }
  const setupRows = Object.entries(groupBy(closed, "setup")).map(([name, list]) => ({ name, ...metrics(list) }));
  const emotionRows = Object.entries(groupBy(closed, "emotion")).map(([name, list]) => ({ name, ...metrics(list) }));
  const bestSetup = [...setupRows].sort((a, b) => b.expectancy - a.expectancy)[0];
  const weakestEmotion = [...emotionRows].sort((a, b) => a.expectancy - b.expectancy)[0];
  const leak = processLeakRate(closed);
  const openCount = openTrades().length;
  const next = openCount
    ? [t("nextFocus"), `${openCount} ${t("open")}`, t("reviewPrompt")]
    : leak > 0.25
      ? [t("nextFocus"), "Process first", "Reduce rule breaks before adding size."]
      : [t("nextFocus"), bestSetup?.name || "Repeat quality", "Only trade the setup with the cleanest evidence."];
  target.innerHTML = [
    insightCard("Working", bestSetup?.name || sop?.name || t("noData"), `Level ${level.level} ${level.name} · ${formatR(progress.expectancy)} expectancy`),
    insightCard("Weakness", sopWeaknessProfile(sop?.id), weakestEmotion ? `${weakestEmotion.name} impact ${formatR(weakestEmotion.expectancy)}` : `${Math.round(leak * 100)}% ${t("processLeak")}`),
    insightCard("Upgrade", sopUpgradeSuggestion(sop?.id), `${progress.screenshots} screenshots · ${Math.round(progress.ruleRate * 100)}% rule follow`)
  ].join("");
}

function tradeRow(trade) {
  const openDisp = formatTimeDisplay(trade.openTime || trade.date);
  const closeDisp = trade.status === "closed" ? formatTimeDisplay(trade.closeTime || trade.closedAt) : "Open";
  const duration = formatHoldDuration(trade.openTime || trade.date, trade.closeTime || trade.closedAt);

  return `<tr>
    <td>
      <div style="font-weight:600;">${openDisp}</div>
      ${trade.status === "closed" ? `<div style="font-size:11px; color:var(--muted);">🔴 ${closeDisp} ${duration ? `(${duration})` : ""}</div>` : '<div style="font-size:11px; color:var(--accent);">🟢 Open</div>'}
    </td>
    <td>${safe(trade.symbol)} ${trade.direction === "Long" ? "↑" : "↓"}</td>
    <td>${safe(trade.setup)}</td>
    <td>${resultTag(trade)}</td>
    <td>${safe(trade.grade)}</td>
    <td>${ruleTag(trade)}</td>
    <td>${mediaBadges(trade)}</td>
    <td>
      <button class="ghost-button action-trigger-btn" data-trade-actions="${trade.id}" style="padding:4px 8px; min-height:auto;">•••</button>
    </td>
  </tr>`;
}

function tradeCard(trade) {
  const img = imageFor(trade);
  const duration = formatHoldDuration(trade.openTime || trade.date, trade.closeTime || trade.closedAt);
  const durationTag = duration ? `<span class="tag info" style="font-size:10px; font-weight:600;">⏱️ ${duration}</span>` : "";
  const openDisp = formatTimeDisplay(trade.openTime || trade.date);
  const closeDisp = trade.status === "closed" ? formatTimeDisplay(trade.closeTime || trade.closedAt) : "Open";

  return `<article class="trade-card" style="position:relative;">
    <button class="ghost-button action-trigger-btn" data-trade-actions="${trade.id}" style="position:absolute; top:12px; right:12px; padding:4px 8px; min-height:auto; font-size:12px; z-index:10;">•••</button>
    <div class="trade-card-head" style="padding-right:32px;">
      <div>
        <strong>${safe(trade.symbol)} ${safe(trade.direction)}</strong>
        <p style="margin-top:2px;">${safe(trade.setup)}</p>
        <div style="font-size:11px; color:var(--muted); margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span>🟢 ${openDisp}</span>
          ${trade.status === "closed" ? `<span>🔴 ${closeDisp}</span>` : `<span class="tag info" style="font-size:10px;">In Progress</span>`}
          ${durationTag}
        </div>
      </div>
      ${resultTag(trade)}
    </div>
    <div class="trade-card-meta" style="margin-top:8px;">
      <span>${trade.status === "open" ? safe(trade.entryPlan || "In progress") : `Grade ${safe(trade.grade)} | ${ruleTag(trade)}`}</span>
      ${img ? `<img class="thumbnail" src="${img}" alt="Chart screenshot" />` : ""}
    </div>
    ${trade.status === "open" ? `
      <div style="margin-top:12px; display:flex; justify-content:flex-end;">
        <button class="ghost-button" data-close-trade="${trade.id}" style="padding:4px 10px; font-size:11px; min-height:auto;">Close Trade</button>
      </div>
    ` : ""}
  </article>`;
}

function resultTag(trade) {
  if (trade.status === "open") return '<span class="tag info">Open</span>';
  const r = rValue(trade);
  const pnlStr = trade.pnl ? ` (${formatDollar(trade.pnl)})` : "";
  return `<span class="tag ${r >= 0 ? "good" : "bad"}">${formatR(r)}${pnlStr}</span>`;
}

function mediaBadges(trade) {
  const imgCount = imagesFor(trade).length;
  const imgBadge = imgCount > 1 ? `<span class="tag info">${imgCount} Images</span> ` : imgCount === 1 ? '<span class="tag info">Image</span> ' : "";
  const tvBadge = trade.tradingViewUrl ? '<span class="tag info">TV</span> ' : "";
  const nearNews = window.forexFactoryRedNewsEngine?.isTradeNearRedNews(trade.date);
  const newsBadge = nearNews ? `<span class="trade-red-news-tag" title="${safe(nearNews.event.title)}">🔴 ${safe(nearNews.event.currency)} News</span> ` : "";
  return `${imgBadge}${tvBadge}${newsBadge}` || '<span class="muted">None</span>';
}

function imageFor(trade) {
  if (!trade) return "";
  if (trade.images && Array.isArray(trade.images) && trade.images.length > 0 && trade.images[0]) {
    return trade.images[0];
  }
  return trade.imageData || trade.imageUrl || "";
}

function renderAnalytics() {
  renderGroupedBars("setupBars", groupBy(closedTrades(), "setup"));
  renderGroupedBars("emotionBars", groupBy(closedTrades(), "emotion"));
  renderGroupedBars("gradeBars", groupBy(closedTrades(), "grade"));
  
  const weekdays = closedTrades().reduce((acc, trade) => {
    const d = new Date(`${trade.date}T12:00:00`);
    const day = d.toLocaleDateString("en", { weekday: "short" });
    if (!acc[day]) acc[day] = [];
    acc[day].push(trade);
    return acc;
  }, {});
  renderGroupedBars("weekdayBars", weekdays);
  renderGroupedBars("directionBars", groupBy(closedTrades(), "direction"));
  
  renderDistribution();
  executeAndRenderMonteCarlo();
  
  // Phase 3: Mistake Analytics
  const mistakeGroup = {};
  closedTrades().forEach(trade => {
    if (!trade.mistakes || !trade.mistakes.length) return;
    trade.mistakes.forEach(mistake => {
      if (!mistakeGroup[mistake]) mistakeGroup[mistake] = [];
      mistakeGroup[mistake].push(trade);
    });
  });
  renderGroupedBars("mistakeBars", mistakeGroup);
}

function getTradeExecutionEfficiency(trade) {
  const actualR = rValue(trade);
  const mfe = Number(trade.mfeR);
  if (!mfe || mfe <= 0 || isNaN(mfe)) return null;
  const eff = (actualR / mfe) * 100;
  return Math.max(0, Math.min(100, Math.round(eff)));
}

function renderSessionHeatmap() {
  const container = document.getElementById("heatmapMatrixContainer");
  if (!container) return;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const sessions = [
    { key: "Asia", label: "Asia (18:00-03:00 EST)" },
    { key: "London", label: "London (03:00-09:30 EST)" },
    { key: "NY_AM", label: "NY Morning (09:30-12:00 EST)" },
    { key: "NY_PM", label: "NY Afternoon (12:00-16:00 EST)" }
  ];

  const matrix = {};
  days.forEach((day) => {
    matrix[day] = {};
    sessions.forEach((s) => {
      matrix[day][s.key] = { rSum: 0, count: 0, wins: 0 };
    });
  });

  const trades = (typeof getActiveAccountTrades === "function" ? getActiveAccountTrades() : (state.trades || [])).filter((t) => t.status === "closed");

  trades.forEach((trade) => {
    if (!trade.date) return;
    const dateObj = new Date(trade.date);
    if (isNaN(dateObj.getTime())) return;
    const dayIdx = dateObj.getDay();
    const dayMap = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };
    const dayName = dayMap[dayIdx];
    if (!dayName) return;

    let sessionKey = "NY_AM";
    if (trade.openTime) {
      const parts = trade.openTime.split("T")[1];
      if (parts) {
        const hour = parseInt(parts.split(":")[0], 10);
        if (hour >= 18 || hour < 3) sessionKey = "Asia";
        else if (hour >= 3 && hour < 9) sessionKey = "London";
        else if (hour >= 9 && hour < 12) sessionKey = "NY_AM";
        else if (hour >= 12 && hour < 18) sessionKey = "NY_PM";
      }
    }

    const r = rValue(trade);
    if (matrix[dayName] && matrix[dayName][sessionKey]) {
      matrix[dayName][sessionKey].rSum += r;
      matrix[dayName][sessionKey].count += 1;
      if (r > 0) matrix[dayName][sessionKey].wins += 1;
    }
  });

  let html = `<table class="heatmap-matrix-table">
    <thead>
      <tr>
        <th class="row-header">Day / Session</th>
        ${sessions.map((s) => `<th>${safe(s.label)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
  `;

  days.forEach((day) => {
    html += `<tr><th class="row-header">${day}</th>`;
    sessions.forEach((s) => {
      const cellData = matrix[day][s.key];
      const count = cellData.count;
      const rSum = cellData.rSum;
      const winRate = count > 0 ? Math.round((cellData.wins / count) * 100) : 0;
      
      let levelClass = "level-neutral";
      if (count > 0) {
        if (rSum >= 3) levelClass = "level-positive-high";
        else if (rSum > 0) levelClass = "level-positive-mid";
        else if (rSum <= -3) levelClass = "level-negative-high";
        else if (rSum < 0) levelClass = "level-negative-mid";
      }

      const cellText = count > 0
        ? `<strong>${formatR(rSum)}</strong><div style="font-size:10px; opacity:0.85; margin-top:2px;">${winRate}% WR (${count}T)</div>`
        : `<span style="opacity:0.4;">-</span>`;

      const titleTooltip = count > 0
        ? `${day} ${s.label}: ${formatR(rSum)} Total, ${cellData.wins} Wins / ${count - cellData.wins} Losses (${winRate}% Win Rate)`
        : `${day} ${s.label}: No trade records`;

      html += `<td class="heatmap-cell ${levelClass}" title="${safe(titleTooltip)}">${cellText}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function renderMaeMfeScatterChart() {
  const svg = document.getElementById("maeMfeScatterSvg");
  if (!svg) return;

  const closed = (typeof getActiveAccountTrades === "function" ? getActiveAccountTrades() : (state.trades || [])).filter((t) => t.status === "closed" && (t.maeR !== null || t.mfeR !== null));
  if (!closed.length) {
    svg.innerHTML = `<text x="380" y="160" text-anchor="middle" fill="var(--muted)" font-size="13">No MAE/MFE trade data recorded yet. Log MAE & MFE in trade form to view scatter distribution.</text>`;
    return;
  }

  const width = 760;
  const height = 320;
  const padding = { top: 30, right: 40, bottom: 40, left: 60 };

  let maxMae = 2.0;
  let maxMfe = 4.0;

  closed.forEach((t) => {
    if (t.maeR !== null) maxMae = Math.max(maxMae, Math.abs(t.maeR));
    if (t.mfeR !== null) maxMfe = Math.max(maxMfe, t.mfeR);
  });

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const scaleX = (mae) => {
    const absMae = Math.abs(mae || 0);
    return padding.left + (absMae / maxMae) * chartW;
  };

  const scaleY = (mfe) => {
    const valMfe = Math.max(0, mfe || 0);
    return padding.top + chartH - (valMfe / maxMfe) * chartH;
  };

  let elements = [];

  for (let i = 0; i <= 4; i++) {
    const yVal = (maxMfe / 4) * i;
    const yPos = scaleY(yVal);
    elements.push(`<line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="var(--hairline)" stroke-dasharray="3,3" />`);
    elements.push(`<text x="${padding.left - 10}" y="${yPos + 4}" text-anchor="end" fill="var(--muted)" font-size="10">+${yVal.toFixed(1)}R</text>`);
  }

  for (let i = 0; i <= 4; i++) {
    const xVal = (-maxMae / 4) * i;
    const xPos = scaleX(xVal);
    elements.push(`<line x1="${xPos}" y1="${padding.top}" x2="${xPos}" y2="${height - padding.bottom}" stroke="var(--hairline)" stroke-dasharray="3,3" />`);
    elements.push(`<text x="${xPos}" y="${height - padding.bottom + 16}" text-anchor="middle" fill="var(--muted)" font-size="10">${xVal.toFixed(1)}R</text>`);
  }

  elements.push(`<text x="${width / 2}" y="${height - 4}" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="600">MAE (Maximum Adverse Excursion / 逆向浮亏 R)</text>`);
  elements.push(`<text x="16" y="${height / 2}" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="600" transform="rotate(-90 16 ${height / 2})">MFE (Maximum Favorable Excursion / 顺向浮盈 R)</text>`);

  closed.forEach((t) => {
    const cx = scaleX(t.maeR || 0);
    const cy = scaleY(t.mfeR || 0);
    const r = rValue(t);
    const isWin = r > 0;
    const color = isWin ? "#34c759" : "#ff3b30";
    const title = `${t.symbol} (${t.date}): ${formatR(r)} | MAE: ${t.maeR ?? 'N/A'}R | MFE: +${t.mfeR ?? 'N/A'}R`;

    elements.push(`
      <g class="scatter-point" style="cursor:pointer;" onclick="window.openDetail('${t.id}')">
        <circle cx="${cx}" cy="${cy}" r="18" fill="transparent"><title>${safe(title)}</title></circle>
        <circle cx="${cx}" cy="${cy}" r="6" fill="${color}" opacity="0.85" stroke="#ffffff" stroke-width="1.5">
          <title>${safe(title)}</title>
        </circle>
      </g>
    `);
  });

  svg.innerHTML = elements.join("");
}

window.getTradeExecutionEfficiency = getTradeExecutionEfficiency;
window.renderSessionHeatmap = renderSessionHeatmap;
window.renderMaeMfeScatterChart = renderMaeMfeScatterChart;

function getSampleContextHtml(n) {
  const base = "font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;";
  if (n < 20) return `<span style="${base} background: var(--bg-card); color: #f59e0b; border: 1px solid #f59e0b33;" title="Low confidence (${n}/20) - Do not form strong conclusions yet.">⚠️ Low Sample (${n})</span>`;
  if (n < 50) return `<span style="${base} background: var(--bg-card); color: #8b5cf6; border: 1px solid #8b5cf633;" title="Medium confidence (${n}/50) - Trends are emerging.">🟡 Med Sample (${n})</span>`;
  return `<span style="${base} background: var(--bg-card); color: #10b981; border: 1px solid #10b98133;" title="High confidence (${n}+) - Statistical significance reached.">🟢 High Sample (${n})</span>`;
}

function renderGroupedBars(id, grouped) {
  const rows = Object.entries(grouped).map(([name, list]) => ({ name, list, ...metrics(list) })).sort((a, b) => b.expectancy - a.expectancy);
  if (!rows.length) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = emptyState("No data yet.");
    return;
  }
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  
  const el = document.getElementById(id);
  if (el) el.innerHTML = rows.map((row) => {
    const volumePct = Math.max((row.count / totalCount) * 100, 10);
    const winRatePct = Math.round(row.winRate * 100);
    const isPositive = row.expectancy >= 0;
    
    return `
      <div class="analytics-card">
        <div class="card-info">
          <div class="card-title-wrap">
            <span class="card-name">${safe(row.name)}</span>
            <span class="card-count">${getSampleContextHtml(row.count)}</span>
          </div>
          <div class="card-metrics">
            <span class="card-r-val ${isPositive ? "positive" : "negative"}">${formatR(row.expectancy)} Expectancy</span>
            <span class="card-winrate">${winRatePct}% win</span>
          </div>
        </div>
        <div class="composite-bar-container">
          <div class="bar-track-volume" style="width: ${volumePct}%" title="${row.count} trades (${Math.round(volumePct)}%)">
            <div class="bar-fill-winrate ${isPositive ? "positive" : "negative"}" style="width: ${winRatePct}%" title="${winRatePct}% win rate"></div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderDistribution() {
  const labels = ["<-2", "-2/-1", "-1/-.5", "-.5/0", "0/.5", ".5/1", "1/2", ">2"];
  const counts = Array(labels.length).fill(0);
  closedTrades().forEach((trade) => {
    const r = rValue(trade);
    let index;
    if (r < -2) index = 0;
    else if (r < -1) index = 1;
    else if (r < -0.5) index = 2;
    else if (r < 0) index = 3;
    else if (r < 0.5) index = 4;
    else if (r < 1) index = 5;
    else if (r < 2) index = 6;
    else index = 7;
    counts[index] += 1;
  });
  const max = Math.max(...counts, 1);
  document.getElementById("distributionChart").innerHTML = counts.map((count, index) => `
    <div class="histogram-bar" style="height:${40 + count / max * 170}px"><strong>${count}</strong><span>${labels[index]}</span></div>
  `).join("");
}

function renderWorkflow() {
  const day = selectedDay || todayISO();
  const tradesToday = byDate(day);
  const closedToday = closedByDate(day);
  const plan = state.dailyPlans[day];
  const review = state.dailyReviews[day];
  const status = [
    ["Plan ready", plan ? "Yes" : "No", plan?.bias || "Save a pre-market plan."],
    ["Open trades", String(openTrades(tradesToday).length), "In-progress execution"],
    ["Closed", String(closedToday.length), `${formatR(metrics(closedToday).totalR)} selected day`],
    ["Checklist quality", `${Math.round((1 - processLeakRate(closedToday)) * 100)}%`, "Closed trade quality"],
    ["Review", review ? "Complete" : "Pending", review?.focus || "Close the loop after session"]
  ];
  document.getElementById("workflowStatus").innerHTML = status.map(([title, value, note]) => insightCard(title, value, note)).join("");
}

function renderCycles() {
  const [monthStart, monthEnd] = monthRange(selectedDay);
  const first = new Date(`${monthStart}T00:00:00`);
  const offset = (first.getDay() + 6) % 7;
  const days = dateRange(monthStart, monthEnd);
  document.getElementById("calendarTitle").textContent = first.toLocaleDateString("en", { month: "long", year: "numeric" });
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="calendar-label">${d}</div>`).join("");
  const blanks = Array(offset).fill('<button class="calendar-day empty" disabled></button>').join("");
  const cells = days.map((day) => {
    const m = metrics(closedByDate(day));
    const openCount = openTrades(byDate(day)).length;
    const review = state.dailyReviews[day] ? "Review done" : "";
    let klass = "";
    if (m.totalR >= 3) klass = "positive-3";
    else if (m.totalR >= 1) klass = "positive-2";
    else if (m.totalR > 0) klass = "positive-1";
    else if (m.totalR <= -3) klass = "negative-3";
    else if (m.totalR <= -1) klass = "negative-2";
    else if (m.totalR < 0) klass = "negative-1";
    return `<button class="calendar-day ${klass} ${day === selectedDay ? "selected" : ""}" data-day="${day}">
      <strong>${Number(day.slice(-2))}</strong>
      <span>${m.count ? formatR(m.totalR) : openCount ? `${openCount} open` : "No trade"}</span>
      <small>${m.count ? `${m.count} closed${openCount ? ` | ${openCount} open` : ""}` : review}</small>
    </button>`;
  }).join("");
  document.getElementById("calendarGrid").innerHTML = labels + blanks + cells;
  renderDayDetail(selectedDay);
  renderCycleSummaries();
}

function renderDayDetail(day) {
  const trades = byDate(day);
  const closed = closedByDate(day);
  const plan = state.dailyPlans[day];
  const review = state.dailyReviews[day];
  document.getElementById("dayDetailTitle").textContent = new Date(`${day}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  document.getElementById("dayDetail").innerHTML = `
    ${insightCard("Day R", formatR(metrics(closed).totalR), `${closed.length} closed | ${openTrades(trades).length} open`)}
    <div class="day-trade"><strong>Plan</strong><p>${safe(plan?.bias || "No plan saved.")}</p><p>${safe(plan?.levels || "")}</p></div>
    <div class="day-trade"><strong>Review</strong><p>${safe(review?.focus || "No review saved.")}</p></div>
    ${trades.map((trade) => `<div class="day-trade"><strong>${safe(trade.symbol)} ${trade.status === "open" ? "Open" : formatR(rValue(trade))}</strong><p>${safe(trade.setup)} | ${safe(trade.status === "open" ? trade.entryPlan || "In progress" : trade.emotion)}</p>${trade.tradingViewUrl ? `<a href="${safe(trade.tradingViewUrl)}" target="_blank" rel="noreferrer">Open Chart</a>` : ""}</div>`).join("")}
  `;
}

function renderCycleSummaries() {
  const [weekStart, weekEnd] = weekRange(selectedDay);
  const [monthStart, monthEnd] = monthRange(selectedDay);
  const weekTrades = tradesInRange(weekStart, weekEnd);
  const monthTrades = tradesInRange(monthStart, monthEnd);
  document.getElementById("weeklySummary").innerHTML = summaryCardsFor(weekTrades, weekStart, weekEnd).join("");
  document.getElementById("monthlySummary").innerHTML = monthlyCards(monthTrades, monthStart, monthEnd).join("");
}

function formatPeriodString(start, end) {
  if (!start || !end) return "N/A";
  const s = start.slice(5).replace("-", ".");
  const e = end.slice(5).replace("-", ".");
  return `${s}\u00A0–\u00A0${e}`;
}

function summaryCardsFor(trades, start, end) {
  const m = metrics(trades);
  const setups = Object.entries(groupBy(trades, "setup")).map(([name, list]) => ({ name, ...metrics(list) }));
  const best = setups.sort((a, b) => b.expectancy - a.expectancy)[0];
  const weak = setups.sort((a, b) => a.expectancy - b.expectancy)[0];
  return [
    insightCard("Period", formatPeriodString(start, end), `${trades.length} trades`),
    insightCard("Total Profit", formatR(m.grossWinR), formatDollar(m.grossWinDollars)),
    insightCard("Total Loss", formatR(m.grossLossR), formatDollar(m.grossLossDollars)),
    insightCard("Total R", formatR(m.totalR), `${Math.round(m.winRate * 100)}% win rate`),
    insightCard("Best Setup", best?.name || "No data", best ? formatR(best.expectancy) : "Add trades"),
    insightCard("Weakest Setup", weak?.name || "No data", weak ? formatR(weak.expectancy) : "Add trades"),
    insightCard("Process Leak", `${Math.round(processLeakRate(trades) * 100)}%`, "Lower is better")
  ];
}

function monthlyCards(trades, start, end) {
  const m = metrics(trades);
  const days = dateRange(start, end);
  const activeDays = days.filter((day) => byDate(day).length || closedByDate(day).length);
  const dayStats = activeDays.map((day) => ({ day, totalR: metrics(closedByDate(day)).totalR }));
  const best = [...dayStats].sort((a, b) => b.totalR - a.totalR)[0];
  const worst = [...dayStats].sort((a, b) => a.totalR - b.totalR)[0];
  const reviews = days.filter((day) => state.dailyReviews[day]).length;

  const formatDateNote = (d) => d ? d.replace(/-/g, ".") : "No data";

  return [
    insightCard("Period", formatPeriodString(start, end), `${trades.length} trades`),
    insightCard("Total Profit", formatR(m.grossWinR), formatDollar(m.grossWinDollars)),
    insightCard("Total Loss", formatR(m.grossLossR), formatDollar(m.grossLossDollars)),
    insightCard("Total R", formatR(m.totalR), `${Math.round(m.winRate * 100)}% win rate`),
    insightCard("Active Days", String(activeDays.length), "Days with trades"),
    insightCard("Best Day", best ? formatR(best.totalR) : "0.00R", formatDateNote(best?.day)),
    insightCard("Worst Day", worst ? formatR(worst.totalR) : "0.00R", formatDateNote(worst?.day)),
    insightCard("Review Rate", `${Math.round(reviews / Math.max(activeDays.length, 1) * 100)}%`, "Reviewed active days")
  ];
}

function renderPlaybook() {
  document.getElementById("playbookGrid").innerHTML = state.sops.map((sop) => {
    const progress = sopProgress(sop.id);
    const level = sopLevel(progress);
    
    const trades = sopTrades(sop.id);
    const closed = closedTrades(trades);
    const sparklineHtml = drawMiniSparklineMarkup(closed);
    
    return `
    <div class="sop-card-container" id="container-${sop.id}">
      <div class="sop-card-inner">
        <!-- Front Face -->
        <div class="sop-card-front">
          <button class="card-flip-btn" style="right: 48px;" data-edit-sop="${safe(sop.id)}" title="Edit SOP" aria-label="Edit SOP">⚙️</button>
          <button class="card-flip-btn" onclick="flipCard('${sop.id}')" title="Flip to rules (Actions)" aria-label="Flip card">🔄</button>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <span class="tag info" style="width:fit-content; margin-bottom:4px;">Level ${level.level} ${level.name}</span>
            <strong style="font-size:18px; line-height:1.2;">${safe(sop.name)}</strong>
            <span style="font-size:12px; color:var(--muted);">${safe(sop.market)} · ${safe(sop.timeframe)} · ${progress.records} records</span>
          </div>
          
          <div class="mini-sparkline-container">
            ${sparklineHtml}
          </div>
          
          <div class="sop-card-stat-row">
            <div class="sop-card-stat">
              <span>Win Rate</span>
              <strong>${Math.round(progress.winRate * 100)}%</strong>
            </div>
            <div class="sop-card-stat">
              <span>Expectancy</span>
              <strong class="${progress.expectancy >= 0 ? 'pos' : 'neg'}">${formatR(progress.expectancy)}</strong>
            </div>
            <div class="sop-card-stat">
              <span>Total R</span>
              <strong class="${progress.totalR >= 0 ? 'pos' : 'neg'}">${formatR(progress.totalR)}</strong>
            </div>
          </div>
        </div>
        
        <!-- Back Face -->
        <div class="sop-card-back">
          <button class="card-flip-btn" onclick="flipCard('${sop.id}')" title="Flip to stats" aria-label="Flip card">🔄</button>
          <div style="display:flex; flex-direction:column; gap:8px; overflow-y:auto; flex-grow:1; margin-bottom:12px; padding-right:4px;">
            <strong style="font-size:14px; color:var(--muted);">Checklist & Rules</strong>
            <ul style="margin: 0; padding-left: 18px; font-size:12px; line-height:1.4;">
              ${(sop.checklist || []).slice(0, 4).map((item) => `<li>${safe(item)}</li>`).join("")}
              ${(sop.checklist || []).length > 4 ? `<li>+${(sop.checklist || []).length - 4} more</li>` : ""}
            </ul>
            ${sop.entryRules ? `<div style="font-size:11px; opacity:0.85; border-top:1px solid var(--hairline); padding-top:6px;"><strong>Entry:</strong> ${safe(sop.entryRules)}</div>` : ''}
            ${sop.weaknesses && sop.weaknesses.length ? `<div style="font-size:11px; opacity:0.85; border-top:1px solid var(--hairline); padding-top:6px; color:var(--red);"><strong>Weakness:</strong> ${safe(sop.weaknesses[0])}</div>` : ''}
          </div>
          <div class="row-actions" style="margin-top:auto; border-top:1px solid var(--hairline); padding-top:10px;">
            <button class="text-button" data-edit-sop="${safe(sop.id)}">Edit</button>
            <button class="text-button" data-add-account="${safe(sop.id)}">Add Account</button>
            <button class="text-button danger" data-delete-sop="${safe(sop.id)}">Delete</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join("");
}

function deleteSop(id) {
  const sop = state.sops.find((s) => s.id === id);
  if (!sop) return;
  const tradeCount = state.trades.filter((t) => t.sopId === id).length;
  const msg = tradeCount
    ? `Delete SOP "${sop.name}" and its ${tradeCount} trade(s)? This cannot be undone.`
    : `Delete SOP "${sop.name}"? This cannot be undone.`;
  if (!confirm(msg)) return;
  state.trades = state.trades.filter((t) => t.sopId !== id);
  state.accounts = state.accounts.filter((a) => a.sopId !== id);
  state.sops = state.sops.filter((s) => s.id !== id);
  if (state.activeSopId === id) {
    state.activeSopId = state.sops[0]?.id || "";
    state.activeAccountId = accountsForSop(state.activeSopId)[0]?.id || "";
  }
  saveState();
  renderAll();
  toast(`SOP "${sop.name}" deleted.`, "delete");
}

function openSopModal(id = "") {
  const sop = state.sops.find((item) => item.id === id) || {};
  openModal(id ? "Edit SOP" : "Add SOP", "SOP Library", `
    <div class="sop-editor-form" id="sopEditorForm" data-sop-id="${safe(id)}">
      <div class="form-row">
        <label>SOP Name<input name="name" required value="${safe(sop.name || "")}" placeholder="Opening Drive SOP" /></label>
        <label>Market<input name="market" value="${safe(sop.market || "Futures")}" placeholder="Futures / Forex / Crypto" /></label>
      </div>
      <div class="form-row">
        <label>Timeframe<input name="timeframe" value="${safe(sop.timeframe || "Intraday")}" /></label>
        <label>Status<select name="status"><option ${sop.status !== "archived" ? "selected" : ""}>active</option><option ${sop.status === "archived" ? "selected" : ""}>archived</option></select></label>
      </div>
      <label>Entry Rules<textarea name="entryRules" rows="3">${safe(sop.entryRules || defaultSopDetails.entryRules)}</textarea></label>
      <label>Exit Rules<textarea name="exitRules" rows="3">${safe(sop.exitRules || defaultSopDetails.exitRules)}</textarea></label>
      <label>Risk Rules<textarea name="riskRules" rows="3">${safe(sop.riskRules || defaultSopDetails.riskRules)}</textarea></label>
      <label>No-trade Rules<textarea name="noTradeRules" rows="3">${safe(sop.noTradeRules || defaultSopDetails.noTradeRules)}</textarea></label>
      <label>Checklist<textarea name="checklist" rows="4">${safe((sop.checklist || defaultSopDetails.checklist).join("\n"))}</textarea></label>
      <label>Weaknesses<textarea name="weaknesses" rows="4">${safe((sop.weaknesses || defaultSopDetails.weaknesses).join("\n"))}</textarea></label>
      <button class="primary-button" type="button" onclick="window.saveSopFromModal(event)">Save SOP</button>s*</div>
  `);
  
}

function openAccountModal(sopId = state.activeSopId, accountId = "") {
  const account = state.accounts.find((item) => item.id === accountId) || {};
    const currentSopId = account.sopId || sopId;
  const sopOptions = state.sops.filter(s => !s.archivedAt).map(s => `<option value="${safe(s.id)}" ${s.id === currentSopId ? "selected" : ""}>${safe(s.name)}</option>`).join("");
  openModal(accountId ? "Edit Account" : "Add Account", "Account", `
    <div class="sop-editor-form" id="accountEditorForm" data-account-id="${safe(accountId)}">
      <label>Parent SOP<select name="sopId">${sopOptions}</select></label>
      <label>Account Name<input name="name" required value="${safe(account.name || "")}" placeholder="ACC 1 / Prop Phase 1 / Funded" /></label>
      <label>Type<input name="type" value="${safe(account.type || "")}" placeholder="Demo, Personal, Prop, Funded" /></label>
      <div class="form-row">
        <label>Starting Balance ($)<input name="startingBalance" type="number" min="0" step="1" value="${safe(account.startingBalance ?? 1000)}" /></label>
        <label>Current Balance ($)<input name="currentBalance" type="number" min="0" step="1" value="${safe(account.currentBalance ?? account.startingBalance ?? 1000)}" /></label>
      </div>
      <button class="primary-button" type="button" onclick="window.saveAccountFromModal(event)">Save Account</button>
    </div>
  `);
  
}


function deleteAccount(id) {
  const account = state.accounts.find((a) => a.id === id);
  if (!account) return;
  
  if (confirm(`Delete Account "${account.name}"? This will hide it from menus.`)) {
    account.archivedAt = new Date().toISOString();
    
    if (state.activeAccountId === id) {
      const activeSopAccounts = accountsForSop(state.activeSopId).filter(a => !a.archivedAt && a.id !== id);
      if (activeSopAccounts.length > 0) {
        state.activeAccountId = activeSopAccounts[0].id;
      } else {
        const otherSop = state.sops.find(s => !s.archivedAt);
        if (otherSop) {
          state.activeSopId = otherSop.id;
          state.activeAccountId = accountsForSop(otherSop.id).filter(a => !a.archivedAt)[0]?.id || "";
        } else {
          state.activeAccountId = "";
        }
      }
    }
    saveState();
    
    const activeModalTitle = document.getElementById("detailSheetTitle")?.textContent;
    if (activeModalTitle === "Manage Wallets") {
      openWalletManagerModal();
    }
    renderAll();
  }
}

function openWalletManagerModal() {
  const html = state.sops.filter(s => !s.archivedAt).map(sop => {
    const accounts = state.accounts.filter(a => a.sopId === sop.id && !a.archivedAt);
    if (accounts.length === 0) return '';
    return `
      <div style="margin-bottom: 16px;">
        <h4 style="margin: 0 0 8px 0; color: var(--muted); font-size: 11px; text-transform: uppercase;">${safe(sop.name)}</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${accounts.map(acc => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--surface-2); border-radius: 8px; border: 1px solid var(--hairline);">
              <div style="display: flex; flex-direction: column;">
                <strong style="font-size: 14px;">${safe(acc.name)}</strong>
                <span style="font-size: 12px; color: var(--muted);">Balance: ${acc.currentBalance ?? acc.startingBalance ?? 1000}</span>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="ghost-button compact" type="button" onclick="window.openAccountModal('${safe(sop.id)}', '${safe(acc.id)}')">Edit</button>
                <button class="ghost-button compact" type="button" style="color: var(--red);" onclick="window.deleteAccount('${safe(acc.id)}')">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).filter(Boolean).join('') || `<div class="empty-state">No accounts found. Create one first.</div>`;

  openModal("Manage Wallets", "Accounts", `
    <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
      <button class="primary-button compact" type="button" onclick="window.openAccountModal()">+ Add Account</button>
    </div>
    <div style="max-height: 60vh; overflow-y: auto; padding-right: 4px;">
      ${html}
    </div>
  `);
}

window.openSopModal = openSopModal;
window.openAccountModal = openAccountModal;
window.deleteAccount = deleteAccount;
window.openWalletManagerModal = openWalletManagerModal;
window.saveSopFromModal = saveSopFromModal;
window.saveAccountFromModal = saveAccountFromModal;
window.closeTradeFromModal = closeTradeFromModal;

function saveSopFromModal(event) {
  event.preventDefault();
  try {
    const container = document.getElementById("sopEditorForm");
    const existing = state.sops.find((sop) => sop.id === container.dataset.sopId);
    
    // Safely extract form values from div
    const getValue = (name) => container.querySelector(`[name="${name}"]`)?.value || "";
    
    if (!getValue("name").trim()) {
      toast("SOP Name is required.", "error");
      return;
    }
    
    const id = existing?.id || makeSopId(getValue("name"));
    const newChecklist = parseSopChecklistRules(getValue("checklist"));
    
    let version = Number(existing?.version || 1);
    if (existing) {
      const checklistChanged = JSON.stringify(existing.checklist || []) !== JSON.stringify(newChecklist);
      const rulesChanged = (existing.entryRules || "").trim() !== getValue("entryRules").trim() ||
                           (existing.exitRules || "").trim() !== getValue("exitRules").trim() ||
                           (existing.riskRules || "").trim() !== getValue("riskRules").trim() ||
                           (existing.noTradeRules || "").trim() !== getValue("noTradeRules").trim();
      if (checklistChanged || rulesChanged) {
        version += 1;
      }
    }

    const sop = {
      id,
      version,
      name: getValue("name").trim() || "Untitled SOP",
      market: getValue("market").trim() || "Futures",
      timeframe: getValue("timeframe").trim() || "Intraday",
      status: getValue("status") || "active",
      levelNotes: existing?.levelNotes || "",
      entryRules: getValue("entryRules").trim(),
      exitRules: getValue("exitRules").trim(),
      riskRules: getValue("riskRules").trim(),
      noTradeRules: getValue("noTradeRules").trim(),
      checklist: newChecklist,
      weaknesses: getValue("weaknesses").split("\n").map((item) => item.trim()).filter(Boolean),
      createdAt: existing?.createdAt || todayISO(),
      archivedAt: getValue("status") === "archived" ? existing?.archivedAt || todayISO() : ""
    };

    if (existing) {
      const idx = state.sops.findIndex((item) => item.id === existing.id);
      if (idx !== -1) state.sops[idx] = sop;
    } else {
      state.sops.push(sop);
      state.accounts.push({ id: makeAccountId(id, "Main Account"), sopId: id, name: "Main Account", type: "Main", startingBalance: 1000, currentBalance: 1000, status: "active", createdAt: todayISO(), archivedAt: "" });
    }
    
    state.activeSopId = id;
    state.activeAccountId = accountsForSop(id)[0]?.id || state.activeAccountId;
    saveState();
    closeModal();
    renderAll();
    populateSopControls();
    renderPreFlightChecklist(id);
    toast(`${sop.name} SOP saved.`);
  } catch (err) {
    console.error("Error saving SOP:", err);
    toast("Failed to save SOP: " + err.message, "error");
  }
}

function saveAccountFromModal(event) {
  event.preventDefault();
  try {
    const container = document.getElementById("accountEditorForm");
    const existing = state.accounts.find((account) => account.id === container.dataset.accountId);
    const getValue = (name) => container.querySelector(`[name="${name}"]`)?.value || "";
    
    const sopId = getValue("sopId") || state.activeSopId;
    
    if (!getValue("name").trim()) {
      toast("Account Name is required.", "error");
      return;
    }
    
    const account = {
      id: existing?.id || makeAccountId(sopId, getValue("name")),
      sopId,
      name: getValue("name").trim(),
      type: getValue("type").trim() || "Account",
      startingBalance: Number(getValue("startingBalance") || 0),
      currentBalance: Number(getValue("currentBalance") || getValue("startingBalance") || 0),
      status: existing?.status || "active",
      createdAt: existing?.createdAt || todayISO(),
      archivedAt: existing?.archivedAt || ""
    };
    if (existing) state.accounts[state.accounts.findIndex((item) => item.id === existing.id)] = account;
    else state.accounts.push(account);
    state.activeSopId = sopId;
    state.activeAccountId = account.id;
    saveState();
    closeModal();
    renderAll();
    toast(`${account.name} account saved.`);
  } catch (err) {
    console.error("Error saving Account:", err);
    toast("Failed to save Account: " + err.message, "error");
  }
}


function applyLanguage() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll(".language-toggle").forEach((button) => {
    button.setAttribute("aria-label", language === "zh" ? "Switch to English" : "切换到华文");
    button.innerHTML = `
      <span class="${language === "en" ? "active" : ""}">EN</span>
      <span class="${language === "zh" ? "active" : ""}">中文</span>
    `;
  });
  const homeTitle = document.querySelector(".home-hero h1");
  const homeCopy = document.querySelector(".home-copy");
  if (homeTitle) homeTitle.textContent = t("homeTitle");
  if (homeCopy) homeCopy.textContent = t("homeCopy");
  const cards = [
    ["overview", t("today")],
    ["journal", t("journal")],
    ["review", t("review")],
    ["settings", t("system")]
  ];
  cards.forEach(([id, label]) => {
    const cardLabel = document.querySelector(`[data-open-module="${id}"] span`);
    const view = document.getElementById(id);
    if (cardLabel) cardLabel.textContent = label;
    if (view) view.dataset.title = label;
  });
  const back = document.getElementById("backHomeBtn");
  if (back) back.textContent = t("back");
  const action = document.querySelector(".module-action");
  if (action) action.textContent = t("logTrade");
  if (activeModule) {
    const view = document.getElementById(activeModule);
    setText("moduleTitle", view?.dataset.title || t("today"));
  }
  translatePageText();
}

function translatePageText() {
  const pairs = [
    ["Command Center", "交易控制台"], ["Execution", "执行"], ["Evidence", "证据"], ["Preferences", "偏好"],
    ["Equity", "权益"], ["R-based journey", "R 值曲线"], ["This week", "本周"], ["Operating status", "运行状态"],
    ["Expectancy", "期望值"], ["Average edge per trade", "每笔平均优势"], ["Win Rate", "胜率"], ["Wins / closed trades", "盈利 / 已完成交易"],
    ["Profit Factor", "盈亏比"], ["Gross wins / gross losses", "总盈利 / 总亏损"], ["Max Drawdown", "最大回撤"], ["Peak-to-trough in R", "按 R 计算的峰谷回撤"],
    ["Pre-market", "盘前"], ["Plan today", "今日计划"], ["Workflow Date", "记录日期"], ["Market Bias", "市场倾向"], ["Key Levels", "关键价位"], ["Allowed Setups", "允许形态"],
    ["Max Loss (R)", "最大亏损 (R)"], ["Max Trades", "最大交易数"], ["Save Plan", "保存计划"],
    ["Daily close", "日终"], ["Review the day", "复盘当天"], ["Keep", "保留"], ["Remove", "移除"], ["Save Review", "保存复盘"],
    ["Open Trades", "进行中交易"], ["Live execution", "执行中"], ["In progress", "进行中"], ["Closed Trades", "已完成交易"], ["Completed records", "完成记录"],
    ["Open trade", "进行中交易"], ["Start trade", "开始交易"], ["Date", "日期"], ["Symbol", "品种"], ["Setup", "形态"], ["Direction", "方向"], ["Risk ($)", "风险 ($)"],
    ["Account", "账户"], ["Current Balance", "当前资金"], ["SOP Journey", "SOP 旅程"], ["SOP Library", "SOP 库"], ["Add Account", "添加账户"], ["Add SOP", "添加 SOP"],
    ["Edit Balance", "编辑资金"],
    ["Capture Trade", "记录交易"], ["SOP Maturity", "SOP 成熟度"], ["Why this level?", "为什么是这个等级？"], ["Starting Balance ($)", "起始资金 ($)"], ["Current Balance ($)", "当前资金 ($)"],
    ["Entry Plan", "入场计划"], ["Stop Plan", "止损计划"], ["Target Plan", "目标计划"], ["Close or add details", "结束或补充细节"],
    ["Grade", "评分"], ["Net P&L ($)", "净盈亏 ($)"], ["Rule followed", "遵守规则"], ["Emotion", "情绪"], ["TradingView Link", "TradingView 链接"],
    ["Chart Image URL", "图表图片链接"], ["Upload Screenshot", "上传截图"], ["Exit Note", "出场记录"], ["General Note", "一般备注"],
    ["Review", "复盘"], ["Current read", "当前解读"],
    ["Insights", "洞察"], ["Charts", "图表"], ["Calendar", "日历"], ["Playbook", "交易手册"], ["Drawdown", "回撤"], ["Risk pressure", "风险压力"],
    ["Distribution", "分布"], ["R multiple spread", "R 倍数分布"], ["Setups", "形态"], ["Performance by setup", "按形态表现"],
    ["Behavior", "行为"], ["Emotion impact", "情绪影响"], ["Quality", "质量"], ["Grade breakdown", "评分拆解"],
    ["Day detail", "当天详情"], ["Select a day", "选择日期"], ["Weekly", "每周"], ["Cycle summary", "周期摘要"], ["Monthly", "每月"], ["Consistency", "一致性"],
    ["Personal system", "个人系统"], ["Default Symbol", "默认品种"], ["Risk Per Trade ($)", "每笔风险 ($)"], ["Daily Max Loss (R)", "每日最大亏损 (R)"],
    ["Max Trades Per Day", "每日最大交易数"], ["Daily Rules", "每日规则"], ["Save Preferences", "保存偏好"], ["Data", "数据"], ["Backup and restore", "备份与恢复"],
    ["Import", "导入"], ["Backup", "备份"], ["Reset Demo", "重置演示"], ["Start Trade", "开始记录"], ["Update", "更新"], ["Edit", "编辑"], ["Delete", "删除"], ["View", "查看"],
    
    // Phase 5 Translations
    ["Backtester", "回测沙盒"],
    ["SOP Backtest Sandbox", "SOP 策略回测沙盒"],
    ["Initial Capital ($)", "初始资金 ($)"],
    ["Risk Mode", "风险模式"],
    ["Risk Value", "风险数值"],
    ["Batch Paste R-Multiples", "批量粘贴 R 倍数"],
    ["Generate Curve", "生成曲线"],
    ["Manual Input", "单笔录入"],
    ["Batch Input", "批量录入"],
    ["R Multiple", "R 倍数"],
    ["Setup Name (Optional)", "形态名称 (可选)"],
    ["Add Trade", "添加模拟"],
    ["Save Run", "保存回测"],
    ["Clear Sandbox", "清空沙盒"],
    ["Mock Trades", "模拟交易列表"],
    ["Backtest Analytics", "回测数据指标"],
    ["Execution Gap", "实盘执行偏差"],
    ["Backtest vs Live Execution", "回测 vs 实盘对比"],
    ["Saved Backtests", "已保存回测历史"],
    ["Import Backup", "导入备份数据"],
    ["Data Manager", "数据管理器"],
    ["Smart Merge (Recommended)", "智能合并数据 (推荐)"],
    ["Full Overwrite Restore", "完全覆盖恢复"],
    ["Projected R-Curve Projection (Dashed: Current / Solid: Merged)", "R 曲线投影对照 (虚线: 当前 / 实线: 合并后)"],
    ["System update ready, click to reload.", "系统更新已就绪，点击立即载入新版本。"],
    ["Update", "更新"]
  ];
  const map = new Map(language === "zh" ? pairs : pairs.map(([en, zh]) => [zh, en]));
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const trimmed = node.nodeValue.trim();
    if (!map.has(trimmed)) return;
    node.nodeValue = node.nodeValue.replace(trimmed, map.get(trimmed));
  });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function emptyState(text) {
  return `<p class="muted">${safe(text)}</p>`;
}

async function fileToDataUrl(file) {
  if (!file) return "";
  const raw = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.readAsDataURL(file);
  });
  return await compressImage(raw);
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (state?.preferences && state.preferences.enableSounds === false) return;
  try {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const now = audioCtx.currentTime;
  
  if (type === 'success') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'error') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'switch') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'click') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
    osc.start(now);
    osc.stop(now + 0.03);
  } else if (type === 'win') {
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.04);
      gain.gain.setValueAtTime(0, now + i * 0.04);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.04 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.3);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.3);
    });
  } else if (type === 'loss') {
    const freqs = [392.00, 311.13, 261.63]; // G4, Eb4, C4
    freqs.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.06);
      gain.gain.setValueAtTime(0, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.4);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.4);
    });
  } else if (type === 'flip') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'delete') {
    try {
      const bufferSize = audioCtx.sampleRate * 0.15;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start(now);
      noise.stop(now + 0.15);
    } catch (e) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } else if (type === 'pop') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  }
  } catch (err) {}
}

async function compressImage(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("Image could not be loaded."));
  });
  const maxSide = 1080;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  
  let quality = 0.75;
  let type = "image/webp";
  let output = canvas.toDataURL(type, quality);
  
  // Fallback to jpeg if webp is not supported by the browser
  if (!output.startsWith("data:image/webp")) {
    type = "image/jpeg";
    output = canvas.toDataURL(type, quality);
  }

  while (output.length > IMAGE_LIMIT && quality > 0.35) {
    quality -= 0.1;
    output = canvas.toDataURL(type, quality);
  }
  if (output.length > IMAGE_LIMIT) throw new Error("Image is too large. Please use a smaller screenshot.");
  return output;
}

function parseSopChecklistRules(text) {
  if (!text) return [];
  if (Array.isArray(text)) {
    text = text.join("\n");
  }
  const lines = String(text).split("\n").map((l) => l.replace(/^[\s\u200B\u3000]+|[\s\u200B\u3000]+$/g, '')).filter(Boolean);
  if (!lines.length) return [];
  
  const numberPrefixRegex = /^[\s\u200B\u3000]*(\d+[\.\)）】\]]|\u2022|-|\*|•|⁃|—|－|✅|☑️|✔️)\s*/;;
  const hasNumbering = lines.some((l) => numberPrefixRegex.test(l));

  if (hasNumbering) {
    const rules = [];
    let currentRule = "";
    for (const line of lines) {
      if (numberPrefixRegex.test(line)) {
        if (currentRule) rules.push(currentRule);
        currentRule = line;
      } else {
        if (currentRule) {
          currentRule += "\n" + line;
        } else {
          currentRule = line;
        }
      }
    }
    if (currentRule) rules.push(currentRule);
    return rules;
  }

  return lines;
}

let _prevChecklistFull = false;

function renderPreFlightChecklist(sopId = null, existingSavedChecklist = null) {
  const container = document.getElementById("preflightChecklistContainer");
  if (!container) return;

  const targetSopId = sopId || state?.activeSopId;
  const sop = state?.sops?.find((s) => s.id === targetSopId) || activeSop();
  
  let rawRules = parseSopChecklistRules(sop?.checklist);
  
  const defaultRules = [
    "1. 交易计划符合 HTF 大周期关键位与趋势方向",
    "2. 确认入场信号 Trigger 成立，不挂盲单/不追单",
    "3. 止损点位明确，严格按照 SOP 计算风险 R",
    "4. 避开高影响红盒新闻发布前后 15 分钟",
    "5. 情绪平静稳定，无 FOMO/报复心理"
  ];

  let rules = rawRules.length > 0 ? rawRules : defaultRules;

  _prevChecklistFull = false;

  container.innerHTML = rules.map((rule, idx) => {
    let isChecked = false;
    if (existingSavedChecklist?.items) {
      const matchByText = existingSavedChecklist.items.find((i) => i.text === rule);
      if (matchByText) {
        isChecked = Boolean(matchByText.checked);
      } else if (existingSavedChecklist.items[idx]) {
        isChecked = Boolean(existingSavedChecklist.items[idx].checked);
      }
    }
    return `
      <label class="preflight-item ${isChecked ? 'checked' : ''}">
        <input type="checkbox" class="preflight-checkbox" data-idx="${idx}" data-rule-text="${safe(rule)}" ${isChecked ? 'checked' : ''} />
        <span class="preflight-item-text">${safe(rule)}</span>
      </label>
    `;
  }).join("");

  container.querySelectorAll(".preflight-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const label = e.target.closest(".preflight-item");
      if (label) label.classList.toggle("checked", e.target.checked);
      updatePreFlightChecklistProgress();
    });
  });

  updatePreFlightChecklistProgress(true);
  updateRedNewsHUD();
}

function updateRedNewsHUD() {
  const container = document.getElementById("preflightRedNewsAlert");
  if (!container) return;

  const tradeDate = document.querySelector("#tradeForm [name='openTime']")?.value?.split("T")[0] || todayISO();
  const nearNews = window.forexFactoryRedNewsEngine?.isTradeNearRedNews ? window.forexFactoryRedNewsEngine.isTradeNearRedNews(tradeDate) : null;

  if (nearNews && nearNews.event) {
    container.classList.remove("hidden");
    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; width:100%;">
        <span style="font-size:16px;">🔴</span>
        <div>
          <strong style="color:#ff3b30; font-size:12px;">High-Impact ${safe(nearNews.event.currency)} Red News Alert</strong>
          <p style="margin:2px 0 0 0; font-size:11px; color:var(--text); opacity:0.9;">
            ${safe(nearNews.event.title)} (${safe(nearNews.event.time || "Today")}) - High Volatility Risk Alert
          </p>
        </div>
      </div>
    `;
  } else {
    container.classList.add("hidden");
    container.innerHTML = "";
  }
}

window.updateRedNewsHUD = updateRedNewsHUD;
window.renderPreFlightChecklist = renderPreFlightChecklist;
window.updatePreFlightChecklistProgress = updatePreFlightChecklistProgress;

function updatePreFlightChecklistProgress(silent = false) {
  const container = document.getElementById("preflightChecklistContainer");
  const card = document.getElementById("preFlightCard");
  const pill = document.getElementById("preflightProgressPill");
  const hint = document.getElementById("preflightHint");
  const submitBtn = document.getElementById("saveTradeBtn");
  if (!container || !card || !pill || !submitBtn) return;

  const checkboxes = Array.from(container.querySelectorAll(".preflight-checkbox"));
  const total = checkboxes.length;
  const checkedCount = checkboxes.filter((cb) => cb.checked).length;
  const isFull = total > 0 && checkedCount === total;

  const formId = document.getElementById("tradeForm")?.elements?.id?.value;
  const currentTrade = formId ? state.trades.find((t) => t.id === formId) : null;
  const isEditingExisting = Boolean(formId && currentTrade);

  if (isFull) {
    card.classList.add("is-verified");
    pill.textContent = `✓ ${total}/${total} Verified`;
    if (hint) hint.textContent = `✅ 风控检查已 100% 通过！解禁允许提交。`;
    submitBtn.disabled = false;
    if (!silent && !_prevChecklistFull) {
      playSound("success");
      if (window.appleAudioEngine) window.appleAudioEngine.play("dockClick");
    }
    _prevChecklistFull = true;
  } else if (isEditingExisting) {
    card.classList.remove("is-verified");
    pill.textContent = `${checkedCount}/${total} Rules Checked`;
    if (hint) hint.textContent = `📝 正在修改已有交易记录 (${checkedCount}/${total})。`;
    submitBtn.disabled = false;
    _prevChecklistFull = false;
  } else {
    card.classList.remove("is-verified");
    pill.textContent = `${checkedCount}/${total} Rules Checked`;
    if (hint) hint.textContent = `⚠️ 必须打勾确认所有 ${total} 项注意事项后，方可开启交易。`;
    submitBtn.disabled = true;
    _prevChecklistFull = false;
  }
}

function resetTradeForm() {
  const form = document.getElementById("tradeForm");
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  form.date.value = todayISO();
  if (form.openTime) form.openTime.value = nowDatetimeLocal();
  if (form.closeTime) form.closeTime.value = "";
  form.symbol.value = state.preferences.defaultSymbol;
  form.sopId.value = state.activeSopId;
  populateSopControls();
  form.accountId.value = state.activeAccountId;
  form.risk.value = state.preferences.riskPerTrade;
  form.pnl.value = "";
  form.tradingViewUrl.value = "";
  form.imageUrl.value = "";
  if (form.imageFile) form.imageFile.value = "";
  form.entryPlan.value = "";
  form.stopPlan.value = "";
  form.targetPlan.value = "";
  form.exitNote.value = "";
  form.note.value = "";
  form.rule.value = "true";
  document.getElementById("tradeFormNewsAlert")?.classList.add("hidden");
  const adv = document.querySelector(".advanced-fields");
  if (adv) adv.open = false;
  const mode = document.getElementById("tradeFormMode");
  if (mode) mode.textContent = "Open trade";
  const btn = document.getElementById("saveTradeBtn");
  if (btn) btn.textContent = "Start Trade";
  const cancel = document.getElementById("cancelEditBtn");
  if (cancel) cancel.classList.add("hidden");
  renderPreFlightChecklist(state.activeSopId);
  closeSheet("tradeFormSheet");
}

function editTrade(id) {
  const trade = state.trades.find((item) => item.id === id);
  if (!trade) return;
  const form = document.getElementById("tradeForm");
  form.elements.id.value = trade.id;
  form.date.value = trade.date;
  if (form.openTime) form.openTime.value = trade.openTime || (trade.date ? `${trade.date}T09:30` : nowDatetimeLocal());
  if (form.closeTime) form.closeTime.value = trade.status === "open" ? "" : (trade.closeTime || (trade.closedAt ? `${trade.closedAt}T10:30` : ""));
  form.symbol.value = trade.symbol;
  state.activeSopId = trade.sopId || state.activeSopId;
  const account = state.accounts.find((item) => item.id === trade.accountId);
  state.activeAccountId = account?.id || accountsForSop(state.activeSopId)[0]?.id || state.activeAccountId;
  populateSopControls();
  form.sopId.value = state.activeSopId;
  form.accountId.value = state.activeAccountId;
  form.setup.value = trade.setup;
  form.direction.value = trade.direction;
  form.grade.value = trade.grade;
  form.risk.value = trade.risk;
  form.pnl.value = trade.status === "open" ? "" : trade.pnl;
  if (form.maeR) form.maeR.value = trade.maeR !== null && trade.maeR !== undefined ? trade.maeR : "";
  if (form.mfeR) form.mfeR.value = trade.mfeR !== null && trade.mfeR !== undefined ? trade.mfeR : "";
  const rSt = getTradeRuleStatus(trade);
  form.rule.value = rSt === "incomplete" ? "incomplete" : (rSt === "violated" ? "false" : "true");
  form.emotion.value = trade.emotion;
  
  // Populate Audit Fields
  if (form.auditCompliance && trade.audit?.compliance) form.auditCompliance.value = trade.audit.compliance;
  if (form.auditStopLoss && trade.audit?.stopLoss) form.auditStopLoss.value = trade.audit.stopLoss;
  if (form.auditTakeProfit && trade.audit?.takeProfit) form.auditTakeProfit.value = trade.audit.takeProfit;
  if (form.auditEmotionScore) form.auditEmotionScore.value = trade.audit?.emotionScore || "";
  
  // Populate Mistakes
  const mistakeCheckboxes = form.querySelectorAll('input[name="mistakes"]');
  mistakeCheckboxes.forEach(cb => {
    cb.checked = (trade.mistakes || []).includes(cb.value);
  });
  
  form.tradingViewUrl.value = trade.tradingViewUrl || "";
  form.imageUrl.value = trade.imageUrl || "";
  form.entryPlan.value = trade.entryPlan || "";
  form.stopPlan.value = trade.stopPlan || "";
  form.targetPlan.value = trade.targetPlan || "";
  form.exitNote.value = trade.exitNote || "";
  form.note.value = trade.note || "";
  for (const key of Object.keys(trade.checklist || {})) {
    if (form[key]) form[key].checked = Boolean(trade.checklist[key]);
  }
  
  // Explicitly render the pre-flight checklist for the edited trade
  if (typeof renderPreFlightChecklist === "function") {
    renderPreFlightChecklist(trade.sopId, trade.preFlightChecklist?.items);
  }

  document.querySelector(".advanced-fields").open = trade.status !== "open";
  document.getElementById("tradeFormMode").textContent = trade.status === "open" ? "Update open trade" : "Edit closed trade";
  document.getElementById("saveTradeBtn").textContent = trade.status === "open" ? "Update Trade" : "Save Trade";
  document.getElementById("cancelEditBtn").classList.remove("hidden");
  renderPreFlightChecklist(trade.sopId, trade.preFlightChecklist);
  if (trade.status === "closed") {
    const saveBtn = document.getElementById("saveTradeBtn");
    if (saveBtn) saveBtn.disabled = false;
  }
  openSheet("tradeFormSheet");
}

async function saveTradeFromForm(event) {
  event.preventDefault();
  const form = event.currentTarget;

  // SaaS Validation: Check if user is logged in & has remaining trade quota
  const isNewTrade = !form.elements.id.value;
  if (isNewTrade && window.TRDAuth && typeof window.TRDAuth.canCreateTrade === "function") {
    const currentTradeCount = (state.trades || []).length;
    if (!window.TRDAuth.canCreateTrade(currentTradeCount)) {
      return;
    }
  }

  try {
    const imagePromises = Array.from(form.imageFile.files).map(file => fileToDataUrl(file));
    const imagesData = (await Promise.all(imagePromises)).filter(Boolean);
    const current = form.elements.id.value ? state.trades.find((trade) => trade.id === form.elements.id.value) : {};
    const hasResult = form.pnl.value.trim() !== "";
    const hasCloseTime = Boolean(form.closeTime?.value.trim());
    const isEditingExistingClosed = Boolean(current && current.status === "closed");
    const nextStatus = (hasResult || hasCloseTime || isEditingExistingClosed) ? "closed" : "open";
    
    const openTimeVal = form.openTime?.value || (form.date.value ? `${form.date.value}T09:30` : nowDatetimeLocal());
    const closeTimeVal = nextStatus === "closed" ? (form.closeTime?.value || (form.date.value ? `${form.date.value}T10:30` : "")) : "";
    const tradeDate = openTimeVal ? openTimeVal.split("T")[0] : form.date.value;
    const closedAtDate = closeTimeVal ? closeTimeVal.split("T")[0] : (nextStatus === "closed" ? tradeDate : "");

    let finalImages = [...(current.images || [])];
    if (current.imageData && !finalImages.includes(current.imageData)) {
      finalImages.unshift(current.imageData);
    }
    const enteredUrl = form.imageUrl.value.trim();
    if (enteredUrl && !finalImages.includes(enteredUrl)) {
      finalImages.push(enteredUrl);
    }
    if (imagesData.length) {
      imagesData.forEach(img => {
        if (!finalImages.includes(img)) finalImages.push(img);
      });
    }

    const preflightContainer = document.getElementById("preflightChecklistContainer");
    const preflightCbs = preflightContainer ? Array.from(preflightContainer.querySelectorAll(".preflight-checkbox")) : [];
    const preflightItems = preflightCbs.map((cb) => ({
      text: cb.dataset.ruleText || "",
      checked: Boolean(cb.checked)
    }));
    const preflightPassed = preflightItems.length === 0 || preflightItems.every((i) => i.checked);

    const activeSopObj = state.sops.find((s) => s.id === form.sopId.value) || activeSop();
    const trade = normalizeTrade({
      ...current,
      id: form.elements.id.value || uid(),
      status: nextStatus,
      date: tradeDate,
      closedAt: closedAtDate,
      openTime: openTimeVal,
      closeTime: closeTimeVal,
      symbol: form.symbol.value.trim().toUpperCase(),
      sopId: form.sopId.value,
      accountId: form.accountId.value,
      setup: form.setup.value,
      direction: form.direction.value,
      grade: form.grade.value,
      risk: Number(form.risk.value),
      pnl: hasResult ? Number(form.pnl.value) : "",
      maeR: form.maeR?.value.trim() !== "" ? -Math.abs(Number(form.maeR.value)) : "",
      mfeR: form.mfeR?.value.trim() !== "" ? Math.abs(Number(form.mfeR.value)) : "",
      rule: form.rule.value === "incomplete" ? "incomplete" : form.rule.value === "true",
      ruleStatus: form.rule.value === "incomplete" ? "incomplete" : (form.rule.value === "false" ? "violated" : "followed"),
      emotion: form.emotion.value,
      note: form.note.value,
      entryPlan: form.entryPlan.value.trim(),
      stopPlan: form.stopPlan.value.trim(),
      targetPlan: form.targetPlan.value.trim(),
      exitNote: form.exitNote.value.trim(),
      tradingViewUrl: form.tradingViewUrl.value.trim(),
      imageUrl: enteredUrl,
      images: finalImages,
      imageData: "",
      checklist: {
        hasPlan: form.hasPlan.checked,
        hasTrigger: form.hasTrigger.checked,
        hasStop: form.hasStop.checked,
        hasTarget: form.hasTarget.checked,
        emotionControlled: form.emotionControlled.checked
      },
      audit: {
        compliance: form.auditCompliance?.value || "",
        stopLoss: form.auditStopLoss?.value || "",
        takeProfit: form.auditTakeProfit?.value || "",
        emotionScore: Number(form.auditEmotionScore?.value) || 0,
        notes: current.audit?.notes || ""
      },
      mistakes: Array.from(form.querySelectorAll('input[name="mistakes"]:checked')).map(cb => cb.value),
      preFlightChecklist: {
        passed: preflightPassed,
        items: preflightItems,
        checkedAt: current.preFlightChecklist?.checkedAt || new Date().toISOString()
      },
      sopSnapshot: current.sopSnapshot || {
        version: activeSopObj?.version || 1,
        sopId: activeSopObj?.id || "",
        sopName: activeSopObj?.name || "",
        savedAt: new Date().toISOString(),
        checklist: parseSopChecklistRules(activeSopObj?.checklist)
      }
    });
    const index = state.trades.findIndex((item) => item.id === trade.id);
    if (index >= 0) state.trades[index] = trade;
    else state.trades.push(trade);
    state.activeSopId = trade.sopId;
    state.activeAccountId = trade.accountId;
    saveState();
    resetTradeForm();
    renderAll();
    const progress = sopProgress(trade.sopId);
    
    let toastType = "info";
    if (nextStatus === "closed") {
      const isWin = trade.pnl > 0 || (trade.pnl === 0 && rValue(trade) > 0);
      toastType = isWin ? "win" : "loss";
    }
    
    toast(nextStatus === "open" ? `Added to ${sopName(trade.sopId)} journey.` : `Record completed. ${progress.records} records in this SOP.`, toastType);
  } catch (error) {
    toast(error.message, "error");
  }
}

function deleteTrade(id) {
  const trade = state.trades.find((item) => item.id === id);
  if (!trade) return;
  if (!confirm(`Delete ${trade.symbol} ${formatR(rValue(trade))}?`)) return;
  state.trades = state.trades.filter((item) => item.id !== id);
  saveState();
  closeSheet("detailSheet");
  closeSheet("tradeFormSheet");
  renderAll();
  toast("Trade deleted.", "delete");
}

function openCloseTradeModal(id) {
  const trade = state.trades.find((item) => item.id === id);
  if (!trade) return;
  const currentNow = nowDatetimeLocal();
  openModal("Close trade", "Result", `
    <div class="close-trade-form" id="closeTradeForm" data-close-id="${trade.id}">
      <div class="insight-grid">
        ${insightCard("Symbol", trade.symbol, trade.direction)}
        ${insightCard("Setup", trade.setup, `Risk ${money(trade.risk)}`)}
      </div>
      <div class="form-row" style="margin-top:12px;">
        <label>Closing Time (平仓时间)
          <input name="closeTime" type="datetime-local" value="${currentNow}" required />
        </label>
      </div>
      <div class="form-row">
        <label>Net P&L ($)<input name="pnl" type="number" step="1" placeholder="240" /></label>
        <label>${t("rResult")}<input name="rResult" type="number" step="0.01" placeholder="+1.20" /></label>
      </div>
      <p class="muted">${t("rHint")} ${t("pnlWins")}</p>
      <div class="form-row">
        <label>Rule followed<select name="rule"><option value="true">🟢 Followed (遵守SOP)</option><option value="false">🔴 Violated (违反SOP)</option><option value="incomplete">🟠 SOP Incomplete (SOP待完善)</option></select></label>
        <label>Emotion<select name="emotion"><option>Calm</option><option>Focused</option><option>FOMO</option><option>Revenge</option><option>Hesitant</option></select></label>
      </div>
      <label>Exit Note
        <div class="markdown-editor-container">
          <div class="md-toolbar">
            <button type="button" class="md-btn" onclick="insertMarkdown(this, '**', '**')" title="Bold">B</button>
            <button type="button" class="md-btn" onclick="insertMarkdown(this, '*', '*')" title="Italic">I</button>
            <button type="button" class="md-btn" onclick="insertMarkdown(this, '==', '==')" title="Highlight">Hi</button>
            <button type="button" class="md-btn" onclick="insertMarkdown(this, '- ', '')" title="List">•</button>
            <button type="button" class="md-btn" onclick="insertMarkdown(this, '> ', '')" title="Quote">"</button>
          </div>
          <textarea name="exitNote" rows="3" placeholder="Why and how the trade ended."></textarea>
        </div>
      </label>
      <label>Upload Screenshot<input name="imageFile" type="file" accept="image/*" /></label>
      <button class="primary-button" type="button" onclick="window.closeTradeFromModal(event)">Close Trade</button>s*</div>
  `);
  
}

function mediaBadges(trade) {
  const imgCount = imagesFor(trade).length;
  const imgBadge = imgCount > 1 ? `<span class="tag info">${imgCount} Images</span> ` : imgCount === 1 ? '<span class="tag info">Image</span> ' : "";
  const tvBadge = trade.tradingViewUrl ? '<span class="tag info">TV</span> ' : "";
  const nearNews = window.forexFactoryRedNewsEngine?.isTradeNearRedNews(trade.date);
  const newsBadge = nearNews ? `<span class="trade-red-news-tag" title="${safe(nearNews.event.title)}">🔴 ${safe(nearNews.event.currency)} News</span> ` : "";
  const preflightBadge = trade.preFlightChecklist?.passed ? '<span class="preflight-verified-badge" title="开仓前 5 项风控检查已全通过">✓ Verified</span> ' : "";
  return `${preflightBadge}${imgBadge}${tvBadge}${newsBadge}` || '<span class="muted">None</span>';
}

async function closeTradeFromModal(event) {
  event.preventDefault();
  try {
    const container = document.getElementById("closeTradeForm");
    const trade = state.trades.find((item) => item.id === container.dataset.closeId);
    if (!trade) return;
    
    const getValue = (name) => container.querySelector(`[name="${name}"]`)?.value || "";
    
    const pnlInput = getValue("pnl").trim();
    const rInput = getValue("rResult").trim();
    if (!pnlInput && !rInput) {
      toast(t("needsResult"), "error");
      return;
    }
    const closeTimeVal = getValue("closeTime") || nowDatetimeLocal();
    if (trade.openTime && closeTimeVal < trade.openTime) {
      toast("Closing time cannot be earlier than opening time.", "error");
      return;
    }
    
    const imageInput = container.querySelector('[name="imageFile"]');
    const imagePromises = imageInput && imageInput.files ? Array.from(imageInput.files).map(file => fileToDataUrl(file)) : [];
    const imagesData = (await Promise.all(imagePromises)).filter(Boolean);
    
    trade.status = "closed";
    trade.closeTime = closeTimeVal;
    trade.closedAt = closeTimeVal.split("T")[0];
    if (rInput !== "") trade.rMultiple = Number(rInput);
    trade.pnl = pnlInput !== "" ? Number(pnlInput) : (rInput !== "" ? Number(rInput) * Number(trade.risk || 0) : 0);
    
    const ruleValue = getValue("rule");
    trade.rule = ruleValue === "incomplete" ? "incomplete" : ruleValue === "true";
    trade.ruleStatus = ruleValue === "incomplete" ? "incomplete" : (ruleValue === "false" ? "violated" : "followed");
    trade.emotion = getValue("emotion");
    trade.exitNote = getValue("exitNote").trim();
    if (imagesData.length) trade.images = imagesData;
    
    const isWin = trade.pnl > 0 || (trade.pnl === 0 && rValue(trade) > 0);
    const toastType = isWin ? "win" : "loss";
    
    saveState();
    closeModal();
    renderAll();
    const progress = sopProgress(trade.sopId);
    toast(`${sopName(trade.sopId)} now has ${progress.records} records.`, toastType);
  } catch (error) {
    console.error("Error closing trade:", error);
    toast("Failed to close trade: " + error.message, "error");
  }
}

function imagesFor(trade) {
  if (!trade) return [];
  const list = trade.images?.length ? trade.images : [trade.imageData || trade.imageUrl];
  return list.filter((item) => typeof item === "string" && item.trim().length > 0);
}

function openDetail(id) {
  const trade = state.trades.find((item) => item.id === id);
  if (!trade) return;
  const imgs = imagesFor(trade);
  let imageHtml = emptyState("No screenshot attached.");
  if (imgs.length > 1) {
    imageHtml = `
      <div class="carousel-container" style="display:flex; overflow-x:auto; gap:12px; padding-bottom:8px;">
        ${imgs.map((src, i) => `
          <button class="text-button" data-image="${trade.id}" data-index="${i}" style="flex-shrink:0; border:1px solid var(--hairline); border-radius:8px; overflow:hidden; position:relative; min-width:140px; min-height:100px; background:var(--hairline);">
            <img src="${src}" alt="Screenshot ${i+1}" style="max-height:160px; object-fit:cover; display:block;" loading="lazy" />
          </button>
        `).join("")}
      </div>
    `;
  } else if (imgs.length === 1) {
    imageHtml = `
      <div style="position:relative; border-radius:12px; overflow:hidden; min-height:160px;" class="skeleton-shimmer">
        <button class="text-button" data-image="${trade.id}" data-index="0" style="width:100%; display:block;">
          <img src="${imgs[0]}" alt="Chart screenshot" style="width:100%; display:block; border-radius:12px;" loading="lazy" onload="this.parentElement.parentElement.classList.remove('skeleton-shimmer')" />
        </button>
      </div>
    `;
  }

  const sopVer = trade.sopSnapshot?.version || 1;
  const snapshotDrawer = trade.sopSnapshot?.checklist?.length
    ? `
      <details class="sop-snapshot-drawer" style="margin:12px 0; padding:10px 14px; border-radius:14px; background:rgba(0,113,227,0.06); border:1px solid rgba(0,113,227,0.2);">
        <summary style="font-size:12px; font-weight:600; color:var(--blue); cursor:pointer; display:flex; align-items:center; justify-content:space-between;">
          <span>📜 SOP v${sopVer} 开仓规则快照 (Checklist at Entry)</span>
          <span class="tag info" style="font-size:10px; padding:2px 6px;">v${sopVer} Snapshot</span>
        </summary>
        <ul style="margin:8px 0 0 18px; font-size:12px; color:var(--text); line-height:1.5;">
          ${(trade.sopSnapshot.checklist || []).map((item) => `<li>${safe(item)}</li>`).join("")}
        </ul>
      </details>
    `
    : "";

  const preflightHtml = trade.preFlightChecklist?.passed
    ? `
      <div class="preflight-detail-box" style="margin:14px 0; padding:12px 14px; border-radius:14px; background:rgba(52,199,89,0.08); border:1px solid rgba(52,199,89,0.3);">
        <strong style="color:#34c759; display:flex; align-items:center; gap:6px; font-size:13px;">✓ 100% Pre-Flight Verified (开仓前风控检查全通过)</strong>
        <ul style="margin:8px 0 0 18px; font-size:12px; color:var(--text); line-height:1.6;">
          ${(trade.preFlightChecklist.items || []).map((i) => `<li>${safe(i.text)}</li>`).join("")}
        </ul>
      </div>
    `
    : "";

  const eff = getTradeExecutionEfficiency(trade);
  const effText = eff !== null ? `${eff}% Efficiency` : (trade.mfeR ? `MFE: +${trade.mfeR}R` : "MFE Not Set");
  const maeSub = trade.maeR !== null && trade.maeR !== undefined && trade.maeR !== "" ? `MAE: ${trade.maeR}R` : "MAE Not Set";

  openModal("Trade detail", "Journal", `
    <div class="day-detail">
      <div class="insight-grid">${[
        insightCard("Symbol", trade.symbol, trade.direction),
        insightCard("Status", trade.status === "open" ? "Open" : "Closed", trade.status === "open" ? "Not in statistics yet" : formatR(rValue(trade))),
        insightCard("SOP", `${sopName(trade.sopId)} (v${sopVer})`, accountName(trade.accountId)),
        insightCard("Setup", trade.setup, `Grade ${trade.grade}`),
        insightCard("Execution Eff.", effText, maeSub),
        insightCard("Process", getTradeRuleStatus(trade) === "incomplete" ? "SOP Incomplete" : (getTradeRuleStatus(trade) === "violated" ? "Broken" : "Followed"), trade.emotion)
      ].join("")}</div>
      ${snapshotDrawer}
      ${preflightHtml}
      ${imageHtml}
      <div class="rich-text-content" style="margin:20px 0;">${parseMarkdown(safe(trade.status === "open" ? trade.entryPlan || "No entry plan." : trade.exitNote || trade.note || "No note."))}</div>
      <div class="row-actions">
        ${trade.status === "open" ? `<button class="primary-button" data-close-trade="${trade.id}">Close Trade</button>` : ""}
        ${trade.tradingViewUrl ? `<a class="primary-button" href="${safe(trade.tradingViewUrl)}" target="_blank" rel="noreferrer">Open Chart</a><button class="ghost-button" data-tv="${trade.id}">Embed TradingView</button>` : ""}
      </div>
      <div id="tvEmbed"></div>
    </div>
  `);
}

function openImage(id, index = 0) {
  const trade = state.trades.find((item) => item.id === id);
  const imgs = imagesFor(trade);
  if (!imgs[index]) return;

  const modal = document.getElementById("imageLightboxBackdrop");
  const img = document.getElementById("imageLightboxImg");
  if (modal && img) {
    img.src = imgs[index];
    modal.style.display = "flex";
    modal.classList.add("active");
    return;
  }
  openModal(`Screenshot ${index + 1} of ${imgs.length}`, "Image", `<img src="${imgs[index]}" alt="Chart screenshot" style="max-width:100%;" />`);
}

window.openImageLightbox = function(src) {
  if (!src) return;
  const modal = document.getElementById("imageLightboxBackdrop");
  const img = document.getElementById("imageLightboxImg");
  if (modal && img) {
    img.src = src;
    modal.style.display = "flex";
    modal.classList.add("active");
  }
};

window.closeImageLightbox = function() {
  const modal = document.getElementById("imageLightboxBackdrop");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
  }
};

function embedTradingView(id) {
  const trade = state.trades.find((item) => item.id === id);
  const target = document.getElementById("tvEmbed");
  if (!trade?.tradingViewUrl || !target) return;
  target.innerHTML = `<iframe class="tv-frame" title="TradingView chart" src="${safe(trade.tradingViewUrl)}"></iframe><p class="muted">If the embed is blocked, use Open Chart.</p>`;
}

function openModal(title, kicker, html) {
  const kickerEl = document.getElementById("detailSheetKicker");
  const titleEl = document.getElementById("detailSheetTitle");
  const bodyEl = document.getElementById("detailSheetBody");
  
  if (kickerEl) kickerEl.textContent = kicker;
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = html;
  
  openSheet("detailSheet");
}

function closeModal() {
  closeSheet("detailSheet");
}

function toast(message, type = "info") {
  if (type === "win") playSound("win");
  else if (type === "loss") playSound("loss");
  else if (type === "delete") playSound("delete");
  else playSound(type === "error" ? "error" : "success");
  
  const el = document.createElement("div");
  el.className = `toast ${type === "win" ? "success" : type === "loss" ? "error" : type === "delete" ? "info" : type}`;
  el.textContent = message;
  document.getElementById("toastStack").appendChild(el);
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 220);
  }, 3000);
}

function exportCsv() {
  const headers = ["status", "date", "closedAt", "symbol", "sopName", "sopId", "accountName", "accountId", "accountStartingBalance", "accountCurrentBalance", "setup", "direction", "grade", "risk", "pnl", "r", "rule", "emotion", "entryPlan", "stopPlan", "targetPlan", "exitNote", "tradingViewUrl", "imageUrl", "imageCount", "note", "reflection"];
  const rows = state.trades.map((trade) => headers.map((key) => {
    const account = state.accounts.find((item) => item.id === trade.accountId);
    const value = key === "r"
      ? rValue(trade).toFixed(2)
      : key === "sopName"
        ? sopName(trade.sopId)
        : key === "accountName"
          ? accountName(trade.accountId)
          : key === "accountStartingBalance"
            ? account?.startingBalance ?? ""
            : key === "accountCurrentBalance"
              ? account?.currentBalance ?? ""
              : key === "imageCount"
                ? imagesFor(trade).length
                : trade[key];
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }).join(","));
  download("trd-journey.csv", [headers.join(","), ...rows].join("\n"), "text/csv;charset=utf-8");
}

function exportJson() {
  state.preferences.lastBackupAt = new Date().toISOString();
  saveState();
  download("trd-journey-backup.json", JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2), "application/json");
  toast("Backup exported successfully.", "success");
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function importJson(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    const incoming = normalizeState(imported);
    if (!Array.isArray(incoming.trades)) throw new Error("Invalid backup file.");
    showImportPreview(incoming);
  } catch (error) {
    toast("Invalid JSON backup. Current data was not changed.", "error");
  }
}

function resetDemo() {
  if (!confirm("Reset to demo data? This replaces current local data.")) return;
  state = defaultState();
  saveState();
  resetTradeForm();
  renderAll();
  toast("Demo data restored.");
}

function renderActivityRings() {
  const day = todayISO();
  
  // 1. Filter today's trades
  const todayTrades = state.trades.filter(t => t.date === day);
  const totalCount = todayTrades.length;
  
  // 2. Rules followed percentage
  let ruleFollowedCount = todayTrades.filter(t => getTradeRuleStatus(t) === "followed").length;
  let rulePercent = totalCount > 0 ? Math.round((ruleFollowedCount / totalCount) * 100) : 100;
  
  // 3. Today's total R multiple
  let totalTodayR = todayTrades.reduce((sum, t) => sum + rValue(t), 0);
  
  // Daily limits from preferences
  const maxTrades = state.preferences.maxTradesPerDay || 4;
  const maxLossR = Math.abs(state.preferences.dailyMaxLossR || 2);
  
  // 4. Calculate ratios
  const tradeRatio = Math.min(totalCount / maxTrades, 1.0);
  const lossRatio = totalTodayR < 0 ? Math.min(Math.abs(totalTodayR) / maxLossR, 1.0) : 0;
  const ruleRatio = rulePercent / 100;

  // 5. Update circle dashes
  // R=60 (circ = 376.99)
  const circleTrades = document.getElementById("ringTrades");
  if (circleTrades) {
    const circumference = 2 * Math.PI * 60;
    circleTrades.style.strokeDashoffset = circumference - (tradeRatio * circumference);
  }
  
  // R=46 (circ = 289.02)
  const circleLoss = document.getElementById("ringLoss");
  if (circleLoss) {
    const circumference = 2 * Math.PI * 46;
    circleLoss.style.strokeDashoffset = circumference - (lossRatio * circumference);
  }
  
  // R=32 (circ = 201.06)
  const circleRules = document.getElementById("ringRules");
  if (circleRules) {
    const circumference = 2 * Math.PI * 32;
    circleRules.style.strokeDashoffset = circumference - (ruleRatio * circumference);
  }

  // 6. Update Legend Values
  setText("legendTradesVal", `${totalCount} / ${maxTrades}`);
  setText("legendLossVal", `${formatR(totalTodayR)} / -${maxLossR.toFixed(1)}R`);
  setText("legendRulesVal", `${rulePercent}%`);
}

function openSheet(id) {
  const sheet = document.getElementById(id);
  if (!sheet) return;
  playSound("switch");
  sheet.classList.remove("hidden");
  // Force reflow
  sheet.offsetWidth;
  sheet.classList.add("active");
  document.body.style.overflow = "hidden";
  document.body.classList.add("sheet-open");

  if (id === "tradeFormSheet") {
    const form = document.getElementById("tradeForm");
    if (form && !form.elements.id.value) {
      renderPreFlightChecklist(state.activeSopId);

      // Check Daily Guardrail Status & Revenge Trading Prevention
      const today = new Date().toISOString().split("T")[0];
      const todayTrades = (state.trades || []).filter(t => (t.date === today || (t.openTime && t.openTime.startsWith(today))));
      let todayR = 0;
      todayTrades.forEach(t => {
        if (t.status === "closed") {
          todayR += (Number(t.pnlR) || 0);
        }
      });

      const riskWarningEl = document.getElementById("tradeFormRiskAlert");
      if (riskWarningEl) {
        if (todayR <= -2 || todayTrades.length >= 3) {
          riskWarningEl.classList.remove("hidden");
          const titleEl = document.getElementById("tradeFormRiskTitle");
          const metaEl = document.getElementById("tradeFormRiskMeta");
          if (titleEl) titleEl.textContent = "🛑 Daily Risk Limit Hit (" + todayR.toFixed(1) + "R / " + todayTrades.length + " Trades)";
          if (metaEl) metaEl.textContent = "Revenge trading detected. Take a 5-minute break and strictly verify all Pre-Flight rules before entry.";
        } else {
          riskWarningEl.classList.add("hidden");
        }
      }
    }
    if (typeof checkTradeFormNewsRisk === "function") {
      setTimeout(checkTradeFormNewsRisk, 50);
    }
  }

  // Hide dock
  const dock = document.getElementById("reactBitsDock");
  if (dock) dock.classList.add("is-hidden");
}

function closeSheet(id) {
  const sheet = document.getElementById(id);
  if (!sheet || sheet.classList.contains("hidden")) return;
  playSound("switch");
  sheet.classList.remove("active");
  setTimeout(() => {
    if (!sheet.classList.contains("active")) {
      sheet.classList.add("hidden");
    }
  }, 400);
  
  const activeSheets = document.querySelectorAll(".sheet-backdrop.active");
  if (activeSheets.length <= 1) {
    document.body.style.overflow = "";
    document.body.classList.remove("sheet-open");
    // Show dock
    const dock = document.getElementById("reactBitsDock");
    if (dock) dock.classList.remove("is-hidden");
  }
}

// Expose core UI functions globally on window for inline HTML & external module triggers
window.openSheet = openSheet;
window.closeSheet = closeSheet;
window.openModal = openModal;
window.closeModal = closeModal;
window.openRedNewsModal = openRedNewsModal;
window.closeRedNewsModal = closeRedNewsModal;
window.renderRedNewsTable = renderRedNewsTable;
window.renderHomeRedNewsWidget = renderHomeRedNewsWidget;
window.updateNewsBarCountdown = updateNewsBarCountdown;

window.clearPastNews = function() {
  if (window.forexFactoryRedNewsEngine) window.forexFactoryRedNewsEngine.clearPast();
  if (typeof renderRedNewsTable === "function") renderRedNewsTable(currentRedNewsCurrencyFilter);
  if (typeof renderHomeRedNewsWidget === "function") renderHomeRedNewsWidget();
  if (typeof updateNewsBarCountdown === "function") updateNewsBarCountdown();
};

window.triggerBentoAction = function(actionStr, moduleName) {
  if (actionStr === "open-capture") {
    openSheet("tradeFormSheet");
    return;
  }
  if (moduleName && typeof openModule === "function") {
    openModule(moduleName);
  }
};

function updateWorkflowTiles() {
  const day = todayISO();
  const hasPlan = !!(state.dailyPlans[day] && state.dailyPlans[day].bias);
  const hasReview = !!(state.dailyReviews[day] && state.dailyReviews[day].keep);

  const tilePlan = document.getElementById("tilePlan");
  const tileReview = document.getElementById("tileReview");

  if (tilePlan) {
    tilePlan.classList.toggle("is-completed", hasPlan);
    const statusText = document.getElementById("statusPlanText");
    if (statusText) {
      statusText.textContent = hasPlan ? "Plan completed ✓" : "Tap to plan today";
    }
  }

  if (tileReview) {
    tileReview.classList.toggle("is-completed", hasReview);
    const statusText = document.getElementById("statusReviewText");
    if (statusText) {
      statusText.textContent = hasReview ? "Review completed ✓" : "Tap to review day";
    }
  }
}

function openModule(id, source = null) {
  const view = document.getElementById(id);
  if (!view) return;
  
  try {
    if (window.css3dCarousel && typeof window.css3dCarousel.collapseCard === 'function') {
      window.css3dCarousel.collapseCard();
    }
    if (window.resetInternalSelection) window.resetInternalSelection();
    playSound("switch");
    if (window.appleAudioEngine) window.appleAudioEngine.play('module');
  } catch (e) {}

  activeModule = id;
  try {
    window.dispatchEvent(new CustomEvent('moduleChanged', { detail: { moduleId: id } }));
  } catch (e) {}
  
  if (id === "landing-gallery") {
    // Overlay mode: Keep current view active, show landing gallery on top
    view.classList.add("active");
  } else {
    // Normal mode: Hide landing gallery overlay and switch active view
    const landing = document.getElementById("landing-gallery");
    if (landing) landing.classList.remove("active");
    
    document.querySelectorAll(".view:not(#landing-gallery)").forEach((item) => {
      item.classList.toggle("active", item.id === id);
    });
  }
  
  const isSimulationActive = id === "review" && Boolean(document.getElementById("review-simulation")?.classList.contains("active"));
  const targetDockModule = id === "landing-gallery" ? activeModule : (isSimulationActive ? "simulation" : id);
  if (window.reactBitsDockEngine) {
    window.reactBitsDockEngine.setActiveModule(targetDockModule);
  } else {
    document.querySelectorAll(".dock-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.dockModule === targetDockModule);
    });
  }
  
  // Trigger shimmer skeleton loaders
  const mainEl = document.querySelector(".main");
  if (mainEl && id !== "landing-gallery") {
    mainEl.classList.add("is-skeleton");
    setTimeout(() => mainEl.classList.remove("is-skeleton"), 240);
  }
  
  // Custom header Log Trade visibility
  const actionBtn = document.getElementById("headerLogTradeBtn");
  if (actionBtn) {
    actionBtn.classList.toggle("hidden", id === "journal");
  }
  
  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.openModule = openModule;
window.closeModule = closeModule;

function closeModule() {
  openModule("landing-gallery");
}

function switchLanguage() {
  playSound("switch");
  language = language === "en" ? "zh" : "en";
  localStorage.setItem(LANGUAGE_KEY, language);
  renderAll();
  toast(t("languageSaved"));
}

function switchTheme() {
  playSound("pop");
  theme = theme === "light" ? "dark" : "light";
  localStorage.setItem("trd-journey-theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  toast(theme === "dark" ? "Dark mode enabled." : "Light mode enabled.");
}

function renderThemeButtons() {
  // SVG sun/moon icon auto toggles via CSS data-theme selectors, no textContent needed.
}

document.querySelectorAll("[data-open-module]").forEach((button) => {
  button.addEventListener("click", () => openModule(button.dataset.openModule, button));
});

document.querySelectorAll(".language-toggle").forEach((button) => {
  button.addEventListener("click", switchLanguage);
});

document.querySelectorAll(".theme-toggle, #headerThemeToggleBtn").forEach((button) => {
  button.addEventListener("click", switchTheme);
});

document.getElementById("backHomeBtn")?.addEventListener("click", closeModule);

document.getElementById("tradeForm")?.addEventListener("submit", saveTradeFromForm);
document.querySelector('#tradeForm [name="openTime"]')?.addEventListener("change", (event) => {
  if (event.target.value) {
    const form = document.getElementById("tradeForm");
    if (form.date) form.date.value = event.target.value.split("T")[0];
  }
});
document.getElementById("cancelEditBtn")?.addEventListener("click", resetTradeForm);
document.getElementById("setupFilter")?.addEventListener("change", renderJournal);
document.getElementById("ruleFilterSelect")?.addEventListener("change", renderJournal);
document.getElementById("activeSopSelect")?.addEventListener("change", (event) => {
  state.activeSopId = event.target.value;
  state.activeAccountId = accountsForSop(state.activeSopId)[0]?.id || "";
  saveState();
  renderAll();
  resetTradeForm();
});
document.getElementById("accountFilterSelect")?.addEventListener("change", (event) => {
  state.activeAccountId = event.target.value;
  saveState();
  renderAll();
  resetTradeForm();
});
document.getElementById("tradeSopSelect")?.addEventListener("change", (event) => {
  state.activeSopId = event.target.value;
  const accounts = accountsForSop(state.activeSopId).filter(a => !a.archivedAt);
  state.activeAccountId = accounts[0]?.id || "";
  saveState();
  
  // Re-populate account options for the trade form without wiping everything else
  const tradeAccountSelect = document.getElementById("tradeAccountSelect");
  if (tradeAccountSelect) {
    tradeAccountSelect.innerHTML = accounts.map(a => `<option value="${safe(a.id)}">${safe(a.name)}</option>`).join("");
    tradeAccountSelect.value = state.activeAccountId;
  }
  
  // Re-render checklist based on new SOP
  renderPreFlightChecklist(state.activeSopId);
  
  // Also update the global select to keep them in sync
  const globalSopSelect = document.getElementById("activeSopSelect");
  if (globalSopSelect) globalSopSelect.value = state.activeSopId;
  const globalAccountSelect = document.getElementById("accountFilterSelect");
  if (globalAccountSelect) {
    globalAccountSelect.innerHTML = accounts.map(a => `<option value="${safe(a.id)}">${safe(a.name)}</option>`).join("");
    globalAccountSelect.value = state.activeAccountId;
  }
});
document.getElementById("tradeAccountSelect")?.addEventListener("change", (event) => {
  state.activeAccountId = event.target.value;
  saveState();
  const globalAccountSelect = document.getElementById("accountFilterSelect");
  if (globalAccountSelect) globalAccountSelect.value = state.activeAccountId;
});
document.getElementById("exportCsvBtn")?.addEventListener("click", exportCsv);
document.getElementById("exportJsonBtn")?.addEventListener("click", exportJson);
document.getElementById("importJsonInput")?.addEventListener("change", (event) => {
  if (event.target.files && event.target.files[0]) {
    importJson(event.target.files[0]);
    event.target.value = "";
  }
});
document.getElementById("resetBtn")?.addEventListener("click", resetDemo);
document.getElementById("addSopBtn")?.addEventListener("click", () => openSopModal());
document.getElementById("addAccountBtn")?.addEventListener("click", () => openAccountModal());
document.getElementById("journalAddSopBtn")?.addEventListener("click", () => openSopModal());
document.getElementById("journalAddAccountBtn")?.addEventListener("click", () => openAccountModal());
document.getElementById("modalCloseBtn")?.addEventListener("click", closeModal);
document.getElementById("modalBackdrop")?.addEventListener("click", (event) => {
  if (event.target.id === "modalBackdrop") closeModal();
});
// Keyboard Navigation helper for active pages (AnimatedList style)
let internalSelectedIndex = -1;

window.resetInternalSelection = function() {
  internalSelectedIndex = -1;
  document.querySelectorAll(".workflow-tile, .quest-item, .timeline-card").forEach(el => {
    el.classList.remove("selected-item");
  });
};

function handleInternalKeyDown(event) {
  // Only handle if landing gallery is NOT active
  const landing = document.getElementById("landing-gallery");
  if (landing && landing.classList.contains("active")) return;
  
  // Ignore if modal or sheet is open
  const modal = document.getElementById("modalBackdrop");
  if (modal && !modal.classList.contains("hidden")) return;
  const sheets = Array.from(document.querySelectorAll(".sheet-backdrop")).filter(s => !s.classList.contains("hidden"));
  if (sheets.length > 0) return;
  
  let selector = "";
  if (activeModule === "overview") {
    selector = ".workflow-tile";
  } else if (activeModule === "missions") {
    selector = ".quest-item";
  } else if (activeModule === "journal") {
    selector = ".timeline-card";
  }
  
  if (!selector) return;
  
  const items = Array.from(document.querySelectorAll(selector)).filter(el => el.offsetWidth > 0); // Must be visible
  if (items.length === 0) return;
  
  if (event.key === "ArrowDown") {
    event.preventDefault();
    internalSelectedIndex = Math.min(internalSelectedIndex + 1, items.length - 1);
    updateInternalSelection(items);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    internalSelectedIndex = Math.max(internalSelectedIndex - 1, 0);
    updateInternalSelection(items);
  } else if (event.key === "Enter") {
    if (internalSelectedIndex >= 0 && internalSelectedIndex < items.length) {
      event.preventDefault();
      const selectedEl = items[internalSelectedIndex];
      if (activeModule === "overview") {
        if (!selectedEl.classList.contains("expanded")) {
          selectedEl.querySelector(".tile-summary-header")?.click();
        } else {
          selectedEl.querySelector(".tile-action-btn")?.click();
        }
      } else if (activeModule === "missions") {
        selectedEl.click();
      } else if (activeModule === "journal") {
        selectedEl.querySelector("[data-detail]")?.click();
      }
    }
  }
}

function updateInternalSelection(items) {
  items.forEach((item, idx) => {
    item.classList.toggle("selected-item", idx === internalSelectedIndex);
    if (idx === internalSelectedIndex) {
      item.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const lightboxBackdrop = document.getElementById("imageLightboxBackdrop");
    const backdrop = document.getElementById("modalBackdrop");
    const authBackdrop = document.getElementById("authModalBackdrop");
    const upgradeBackdrop = document.getElementById("upgradeModalBackdrop");

    if (lightboxBackdrop && lightboxBackdrop.classList.contains("active")) {
      if (window.closeImageLightbox) window.closeImageLightbox();
      return;
    }
    if (authBackdrop && authBackdrop.classList.contains("active")) {
      authBackdrop.classList.remove("active");
      return;
    }
    if (upgradeBackdrop && upgradeBackdrop.classList.contains("active")) {
      upgradeBackdrop.classList.remove("active");
      return;
    }
    if (backdrop && !backdrop.classList.contains("hidden")) {
      closeModal();
      return;
    }
    const activeSheet = document.querySelector(".sheet-backdrop.active");
    if (activeSheet && typeof closeSheet === "function") {
      closeSheet(activeSheet.id);
      return;
    }
    return;
  }
  
  handleInternalKeyDown(event);
});

// Update internal select index on hover
document.body.addEventListener("mouseenter", (e) => {
  const item = e.target.closest(".workflow-tile, .quest-item, .timeline-card");
  if (item) {
    let selector = "";
    if (activeModule === "overview") selector = ".workflow-tile";
    else if (activeModule === "missions") selector = ".quest-item";
    else if (activeModule === "journal") selector = ".timeline-card";
    
    if (selector && item.matches(selector)) {
      const items = Array.from(document.querySelectorAll(selector)).filter(el => el.offsetWidth > 0);
      internalSelectedIndex = items.indexOf(item);
      items.forEach((el, idx) => {
        el.classList.toggle("selected-item", idx === internalSelectedIndex);
      });
    }
  }
}, true);

document.getElementById("prevMonthBtn")?.addEventListener("click", () => {
  const d = new Date(`${selectedDay}T00:00:00`);
  d.setMonth(d.getMonth() - 1);
  d.setDate(1);
  selectedDay = localISO(d);
  renderCycles();
});

document.getElementById("nextMonthBtn")?.addEventListener("click", () => {
  const d = new Date(`${selectedDay}T00:00:00`);
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  selectedDay = localISO(d);
  renderCycles();
});

document.body.addEventListener("click", (event) => {
  // Bubble Menu Item Handlers
  const bubbleBtnDetail = event.target.closest("#bubbleBtnDetail");
  const bubbleBtnEdit = event.target.closest("#bubbleBtnEdit");
  const bubbleBtnDelete = event.target.closest("#bubbleBtnDelete");
  const bubbleMenu = document.getElementById("bubbleMenu");

  if (bubbleBtnDetail) {
    const id = bubbleMenu.dataset.activeTradeId;
    if (bubbleMenu) {
      bubbleMenu.classList.remove("active");
      setTimeout(() => bubbleMenu.classList.add("hidden"), 200);
    }
    openDetail(id);
    return;
  }
  if (bubbleBtnEdit) {
    const id = bubbleMenu.dataset.activeTradeId;
    if (bubbleMenu) {
      bubbleMenu.classList.remove("active");
      setTimeout(() => bubbleMenu.classList.add("hidden"), 200);
    }
    editTrade(id);
    return;
  }
  if (bubbleBtnDelete) {
    const id = bubbleMenu.dataset.activeTradeId;
    if (bubbleMenu) {
      bubbleMenu.classList.remove("active");
      setTimeout(() => bubbleMenu.classList.add("hidden"), 200);
    }
    deleteTrade(id);
    return;
  }

  // Dismiss bubble menu when clicking outside
  if (bubbleMenu && !event.target.closest("#bubbleMenu") && !event.target.closest("[data-trade-actions]")) {
    if (bubbleMenu.classList.contains("active")) {
      bubbleMenu.classList.remove("active");
      setTimeout(() => bubbleMenu.classList.add("hidden"), 200);
    }
  }

  // Trigger three-dot bubble menu
  const actionsTrigger = event.target.closest("[data-trade-actions]");
  if (actionsTrigger) {
    event.stopPropagation();
    const tradeId = actionsTrigger.dataset.tradeActions;
    playSound("pop");
    
    if (bubbleMenu) {
      bubbleMenu.dataset.activeTradeId = tradeId;
      const rect = actionsTrigger.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      
      const leftPos = Math.max(12, Math.min(window.innerWidth - 170, rect.left + scrollX + rect.width / 2 - 75));
      const topPos = rect.top < 160 ? (rect.top + scrollY + rect.height + 8) : (rect.top + scrollY - 146);
      
      bubbleMenu.style.left = leftPos + "px";
      bubbleMenu.style.top = topPos + "px";
      
      bubbleMenu.classList.remove("hidden");
      bubbleMenu.offsetWidth; // reflow
      bubbleMenu.classList.add("active");
    }
    return;
  }

  const shortcut = event.target.closest("[data-view-shortcut]")?.dataset.viewShortcut;
  const detail = event.target.closest("[data-detail]")?.dataset.detail;
  const edit = event.target.closest("[data-edit]")?.dataset.edit;
  const del = event.target.closest("[data-delete]")?.dataset.delete;
  const closeTrade = event.target.closest("[data-close-trade]")?.dataset.closeTrade;
  const sop = event.target.closest("[data-sop]")?.dataset.sop;
  const account = event.target.closest("[data-account]")?.dataset.account;
  const editSop = event.target.closest("[data-edit-sop]")?.dataset.editSop;
  const addAccount = event.target.closest("[data-add-account]")?.dataset.addAccount;
  const editAccount = event.target.closest("[data-edit-account]")?.dataset.editAccount;
  const editActiveAccount = event.target.closest("[data-edit-active-account]");
  const openCapture = event.target.closest("[data-open-capture]");
  const journalViewTarget = event.target.closest("[data-journal-view]")?.dataset.journalView;
  const day = event.target.closest("[data-day]")?.dataset.day;
  const imageEl = event.target.closest("[data-image]");
  const image = imageEl?.dataset.image;
  const imageIndex = imageEl?.dataset.index;
  const tv = event.target.closest("[data-tv]")?.dataset.tv;
  const deleteSopId = event.target.closest("[data-delete-sop]")?.dataset.deleteSop;
  const insightKey = event.target.closest("[data-insight]")?.dataset.insight;
  const sopExpand = event.target.closest("[data-sop-expand]");
  if (sopExpand && !event.target.closest("button")) {
    event.stopPropagation();
    document.querySelectorAll(".sop-card").forEach((card) => {
      if (card !== sopExpand) card.classList.remove("expanded");
    });
    sopExpand.classList.toggle("expanded");
  }

  if (shortcut) openModule(shortcut);
  if (detail) openDetail(detail);
  if (edit) editTrade(edit);
  if (del) deleteTrade(del);
  if (closeTrade) openCloseTradeModal(closeTrade);
  if (sop) {
    state.activeSopId = sop;
    state.activeAccountId = accountsForSop(sop)[0]?.id || "";
    saveState();
    renderAll();
    resetTradeForm();
  }
  if (account) {
    state.activeAccountId = account;
    saveState();
    renderAll();
    resetTradeForm();
  }
  if (editSop) openSopModal(editSop);
  if (addAccount) openAccountModal(addAccount);
  if (editAccount) {
    const item = state.accounts.find((entry) => entry.id === editAccount);
    openAccountModal(item?.sopId || state.activeSopId, editAccount);
  }
  if (editActiveAccount) openAccountModal(state.activeSopId, state.activeAccountId);
  if (openCapture) {
    openSheet("tradeFormSheet");
  }
  if (journalViewTarget) {
    journalView = journalViewTarget;
    document.querySelectorAll("[data-journal-view]").forEach((button) => button.classList.toggle("active", button.dataset.journalView === journalView));
    document.getElementById("sopTimeline").classList.toggle("hidden", journalView !== "timeline");
    document.getElementById("journalTablePanel").classList.toggle("hidden", journalView !== "table");
  }
  if (day) {
    setWorkflowDate(day);
  }
  if (image) openImage(image, imageIndex ? parseInt(imageIndex, 10) : 0);
  if (tv) embedTradingView(tv);
  if (deleteSopId) deleteSop(deleteSopId);
  if (insightKey) openInsightDetail(insightKey);
  
  const saveReflectionBtn = event.target.closest(".save-reflection-btn");
  if (saveReflectionBtn) {
    const tradeId = saveReflectionBtn.dataset.tradeId;
    const card = saveReflectionBtn.closest(".shame-trade-card");
    const textarea = card.querySelector("textarea");
    const text = textarea.value.trim();
    
    const trade = state.trades.find(t => t.id === tradeId);
    if (trade) {
      trade.reflection = text;
      saveState();
      toast("Self-reflection saved.", "success");
    }
    return;
  }
});

// Global submit listener removed; dynamic forms now use inline onsubmit handlers to prevent iOS Safari bubbling bugs.

document.querySelectorAll("[data-review-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    playSound("click");
    document.querySelectorAll("[data-review-panel]").forEach((item) => item.classList.toggle("active", item === button));
    const targetPanelId = `review-${button.dataset.reviewPanel}`;
    const targetPanel = document.getElementById(targetPanelId);
    
    document.querySelectorAll(".review-panel").forEach((panel) => {
      panel.classList.remove("active");
    });
    
    if (targetPanel) {
      targetPanel.classList.add("active");
      targetPanel.classList.add("is-skeleton");
      setTimeout(() => targetPanel.classList.remove("is-skeleton"), 200);
    }
    
    if (button.dataset.reviewPanel === "backtester") {
      populateBacktestSops();
      renderSavedBacktests();
      updateBacktesterUI();
    }
    if (button.dataset.reviewPanel === "simulation") {
      executeAndRenderMonteCarlo();
      if (window.reactBitsDockEngine) window.reactBitsDockEngine.setActiveModule('simulation');
    } else {
      if (window.reactBitsDockEngine) window.reactBitsDockEngine.setActiveModule('review');
    }
  });
});

document.getElementById("btnRunMonteCarlo")?.addEventListener("click", () => {
  playSound("click");
  executeAndRenderMonteCarlo();
  toast("Monte Carlo 1,000 trials simulated!", "success");
});
document.getElementById("mcTradeCountSelect")?.addEventListener("change", executeAndRenderMonteCarlo);

document.querySelectorAll("#planForm [name='workflowDate'], #reviewForm [name='workflowDate']").forEach((input) => {
  input.addEventListener("change", (event) => setWorkflowDate(event.target.value));
});

document.getElementById("planForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const day = form.workflowDate.value || selectedDay || todayISO();
  selectedDay = day;
  state.dailyPlans[day] = {
    bias: form.bias.value.trim(),
    levels: form.levels.value.trim(),
    allowedSetups: form.allowedSetups.value.trim(),
    maxLossR: Number(form.maxLossR.value),
    maxTrades: Number(form.maxTrades.value)
  };
  saveState();
  
  const wasAlreadyRewarded = state.experience?.dailyXpLog?.[day]?.plan === true;
  awardXpForQuest(day, "plan");
  renderAll();
  if (wasAlreadyRewarded) {
    toast(`Plan saved for ${day}.`);
  }
  closeSheet("planSheet");
});

document.getElementById("reviewForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const day = form.workflowDate.value || selectedDay || todayISO();
  selectedDay = day;
  state.dailyReviews[day] = {
    keep: form.keep.value.trim(),
    remove: form.remove.value.trim(),
    focus: form.focus.value.trim()
  };
  saveState();
  
  const wasReviewRewarded = state.experience?.dailyXpLog?.[day]?.review === true;
  awardXpForQuest(day, "review");
  
  // Check Risk Control Shield
  const todayTrades = state.trades.filter(t => t.date === day);
  const totalCount = todayTrades.length;
  const maxTrades = state.preferences.maxTradesPerDay || 4;
  const maxLossR = Math.abs(state.preferences.dailyMaxLossR || 2);
  const totalTodayR = todayTrades.reduce((sum, t) => sum + rValue(t), 0);
  const riskShieldActive = totalCount <= maxTrades && totalTodayR >= -maxLossR;
  
  const wasRiskRewarded = state.experience?.dailyXpLog?.[day]?.risk === true;
  if (riskShieldActive) {
    awardXpForQuest(day, "risk");
  }
  
  renderAll();
  if (wasReviewRewarded && (!riskShieldActive || wasRiskRewarded)) {
    toast(`Review saved for ${day}.`);
  }
  closeSheet("reviewSheet");
});

document.getElementById("lgCustomAlertsForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!state.longGame.customAlertConfig) state.longGame.customAlertConfig = {};
  
  state.longGame.customAlertConfig.consecutiveLosses = parseInt(form.consecutiveLosses.value, 10) || 4;
  state.longGame.customAlertConfig.sopChangeWindowDays = parseInt(form.sopChangeWindowDays.value, 10) || 7;
  state.longGame.customAlertConfig.shockBreakRatioDelta = parseFloat(form.shockBreakRatioDelta.value) || 0.2;
  
  saveState();
  toast("Long Game custom alerts saved.");
});

document.getElementById("settingsForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  state.preferences = {
    ...state.preferences,
    defaultSymbol: form.defaultSymbol.value.trim().toUpperCase() || "NQ",
    riskPerTrade: Number(form.riskPerTrade.value),
    dailyMaxLossR: Number(form.dailyMaxLossR.value),
    maxTradesPerDay: Number(form.maxTradesPerDay.value),
    setups: form.setups.value.split("\n").map((item) => item.trim()).filter(Boolean),
    dailyRules: form.dailyRules.value.split("\n").map((item) => item.trim()).filter(Boolean),
    backupReminder: form.backupReminder.checked,
    enableSounds: form.enableSounds.checked,
    carouselDragSensitivity: Number(form.carouselDragSensitivity.value),
    carouselSnapFriction: Number(form.carouselSnapFriction.value),
    checklistLabels: {
      hasPlan: form.checklistLabelPlan.value.trim() || "Plan",
      hasTrigger: form.checklistLabelTrigger.value.trim() || "Trigger",
      hasStop: form.checklistLabelStop.value.trim() || "Invalidation Stop",
      hasTarget: form.checklistLabelTarget.value.trim() || "Planned Target",
      emotionControlled: form.checklistLabelEmotion.value.trim() || "Emotional Control"
    }
  };
  if (!state.preferences.setups.length) state.preferences.setups = [...defaultPreferences.setups];
  state = ensureSopState(state);
  saveState();
  resetTradeForm();
  renderAll();
  toast("Preferences saved.");
});

function openInsightDetail(key) {
  const panel = document.getElementById("insightDetailPanel");
  const chart = document.getElementById("insightDetailChart");
  const title = document.getElementById("insightDetailTitle");
  const kicker = document.getElementById("insightDetailKicker");
  const cards = document.getElementById("insightDetailCards");
  if (!panel) return;

  const closed = closedTrades();
  if (!closed.length) { toast("No closed trades yet.", "error"); return; }

  let seriesData = [];
  let detailCards = [];
  let chartOptions = {};

  if (key === "totalProfit") {
    kicker.textContent = "Gross Profit Breakdown";
    title.textContent = "Cumulative Winning Trades ($ & R)";
    chartOptions = { positive: true };
    let totalR = 0;
    const wins = closed.filter(t => rValue(t) > 0);
    seriesData = [{ value: 0, label: "Start" }, ...wins.map((t) => {
      totalR += rValue(t);
      return { value: totalR, label: t.date, detail: `${t.symbol}: ${formatR(rValue(t))} (${money(t.pnl)})` };
    })];
    const m = metrics();
    const avgWin = wins.length ? m.grossWinR / wins.length : 0;
    const avgWinDollars = wins.length ? m.grossWinDollars / wins.length : 0;
    detailCards = [
      insightCard("Total Profit R", formatR(m.grossWinR), `${wins.length} winning trades`),
      insightCard("Total Profit $", formatDollar(m.grossWinDollars), "Gross USD gain"),
      insightCard("Avg Win R", formatR(avgWin), "Average winner size"),
      insightCard("Avg Win $", formatDollar(avgWinDollars), "Average winner PnL"),
    ];
  } else if (key === "totalLoss") {
    kicker.textContent = "Gross Loss Breakdown";
    title.textContent = "Cumulative Losing Trades ($ & R)";
    chartOptions = { negative: true };
    let totalLossR = 0;
    const losses = closed.filter(t => rValue(t) < 0);
    seriesData = [{ value: 0, label: "Start" }, ...losses.map((t) => {
      totalLossR += rValue(t);
      return { value: totalLossR, label: t.date, detail: `${t.symbol}: ${formatLossR(rValue(t))} (${money(t.pnl)})` };
    })];
    const m = metrics();
    const avgLoss = losses.length ? m.grossLossR / losses.length : 0;
    const avgLossDollars = losses.length ? m.grossLossDollars / losses.length : 0;
    detailCards = [
      insightCard("Total Loss R", formatLossR(m.grossLossR), `${losses.length} losing trades`),
      insightCard("Total Loss $", formatDollar(m.grossLossDollars), "Gross USD loss"),
      insightCard("Avg Loss R", formatLossR(avgLoss), "Average loser size"),
      insightCard("Avg Loss $", formatDollar(avgLossDollars), "Average loser PnL"),
    ];
  } else if (key === "weekR" || key === "totalR") {
    kicker.textContent = key === "weekR" ? "Weekly Trend" : "Cumulative Equity";
    title.textContent = key === "weekR" ? "R-Value per trade (this week)" : "Equity curve (all trades)";
    let total = 0;
    seriesData = [{ value: 0, label: "Start" }, ...closed.map((t) => {
      total += rValue(t);
      return { value: total, label: t.date, detail: `${t.symbol} (${formatR(rValue(t))})` };
    })];
    const m = metrics();
    detailCards = [
      insightCard("Win Rate", `${Math.round(m.winRate * 100)}%`, `${m.wins}W / ${m.losses}L`),
      insightCard("Expectancy", formatR(m.expectancy), "Per trade average"),
      insightCard("Profit Factor", Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞", "Gross profit / Gross loss"),
      insightCard("Max DD", formatR(m.maxDrawdown), "Worst peak-to-trough"),
    ];
  } else if (key === "streak") {
    kicker.textContent = "Daily Performance";
    title.textContent = "Daily R over time";
    const dayMap = {};
    closed.forEach((t) => { dayMap[t.date] = (dayMap[t.date] || 0) + rValue(t); });
    const sortedDays = Object.keys(dayMap).sort();
    seriesData = sortedDays.map((d) => ({ value: dayMap[d], label: d, detail: `Day total: ${formatR(dayMap[d])}` }));
    const posDays = sortedDays.filter((d) => dayMap[d] > 0).length;
    const negDays = sortedDays.filter((d) => dayMap[d] < 0).length;
    detailCards = [
      insightCard("Green Days", String(posDays), `${Math.round(posDays / sortedDays.length * 100)}% of days`),
      insightCard("Red Days", String(negDays), `${Math.round(negDays / sortedDays.length * 100)}% of days`),
      insightCard("Best Day", formatR(Math.max(...Object.values(dayMap))), "Single day best"),
      insightCard("Worst Day", formatR(Math.min(...Object.values(dayMap))), "Single day worst"),
    ];
  } else if (key === "bestSetup" || key === "worstSetup") {
    kicker.textContent = "Setup Analysis";
    title.textContent = "Cumulative R by setup";
    const grouped = Object.entries(groupBy(closed, "setup"));
    const allSetupCards = grouped.map(([name, list]) => {
      const m = metrics(list);
      return insightCard(name, formatR(m.totalR), `${m.count} trades · WR ${Math.round(m.winRate * 100)}%`);
    });
    detailCards = allSetupCards;
    let total = 0;
    seriesData = [{ value: 0, label: "Start" }, ...closed.map((t) => {
      total += rValue(t);
      return { value: total, label: t.setup, detail: `${t.symbol} ${formatR(rValue(t))}` };
    })];
  } else if (key === "largestWin" || key === "largestLoss") {
    kicker.textContent = "Trade Distribution";
    title.textContent = "Individual trade R-values";
    seriesData = closed.map((t) => ({ value: rValue(t), label: t.date, detail: `${t.symbol} ${t.setup}` }));
    const sorted = [...closed].sort((a, b) => rValue(b) - rValue(a));
    const top3 = sorted.slice(0, 3);
    const bottom3 = sorted.slice(-3).reverse();
    detailCards = [
      ...top3.map((t, i) => insightCard(`#${i + 1} Best`, formatR(rValue(t)), `${t.symbol} · ${t.date}`)),
      ...bottom3.map((t, i) => insightCard(`#${i + 1} Worst`, formatR(rValue(t)), `${t.symbol} · ${t.date}`)),
    ];
  } else if (key === "processLeak") {
    kicker.textContent = "Process Quality";
    title.textContent = "Rule adherence over time";
    let followed = 0;
    seriesData = closed.map((t, i) => {
      const st = getTradeRuleStatus(t);
      if (st === "followed") followed++;
      const rate = Math.round(followed / (i + 1) * 100);
      const labelText = st === "incomplete" ? "SOP Incomplete" : (st === "violated" ? "Broken" : "Followed");
      return { value: rate, label: t.date, detail: `${t.symbol} · ${labelText}` };
    });
    const ruleFollowed = closed.filter((t) => getTradeRuleStatus(t) === "followed").length;
    const gradeA = closed.filter((t) => t.grade === "A").length;
    detailCards = [
      insightCard("Rules Followed", `${Math.round(ruleFollowed / closed.length * 100)}%`, `${ruleFollowed} of ${closed.length}`),
      insightCard("A-Grade Trades", `${Math.round(gradeA / closed.length * 100)}%`, `${gradeA} of ${closed.length}`),
      insightCard("Avg R (Rule ✓)", formatR(metrics(closed.filter((t) => getTradeRuleStatus(t) === "followed")).expectancy), "When following rules"),
      insightCard("Avg R (Rule ✗)", formatR(metrics(closed.filter((t) => getTradeRuleStatus(t) === "violated")).expectancy), "When breaking rules"),
    ];
  } else {
    return;
  }

  panel.style.display = "block";
  renderLineChart("insightDetailChart", seriesData, chartOptions);
  cards.innerHTML = detailCards.join("");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("closeInsightDetail")?.addEventListener("click", () => {
  document.getElementById("insightDetailPanel").style.display = "none";
});

// --- Phase 5: Additional UI & Backtesting Sandbox Helper Functions ---

let sandboxTrades = [];

function initCardSpotlightHover() {
  document.addEventListener("mousemove", (e) => {
    const card = e.target.closest(".home-card, .play-card, .sop-card-container");
    
    // Reset all other cards
    const activeCards = document.querySelectorAll(".home-card, .play-card, .sop-card-container");
    activeCards.forEach(c => {
      if (c !== card) {
        c.style.transform = "";
        c.style.transition = "transform var(--motion-base) var(--spring)";
        c.style.setProperty("--mouse-x", "-999px");
        c.style.setProperty("--mouse-y", "-999px");
      }
    });
    
    if (!card) return;
    
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
    
    // Tilt calculations
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (centerY - y) / 12;
    const rotateY = (x - centerX) / 12;
    
    card.style.transition = "transform 0.08s ease-out";
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.015, 1.015, 1.015)`;
  });
  
  document.addEventListener("mouseleave", (e) => {
    const card = e.target.closest(".home-card, .play-card, .sop-card-container");
    if (card) {
      card.style.transition = "transform var(--motion-base) var(--spring)";
      card.style.transform = "";
      card.style.setProperty("--mouse-x", "-999px");
      card.style.setProperty("--mouse-y", "-999px");
    }
  }, true);
}

function initMacDock() {
  console.log("initMacDock: Initializing macOS smooth dock...");
  const dock = document.querySelector(".ios-dock");
  if (!dock) {
    console.warn("initMacDock: .ios-dock not found!");
    return;
  }
  const items = dock.querySelectorAll(".dock-item");
  console.log(`initMacDock: Found ${items.length} dock items.`);
  
  const baseSize = 58;
  const magnification = 80;
  const distance = 150;
  
  let animationFrameId = null;
  let targetWidths = Array(items.length).fill(baseSize);
  let currentWidths = Array(items.length).fill(baseSize);
  let isHovered = false;

  const loop = () => {
    let needsUpdate = false;
    items.forEach((item, index) => {
      // Lerp for smooth spring-like animation to avoid jitter
      currentWidths[index] += (targetWidths[index] - currentWidths[index]) * 0.25;
      
      if (Math.abs(targetWidths[index] - currentWidths[index]) > 0.1) {
        needsUpdate = true;
      } else {
        currentWidths[index] = targetWidths[index]; // Snap
      }

      item.style.width = `${currentWidths[index]}px`;
      item.style.height = `${currentWidths[index]}px`;
      
      const icon = item.querySelector(".dock-icon");
      if (icon) {
        const targetIconSize = 24 + ((currentWidths[index] - baseSize) / (magnification - baseSize)) * 8;
        icon.style.fontSize = `${targetIconSize}px`;
      }
    });

    if (needsUpdate && isHovered) {
      animationFrameId = requestAnimationFrame(loop);
    } else {
      animationFrameId = null;
    }
  };
  
  dock.addEventListener("mouseenter", () => {
    isHovered = true;
    items.forEach(item => {
      item.classList.remove("resetting");
      const icon = item.querySelector(".dock-icon");
      if (icon) icon.classList.remove("resetting");
    });
    
    // Jump to current bounds in case it was resetting via CSS
    items.forEach((item, i) => {
      const rect = item.getBoundingClientRect();
      currentWidths[i] = rect.width;
      targetWidths[i] = rect.width;
    });
    
    if (!animationFrameId) animationFrameId = requestAnimationFrame(loop);
  });
  
  dock.addEventListener("mousemove", (e) => {
    const mouseX = e.clientX;
    
    items.forEach((item, index) => {
      const rect = item.getBoundingClientRect();
      const itemCenterX = rect.left + rect.width / 2;
      const dist = Math.abs(mouseX - itemCenterX);
      
      if (dist < distance) {
        // React bits linear mapping
        const progress = 1 - (dist / distance);
        targetWidths[index] = baseSize + (magnification - baseSize) * progress;
      } else {
        targetWidths[index] = baseSize;
      }
    });
    
    if (!animationFrameId && isHovered) {
      animationFrameId = requestAnimationFrame(loop);
    }
  });
  
  dock.addEventListener("mouseleave", () => {
    isHovered = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    items.forEach((item, index) => {
      item.classList.add("resetting");
      item.style.width = "";
      item.style.height = "";
      const icon = item.querySelector(".dock-icon");
      if (icon) {
        icon.classList.add("resetting");
        icon.style.fontSize = "";
      }
      targetWidths[index] = baseSize;
      currentWidths[index] = baseSize;
    });
  });
}

function initCalendarHover() {
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;
  
  grid.addEventListener("mouseover", (e) => {
    const dayBtn = e.target.closest(".calendar-day");
    if (!dayBtn || dayBtn.classList.contains("empty")) return;
    
    const day = dayBtn.dataset.day;
    if (!day) return;
    
    const dayTrades = byDate(day);
    const closed = closedTrades(dayTrades);
    const m = metrics(closed);
    const review = state.dailyReviews[day];
    const plan = state.dailyPlans[day];
    
    let html = `<div style="font-family:-apple-system, sans-serif; font-size:12px; line-height:1.45; text-align:left;">`;
    html += `<strong style="font-size:13px; color:var(--ink); display:block; margin-bottom:4px;">${day}</strong>`;
    
    if (dayTrades.length === 0) {
      html += `<span class="muted">No trades recorded.</span>`;
    } else {
      html += `<span style="font-weight:600; color:${m.totalR >= 0 ? 'var(--green)' : 'var(--red)'}">Profit: ${formatR(m.totalR)}</span> (${closed.length} closed, ${dayTrades.length - closed.length} open)<br>`;
      html += `<div style="margin-top:6px; border-top:1px solid var(--hairline); padding-top:4px; max-height:80px; overflow-y:auto; display:grid; gap:2px;">`;
      dayTrades.forEach(t => {
        const val = t.status === "open" ? "Open" : (t.pnl ? `$${t.pnl}` : formatR(rValue(t)));
        html += `<div style="font-size:11px;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${t.pnl >= 0 || rValue(t) >= 0 ? 'var(--green)' : 'var(--red)'}; margin-right:4px;"></span>`;
        html += `<strong>${safe(t.symbol)}</strong> (${safe(t.setup)}) ${t.direction}: <strong>${val}</strong></div>`;
      });
      html += `</div>`;
    }
    
    if (plan) {
      html += `<div style="margin-top:6px; border-top:1px solid var(--hairline); padding-top:4px; opacity:0.85;">`;
      html += `<strong>Plan:</strong> ${safe(plan.bias)} (${plan.allowedSetups})<br>`;
      html += `</div>`;
    }
    if (review) {
      html += `<div style="margin-top:4px; opacity:0.85;">`;
      html += `<strong>Focus:</strong> ${safe(review.focus)}<br>`;
      html += `</div>`;
    }
    html += `</div>`;
    
    const tooltip = document.getElementById("chartTooltip");
    if (tooltip) {
      tooltip.innerHTML = html;
      const rect = dayBtn.getBoundingClientRect();
      const tooltipX = window.scrollX + rect.left + rect.width / 2;
      const tooltipY = window.scrollY + rect.top - 10;
      
      tooltip.style.left = tooltipX + "px";
      tooltip.style.top = tooltipY + "px";
      tooltip.style.transform = "translate(-50%, -100%)";
      tooltip.classList.remove("hidden");
    }
  });
  
  grid.addEventListener("mouseleave", () => {
    const tooltip = document.getElementById("chartTooltip");
    if (tooltip) tooltip.classList.add("hidden");
  }, true);
  
  grid.addEventListener("mouseout", (e) => {
    const dayBtn = e.target.closest(".calendar-day");
    if (!dayBtn) {
      const tooltip = document.getElementById("chartTooltip");
      if (tooltip) tooltip.classList.add("hidden");
    }
  });
}

function updateStorageEstimate() {
  const el = document.getElementById("storageEstimate");
  if (!el) return;
  
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then((estimate) => {
      const usedMb = (estimate.usage / (1024 * 1024)).toFixed(2);
      const totalMb = (estimate.quota / (1024 * 1024)).toFixed(0);
      el.textContent = `${usedMb} MB / ${totalMb} MB (${((estimate.usage / estimate.quota) * 100).toFixed(4)}%)`;
    }).catch(() => {
      el.textContent = "Offline storage quota available";
    });
  } else {
    el.textContent = "Supported";
  }
}

function updateSyncStatus() {
  const dot = document.getElementById("syncStatusDot");
  if (!dot) return;
  
  if (navigator.onLine) {
    dot.className = "status-dot online";
    dot.title = "Online (Local Storage Sync ready)";
  } else {
    dot.className = "status-dot offline";
    dot.title = "Offline (Local Database Sandbox mode active)";
  }
}

function showUpdateBanner(worker) {
  let banner = document.getElementById("pwaUpdateBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "pwaUpdateBanner";
    banner.className = "update-banner";
    const text = t("System update ready, click to reload.") || "System update ready, click to reload.";
    const btnText = t("Update") || "Update";
    banner.innerHTML = `
      <span>${text}</span>
      <button class="primary-button" style="padding:4px 10px; font-size:12px; margin-left:8px; border-radius:999px; background:white; color:var(--blue); font-weight:700; border:none;">${btnText}</button>
    `;
    document.body.appendChild(banner);
    
    banner.querySelector("button").addEventListener("click", () => {
      playSound("click");
      worker.postMessage({ action: "skipWaiting" });
    });
  }
  setTimeout(() => banner.classList.add("show"), 100);
}

function getDisciplineStreak() {
  const closed = closedTrades().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  let streak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    const status = getTradeRuleStatus(closed[i]);
    if (status === "followed") {
      streak++;
    } else if (status === "incomplete") {
      // 🟠 Incomplete SOP / Sandbox trade: preserves the discipline streak 🔥
      continue;
    } else {
      // 🔴 Violated SOP: resets the discipline streak
      break;
    }
  }
  return streak;
}

function runMonteCarloSimulation(numTrades = 50, numRuns = 1000) {
  const closed = closedTrades();
  let samplePool = closed.map(t => rValue(t)).filter(v => !isNaN(v));
  let isBaseline = false;

  if (samplePool.filter(v => Math.abs(v) > 0.001).length < 3) {
    isBaseline = true;
    samplePool = [1.8, 2.0, -1.0, 1.5, -1.0, 2.5, -1.0, 1.2, -1.0, 2.0, -1.0, 1.5, 3.0, -1.0, 1.0];
  }

  const allRuns = [];
  let winRuns = 0;
  const maxDrawdowns = [];

  for (let r = 0; r < numRuns; r++) {
    let currentR = 0;
    let peakR = 0;
    let maxDD = 0;
    const curve = [0];

    for (let t = 0; t < numTrades; t++) {
      const randomIndex = Math.floor(Math.random() * samplePool.length);
      const sampledR = samplePool[randomIndex];
      currentR += sampledR;
      curve.push(Number(currentR.toFixed(2)));

      if (currentR > peakR) peakR = currentR;
      const dd = peakR - currentR;
      if (dd > maxDD) maxDD = dd;
    }

    if (currentR > 0) winRuns++;
    maxDrawdowns.push(maxDD);
    allRuns.push(curve);
  }

  const medianCurve = [];
  const topCurve = [];
  const bottomCurve = [];

  for (let step = 0; step <= numTrades; step++) {
    const valuesAtStep = allRuns.map(run => run[step]).sort((a, b) => a - b);
    bottomCurve.push(valuesAtStep[Math.floor(numRuns * 0.05)]);
    medianCurve.push(valuesAtStep[Math.floor(numRuns * 0.50)]);
    topCurve.push(valuesAtStep[Math.floor(numRuns * 0.95)]);
  }

  const winRate = Math.round((winRuns / numRuns) * 100);
  maxDrawdowns.sort((a, b) => a - b);
  const medianDD = maxDrawdowns[Math.floor(numRuns * 0.50)];
  const p95DD = maxDrawdowns[Math.floor(numRuns * 0.95)];

  return {
    numTrades,
    numRuns,
    isBaseline,
    topCurve,
    medianCurve,
    bottomCurve,
    winRate,
    medianFinalR: medianCurve[medianCurve.length - 1],
    medianDD,
    p95DD
  };
}

function renderMonteCarloChart(results) {
  const svg = document.getElementById("monteCarloChart");
  const metricsGrid = document.getElementById("monteCarloMetricsGrid");
  if (!svg) return;

  const { numTrades, topCurve, medianCurve, bottomCurve, winRate, medianFinalR, medianDD, p95DD, isBaseline } = results;
  const width = 760;
  const height = 320;
  const pad = 36;

  const allValues = [...topCurve, ...medianCurve, ...bottomCurve, 0];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const spread = Math.max(maxVal - minVal, 1);

  const getPoints = (curve) => curve.map((val, idx) => {
    const x = pad + (idx / numTrades) * (width - pad * 2);
    const y = height - pad - ((val - minVal) / spread) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const zeroY = height - pad - ((0 - minVal) / spread) * (height - pad * 2);

  svg.innerHTML = `
    <!-- Grid Lines -->
    <line class="grid-line" x1="${pad}" y1="${pad}" x2="${width - pad}" y2="${pad}"></line>
    <line class="grid-line" x1="${pad}" y1="${zeroY}" x2="${width - pad}" y2="${zeroY}" stroke="rgba(255,255,255,0.2)" stroke-dasharray="4 4"></line>
    <text class="axis-label" x="${pad}" y="${pad - 10}">${formatR(maxVal)}</text>
    <text class="axis-label" x="${pad}" y="${zeroY - 6}" fill="var(--muted)">0.00R</text>
    <text class="axis-label" x="${width - pad - 70}" y="${height - 10}">${numTrades} Trades</text>

    <!-- 95th Best-Case Curve (Green) -->
    <polyline points="${getPoints(topCurve)}" fill="none" stroke="#30d158" stroke-width="2" stroke-dasharray="4 4" opacity="0.85"></polyline>

    <!-- 5th Worst-Case Curve (Orange/Red) -->
    <polyline points="${getPoints(bottomCurve)}" fill="none" stroke="#ff9f0a" stroke-width="2" stroke-dasharray="5 5" opacity="0.85"></polyline>

    <!-- 50th Median Expected Curve (Solid Blue) -->
    <polyline points="${getPoints(medianCurve)}" fill="none" stroke="#0071e3" stroke-width="3"></polyline>
  `;

  // Interactive Hover Tooltip for Monte Carlo Canvas
  const mcPoints = [];
  for (let i = 0; i <= numTrades; i++) {
    const x = pad + (i / numTrades) * (width - pad * 2);
    mcPoints.push({
      step: i,
      x,
      top: topCurve[i],
      med: medianCurve[i],
      bot: bottomCurve[i]
    });
  }

  svg.onmousemove = (e) => {
    if (!mcPoints.length) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (width / rect.width);
    let nearest = mcPoints[0];
    let minDist = Infinity;
    for (const p of mcPoints) {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }

    const tooltip = document.getElementById("chartTooltip");
    if (nearest && tooltip && minDist < 50) {
      tooltip.style.left = `${e.clientX + 14}px`;
      tooltip.style.top = `${e.clientY + 14}px`;
      tooltip.innerHTML = `
        <div style="font-weight:700; font-size:12px; margin-bottom:4px;">Trade Step #${nearest.step}</div>
        <div style="color:#30d158; font-size:11px;">🌟 Best (95%): ${formatR(nearest.top)}</div>
        <div style="color:#0071e3; font-size:11px;">📈 Expected (50%): ${formatR(nearest.med)}</div>
        <div style="color:#ff9f0a; font-size:11px;">🛡️ Floor (5%): ${formatR(nearest.bot)}</div>
      `;
      tooltip.classList.remove("hidden");
    }
  };

  svg.onmouseleave = () => {
    const tooltip = document.getElementById("chartTooltip");
    if (tooltip) tooltip.classList.add("hidden");
  };

  if (metricsGrid) {
    metricsGrid.innerHTML = [
      insightCard("Win Probability", `${winRate}%`, `${isBaseline ? "Baseline model" : "Historical pool"} (${results.numRuns} runs)`),
      insightCard("Expected Median R", formatR(medianFinalR), `Projected over ${numTrades} trades`),
      insightCard("Median Drawdown", formatR(-medianDD), "50% typical max drawdown"),
      insightCard("95% DD Floor", formatR(-p95DD), "Worst 5% drawdown boundary")
    ].join("");
  }
}

function executeAndRenderMonteCarlo() {
  const select = document.getElementById("mcTradeCountSelect");
  const count = select ? parseInt(select.value, 10) : 50;
  const results = runMonteCarloSimulation(count, 1000);
  renderMonteCarloChart(results);
}

function updateMindfulnessBanner() {
  const banner = document.getElementById("mindfulnessBanner");
  if (!banner) return;

  const closed = closedTrades();
  if (closed.length === 0) {
    banner.style.display = "none";
    return;
  }

  const streak = getDisciplineStreak();
  const calmTrades = closed.filter(t => t.emotion === "Calm" || t.emotion === "Focused");
  const otherTrades = closed.filter(t => t.emotion && t.emotion !== "Calm" && t.emotion !== "Focused");

  let diffText = "";
  if (calmTrades.length > 0 && otherTrades.length > 0) {
    const calmM = metrics(calmTrades);
    const otherM = metrics(otherTrades);
    const diff = Math.round((calmM.winRate - otherM.winRate) * 100);
    if (diff > 0) {
      diffText = `Mindfulness Advantage: Trading in a <strong>Calm & Focused</strong> state increases average Win Rate by <span style="color:var(--green); font-weight:700;">+${diff}%</span> compared to emotional trading.`;
    } else if (diff < 0) {
      diffText = `Mindfulness Warning: Win rate in emotional states is slightly higher. Keep centering yourself to build long-term expectancy.`;
    } else {
      diffText = `Mindfulness Process: Win rate is balanced. Keep focusing on process compliance.`;
    }
  } else {
    diffText = `Mindfulness Process: Maintain a calm, focused mindset. Log more trades with emotional tags to unlock diagnostic comparison.`;
  }

  const streakCountEl = document.getElementById("streakCount");
  const calmDiagnosticEl = document.getElementById("calmDiagnostic");
  if (streakCountEl) streakCountEl.textContent = streak;
  if (calmDiagnosticEl) calmDiagnosticEl.innerHTML = diffText;

  if (streak >= 3 || (calmTrades.length > 0 && otherTrades.length > 0)) {
    banner.style.display = "flex";
    banner.style.flexDirection = "column";
  } else {
    banner.style.display = "none";
  }
}

function updateRewardMission() {
  const setupView = document.getElementById("rewardSetupView");
  const progressView = document.getElementById("rewardProgressView");
  const completedView = document.getElementById("rewardCompletedView");
  if (!setupView || !progressView || !completedView) return;

  if (!state.rewardMission) {
    state.rewardMission = { status: "idle", rewardName: "" };
  }

  const mission = state.rewardMission;

  if (mission.status === "idle") {
    setupView.classList.remove("hidden");
    progressView.classList.add("hidden");
    completedView.classList.add("hidden");
    return;
  }

  const closed = closedTrades();
  let current = 0;
  let target = 1;
  let isDone = false;
  let goalTitle = "";

  if (mission.targetType === "streak") {
    target = 3;
    current = getDisciplineStreak();
    goalTitle = "3-Trade Compliance Streak";
    if (current >= target) {
      current = target;
      isDone = true;
    }
  } else if (mission.targetType === "streak5") {
    target = 5;
    current = getDisciplineStreak();
    goalTitle = "5-Trade Compliance Streak";
    if (current >= target) {
      current = target;
      isDone = true;
    }
  } else if (mission.targetType === "compliance") {
    target = 9;
    const last10 = closed.slice(-10);
    current = last10.filter(t => getTradeRuleStatus(t) === "followed").length;
    goalTitle = "90% Compliance (Last 10 trades)";
    if (last10.length >= 10 && current >= target) {
      isDone = true;
    }
  } else if (mission.targetType === "rgain") {
    target = 5;
    const currentTotalR = metrics().totalR;
    const startR = mission.startR || 0;
    current = Math.max(0, currentTotalR - startR);
    goalTitle = "Gain 5R Multiple";
    if (current >= target) {
      current = target;
      isDone = true;
    }
  }

  mission.currentProgress = current;
  mission.targetProgress = target;

  if (isDone && mission.status === "active") {
    mission.status = "completed";
    saveState();
    playSound("success");
  }

  if (mission.status === "active") {
    setupView.classList.add("hidden");
    progressView.classList.remove("hidden");
    completedView.classList.add("hidden");

    const progressGoalEl = document.getElementById("rewardProgressGoal");
    const progressPrizeEl = document.getElementById("rewardProgressPrize");
    const progressTextEl = document.getElementById("rewardProgressText");
    const progressBarFillEl = document.getElementById("rewardProgressBarFill");

    if (progressGoalEl) progressGoalEl.textContent = goalTitle;
    if (progressPrizeEl) progressPrizeEl.textContent = mission.rewardName;
    
    let progressPercentage = 0;
    if (mission.targetType === "rgain") {
      progressPercentage = Math.min(100, Math.round((current / target) * 100));
      if (progressTextEl) progressTextEl.textContent = `Progress: ${current.toFixed(2)}R / ${target}R`;
    } else if (mission.targetType === "compliance") {
      progressPercentage = Math.min(100, Math.round((current / 10) * 100));
      if (progressTextEl) progressTextEl.textContent = `Progress: ${current} / 10 compliant (Target: ${target})`;
    } else {
      progressPercentage = Math.min(100, Math.round((current / target) * 100));
      if (progressTextEl) progressTextEl.textContent = `Progress: ${current} / ${target} trades`;
    }
    
    if (progressBarFillEl) progressBarFillEl.style.width = `${progressPercentage}%`;

  } else if (mission.status === "completed") {
    setupView.classList.add("hidden");
    progressView.classList.add("hidden");
    completedView.classList.remove("hidden");

    const completedPrizeEl = document.getElementById("rewardCompletedPrize");
    if (completedPrizeEl) completedPrizeEl.textContent = mission.rewardName;
  }
}

function initRewardListeners() {
  document.getElementById("rewardSetupForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const type = document.getElementById("rewardTargetType").value;
    const name = document.getElementById("rewardNameInput").value.trim();
    if (!name) return;
    
    playSound("success");
    state.rewardMission = {
      status: "active",
      targetType: type,
      rewardName: name,
      startR: metrics().totalR,
      currentProgress: 0,
      targetProgress: 5,
      claimed: false
    };
    saveState();
    updateRewardMission();
    toast("Reward mission activated! Stay focused.");
  });

  document.getElementById("btnCancelReward")?.addEventListener("click", () => {
    if (!confirm("Are you sure you want to cancel this mission? Your progress will be lost.")) return;
    playSound("delete");
    state.rewardMission = { status: "idle", rewardName: "" };
    saveState();
    updateRewardMission();
    toast("Mission cancelled.");
  });

  document.getElementById("btnResetReward")?.addEventListener("click", () => {
    playSound("success");
    const mission = state.rewardMission;
    
    // Archive achievement
    const newAchievement = {
      id: uid(),
      date: todayISO(),
      targetType: mission.targetType,
      rewardName: mission.rewardName,
      goalTitle: document.getElementById("rewardProgressGoal")?.textContent || "Discipline Goal"
    };
    
    if (!state.experience) {
      state.experience = { xp: 0, level: 1, achievements: [], dailyXpLog: {} };
    }
    if (!state.experience.achievements) {
      state.experience.achievements = [];
    }
    state.experience.achievements.push(newAchievement);
    
    // Reset mission
    state.rewardMission = { status: "idle", rewardName: "" };
    saveState();
    
    // Add XP!
    addXp(100);
    
    renderAll();
    toast("Congratulations! Go enjoy your reward. (+100 XP)");
  });
}

function getDisciplineTitle(lvl) {
  const titles = {
    1: "Impulsive Novice",
    2: "Rule Explorer",
    3: "Patient Hunter",
    4: "Calm Executor",
    5: "Zen Master"
  };
  return titles[lvl] || "Zen Master";
}

function getXpProgress(xp) {
  if (xp < 100) return { current: xp, target: 100, pct: (xp / 100) * 100, level: 1 };
  if (xp < 300) return { current: xp - 100, target: 200, pct: ((xp - 100) / 200) * 100, level: 2 };
  if (xp < 600) return { current: xp - 300, target: 300, pct: ((xp - 300) / 300) * 100, level: 3 };
  if (xp < 1000) return { current: xp - 600, target: 400, pct: ((xp - 600) / 400) * 100, level: 4 };
  return { current: 1, target: 1, pct: 100, level: 5 };
}

function addXp(amount) {
  if (!state.experience) {
    state.experience = { xp: 0, level: 1, achievements: [], dailyXpLog: {} };
  }
  const oldLevel = state.experience.level;
  state.experience.xp += amount;
  
  // Calculate level
  const progress = getXpProgress(state.experience.xp);
  state.experience.level = progress.level;
  
  saveState();
  
  if (state.experience.level > oldLevel) {
    playSound("success");
    setTimeout(() => {
      openModal(
        "Level Up!",
        "Discipline Center",
        `
        <div style="text-align:center; padding:20px; display:flex; flex-direction:column; align-items:center; gap:16px;">
          <div class="reward-badge-glow" style="font-size:3.5rem;">🏆</div>
          <h2 style="color:var(--green); font-size:24px; font-weight:800; margin:0;">You Levelled Up!</h2>
          <p style="margin:0; font-size:14px;">Your discipline level is now <strong>Level ${state.experience.level}</strong></p>
          <div class="xp-badge" style="width:80px; height:80px; font-size:1.3rem; margin:0 auto; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #a020f0, #0071e3); color:white; border-radius:50%; font-weight:800;">Lvl ${state.experience.level}</div>
          <h3 style="font-size:18px; font-weight:700; margin:0;">Title Unlocked: <strong>${getDisciplineTitle(state.experience.level)}</strong></h3>
          <p class="muted" style="font-size:12px; margin:0;">Keep up the self-discipline and follow your trading rules!</p>
          <button class="primary-button" onclick="closeModal()" style="margin-top:10px; width:100%;">Awesome</button>
        </div>
        `
      );
    }, 500);
  }
}

function awardXpForQuest(day, questType) {
  if (!state.experience) {
    state.experience = { xp: 0, level: 1, achievements: [], dailyXpLog: {} };
  }
  if (!state.experience.dailyXpLog) {
    state.experience.dailyXpLog = {};
  }
  if (!state.experience.dailyXpLog[day]) {
    state.experience.dailyXpLog[day] = { plan: false, risk: false, review: false };
  }
  
  if (state.experience.dailyXpLog[day][questType] !== true) {
    state.experience.dailyXpLog[day][questType] = true;
    addXp(10);
    let questName = "";
    if (questType === "plan") questName = "Pre-market Plan";
    if (questType === "risk") questName = "Risk Control Shield";
    if (questType === "review") questName = "Close-out Review";
    toast(`Daily Quest completed: ${questName}! +10 XP`);
  }
}

function renderMissions() {
  const missionsView = document.getElementById("missions");
  if (!missionsView) return;

  if (!state.experience) {
    state.experience = { xp: 0, level: 1, achievements: [], dailyXpLog: {} };
  }
  const exp = state.experience;

  // 1. Render XP status
  const progress = getXpProgress(exp.xp);
  
  setText("xpLevelBadge", `Lvl ${progress.level}`);
  setText("xpLevelTitle", getDisciplineTitle(progress.level));
  setText("xpNumerical", progress.level === 5 ? `${exp.xp} XP (Max Level)` : `${progress.current} / ${progress.target} XP (Total: ${exp.xp} XP)`);
  
  const xpBar = document.getElementById("xpBarFill");
  if (xpBar) xpBar.style.width = `${progress.pct}%`;

  // 2. Render Daily Quests
  const day = todayISO();
  const hasPlan = !!(state.dailyPlans[day] && state.dailyPlans[day].bias);
  const hasReview = !!(state.dailyReviews[day] && state.dailyReviews[day].keep);
  
  // Risk control quest:
  const todayTrades = state.trades.filter(t => t.date === day);
  const totalCount = todayTrades.length;
  const maxTrades = state.preferences.maxTradesPerDay || 4;
  const maxLossR = Math.abs(state.preferences.dailyMaxLossR || 2);
  let totalTodayR = todayTrades.reduce((sum, t) => sum + rValue(t), 0);
  const riskShieldActive = totalCount <= maxTrades && totalTodayR >= -maxLossR;

  // Update DOM status
  updateQuestTile("questPlanTile", "questPlanStatus", hasPlan || (exp.dailyXpLog?.[day]?.plan));
  updateQuestTile("questReviewTile", "questReviewStatus", hasReview || (exp.dailyXpLog?.[day]?.review));
  updateQuestTile("questRiskTile", "questRiskStatus", (totalCount > 0 && riskShieldActive && hasReview) || (exp.dailyXpLog?.[day]?.risk));

  // 3. Render Achievements List (Hall of Fame)
  const achGrid = document.getElementById("achievementsGrid");
  if (achGrid) {
    const achievements = exp.achievements || [];
    if (achievements.length === 0) {
      achGrid.innerHTML = `
        <div class="zero-state-card" style="grid-column: 1 / -1; width:100%; border-style:dashed;">
          <div class="zero-state-artwork" style="width:50px; height:50px; margin-bottom:8px;">
            <div class="glow-orb" style="width:30px; height:30px; background:radial-gradient(circle, rgba(255,215,0,0.2) 0%, transparent 70%);"></div>
            <span style="font-size:24px; z-index:2; position:relative;">🏆</span>
          </div>
          <h3 style="font-size:13px; font-weight:700;">No Redeemed Rewards</h3>
          <p style="font-size:11px; max-width:200px;">Complete Epic Reward Missions to build your self-discipline hall of fame.</p>
        </div>
      `;
    } else {
      achGrid.innerHTML = achievements.map(ach => `
        <div class="achievement-card">
          <div class="achievement-badge-icon">🏆</div>
          <strong>${safe(ach.rewardName)}</strong>
          <span class="ach-date">${ach.date}</span>
          <span class="ach-desc">${safe(ach.goalTitle)}</span>
        </div>
      `).join("");
    }
  }
}

function updateQuestTile(tileId, statusId, isDone) {
  const tile = document.getElementById(tileId);
  const status = document.getElementById(statusId);
  if (!tile || !status) return;

  tile.classList.toggle("is-completed", !!isDone);
  status.textContent = isDone ? "Completed" : "Pending";
}

function renderDisciplineHeatmap() {
  const grid = document.getElementById("disciplineHeatmap");
  if (!grid) return;
  
  grid.innerHTML = "";
  
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - dayOfWeek - 14 * 7); // Sunday 14 weeks ago
  
  // Build a map of date string to trade compliance
  const tradeMap = {};
  closedTrades().forEach(t => {
    if (!t.date) return;
    const dStr = String(t.date).trim().split("T")[0].split(" ")[0]; // YYYY-MM-DD
    if (!dStr) return;
    if (!tradeMap[dStr]) {
      tradeMap[dStr] = { total: 0, compliant: 0 };
    }
    tradeMap[dStr].total++;
    if (getTradeRuleStatus(t) === "followed") {
      tradeMap[dStr].compliant++;
    }
  });
  
  for (let i = 0; i < 105; i++) {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + i);
    
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    
    const record = tradeMap[dateStr];
    let titleText = `${dateStr}: No trades`;
    
    if (record) {
      const nonCompliant = record.total - record.compliant;
      if (nonCompliant > 0) {
        cell.classList.add("non-compliant");
        titleText = `${dateStr}: ${record.total} trades (${nonCompliant} broken rules ❌)`;
      } else {
        cell.classList.add("compliant");
        titleText = `${dateStr}: ${record.total} trades (All compliant! 🔥)`;
      }
    } else {
      cell.classList.add("no-trade");
    }
    
    cell.title = titleText;
    grid.appendChild(cell);
  }
}

function flipCard(id) {
  playSound("flip");
  const container = document.getElementById(`container-${id}`);
  if (container) {
    container.classList.toggle("flipped");
  }
}

function drawMiniSparklineMarkup(closed) {
  if (!closed || closed.length === 0) {
    return `<svg class="mini-sparkline" viewBox="0 0 100 24" aria-hidden="true"><line x1="0" y1="12" x2="100" y2="12" stroke="var(--hairline)" stroke-width="1.5" stroke-dasharray="2,2"></line></svg>`;
  }
  let total = 0;
  const values = [0];
  for (const t of closed) {
    total += rValue(t);
    values.push(total);
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 0.1);
  const points = values.map((val, idx) => {
    const x = (idx / Math.max(values.length - 1, 1)) * 100;
    const y = 22 - ((val - min) / spread) * 20;
    return `${x},${y}`;
  }).join(" ");
  
  const strokeColor = total >= 0 ? "var(--green)" : "var(--red)";
  return `<svg class="mini-sparkline" viewBox="0 0 100 24" style="overflow:visible;" aria-hidden="true">
    <polyline fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}"></polyline>
  </svg>`;
}



function showImportPreview(incoming) {
  const currentClosed = closedTrades();
  let currentTotal = 0;
  const currentSeries = [{ value: 0 }];
  currentClosed.forEach(t => {
    currentTotal += rValue(t);
    currentSeries.push({ value: currentTotal });
  });
  
  const mergedTrades = [...state.trades];
  incoming.trades.forEach(inTrade => {
    const idx = mergedTrades.findIndex(t => t.id === inTrade.id);
    if (idx >= 0) {
      mergedTrades[idx] = inTrade;
    } else {
      mergedTrades.push(inTrade);
    }
  });
  
  const mergedClosed = mergedTrades.filter(t => t.status === "closed").sort((a, b) => a.date.localeCompare(b.date));
  let mergedTotal = 0;
  const mergedSeries = [{ value: 0 }];
  mergedClosed.forEach(t => {
    mergedTotal += rValue(t);
    mergedSeries.push({ value: mergedTotal });
  });
  
  let newCount = 0;
  let duplicateCount = 0;
  incoming.trades.forEach(inTrade => {
    const exists = state.trades.some(t => t.id === inTrade.id);
    if (exists) duplicateCount++;
    else newCount++;
  });
  
  const content = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <p style="font-size:13px; line-height:1.45;">We compared your backup file with current local data. Select how you want to import your data.</p>
      
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
        <div class="status-card" style="padding:10px; text-align:center; background:var(--paper-strong); border:1px solid var(--hairline); border-radius:10px;">
          <span style="font-size:11px; color:var(--muted); display:block;">Incoming Trades</span>
          <strong style="font-size:18px;">${incoming.trades.length}</strong>
          <small class="muted" style="font-size:10px; display:block; opacity:0.8;">(${newCount} new, ${duplicateCount} duplicate)</small>
        </div>
        <div class="status-card" style="padding:10px; text-align:center; background:var(--paper-strong); border:1px solid var(--hairline); border-radius:10px;">
          <span style="font-size:11px; color:var(--muted); display:block;">SOPs</span>
          <strong style="font-size:18px;">${incoming.sops.length}</strong>
        </div>
        <div class="status-card" style="padding:10px; text-align:center; background:var(--paper-strong); border:1px solid var(--hairline); border-radius:10px;">
          <span style="font-size:11px; color:var(--muted); display:block;">Accounts</span>
          <strong style="font-size:18px;">${incoming.accounts.length}</strong>
        </div>
      </div>
      
      <div>
        <strong style="font-size:12px; display:block; margin-bottom:6px;">Projected R-Curve Projection (Dashed: Current / Solid: Merged)</strong>
        <div style="border:1px solid var(--hairline); border-radius:14px; padding:10px; background:var(--canvas);">
          <svg id="importCompareChart" viewBox="0 0 760 240" style="width:100%; height:180px;"></svg>
        </div>
      </div>
      
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
        <button class="primary-button" id="btnConfirmMerge" style="background:var(--green); border-color:var(--green); color:white;">Smart Merge (Recommended)</button>
        <span style="font-size:11px; color:var(--muted); margin-top:-6px;">Combines backup with local data. Duplicate IDs will be updated.</span>
        
        <button class="primary-button danger" id="btnConfirmOverwrite" style="background:var(--red); border-color:var(--red); color:white;">Full Overwrite Restore</button>
        <span style="font-size:11px; color:var(--muted); margin-top:-6px;">Erase current local database and replace it completely with backup.</span>
      </div>
    </div>
  `;
  
  openModal("Import Backup", "Data Manager", content);
  
  setTimeout(() => {
    renderDualLineChart("importCompareChart", currentSeries, mergedSeries);
  }, 100);
  
  document.getElementById("btnConfirmMerge")?.addEventListener("click", () => {
    state.trades = mergedTrades;
    incoming.sops.forEach(inSop => {
      const idx = state.sops.findIndex(s => s.id === inSop.id);
      if (idx >= 0) state.sops[idx] = { ...state.sops[idx], ...inSop };
      else state.sops.push(inSop);
    });
    incoming.accounts.forEach(inAcct => {
      const idx = state.accounts.findIndex(a => a.id === inAcct.id);
      if (idx >= 0) state.accounts[idx] = inAcct;
      else state.accounts.push(inAcct);
    });
    
    saveState();
    closeModal();
    playSound("success");
    renderAll();
    toast("Data merged successfully.");
  });
  
  document.getElementById("btnConfirmOverwrite")?.addEventListener("click", () => {
    if (!confirm("Are you absolutely sure you want to delete all current data and restore this backup? This cannot be undone.")) return;
    state = incoming;
    saveState();
    closeModal();
    playSound("success");
    renderAll();
    toast("Database fully restored.");
  });
}

function renderDualLineChart(id, currentSeries, projectedSeries) {
  const svg = document.getElementById(id);
  if (!svg) return;
  
  const width = 760;
  const height = 240;
  const pad = 32;
  
  const currentValues = currentSeries.map(p => p.value);
  const projectedValues = projectedSeries.map(p => p.value);
  const allValues = [...currentValues, ...projectedValues, 0];
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues, 1);
  const spread = Math.max(max - min, 1);
  
  const mapPoints = (series) => series.map((item, index) => {
    const x = pad + (index / Math.max(series.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((item.value - min) / spread) * (height - pad * 2);
    return { x, y };
  });
  
  const currentPoints = mapPoints(currentSeries);
  const projectedPoints = mapPoints(projectedSeries);
  
  const currentPath = currentPoints.map(p => `${p.x},${p.y}`).join(" ");
  const projectedPath = projectedPoints.map(p => `${p.x},${p.y}`).join(" ");
  const zeroY = height - pad - ((0 - min) / spread) * (height - pad * 2);
  
  svg.innerHTML = `
    <line class="grid-line" x1="${pad}" y1="${pad}" x2="${width - pad}" y2="${pad}" stroke="var(--hairline)"></line>
    <text class="axis-label" x="${pad}" y="${pad - 10}" fill="var(--muted)" font-size="10px">${formatR(max)}</text>
    <line class="zero-line" x1="${pad}" y1="${zeroY}" x2="${width - pad}" y2="${zeroY}" stroke="var(--hairline-strong)"></line>
    <text class="axis-label" x="${pad}" y="${zeroY - 8}" fill="var(--muted)" font-size="10px">0R</text>
    <text class="axis-label" x="${pad}" y="${height - 8}" fill="var(--muted)" font-size="10px">${formatR(min)}</text>
    
    <!-- Current Curve (Dashed Blue) -->
    ${currentPoints.length ? `<polyline fill="none" stroke="var(--blue)" stroke-width="2" stroke-dasharray="5,5" points="${currentPath}"></polyline>` : ''}
    
    <!-- Projected Curve (Solid Green) -->
    ${projectedPoints.length ? `<polyline fill="none" stroke="var(--green)" stroke-width="3" points="${projectedPath}"></polyline>` : ''}
  `;
}

function initCollapsiblePanels() {
  const panels = document.querySelectorAll(".panel");
  panels.forEach((panel, idx) => {
    const head = panel.querySelector(".panel-head");
    if (!head) return;
    if (head.querySelector(".panel-collapse-btn")) return;
    
    const titleText = head.querySelector("h2")?.textContent || head.querySelector("h3")?.textContent || "";
    const key = "trd-panel-collapsed-" + (panel.id || titleText.replace(/[^a-zA-Z0-9]/g, "") || idx);
    
    const isCollapsed = localStorage.getItem(key) === "true";
    if (isCollapsed) {
      panel.classList.add("is-collapsed");
    }
    
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "panel-collapse-btn";
    btn.innerHTML = isCollapsed ? "▲" : "▼";
    btn.title = "Toggle collapse";
    
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      playSound("click");
      const currentlyCollapsed = panel.classList.toggle("is-collapsed");
      btn.innerHTML = currentlyCollapsed ? "▲" : "▼";
      localStorage.setItem(key, String(currentlyCollapsed));
    });
    
    head.appendChild(btn);
  });
}

function initLayoutListeners() {
  console.log("initLayoutListeners: Initializing click and layout listeners...");
  
  // Carousel range sliders dynamic text updates
  document.querySelector('[name="carouselDragSensitivity"]')?.addEventListener("input", (e) => {
    const val = document.getElementById("carouselDragSensVal");
    if (val) val.textContent = e.target.value;
  });
  document.querySelector('[name="carouselSnapFriction"]')?.addEventListener("input", (e) => {
    const val = document.getElementById("carouselSnapFricVal");
    if (val) val.textContent = e.target.value;
  });

  // Bottom Dock navigation
  document.querySelectorAll(".dock-item").forEach((button) => {
    console.log("initLayoutListeners: Registering click for dock item", button.dataset.dockModule);
    button.addEventListener("click", () => {
      console.log("initLayoutListeners: Dock item clicked:", button.dataset.dockModule);
      openModule(button.dataset.dockModule, button);
    });
  });
  
  // Top header "Log Trade" button
  document.getElementById("headerLogTradeBtn")?.addEventListener("click", () => {
    openSheet("tradeFormSheet");
  });

  // Workflow Tiles (Plan & Review) - CardNav collapsible style
  document.querySelectorAll(".workflow-tile").forEach((tile) => {
    tile.querySelector(".tile-summary-header")?.addEventListener("click", (e) => {
      e.stopPropagation();
      // Collapse other tiles
      document.querySelectorAll(".workflow-tile").forEach((other) => {
        if (other !== tile) other.classList.remove("expanded");
      });
      tile.classList.toggle("expanded");
    });
  });

  document.getElementById("openPlanSheetBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openSheet("planSheet");
  });
  document.getElementById("openReviewSheetBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openSheet("reviewSheet");
  });

  // Sheet close buttons
  document.querySelectorAll(".sheet-close").forEach((button) => {
    button.addEventListener("click", (event) => {
      const backdrop = event.currentTarget.closest(".sheet-backdrop");
      if (backdrop) closeSheet(backdrop.id);
    });
  });

  // Sheet backdrop clicks to close (click outside card)
  document.querySelectorAll(".sheet-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        closeSheet(backdrop.id);
      }
    });
  });

  // Esc key closure
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const activeSheet = document.querySelector(".sheet-backdrop.active");
      if (activeSheet) {
        closeSheet(activeSheet.id);
      }
    }
  });
}

async function initApp() {
  try {
    const APP_VERSION = "v92-cache-purge";
    try {
      if (localStorage.getItem("trd_app_version") !== APP_VERSION) {
        localStorage.setItem("trd_app_version", APP_VERSION);
        if ("caches" in window) {
          caches.keys().then(keys => {
            keys.forEach(k => {
              if (!k.includes("v92")) caches.delete(k);
            });
          });
        }
      }
    } catch (e) {}

    console.log("initApp: Starting application initialization...");
    state = await loadState();
    window.state = state;
    console.log("initApp: State loaded successfully");
    await saveState(); // Ensure initialized defaults or migrated data are saved
    renderAll();
    console.log("initApp: Main rendering complete");
    resetTradeForm();
    
    // Boot up the main app (overview) so the DOM is laid out behind the glass
    openModule("overview");
    // Immediately overlay the 3D Welcome Launcher
    openModule("landing-gallery");
    console.log("initApp: Opened overview behind landing gallery overlay");
    
    // Phase 5 & 6 Initializations
    if (window.initCSS3DCarousel) {
      window.initCSS3DCarousel();
    } else {
      window.addEventListener('gallery-ready', () => {
        window.initCSS3DCarousel();
      });
    }
    
    initCardSpotlightHover();
    initCalendarHover();
    initMacDock();
    initRewardListeners();
    initLayoutListeners();
    console.log("initApp: Listeners and modules initialized successfully");
    
    const tradeForm = document.getElementById("tradeForm");
    if (tradeForm) {
      ["change", "input"].forEach((evtName) => {
        tradeForm.elements.openTime?.addEventListener(evtName, updateRedNewsHUD);
        tradeForm.elements.date?.addEventListener(evtName, updateRedNewsHUD);
      });
    }

    updateStorageEstimate();
    updateSyncStatus();
    
    // Auto-backup reminder check
    if (state.preferences.backupReminder !== false && state.trades.length >= 10) {
      const lastBackup = state.preferences.lastBackupAt ? new Date(state.preferences.lastBackupAt) : null;
      const daysSinceBackup = lastBackup ? (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
      if (daysSinceBackup >= 7) {
        toast("Your data hasn't been backed up recently. Please export a backup to secure your journal.", "loss");
      }
    }
    
    window.addEventListener("online", updateSyncStatus);
    window.addEventListener("offline", updateSyncStatus);
    
    // Register service worker with version update banner
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").then((reg) => {
        reg.update();
        if (reg.waiting) {
          showUpdateBanner(reg.waiting);
        }
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateBanner(newWorker);
            }
          });
        });
      }).catch((err) => console.log("SW failed", err));
      
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }
  } catch (err) {
    console.error("Initialization failed:", err);
    alert("Initialization Error:\n" + err.message + "\n\nStack:\n" + err.stack);
  }
}

// Intersection Observer for animated items (AnimatedList scale/fade transition)
const inViewObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in-view");
    } else {
      entry.target.classList.remove("in-view");
    }
  });
}, {
  threshold: 0.1,
  rootMargin: "0px 0px -20px 0px"
});

window.observeAnimatedItems = function() {
  document.querySelectorAll(".timeline-card, .quest-item, .sop-card").forEach(item => {
    item.classList.add("animated-in-view");
    inViewObserver.observe(item);
  });
};

// Scroll overlay gradients manager
window.updateScrollGradients = function(containerEl) {
  if (!containerEl) return;
  const listEl = containerEl.querySelector(".scroll-list");
  const topGrad = containerEl.querySelector(".top-gradient");
  const bottomGrad = containerEl.querySelector(".bottom-gradient");
  if (!listEl || !topGrad || !bottomGrad) return;
  
  const scrollTop = listEl.scrollTop;
  const scrollHeight = listEl.scrollHeight;
  const clientHeight = listEl.clientHeight;
  
  topGrad.style.opacity = String(Math.min(scrollTop / 45, 1));
  const bottomDistance = scrollHeight - (scrollTop + clientHeight);
  bottomGrad.style.opacity = String(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 45, 1));
};

window.initScrollListGradients = function() {
  document.querySelectorAll(".scroll-list-container").forEach(container => {
    const listEl = container.querySelector(".scroll-list");
    if (listEl && !listEl.dataset.hasScrollBound) {
      listEl.dataset.hasScrollBound = "true";
      listEl.addEventListener("scroll", () => window.updateScrollGradients(container), { passive: true });
    }
    window.updateScrollGradients(container);
    setTimeout(() => window.updateScrollGradients(container), 80);
  });
};

function getRelativeOffsetTop(container, element) {
  let offsetTop = 0;
  let current = element;
  while (current && current !== container && container.contains(current)) {
    offsetTop += current.offsetTop;
    current = current.offsetParent;
  }
  return offsetTop;
}

function formatFailedChecklist(checklist) {
  if (!checklist) return "";
  const labels = state.preferences.checklistLabels || defaultPreferences.checklistLabels;
  const mappings = {
    hasPlan: `No ${labels.hasPlan} 📋`,
    hasTrigger: `No ${labels.hasTrigger} 🎯`,
    hasStop: `No ${labels.hasStop} 🛑`,
    hasTarget: `No ${labels.hasTarget} 🏁`,
    emotionControlled: labels.emotionControlled.toLowerCase().includes("control") 
      ? `Loss of ${labels.emotionControlled} 🧠` 
      : `No ${labels.emotionControlled} 🧠`
  };
  const failed = [];
  for (const [key, val] of Object.entries(checklist)) {
    if (!val && mappings[key]) {
      failed.push(mappings[key]);
    }
  }
  return failed.map(tag => `<span class="tag" style="background: rgba(217, 74, 69, 0.1); color: var(--red); border: 1px solid rgba(217, 74, 69, 0.2); font-size: 11px; padding: 2px 8px; border-radius: 4px;">${safe(tag)}</span>`).join(" ");
}

function renderReflections() {
  const summaryTarget = document.getElementById("shameWallSummary");
  const listTarget = document.getElementById("shameTradesList");
  if (!summaryTarget || !listTarget) return;

  const violationTrades = state.trades.filter(t => getTradeRuleStatus(t) === "violated");
  violationTrades.sort((a, b) => b.date.localeCompare(a.date));

  if (violationTrades.length === 0) {
    summaryTarget.innerHTML = `
      <div class="zero-state-card" style="padding: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: rgba(52, 199, 89, 0.05); border: 1px dashed rgba(52, 199, 89, 0.3); border-radius: 16px; width: 100%; box-sizing: border-box;">
        <div style="font-size: 48px; margin-bottom: 12px;">🛡️</div>
        <h3>Perfect Discipline!</h3>
        <p style="color: var(--muted); font-size: 14px; margin: 0;">You have zero SOP rule violations logged. Keep up this immaculate execution standard!</p>
      </div>
    `;
    listTarget.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 40px 0; font-size: 14px;">No broken rules in your timeline.</div>`;
    return;
  }

  const totalPnLLeak = violationTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalRLeak = violationTrades.reduce((sum, t) => sum + rValue(t), 0);
  const count = violationTrades.length;
  
  // Find most common emotion
  const emotions = violationTrades.map(t => t.emotion).filter(Boolean);
  const emotionCounts = emotions.reduce((acc, emo) => {
    acc[emo] = (acc[emo] || 0) + 1;
    return acc;
  }, {});
  const topEmotion = Object.keys(emotionCounts).sort((a, b) => emotionCounts[b] - emotionCounts[a])[0] || "None";

  summaryTarget.innerHTML = `
    <div class="insight-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 14px;">
      ${insightCard("Violations Count", `${count} trades`, `${Math.round(count / Math.max(state.trades.length, 1) * 100)}% of total trades`)}
      ${insightCard("Total R Leakage", formatR(totalRLeak), "R multiple lost")}
      ${insightCard("Financial Leakage", `$${totalPnLLeak.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, "Net P&L of rule breaks", "largestLoss")}
      ${insightCard("Trigger Emotion", topEmotion, emotions.length ? `Prevalent feeling (${emotionCounts[topEmotion] || 0} times)` : "No emotion logged")}
    </div>
  `;

  listTarget.innerHTML = violationTrades.map(t => {
    const failedChecksHtml = formatFailedChecklist(t.checklist);
    const pnlClass = t.pnl < 0 ? "bad" : t.pnl > 0 ? "good" : "muted";
    
    return `
      <div class="shame-trade-card" data-trade-id="${t.id}">
        <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong style="font-size: 16px; color: var(--ink);">${safe(t.date)} · ${safe(t.symbol)} ${safe(t.direction)}</strong>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 4px 0 0 0;">
              Setup: <strong>${safe(t.setup)}</strong> · Account: <strong>${safe(accountName(t.accountId))}</strong>
            </p>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
            <strong class="tag ${pnlClass}" style="font-size: 14px; font-weight: 700; padding: 4px 10px; border-radius: 999px;">
              ${t.pnl ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl}` : "$0"} (${formatR(rValue(t))})
            </strong>
            <span style="font-size: 12px; color: var(--muted); margin-top: 4px;">Emotion: <strong style="color: var(--red);">${safe(t.emotion || "Unspecified")}</strong></span>
          </div>
        </div>
        
        ${failedChecksHtml ? `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">${failedChecksHtml}</div>` : ""}
        
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; padding: 10px; border-radius: 10px; background: rgba(0, 0, 0, 0.02); border-left: 3px solid rgba(217, 74, 69, 0.3); margin-top: 8px;">
          <strong>Log Note:</strong> ${safe(t.exitNote || t.note || "No execution details logged.")}
        </div>
        
        <div class="reflection-editor" style="display: flex; flex-direction: column; gap: 6px; margin-top: 10px;">
          <strong style="font-size: 13px; color: var(--ink);">🧠 自我反省与改进计划 (Self-Reflection):</strong>
          <textarea placeholder="Write down why you broke the rule, how it felt, and what action you will take to prevent this next time..." rows="3" style="width: 100%; font-size: 13px; line-height: 1.5; padding: 10px; border-radius: 10px; border: 1px solid var(--hairline); background: white; resize: vertical; box-sizing: border-box;">${safe(t.reflection || "")}</textarea>
          <button class="primary-button compact save-reflection-btn" data-trade-id="${t.id}" style="align-self: flex-end; width: auto; min-width: 120px; padding: 6px 14px; font-size: 12px; border-radius: 999px; background: var(--red); border: none; color: white; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px;">
            <span>💾 Save Reflection</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function scrollSelectedItemIntoView(container, selectedItem) {
  if (!container || !selectedItem) return;
  const extraMargin = 50;
  const containerScrollTop = container.scrollTop;
  const containerHeight = container.clientHeight;
  const itemTop = getRelativeOffsetTop(container, selectedItem);
  const itemBottom = itemTop + selectedItem.offsetHeight;
  
  if (itemTop < containerScrollTop + extraMargin) {
    container.scrollTo({ top: itemTop - extraMargin, behavior: "smooth" });
  } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
    container.scrollTo({
      top: itemBottom - containerHeight + extraMargin,
      behavior: "smooth"
    });
  }
}

/* ==========================================================================
   ForexFactory High-Impact Red Folder Economic Calendar & Top News Bar
   ========================================================================== */
let currentRedNewsCurrencyFilter = "All";

function initNewsBar() {
  if (window.newsBarInitialized) {
    updateNewsBarCountdown();
    renderHomeRedNewsWidget();
    return;
  }
  window.newsBarInitialized = true;

  const headerNewsBtn = document.getElementById("headerNewsBtn");
  const newsBarViewBtn = document.getElementById("newsBarViewBtn");
  const closeRedNewsModalBtn = document.getElementById("closeRedNewsModalBtn");
  const newsCurrencyFilters = document.getElementById("newsCurrencyFilters");

  if (headerNewsBtn) headerNewsBtn.onclick = () => openRedNewsModal();
  if (newsBarViewBtn) newsBarViewBtn.onclick = () => openRedNewsModal();
  if (closeRedNewsModalBtn) closeRedNewsModalBtn.onclick = () => closeRedNewsModal();

  if (newsCurrencyFilters) {
    newsCurrencyFilters.querySelectorAll(".filter-chip").forEach(btn => {
      btn.onclick = (e) => {
        newsCurrencyFilters.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        currentRedNewsCurrencyFilter = e.target.getAttribute("data-currency") || "All";
        renderRedNewsTable(currentRedNewsCurrencyFilter);
      };
    });
  }

  const tradeForm = document.getElementById("tradeForm");
  if (tradeForm) {
    ["change", "input"].forEach(evtName => {
      tradeForm.addEventListener(evtName, () => checkTradeFormNewsRisk());
    });
  }

  // Expose news management to global scope for inline HTML handlers
  window.addRedNewsEvent = addRedNewsEvent;
  window.deleteRedNewsEvent = deleteRedNewsEvent;
  window.clearPastRedNewsEvents = clearPastRedNewsEvents;

  window.submitRedNewsEvent = function(event) {
    event.preventDefault();
    const date = document.getElementById("rnDate")?.value?.trim();
    const time = document.getElementById("rnTime")?.value?.trim();
    const currency = document.getElementById("rnCurrency")?.value?.trim();
    const title = document.getElementById("rnTitle")?.value?.trim();
    const forecast = document.getElementById("rnForecast")?.value?.trim();
    const previous = document.getElementById("rnPrevious")?.value?.trim();
    if (!date || !time || !title) return;
    addRedNewsEvent({ date, time, currency, title, forecast, previous });
    document.getElementById("rnTitle").value = "";
    document.getElementById("rnForecast").value = "";
    document.getElementById("rnPrevious").value = "";
    renderRedNewsTable(currentRedNewsCurrencyFilter);
    renderHomeRedNewsWidget();
    updateNewsBarCountdown();
  };

  // Global sync function for button and auto-sync
  window.syncFFNews = async function(force = false) {
    const syncBtn = document.getElementById("ffSyncBtn");
    const syncStatus = document.getElementById("ffSyncStatus");
    if (syncBtn) { syncBtn.disabled = true; syncBtn.textContent = "⏳ Syncing..."; }
    if (syncStatus) syncStatus.textContent = "Connecting to ForexFactory...";

    if (force && window.forexFactoryRedNewsEngine) {
      // Clear the 1h cache to force a fresh fetch
      try { localStorage.removeItem("trd_ff_sync_cache_v1"); } catch(e) {}
    }

    const result = await window.forexFactoryRedNewsEngine?.syncFromFeed({ onlyHighImpact: true, clearExisting: force });
    if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = "🔄 Sync Now"; }

    if (result?.success) {
      const msg = result.added > 0
        ? `✅ Added ${result.added} new high-impact events (${result.total} total this week)`
        : `✅ Already up to date (${result.total} events this week)`;
      if (syncStatus) syncStatus.textContent = msg;
      renderRedNewsTable(currentRedNewsCurrencyFilter);
      renderHomeRedNewsWidget();
      updateNewsBarCountdown();
    } else {
      if (syncStatus) syncStatus.textContent = `⚠️ Sync failed: ${result?.error || "Network error"}. You can add events manually below.`;
    }
  };

  updateNewsBarCountdown();
  renderHomeRedNewsWidget();
  if (!window.newsBarTimer) {
    window.newsBarTimer = setInterval(updateNewsBarCountdown, 1000);
  }
}

function updateNewsBarCountdown() {
  const countdownEl = document.getElementById("newsBarCountdown");
  if (!countdownEl || !window.forexFactoryRedNewsEngine) return;

  const nextEvt = window.forexFactoryRedNewsEngine.getNextRedEvent();
  if (!nextEvt) {
    countdownEl.textContent = "No upcoming high-impact red news";
    return;
  }

  const now = new Date();
  const diffMs = nextEvt.eventDate - now;

  if (diffMs <= 0) {
    countdownEl.textContent = `🔴 ${nextEvt.currency} ${nextEvt.title} (Released Now)`;
  } else {
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
    const hStr = hours > 0 ? `${hours}h ` : "";
    const mStr = `${mins}m `;
    const sStr = `${secs}s`;
    countdownEl.textContent = `Next Red Event: ${nextEvt.currency} ${nextEvt.title} in ${hStr}${mStr}${sStr} (${nextEvt.time})`;
  }
}

function openRedNewsModal() {
  renderRedNewsTable(currentRedNewsCurrencyFilter);
  openSheet("redNewsModal");
  // Auto-sync from ForexFactory when opening the modal (respects 1h rate-limit cache)
  if (window.syncFFNews) window.syncFFNews(false);
}

function closeRedNewsModal() {
  closeSheet("redNewsModal");
}

function renderRedNewsTable(currency = "All") {
  const tbody = document.getElementById("redNewsTableBody");
  if (!tbody || !window.forexFactoryRedNewsEngine) return;

  const events = window.forexFactoryRedNewsEngine.filterByCurrency(currency);

  // Always show the add-event form in a fixed area above the table
  const addFormEl = document.getElementById("redNewsAddForm");
  if (addFormEl) addFormEl.style.display = "";

  if (!events.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px 24px;">
      <div style="font-size:2rem; margin-bottom:10px;">🗓️</div>
      <div style="font-weight:700; margin-bottom:6px;">No events added yet${currency !== 'All' ? ' for ' + safe(currency) : ''}</div>
      <div style="color:var(--muted); font-size:0.82rem; max-width:320px; margin:0 auto; line-height:1.5;">
        Go to <strong>forexfactory.com/calendar</strong>, find the red-folder 🔴 events for the week,<br>and add them using the form above.
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = events.map(e => {
    const currClass = e.currency.toLowerCase();
    const actualClass = !e.actual ? "style='color:var(--muted);'" : e.actual.includes("-") ? "style='color:#ef4444; font-weight:700;'" : "style='color:#22c55e; font-weight:700;'";
    return `
      <tr>
        <td><strong>${safe(e.date)}</strong> <span style="color:var(--muted); margin-left:4px;">${safe(e.time)}</span></td>
        <td><span class="badge-currency ${currClass}">${safe(e.currency)}</span></td>
        <td><span class="red-folder-icon" title="High Impact">🔴</span></td>
        <td><strong>${safe(e.title)}</strong></td>
        <td ${actualClass}>${safe(e.actual || "—")}</td>
        <td>${safe(e.forecast || "—")}</td>
        <td>${safe(e.previous || "—")}</td>
        <td><button onclick="window.forexFactoryRedNewsEngine.deleteEvent('${safe(e.id)}'); renderRedNewsTable(currentRedNewsCurrencyFilter); renderHomeRedNewsWidget(); updateNewsBarCountdown();" style="background:none; border:none; cursor:pointer; color:var(--red); font-size:1rem; padding:2px 6px;" title="Delete event">✕</button></td>
      </tr>
    `;
  }).join("");
}

function renderHomeRedNewsWidget() {
  const bodyEl = document.getElementById("homeRedNewsBody");
  if (!bodyEl || !window.forexFactoryRedNewsEngine) return;

  const now = new Date();
  const todayStr = todayISO();
  const allEvents = window.forexFactoryRedNewsEngine.getAllRedEvents();
  
  let displayEvents = allEvents.filter(e => e.date === todayStr);
  if (!displayEvents.length) {
    displayEvents = allEvents.filter(e => new Date(`${e.date}T${e.time}:00`) > now).slice(0, 3);
  }

  if (!displayEvents.length) {
    bodyEl.innerHTML = `<div style="color:var(--muted); font-size:0.8rem; padding:8px 0; line-height:1.5;">
      No upcoming events. Open the <button onclick="openRedNewsModal()" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:0.8rem;padding:0;text-decoration:underline;">News Calendar</button> to add real red-folder events from ForexFactory.
    </div>`;
    return;
  }

  bodyEl.innerHTML = displayEvents.map(evt => {
    const currClass = evt.currency.toLowerCase();
    const actualText = evt.actual ? `Actual: ${safe(evt.actual)}` : `Est: ${safe(evt.forecast || "—")}`;
    const dateLabel = evt.date === todayStr ? evt.time : `${evt.date.slice(5)} ${evt.time}`;
    return `
      <div class="bento-news-row" onclick="window.openRedNewsModal()" style="cursor:pointer;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="badge-currency ${currClass}">${safe(evt.currency)}</span>
          <span class="red-folder-icon">🔴</span>
          <strong>${safe(evt.title)}</strong>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:0.78rem; color:var(--muted);">${actualText}</span>
          <strong style="color:var(--text);">${safe(dateLabel)}</strong>
        </div>
      </div>
    `;
  }).join("");
}

function checkTradeFormNewsRisk() {
  const form = document.getElementById("tradeForm");
  const alertEl = document.getElementById("tradeFormNewsAlert");
  const titleEl = document.getElementById("tradeFormNewsTitle");
  const metaEl = document.getElementById("tradeFormNewsMeta");
  if (!form || !alertEl || !window.forexFactoryRedNewsEngine) return;

  const dateVal = form.date?.value || form.openTime?.value || "";
  if (!dateVal) {
    alertEl.classList.add("hidden");
    return;
  }

  const nearNews = window.forexFactoryRedNewsEngine.isTradeNearRedNews(dateVal);
  if (nearNews) {
    const evt = nearNews.event;
    alertEl.classList.remove("hidden");
    if (titleEl) titleEl.textContent = `🔴 ${evt.currency} High Impact Event (${evt.title})`;
    if (metaEl) {
      if (nearNews.isAllDay) {
        metaEl.textContent = `High-impact event scheduled for today (${evt.date}) — All Day / Tentative timing.`;
      } else if (nearNews.sameDay) {
        metaEl.textContent = `Red folder news scheduled for ${evt.date} at ${evt.time}.`;
      } else {
        metaEl.textContent = `Trade logged within ${nearNews.diffMins} minutes of ${evt.title} (${evt.time}).`;
      }
    }
  } else {
    alertEl.classList.add("hidden");
  }
}

function openCommandPaletteModal() {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modSymbol = isMac ? "⌘" : "Ctrl";

  const commandHtml = `
    <div class="command-palette-list" style="display:flex; flex-direction:column; gap:10px; margin:10px 0;">
      <button class="ghost-button" onclick="closeModal(); openSheet('tradeFormSheet');" style="display:flex; align-items:center; justify-content:space-between; text-align:left; padding:12px 16px; border-radius:12px;">
        <span>🚀 Start New Trade (开启新交易)</span>
        <kbd style="font-size:11px; padding:2px 6px; background:var(--hairline); border-radius:4px;">${modSymbol} + N</kbd>
      </button>
      <button class="ghost-button" onclick="closeModal(); openModule('journal');" style="display:flex; align-items:center; justify-content:space-between; text-align:left; padding:12px 16px; border-radius:12px;">
        <span>📖 Open Journal Trail (打开交易日志)</span>
        <kbd style="font-size:11px; padding:2px 6px; background:var(--hairline); border-radius:4px;">Journal</kbd>
      </button>
      <button class="ghost-button" onclick="closeModal(); openModule('review');" style="display:flex; align-items:center; justify-content:space-between; text-align:left; padding:12px 16px; border-radius:12px;">
        <span>📊 Open Analytics & 2D Matrix (打开复盘矩阵)</span>
        <kbd style="font-size:11px; padding:2px 6px; background:var(--hairline); border-radius:4px;">Analytics</kbd>
      </button>
      <button class="ghost-button" onclick="closeModal(); window.exportJSONBackup();" style="display:flex; align-items:center; justify-content:space-between; text-align:left; padding:12px 16px; border-radius:12px;">
        <span>⚡ 1-Click JSON Backup (下载紧急安全备份)</span>
        <kbd style="font-size:11px; padding:2px 6px; background:var(--hairline); border-radius:4px;">${modSymbol} + S</kbd>
      </button>
      <button class="ghost-button" onclick="closeModal(); openModule('settings');" style="display:flex; align-items:center; justify-content:space-between; text-align:left; padding:12px 16px; border-radius:12px;">
        <span>⚙️ Open System Preferences (系统设置)</span>
        <kbd style="font-size:11px; padding:2px 6px; background:var(--hairline); border-radius:4px;">Settings</kbd>
      </button>
    </div>
  `;

  openModal("Quick Command Palette", "Navigation & Shortcuts", commandHtml);
}

window.openCommandPaletteModal = openCommandPaletteModal;

window.addEventListener("keydown", (e) => {
  const modifier = e.metaKey || e.ctrlKey;

  // 1. Cmd/Ctrl + N: Start Trade
  if (modifier && e.key.toLowerCase() === "n") {
    e.preventDefault();
    if (window.openSheet) window.openSheet("tradeFormSheet");
    return;
  }

  // 2. Cmd/Ctrl + K: Quick Command Palette
  if (modifier && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openCommandPaletteModal();
    return;
  }

  // 3. Cmd/Ctrl + S: Export JSON Backup or Save Form
  if (modifier && e.key.toLowerCase() === "s") {
    e.preventDefault();
    const tradeSheet = document.getElementById("tradeFormSheet");
    if (tradeSheet && tradeSheet.classList.contains("active")) {
      document.getElementById("tradeForm")?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    } else if (window.exportJSONBackup) {
      window.exportJSONBackup();
    }
    return;
  }

  // 4. Escape key: Dismiss sheet
  if (e.key === "Escape") {
    const activeSheets = document.querySelectorAll(".sheet-backdrop.active");
    if (activeSheets.length) {
      const topSheet = activeSheets[activeSheets.length - 1];
      if (topSheet.id) closeSheet(topSheet.id);
    }
  }
});

// 5. Global Clipboard Paste Listener (Cmd+V / Ctrl+V from TradingView)
window.addEventListener("paste", async (e) => {
  const activeTag = document.activeElement?.tagName?.toLowerCase();
  if (activeTag === "input" || activeTag === "textarea") return;

  const items = (e.clipboardData || window.clipboardData)?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      const file = items[i].getAsFile();
      if (!file) continue;

      e.preventDefault();
      if (window.openSheet) window.openSheet("tradeFormSheet");

      try {
        const base64 = await fileToDataUrl(file);
        if (base64) {
          const form = document.getElementById("tradeForm");
          if (form) {
            let container = document.getElementById("tradeFormUploadedImagesPreview");
            if (!container) {
              container = document.createElement("div");
              container.id = "tradeFormUploadedImagesPreview";
              container.style.cssText = "display:flex; gap:8px; overflow-x:auto; margin:10px 0; padding:4px;";
              form.querySelector("input[name='imageUrl']")?.parentElement?.after(container);
            }
            const imgEl = document.createElement("img");
            imgEl.src = base64;
            imgEl.style.cssText = "height:70px; border-radius:8px; border:1px solid #30d158; box-shadow:0 4px 12px rgba(0,0,0,0.3);";
            container.appendChild(imgEl);

            if (window.toast) window.toast("📋 Chart screenshot pasted into journal!", "success");
            if (typeof playSound === "function") playSound("bell");
          }
        }
      } catch (err) {
        console.error("Paste error:", err);
      }
      break;
    }
  }
});

initApp();
