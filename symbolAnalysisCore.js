(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TRDSymbolAnalysis = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function normalizeSymbol(value) {
    return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
  }

  function symbolLabel(value) {
    return normalizeSymbol(value) || 'Unspecified symbol';
  }

  function closeDate(trade) {
    return String(trade?.closeTime || trade?.closedAt || trade?.date || '').slice(0, 10);
  }

  function ruleStatus(trade) {
    if (trade?.ruleStatus) return trade.ruleStatus;
    if (['incomplete', 'Incomplete', 'orange'].includes(trade?.rule)) return 'incomplete';
    if ([false, 'false', 'No', 'broken'].includes(trade?.rule)) return 'violated';
    return 'followed';
  }

  function normalizedSession(trade) {
    return trade?.session === 'Asian' ? 'Asia' : (trade?.session || 'Other');
  }

  function matchesContext(trade, filters = {}) {
    if (filters.account && !['All', 'Current'].includes(filters.account) && trade?.accountId !== filters.account) return false;
    if (filters.session && filters.session !== 'All' && normalizedSession(trade) !== filters.session) return false;
    if (filters.grade && filters.grade !== 'All' && trade?.grade !== filters.grade) return false;
    if (filters.emotion && filters.emotion !== 'All' && trade?.emotion !== filters.emotion) return false;
    if (filters.setup && filters.setup !== 'All' && trade?.setup !== filters.setup) return false;
    if (filters.rule && filters.rule !== 'All' && ruleStatus(trade) !== filters.rule) return false;
    const date = closeDate(trade);
    if (filters.dateFrom && (!date || date < filters.dateFrom)) return false;
    if (filters.dateTo && (!date || date > filters.dateTo)) return false;
    return true;
  }

  function tradeR(trade) {
    const risk = Number(trade?.risk);
    const pnl = Number(trade?.pnl);
    return Number.isFinite(risk) && risk > 0 && Number.isFinite(pnl) ? pnl / risk : 0;
  }

  function outcome(trade) {
    const pnl = Number(trade?.pnl);
    if (!Number.isFinite(pnl) || pnl === 0) return 'breakeven';
    return pnl > 0 ? 'win' : 'loss';
  }

  function sampleLevel(count) {
    if (count < 30) return 'insufficient';
    if (count < 50) return 'preliminary';
    return 'established';
  }

  function metrics(trades) {
    const source = (Array.isArray(trades) ? trades : []).filter(trade => trade?.status !== 'open');
    const wins = source.filter(trade => outcome(trade) === 'win');
    const losses = source.filter(trade => outcome(trade) === 'loss');
    const breakevens = source.filter(trade => outcome(trade) === 'breakeven');
    const pnl = source.map(trade => Number.isFinite(Number(trade?.pnl)) ? Number(trade.pnl) : 0);
    const validRTrades = source.filter(trade => Number.isFinite(Number(trade?.risk)) && Number(trade.risk) > 0 && Number.isFinite(Number(trade?.pnl)));
    const rs = validRTrades.map(tradeR);
    const grossWinR = validRTrades.filter(trade => outcome(trade) === 'win').reduce((sum, trade) => sum + Math.max(0, tradeR(trade)), 0);
    const grossLossR = validRTrades.filter(trade => outcome(trade) === 'loss').reduce((sum, trade) => sum + Math.min(0, tradeR(trade)), 0);
    const decisive = wins.length + losses.length;
    const totalPnL = pnl.reduce((sum, value) => sum + value, 0);
    const totalR = rs.reduce((sum, value) => sum + value, 0);
    let curve = 0;
    let peak = 0;
    let maxDrawdown = 0;
    rs.forEach(value => {
      curve += value;
      peak = Math.max(peak, curve);
      maxDrawdown = Math.min(maxDrawdown, curve - peak);
    });
    return {
      count: source.length,
      wins: wins.length,
      losses: losses.length,
      breakevens: breakevens.length,
      decisiveCount: decisive,
      winRate: decisive ? wins.length / decisive : 0,
      totalPnL,
      averagePnL: source.length ? totalPnL / source.length : 0,
      totalR,
      validRCount: validRTrades.length,
      invalidRiskCount: source.length - validRTrades.length,
      averageR: validRTrades.length ? totalR / validRTrades.length : 0,
      expectancy: validRTrades.length ? totalR / validRTrades.length : 0,
      profitFactor: Math.abs(grossLossR) ? grossWinR / Math.abs(grossLossR) : grossWinR ? Infinity : 0,
      maxDrawdown,
      sampleLevel: sampleLevel(source.length)
    };
  }

  function groupRows(trades) {
    const groups = new Map();
    for (const trade of Array.isArray(trades) ? trades : []) {
      const key = normalizeSymbol(trade?.symbol);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(trade);
    }
    return [...groups.entries()].map(([key, list]) => {
      const closed = list.filter(trade => trade?.status !== 'open');
      return {
        key,
        label: key || 'Unspecified symbol',
        rankable: Boolean(key) && closed.length > 0,
        openCount: list.length - closed.length,
        trades: list,
        closedTrades: closed,
        ...metrics(closed)
      };
    });
  }

  function sortRows(rows, sort = 'expectancy') {
    const value = row => {
      if (sort === 'winRate') return row.winRate;
      if (sort === 'totalPnL') return row.totalPnL;
      if (sort === 'count') return row.count;
      return row.expectancy;
    };
    return (Array.isArray(rows) ? rows : []).slice().sort((a, b) => {
      if (a.rankable !== b.rankable) return a.rankable ? -1 : 1;
      return value(b) - value(a) || b.count - a.count || a.label.localeCompare(b.label);
    });
  }

  function analyze(trades, filters = {}, sort = 'expectancy') {
    const contextual = (Array.isArray(trades) ? trades : []).filter(trade => matchesContext(trade, filters));
    const rows = sortRows(groupRows(contextual), sort);
    return {
      trades: contextual,
      rows,
      overall: metrics(contextual),
      openCount: contextual.filter(trade => trade?.status === 'open').length
    };
  }

  function monthKey(trade) {
    return closeDate(trade).slice(0, 7) || 'Unknown';
  }

  function detailGroups(trades) {
    const group = keyFn => {
      const map = new Map();
      for (const trade of (Array.isArray(trades) ? trades : []).filter(item => item?.status !== 'open')) {
        const key = keyFn(trade) || 'Unknown';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(trade);
      }
      return [...map.entries()].map(([label, list]) => ({ label, ...metrics(list) }));
    };
    return {
      months: group(monthKey).sort((a, b) => a.label.localeCompare(b.label)),
      sessions: group(trade => normalizedSession(trade)).sort((a, b) => b.count - a.count),
      directions: group(trade => trade?.direction || 'Unknown').sort((a, b) => b.count - a.count)
    };
  }

  return {
    normalizeSymbol, symbolLabel, closeDate, matchesContext, tradeR, outcome,
    sampleLevel, metrics, groupRows, sortRows, analyze, detailGroups
  };
});
