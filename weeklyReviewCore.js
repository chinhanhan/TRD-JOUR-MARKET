(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TRDWeeklyReview = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function rValue(trade) {
    const risk = Number(trade?.risk);
    const pnl = Number(trade?.pnl);
    return Number.isFinite(risk) && risk > 0 && Number.isFinite(pnl) ? pnl / risk : 0;
  }

  function ruleStatus(trade) {
    if (trade?.ruleStatus) return trade.ruleStatus;
    if (['incomplete', 'Incomplete', 'orange'].includes(trade?.rule)) return 'incomplete';
    if ([false, 'false', 'No', 'broken'].includes(trade?.rule)) return 'violated';
    return 'followed';
  }

  function uniqueLabels(values) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(value => String(value || '').trim())
      .filter(Boolean))];
  }

  function strongestGroup(trades, key, minimumCount) {
    const groups = new Map();
    trades.forEach(trade => {
      const name = String(trade?.[key] || '').trim();
      if (!name) return;
      const current = groups.get(name) || { name, count: 0, totalR: 0 };
      current.count += 1;
      current.totalR += rValue(trade);
      groups.set(name, current);
    });
    return [...groups.values()]
      .filter(group => group.count >= minimumCount)
      .map(group => ({ ...group, expectancy: group.totalR / group.count }))
      .sort((a, b) => b.expectancy - a.expectancy || b.totalR - a.totalR || b.count - a.count || a.name.localeCompare(b.name))[0] || null;
  }

  function analyze(input, options = {}) {
    const minimumSample = Number.isInteger(options.minimumSample) ? Math.max(1, options.minimumSample) : 5;
    const minimumGroupSample = Number.isInteger(options.minimumGroupSample) ? Math.max(1, options.minimumGroupSample) : 2;
    const trades = (Array.isArray(input) ? input : []).filter(trade => trade?.status !== 'open');
    const sampleSize = trades.length;
    const mistakeMap = new Map();

    trades.forEach(trade => {
      const lossR = Math.max(0, -rValue(trade));
      const mistakes = uniqueLabels(trade?.mistakes);
      if (!lossR || !mistakes.length) return;
      const allocatedR = lossR / mistakes.length;
      mistakes.forEach(name => {
        const current = mistakeMap.get(name) || { name, costR: 0, count: 0 };
        current.costR += allocatedR;
        current.count += 1;
        mistakeMap.set(name, current);
      });
    });

    const mistakeCosts = [...mistakeMap.values()]
      .sort((a, b) => b.costR - a.costR || b.count - a.count || a.name.localeCompare(b.name));
    const topMistake = mistakeCosts[0] || null;
    const bestSetup = strongestGroup(trades, 'setup', minimumGroupSample);
    const bestSession = strongestGroup(trades, 'session', minimumGroupSample);
    const violatedCount = trades.filter(trade => ruleStatus(trade) === 'violated').length;
    const remaining = Math.max(0, minimumSample - sampleSize);
    let focus;

    if (sampleSize < minimumSample) {
      focus = {
        type: 'sample',
        title: `Collect ${remaining} more reviewed trade${remaining === 1 ? '' : 's'}`,
        detail: `Reach ${minimumSample} closed trades before turning this week's signals into a process change.`
      };
    } else if (topMistake) {
      focus = {
        type: 'mistake',
        title: `Reduce ${topMistake.name}`,
        detail: `${topMistake.costR.toFixed(2)}R of observed loss was associated with this mistake across ${topMistake.count} trade${topMistake.count === 1 ? '' : 's'}. Add one pre-entry check for it.`
      };
    } else if (violatedCount) {
      focus = {
        type: 'rules',
        title: 'Protect rule compliance',
        detail: `${violatedCount} trade${violatedCount === 1 ? '' : 's'} broke a rule. Confirm the checklist before the next entry.`
      };
    } else {
      focus = {
        type: 'process',
        title: 'Repeat the clean process',
        detail: 'No tagged mistake or rule violation appeared in this sample. Keep the same pre-entry routine next week.'
      };
    }

    return {
      sampleSize,
      confidence: sampleSize < minimumSample ? 'insufficient' : sampleSize < 10 ? 'early' : 'developing',
      mistakeCosts,
      topMistake,
      bestSetup,
      bestSession,
      violatedCount,
      focus
    };
  }

  return { rValue, ruleStatus, analyze };
});
