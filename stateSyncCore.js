// Pure state merge helpers shared by the browser and isolated regression tests.
(function(root) {
  const collections = new Set(['trades', 'sops', 'accounts', 'backtests',
    'longGame/events', 'longGame/seasons', 'longGame/rawJournal',
    'longGame/mirrorEntries', 'longGame/weeklyReviews']);
  const reserved = new Set(['__proto__', 'prototype', 'constructor']);
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const keys = value => Object.keys(value || {}).filter(k => !reserved.has(k));
  const part = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
  const join = (path, key) => path ? `${path}/${part(key)}` : part(key);
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const time = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  const recordMap = items => new Map((Array.isArray(items) ? items : []).filter(x => x && x.id).map(x => [String(x.id), x]));
  const revision = (meta, path) => {
    let at = Number(meta[path]?.at) || 0;
    for (const key of keys(meta)) if (key.startsWith(path + '/')) at = Math.max(at, Number(meta[key]?.at) || 0);
    return at;
  };

  function stamp(current, previous = {}) {
    const entries = { ...(previous._sync?.entries || {}), ...(current._sync?.entries || {}) };
    const at = Math.max(Date.now(), Number(previous._sync?.clock || 0) + 1, Number(current._sync?.clock || 0) + 1);
    function visit(value, old, path) {
      if (equal(value, old)) return;
      if (collections.has(path)) {
        const now = recordMap(value), before = recordMap(old);
        for (const id of new Set([...now.keys(), ...before.keys()])) {
          const item = now.get(id), prior = before.get(id);
          if (!equal(item, prior)) {
            entries[join(path, id)] = { at, deleted: !item };
            if (item) item.updatedAt = new Date(at).toISOString();
          }
        }
      } else if (object(value) && (object(old) || old === undefined)) {
        for (const key of new Set([...keys(value), ...keys(old)])) {
          if (!path && ['_sync', 'updatedAt', 'tradeCount', 'ownerUid', 'syncWriteId'].includes(key)) continue;
          visit(value[key], old?.[key], join(path, key));
        }
      } else {
        entries[path] = { at, deleted: value === undefined };
      }
    }
    visit(current, previous, '');
    current._sync = { version: 1, clock: at, entries };
    return current;
  }

  function merge(local = {}, remote = {}) {
    const lm = local._sync?.entries || {}, rm = remote._sync?.entries || {};
    const entries = {};
    for (const path of new Set([...keys(lm), ...keys(rm)])) {
      entries[path] = clone((lm[path]?.at || 0) > (rm[path]?.at || 0) ? lm[path] : rm[path] || lm[path]);
    }
    function visit(a, b, path) {
      const la = revision(lm, path), ra = revision(rm, path);
      const deletion = entries[path];
      if (deletion?.deleted && deletion.at >= Math.max(la, ra)) return undefined;
      if (collections.has(path)) {
        const left = recordMap(a), right = recordMap(b), result = [];
        for (const id of new Set([...left.keys(), ...right.keys()])) {
          const l = left.get(id), r = right.get(id), key = join(path, id);
          const lt = Math.max(Number(lm[key]?.at) || 0, time(l?.updatedAt));
          const rt = Math.max(Number(rm[key]?.at) || 0, time(r?.updatedAt));
          if (entries[key]?.deleted && entries[key].at >= Math.max(lt, rt)) continue;
          const winner = clone(!l ? r : !r ? l : lt > rt ? l : r);
          // Cloud-stripped media may be preserved locally without reverting P&L.
          if (path === 'trades' && l && winner.imagesCloudStripped && !winner.images?.length && !winner.imageData) {
            if (Array.isArray(l.images) && l.images.length) winner.images = clone(l.images);
            if (l.imageData) winner.imageData = l.imageData;
          }
          if (winner) result.push(winner);
        }
        return result.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      }
      if (object(a) && object(b)) {
        const result = {};
        for (const key of new Set([...keys(a), ...keys(b)])) {
          if (!path && ['_sync', 'updatedAt', 'tradeCount', 'ownerUid', 'syncWriteId'].includes(key)) continue;
          const value = visit(a[key], b[key], join(path, key));
          if (value !== undefined) result[key] = value;
        }
        return result;
      }
      if (a === undefined) return clone(b);
      if (b === undefined) return clone(a);
      return clone(la > ra ? a : b);
    }
    const result = visit(local, remote, '');
    result._sync = { version: 1, clock: Math.max(local._sync?.clock || 0, remote._sync?.clock || 0), entries };
    result.ownerUid = local.ownerUid || remote.ownerUid || null;
    // Remove references to explicitly deleted SOPs before normalizeState can
    // recreate a setup from old preferences or an offline trade.
    const deletedSops = new Set(keys(entries).filter(k => k.startsWith('sops/') && entries[k].deleted)
      .map(k => k.slice(5).replace(/~1/g, '/').replace(/~0/g, '~')));
    if (deletedSops.size) {
      result.trades = (result.trades || []).filter(t => !deletedSops.has(t.sopId));
      result.accounts = (result.accounts || []).filter(a => !deletedSops.has(a.sopId));
      if (result.preferences) result.preferences.setups = (result.sops || []).filter(s => !s.archivedAt).map(s => s.name);
    }
    return result;
  }

  const api = { stamp, merge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TRDStateSync = api;
})(typeof window !== 'undefined' ? window : this);
