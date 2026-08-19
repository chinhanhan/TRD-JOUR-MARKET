// TRD Journey SaaS - Real-time Firestore Cloud Sync Engine
(function() {
  let activeUid = null;
  let syncDebounceTimer = null;
  let isSyncing = false;

  window.TRDCloudSync = {
    async init(uid) {
      if (!uid || !window.fbDb) return;
      activeUid = uid;
      console.log("☁️ [TRD CloudSync] Initializing for user:", uid);
      this.updateSyncIndicator("syncing", "Syncing with cloud...");
      await this.pullFromCloud();
    },

    updateSyncIndicator(status, tooltip = "") {
      const dot = document.getElementById("syncStatusDot");
      if (!dot) return;
      dot.className = `status-dot ${status}`;
      dot.title = tooltip || (status === "online" ? "Cloud Synced" : status);
    },

    async pullFromCloud() {
      if (!activeUid || !window.fbDb) return;
      try {
        const stateDocRef = window.fbDb.collection("users").doc(activeUid).collection("data").doc("state");
        const docSnap = await stateDocRef.get();
        if (docSnap.exists) {
          const cloudData = docSnap.data();
          if (cloudData && typeof cloudData === "object") {
            console.log("☁️ [TRD CloudSync] Pulled cloud state successfully.");
            // Merge or replace local state if cloud data has trades or setups
            if (window.state) {
              if (Array.isArray(cloudData.trades) && cloudData.trades.length > 0) {
                window.state.trades = cloudData.trades;
              }
              if (Array.isArray(cloudData.sop) && cloudData.sop.length > 0) {
                window.state.sop = cloudData.sop;
              }
              if (Array.isArray(cloudData.accounts) && cloudData.accounts.length > 0) {
                window.state.accounts = cloudData.accounts;
              }
              if (cloudData.settings) {
                window.state.settings = { ...window.state.settings, ...cloudData.settings };
              }
              // Save locally to IndexedDB
              if (typeof window.saveState === "function") {
                await window.saveState();
              }
              if (typeof window.renderAll === "function") {
                window.renderAll();
              }
            }
          }
        } else {
          // If no cloud doc yet, push local state as initial backup
          console.log("☁️ [TRD CloudSync] First cloud sync: pushing existing local state.");
          await this.pushToCloudImmediate();
        }
        this.updateSyncIndicator("online", "Cloud Synced ✓");
      } catch (err) {
        console.error("☁️ [TRD CloudSync] Pull error:", err);
        this.updateSyncIndicator("offline", "Sync error: " + err.message);
      }
    },

    schedulePush() {
      if (!activeUid || !window.fbDb) return;
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      this.updateSyncIndicator("syncing", "Saving changes to cloud...");
      syncDebounceTimer = setTimeout(() => {
        this.pushToCloudImmediate();
      }, 1000); // 1-second debounce
    },

    async pushToCloudImmediate() {
      if (!activeUid || !window.fbDb || isSyncing) return;
      if (!window.state) return;
      isSyncing = true;
      try {
        const stateDocRef = window.fbDb.collection("users").doc(activeUid).collection("data").doc("state");
        const cleanState = JSON.parse(JSON.stringify(window.state));
        cleanState.updatedAt = new Date().toISOString();
        cleanState.tradeCount = (cleanState.trades || []).length;

        await stateDocRef.set(cleanState, { merge: true });

        // Update trade count in profile for free tier monitoring
        const profileRef = window.fbDb.collection("users").doc(activeUid);
        await profileRef.set({
          lastActiveAt: new Date().toISOString(),
          tradeCount: cleanState.tradeCount
        }, { merge: true });

        this.updateSyncIndicator("online", "Cloud Synced ✓");
      } catch (err) {
        console.error("☁️ [TRD CloudSync] Push error:", err);
        this.updateSyncIndicator("offline", "Cloud save failed");
      } finally {
        isSyncing = false;
      }
    }
  };

  // Hook into window.saveState
  const originalSaveState = window.saveState;
  window.saveState = async function() {
    let result = true;
    if (typeof originalSaveState === "function") {
      result = await originalSaveState();
    }
    if (window.TRDCloudSync && typeof window.TRDCloudSync.schedulePush === "function") {
      window.TRDCloudSync.schedulePush();
    }
    return result;
  };
})();
