// Backup imports are explicit user actions, separate from background sync.
(function(root) {
  const blocked = new Set(['__proto__', 'constructor', 'prototype']);
  const clone = value => JSON.parse(JSON.stringify(value), (key, item) => blocked.has(key) ? undefined : item);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function validate(raw) {
    const value = clone(raw?.state || raw);
    if (!object(value) || !['trades', 'sops', 'sop', 'accounts', 'dailyPlans', 'longGame', 'preferences'].some(key => key in value)) throw Error('Unrecognized backup.');
    for (const key of ['trades', 'accounts', 'sops', 'backtests']) {
      if (value[key] !== undefined && (!Array.isArray(value[key]) || value[key].some(item => !object(item) && !(key === 'sops' && typeof item === 'string')))) throw Error(`Invalid ${key}.`);
    }
    for (const key of ['preferences', 'dailyPlans', 'dailyReviews', 'longGame']) {
      if (value[key] !== undefined && !object(value[key])) throw Error(`Invalid ${key}.`);
    }
    for (const key of ['events','rawJournal','seasons','mirrorEntries','weeklyReviews','observations']) {
      const records = value.longGame?.[key];
      if (records !== undefined && (!Array.isArray(records) || records.some(item => !object(item)))) throw Error(`Invalid Long Game ${key}.`);
    }
    for (const key of ['setups','dailyRules']) {
      if (value.preferences?.[key] !== undefined && !Array.isArray(value.preferences[key])) throw Error(`Invalid ${key}.`);
    }
    for (const trade of value.trades || []) {
      for (const key of ['risk','pnl','rMultiple','maeR','mfeR']) {
        if (trade[key] != null && trade[key] !== '' && !Number.isFinite(Number(trade[key]))) throw Error(`Invalid trade ${key}.`);
      }

      for (const key of ['date','openTime','closeTime','closedAt','symbol','setup']) {
        if (trade[key] != null && typeof trade[key] !== 'string') throw Error(`Invalid trade ${key}.`);
      }
    }
    // Importing a backup is a new edit. Old tombstones and clocks must not
    // delete unrelated current data or override subsequent device edits.
    delete value._sync;
    return value;
  }
  function merge(current, incoming) {
    function combine(a, b, key) {
      if (b === undefined) return clone(a);
      if (Array.isArray(a) && Array.isArray(b)) {
        if (key === 'setups') return [...new Set([...a, ...b])];
        if ([...a, ...b].every(item => object(item) && item.id != null)) {
          const records = new Map(a.map(item => [String(item.id), clone(item)]));
          b.forEach(item => records.set(String(item.id), { ...records.get(String(item.id)), ...clone(item) }));
          return [...records.values()];
        }
        return clone(b);
      }
      if (object(a) && object(b)) {
        const result = clone(a);
        for (const name of Object.keys(b).filter(name => !blocked.has(name) && name !== '_sync' && name !== 'ownerUid')) {
          result[name] = name in a ? combine(a[name], b[name], name) : clone(b[name]);
        }
        return result;
      }
      return clone(b);
    }
    const result = combine(current, incoming, '');
    result.ownerUid = current.ownerUid;
    result._sync = clone(current._sync || { version: 1, clock: 0, entries: {} });
    return result;
  }
  const api = { validate, merge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TRDBackup = api;
})(typeof window !== 'undefined' ? window : this);
