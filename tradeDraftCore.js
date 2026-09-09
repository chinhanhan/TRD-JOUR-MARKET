(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TRDTradeDraft = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_TEXT_LENGTH = 50000;
  const FIELD_NAMES = Object.freeze([
    "sopId", "accountId", "date", "symbol", "openTime", "closeTime", "session", "setup",
    "direction", "risk", "entryPlan", "stopPlan", "targetPlan", "grade", "pnl", "maeR", "mfeR",
    "rule", "emotion", "hasPlan", "hasTrigger", "hasStop", "hasTarget", "emotionControlled",
    "auditCompliance", "auditEmotionScore", "auditStopLoss", "auditTakeProfit", "mistakes",
    "tradingViewUrl", "imageUrl", "exitNote", "note"
  ]);
  const CHECKBOX_FIELDS = Object.freeze(["hasPlan", "hasTrigger", "hasStop", "hasTarget", "emotionControlled"]);

  function storageKey(ownerUid) {
    return `trd-journey-trade-draft-v1:${ownerUid ? `user:${ownerUid}` : "guest"}`;
  }

  function cleanText(value, limit = MAX_TEXT_LENGTH) {
    return typeof value === "string" ? value.slice(0, limit) : String(value == null ? "" : value).slice(0, limit);
  }

  function createDraft(input = {}) {
    const source = input.values && typeof input.values === "object" ? input.values : {};
    const values = Object.create(null);
    for (const name of FIELD_NAMES) {
      if (name === "mistakes") {
        values[name] = Array.isArray(source[name]) ? source[name].slice(0, 30).map(value => cleanText(value, 200)) : [];
      } else if (CHECKBOX_FIELDS.includes(name)) {
        values[name] = Boolean(source[name]);
      } else {
        values[name] = cleanText(source[name]);
      }
    }
    const preflight = Array.isArray(input.preflight) ? input.preflight.slice(0, 100).map(item => ({
      text: cleanText(item?.text, 1000),
      checked: Boolean(item?.checked)
    })) : [];
    const savedAt = Number.isFinite(Number(input.savedAt)) ? Number(input.savedAt) : Date.now();
    return { version: VERSION, savedAt, values, preflight, advancedOpen: Boolean(input.advancedOpen) };
  }

  function readDraft(raw, options = {}) {
    let parsed;
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { return null; }
    if (!parsed || typeof parsed !== "object" || parsed.version !== VERSION) return null;
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const maxAgeMs = Number.isFinite(Number(options.maxAgeMs)) ? Number(options.maxAgeMs) : MAX_AGE_MS;
    const savedAt = Number(parsed.savedAt);
    if (!Number.isFinite(savedAt) || savedAt > now + 60000 || now - savedAt > maxAgeMs) return null;
    return createDraft({
      savedAt,
      values: parsed.values,
      preflight: parsed.preflight,
      advancedOpen: parsed.advancedOpen
    });
  }

  return { VERSION, MAX_AGE_MS, FIELD_NAMES, CHECKBOX_FIELDS, storageKey, createDraft, readDraft };
});
