(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TRDTradeValidation = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function present(value) {
    return String(value ?? '').trim() !== '';
  }

  function validDateTime(value) {
    return present(value) && Number.isFinite(Date.parse(String(value)));
  }

  function validateDraft(draft = {}) {
    const errors = [];
    const add = (field, code, message) => errors.push({ field, code, message });
    const hasPnl = present(draft.pnl);
    const hasCloseTime = present(draft.closeTime);
    const completing = draft.currentStatus === 'closed' || hasPnl || hasCloseTime;
    const risk = Number(draft.risk);

    if (!Number.isFinite(risk) || risk <= 0) add('risk', 'risk_positive', 'Risk must be a positive amount.');
    if (!validDateTime(draft.openTime)) add('openTime', 'open_time_required', 'Enter a valid opening time.');
    if (completing && !hasCloseTime) add('closeTime', 'close_time_required', 'A completed trade needs a closing time.');
    else if (hasCloseTime && !validDateTime(draft.closeTime)) add('closeTime', 'close_time_invalid', 'Enter a valid closing time.');
    if (completing && !hasPnl) add('pnl', 'pnl_required', 'A completed trade needs Net P&L, including 0 for breakeven.');
    else if (hasPnl && !Number.isFinite(Number(draft.pnl))) add('pnl', 'pnl_invalid', 'Net P&L must be a valid number.');
    if (validDateTime(draft.openTime) && validDateTime(draft.closeTime) && Date.parse(draft.closeTime) < Date.parse(draft.openTime)) {
      add('closeTime', 'close_before_open', 'Closing time cannot be earlier than opening time.');
    }
    for (const field of ['maeR', 'mfeR']) {
      if (present(draft[field]) && !Number.isFinite(Number(draft[field]))) {
        add(field, `${field}_invalid`, `${field === 'maeR' ? 'MAE' : 'MFE'} must be a valid R value.`);
      }
    }
    return { valid: errors.length === 0, completing, errors };
  }

  return { present, validDateTime, validateDraft };
});
