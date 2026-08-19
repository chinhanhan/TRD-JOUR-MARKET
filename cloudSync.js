// TRD Journey SaaS - High-Resilience Firestore Cloud Sync Engine (1MB Limit Guard & Conflict-Free Merge)
(function() {
  let activeUid = null;
  let syncDebounceTimer = null;
  let isSyncing = false;

  // Maximum safe byte size for Firestore document (capped at 750KB to leave safe buffer under 1MB)
  const MAX_SAFE_DOC_BYTES = 750 * 1024;

  window.TRDCloudSync = {
    async init(uid) {
      if (!uid || !window.fbDb) return;
      activeUid = uid;
      console.log("☁️ [TRD CloudSync] Initializing resilient sync for user:", uid);
      this.updateSyncIndicator("syncing", "Syncing with cloud...");
      await this.pullFromCloud();
    },

    updateSyncIndicator(status, tooltip = "") {
      const dot = document.getElementById("syncStatusDot");
      if (!dot) return;
      dot.className = `status-dot ${status}`;
      dot.title = tooltip || (status === "online" ? "Cloud Synced" : status);
    },

    // Deep merge local trades and cloud trades by id and timestamp (Never loses offline trades)
    mergeTradeArrays(localTrades = [], cloudTrades = []) {
      const tradeMap = new Map();

      // Put cloud trades first
      cloudTrades.forEach(trade => {
        if (trade && trade.id) {
          tradeMap.set(trade.id, trade);
        }
      });

      // Merge local trades: if local has updated version or new offline trades, preserve them
      localTrades.forEach(trade => {
        if (trade && trade.id) {
          if (!tradeMap.has(trade.id)) {
            // New offline trade created locally
            tradeMap.set(trade.id, trade);
          } else {
            // Preserve local trade if it has full images while cloud had compressed thumb
            const cloudTrade = tradeMap.get(trade.id);
            const localHasImages = Array.isArray(trade.images) && trade.images.length > 0;
            const cloudHasImages = Array.isArray(cloudTrade.images) && cloudTrade.images.length > 0;

            if (localHasImages && !cloudHasImages) {
              tradeMap.set(trade.id, { ...cloudTrade, ...trade });
            }
          }
        }
      });

      return Array.from(tradeMap.values());
    },

    // Compresses & strips heavy old image blobs for cloud payload if nearing 1MB limit
    sanitizeStateForCloud(rawState) {
      const cleanState = JSON.parse(JSON.stringify(rawState));
      let jsonString = JSON.stringify(cleanState);
      let byteSize = new Blob([jsonString]).size;

      // If within safe limits (< 750KB), send full payload as is
      if (byteSize <= MAX_SAFE_DOC_BYTES) {
        return cleanState;
      }

      console.warn(`⚠️ [TRD CloudSync] Payload size (${Math.round(byteSize / 1024)}KB) exceeds safe threshold. Optimizing old image thumbnails for cloud...`);

      // Optimize: keep images for the 10 most recent trades, strip heavy base64 for older trades in cloud only
      // (Full images remain 100% untouched and safe in local IndexedDB)
      if (Array.isArray(cleanState.trades)) {
        cleanState.trades.forEach((trade, index) => {
          if (index < cleanState.trades.length - 10) {
            // Old trade: strip heavy images in cloud document to prevent 1MB overflow
            if (trade.images && trade.images.length > 0) {
              trade.imagesCloudStripped = true;
              delete trade.images;
              delete trade.imageData;
            }
          }
        });
      }

      return cleanState;
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

            if (window.state) {
              // Conflict-Free Trade Merge
              if (Array.isArray(cloudData.trades)) {
                window.state.trades = this.mergeTradeArrays(window.state.trades, cloudData.trades);
              }
              if (Array.isArray(cloudData.sops) && cloudData.sops.length > 0) {
                window.state.sops = cloudData.sops;
              }
              if (Array.isArray(cloudData.accounts) && cloudData.accounts.length > 0) {
                window.state.accounts = cloudData.accounts;
              }
              if (cloudData.settings) {
                window.state.settings = { ...window.state.settings, ...cloudData.settings };
              }
              if (cloudData.activeSopId) window.state.activeSopId = cloudData.activeSopId;
              if (cloudData.activeAccountId) window.state.activeAccountId = cloudData.activeAccountId;

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
        if (window.TRDAuth && typeof window.TRDAuth.updateQuotaBadge === "function") {
          window.TRDAuth.updateQuotaBadge();
        }
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
      }, 800); // 800ms debounce
    },

    async pushToCloudImmediate() {
      if (!activeUid || !window.fbDb || isSyncing) return;
      if (!window.state) return;
      isSyncing = true;
      try {
        const stateDocRef = window.fbDb.collection("users").doc(activeUid).collection("data").doc("state");
        const cleanState = this.sanitizeStateForCloud(window.state);
        cleanState.updatedAt = new Date().toISOString();
        cleanState.tradeCount = (window.state.trades || []).length;

        await stateDocRef.set(cleanState, { merge: true });

        // Update trade count in profile for free tier monitoring
        const profileRef = window.fbDb.collection("users").doc(activeUid);
        await profileRef.set({
          lastActiveAt: new Date().toISOString(),
          tradeCount: cleanState.tradeCount
        }, { merge: true });

        this.updateSyncIndicator("online", "Cloud Synced ✓");
        if (window.TRDAuth && typeof window.TRDAuth.updateQuotaBadge === "function") {
          window.TRDAuth.updateQuotaBadge();
        }
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
