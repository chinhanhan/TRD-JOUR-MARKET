// Real-time sync: explicit local persistence, transactional merges and retryable writes.
(function() {
  const MAX_SAFE_DOC_BYTES = 750 * 1024;
  let session = null;
  const bytes = value => new Blob([JSON.stringify(value)]).size;
  const current = s => session === s && window.TRDLocalStore?.getOwnerUid() === s.uid;
  const stateRef = s => window.fbDb.collection('users').doc(s.uid).collection('data').doc('state');

  window.TRDCloudSync = {
    async init(uid) {
      this.stop();
      if (!uid || !window.fbDb || window.TRDLocalStore?.getOwnerUid() !== uid) return false;
      const s = session = { uid, pending: false, timer: null, running: null, unsubscribe: null, ownWrites: new Set(), retries: 0 };
      this.updateSyncIndicator('syncing', 'Connecting cloud sync...');
      const ok = await this.pullFromCloud();
      if (!current(s)) return false;
      s.unsubscribe = stateRef(s).onSnapshot(snap => {
        if (!current(s) || !snap.exists || snap.metadata?.hasPendingWrites) return;
        const remote = snap.data();
        if (s.ownWrites.has(remote.syncWriteId)) return;
        if (window.isImporting) { s.pendingRemote = remote; return; }
        this.applyRemote(s, remote).catch(error => this.fail(s, error));
      }, error => this.fail(s, error));
      return ok;
    },

    stop() {
      const old = session;
      session = null;
      if (!old) return;
      clearTimeout(old.timer);
      old.unsubscribe?.();
      // Any in-flight write uses its captured UID; its completion cannot touch
      // the next user's in-memory state or profile.
    },

    updateSyncIndicator(status, tooltip = '') {
      const dot = document.getElementById('syncStatusDot');
      if (!dot) return;
      dot.className = `status-dot ${status}`;
      dot.title = tooltip || status;
    },

    fail(s, error) {
      if (!current(s)) return;
      console.error('[TRD CloudSync]', error);
      const quota = error.code === 'permission-denied' && window.TRDAuth?.getSubscription().plan !== 'pro' && (window.state.trades || []).length > 20;
      const message = quota ? 'Cloud quota exceeded. Your full journal is saved locally; export a backup or upgrade to sync more than 20 trades.' : 'Cloud Save Failed: ' + error.message;
      this.updateSyncIndicator('offline', message);
      window.toast?.(message, 'error');
    },

    async applyRemote(s, remote) {
      if (!current(s)) return false;
      if (remote.ownerUid && remote.ownerUid !== s.uid) throw new Error('Cloud data belongs to another account.');
      const merged = window.TRDStateSync.merge(window.state, remote);
      merged.ownerUid = s.uid;
      const saved = await window.TRDLocalStore.applyRemote(merged, s.uid);
      if (!current(s)) return false;
      if (!saved) throw new Error('Received cloud data could not be saved on this device.');
      if (!s.pending && !s.running) this.updateSyncIndicator('online', 'Saved locally and synced to cloud');
      return true;
    },

    mergeTradeArrays(localTrades = [], cloudTrades = []) {
      return window.TRDStateSync.merge({ trades: localTrades }, { trades: cloudTrades }).trades;
    },

    sanitizeStateForCloud(rawState) {
      const clean = JSON.parse(JSON.stringify(rawState));
      // Cloud metadata must fit inside the same 750KB budget.
      if (bytes(clean) <= MAX_SAFE_DOC_BYTES) return clean;
      const oldestFirst = [...(clean.trades || [])].sort((a, b) =>
        String(a.openTime || a.date || '').localeCompare(String(b.openTime || b.date || '')));
      for (const trade of oldestFirst) {
        if ((trade.images?.length) || trade.imageData) {
          trade.imagesCloudStripped = true;
          delete trade.images;
          delete trade.imageData;
          if (bytes(clean) <= MAX_SAFE_DOC_BYTES) return clean;
        }
      }
      throw new Error('Journal exceeds the 750KB cloud limit even without screenshots. Your local data is safe; export a JSON backup.');
    },

    async pullFromCloud() {
      const s = session;
      if (!s || !current(s)) return false;
      try {
        const snap = await stateRef(s).get();
        if (!current(s)) return false;
        if (snap.exists) await this.applyRemote(s, snap.data());
        // Also upload offline additions merged during the pull.
        s.pending = true;
        return await this.pushToCloudImmediate();
      } catch (error) {
        this.fail(s, error);
        return false;
      }
    },

    schedulePush() {
      const s = session;
      if (!s || !current(s)) return;
      s.pending = true;
      clearTimeout(s.timer);
      this.updateSyncIndicator('syncing', 'Saved locally; cloud save pending...');
      s.timer = setTimeout(() => this.pushToCloudImmediate(), 800);
    },

    async pushToCloudImmediate() {
      const s = session;
      if (!s || !current(s)) return false;
      clearTimeout(s.timer);
      s.pending = true;
      if (s.running) return s.running;
      const run = async () => {
        try {
          while (current(s) && s.pending) {
            if (window.isImporting) return false;
            s.pending = false;
            const local = window.TRDLocalStore.getSnapshot();
            if (!local || local.ownerUid !== s.uid) throw new Error('Local account data is not ready.');
            const writeId = `${s.uid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            s.ownWrites.add(writeId);
            if (s.ownWrites.size > 30) s.ownWrites.delete(s.ownWrites.values().next().value);
            let written;
            await window.fbDb.runTransaction(async transaction => {
              const ref = stateRef(s);
              const remote = await transaction.get(ref);
              if (!current(s)) throw new Error('Account changed during sync.');
              const data = remote.exists ? remote.data() : {};
              if (data.ownerUid && data.ownerUid !== s.uid) throw new Error('Cloud account mismatch.');
              written = window.TRDStateSync.merge(local, data);
              written.ownerUid = s.uid;
              written.updatedAt = new Date().toISOString();
              written.syncWriteId = writeId;
              written.tradeCount = (written.trades || []).length;
              const payload = this.sanitizeStateForCloud(written);
              // Replace only this state document. Merge has already preserved
              // concurrent updates; replacing also removes deleted map fields.
              transaction.set(ref, payload);
            });
            if (!current(s)) return false;
            await this.applyRemote(s, written);
            await window.fbDb.collection('users').doc(s.uid).set({
              lastActiveAt: written.updatedAt, tradeCount: written.tradeCount
            }, { merge: true });
          }
          if (current(s)) {
            s.retries = 0;
            this.updateSyncIndicator('online', 'Saved locally and synced to cloud');
            window.TRDAuth?.updateQuotaBadge();
          }
          return true;
        } catch (error) {
          if (current(s)) {
            s.pending = true;
            this.fail(s, error);
            // Retry a bounded number of times. Further edits or reconnecting
            // resume the queue; never discard unsynced local data.
            if (error.code !== 'permission-denied' && ++s.retries <= 3) s.timer = setTimeout(() => this.pushToCloudImmediate(), 2000 * s.retries);
          }
          return false;
        }
      };
      s.running = run();
      try { return await s.running; }
      finally { s.running = null; }
    },

    async resumeAfterImport() {
      const s = session;
      if (!s || !current(s)) return;
      if (s.pendingRemote) {
        const remote = s.pendingRemote;
        s.pendingRemote = null;
        await this.applyRemote(s, remote);
      }
      await this.pushToCloudImmediate();
    },

    refreshStatus() {
      if (!session) this.updateSyncIndicator('offline', 'Local journal; sign in for cloud sync');
      else if (!navigator.onLine) this.updateSyncIndicator('offline', 'Offline; changes stay on this device until synced');
      else if (session.pending || session.running) this.updateSyncIndicator('syncing', 'Cloud save pending...');
    }
  };
  window.addEventListener('online', () => {
    if (session) { session.retries = 0; window.TRDCloudSync.pullFromCloud(); }
  });
  window.addEventListener('offline', () => window.TRDCloudSync.refreshStatus());
})();
