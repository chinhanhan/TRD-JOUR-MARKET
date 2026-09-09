(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TRDJournalFilter = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function fold(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .trim();
  }

  function recordDate(trade) {
    return String(trade?.date || trade?.openTime || '').slice(0, 10);
  }

  function searchableText(trade) {
    const audit = trade?.audit || {};
    const snapshot = trade?.sopSnapshot || {};
    return fold([
      trade?.symbol, trade?.setup, trade?.direction, trade?.grade,
      trade?.session, trade?.emotion, trade?.note, trade?.entryPlan,
      trade?.entryNote, trade?.stopPlan, trade?.targetPlan, trade?.exitNote,
      trade?.reflection, ...(Array.isArray(trade?.mistakes) ? trade.mistakes : []),
      audit.compliance, audit.stopLoss, audit.takeProfit, audit.notes,
      snapshot.name, ...(Array.isArray(snapshot.checklist) ? snapshot.checklist : [])
    ].join(' '));
  }

  function ruleStatus(trade) {
    if (trade?.ruleStatus) return trade.ruleStatus;
    if (['incomplete', 'Incomplete', 'orange'].includes(trade?.rule)) return 'incomplete';
    if ([false, 'false', 'No', 'broken'].includes(trade?.rule)) return 'violated';
    return 'followed';
  }

  function resultStatus(trade) {
    if (trade?.status === 'open') return 'open';
    const pnl = Number(trade?.pnl);
    if (!Number.isFinite(pnl) || pnl === 0) return 'breakeven';
    return pnl > 0 ? 'win' : 'loss';
  }

  function matches(trade, filters = {}) {
    const queryTokens = fold(filters.query).split(/\s+/).filter(Boolean);
    if (queryTokens.length) {
      const haystack = searchableText(trade);
      if (!queryTokens.every(token => haystack.includes(token))) return false;
    }
    if (filters.setup && filters.setup !== 'All' && trade?.setup !== filters.setup) return false;
    if (filters.rule && filters.rule !== 'All' && ruleStatus(trade) !== filters.rule) return false;
    if (filters.status && filters.status !== 'All' && trade?.status !== filters.status) return false;
    if (filters.session && filters.session !== 'All') {
      const session = trade?.session === 'Asian' ? 'Asia' : (trade?.session || 'Other');
      if (session !== filters.session) return false;
    }
    if (filters.outcome && filters.outcome !== 'All' && resultStatus(trade) !== filters.outcome) return false;
    if (filters.grade && filters.grade !== 'All' && trade?.grade !== filters.grade) return false;
    if (filters.emotion && filters.emotion !== 'All' && trade?.emotion !== filters.emotion) return false;
    if (filters.account && !['All', 'Current'].includes(filters.account) && trade?.accountId !== filters.account) return false;
    const date = recordDate(trade);
    if (filters.dateFrom && (!date || date < filters.dateFrom)) return false;
    if (filters.dateTo && (!date || date > filters.dateTo)) return false;
    return true;
  }

  function filterTrades(trades, filters) {
    return (Array.isArray(trades) ? trades : []).filter(trade => matches(trade, filters));
  }

  function tradeR(trade) {
    const risk = Number(trade?.risk);
    const pnl = Number(trade?.pnl);
    return Number.isFinite(risk) && risk > 0 && Number.isFinite(pnl) ? pnl / risk : 0;
  }

  function chronology(trade) {
    return String(trade?.closeTime || trade?.closedAt || trade?.date || '');
  }

  function compareNewest(a, b) {
    return chronology(b).localeCompare(chronology(a)) || String(b?.id || '').localeCompare(String(a?.id || ''));
  }

  function sortTrades(trades, order = 'newest') {
    const result = Array.isArray(trades) ? trades.slice() : [];
    if (order === 'oldest') return result.sort((a, b) => -compareNewest(a, b));
    if (order === 'bestR') return result.sort((a, b) => tradeR(b) - tradeR(a) || compareNewest(a, b));
    if (order === 'worstR') return result.sort((a, b) => tradeR(a) - tradeR(b) || compareNewest(a, b));
    return result.sort(compareNewest);
  }

  return { fold, recordDate, searchableText, ruleStatus, resultStatus, matches, filterTrades, tradeR, chronology, sortTrades };
});
