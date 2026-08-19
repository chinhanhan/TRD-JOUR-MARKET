// TRD Journey SaaS - Real-Time Multi-Device Cloud Sync Engine (Live Snapshot + 1MB Guard + Conflict-Free Merge)
(function() {
  let activeUid = null;
  let syncDebounceTimer = null;
  let isSyncing = false;
  let isApplyingRemoteUpdate = false;
  let unsubscribeSnapshot = null;
  let lastPushedTimestamp = null;

  // Maximum safe byte size for Firestore document (capped at 750KB to leave safe buffer under 1MB)
  const MAX_SAFE_DOC_BYTES = 750 * 1024;

  const originalSaveState = window.saveState;

  window.TRDCloudSync = {
    async init(uid) {
      if (!uid || !window.fbDb) return;
      activeUid = uid;
      console.log("☁️ [TRD CloudSync] Initializing real-time multi-device sync for user:", uid);
      this.updateSyncIndicator("syncing", "Connecting live cloud sync...");

      // Clean up previous listeners if any
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      await this.pullFromCloud();
      this.listenRealtimeUpdates();
    },

    updateSyncIndicator(status, tooltip = "") {
      const dot = document.getElementById("syncStatusDot");
      if (!dot) return;
      dot.className = `status-dot ${status}`;
      dot.title = tooltip || (status === "online" ? "Cloud Synced ✓" : status);
    },

    // Real-time live snapshot listener for multi-window / multi-device instant sync
    listenRealtimeUpdates() {
      if (!activeUid || !window.fbDb) return;
      try {
        const stateDocRef = window.fbDb.collection("users").doc(activeUid).collection("data").doc("state");
        unsubscribeSnapshot = stateDocRef.onSnapshot(async (docSnap) => {
          if (!docSnap.exists) return;
          const cloudData = docSnap.data();
          if (!cloudData || typeof cloudData !== "object") return;

          // Prevent echo loops: if this was our own push, skip re-applying
          if (lastPushedTimestamp && cloudData.updatedAt === lastPushedTimestamp) {
            return;
          }

          if (window.state && Array.isArray(cloudData.trades)) {
            console.log("⚡ [TRD CloudSync] Live remote update received from another device.");
            window.state.trades = this.mergeTradeArrays(window.state.trades, cloudData.trades);
            if (Array.isArray(cloudData.sops) && cloudData.sops.length > 0) {
              window.state.sops = cloudData.sops;
            }
            if (Array.isArray(cloudData.accounts) && cloudData.accounts.length > 0) {
              window.state.accounts = cloudData.accounts;
            }
            if (cloudData.preferences) {
              window.state.preferences = { ...window.state.preferences, ...cloudData.preferences };
            } else if (cloudData.settings) {
              window.state.preferences = { ...window.state.preferences, ...cloudData.settings };
            }
            if (cloudData.dailyPlans) {
              window.state.dailyPlans = { ...window.state.dailyPlans, ...cloudData.dailyPlans };
            }
            if (cloudData.dailyReviews) {
              window.state.dailyReviews = { ...window.state.dailyReviews, ...cloudData.dailyReviews };
            }
            if (cloudData.reflections) {
              window.state.reflections = { ...window.state.reflections, ...cloudData.reflections };
            }
            if (cloudData.playbook) {
              window.state.playbook = { ...window.state.playbook, ...cloudData.playbook };
            }
            if (cloudData.longGame) {
              window.state.longGame = { ...window.state.longGame, ...cloudData.longGame };
            }
            if (cloudData.experience) {
              window.state.experience = { ...window.state.experience, ...cloudData.experience };
            }
            if (Array.isArray(cloudData.backtests)) {
              window.state.backtests = cloudData.backtests;
            }
            if (cloudData.activeSopId) window.state.activeSopId = cloudData.activeSopId;
            if (cloudData.activeAccountId) window.state.activeAccountId = cloudData.activeAccountId;

            // Save to IndexedDB locally without triggering a push echo back to cloud
            isApplyingRemoteUpdate = true;
            try {
              if (typeof originalSaveState === "function") {
                await originalSaveState();
              }
            } finally {
              isApplyingRemoteUpdate = false;
            }

            if (typeof window.renderAll === "function") {
              window.renderAll();
            }
            if (window.TRDAuth && typeof window.TRDAuth.updateQuotaBadge === "function") {
              window.TRDAuth.updateQuotaBadge();
            }
            this.updateSyncIndicator("online", "Live Multi-Device Synced ✓");
          }
        }, (err) => {
          console.warn("☁️ [TRD CloudSync] Realtime snapshot warning:", err);
        });
      } catch (e) {
        console.error("☁️ [TRD CloudSync] Listener setup error:", e);
      }
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
            tradeMap.set(trade.id, trade);
          } else {
            const cloudTrade = tradeMap.get(trade.id);
            const localHasImages = Array.isArray(trade.images) && trade.images.length > 0;
            const cloudHasImages = Array.isArray(cloudTrade.images) && cloudTrade.images.length > 0;

            if (localHasImages && !cloudHasImages) {
              tradeMap.set(trade.id, { ...cloudTrade, ...trade });
            } else if (trade.updatedAt && cloudTrade.updatedAt) {
              if (new Date(trade.updatedAt).getTime() > new Date(cloudTrade.updatedAt).getTime()) {
                tradeMap.set(trade.id, { ...cloudTrade, ...trade });
              }
            }
          }
        }
      });

      return Array.from(tradeMap.values()).sort((a, b) => {
        const timeA = new Date(a.openTime || a.date || 0).getTime();
        const timeB = new Date(b.openTime || b.date || 0).getTime();
        return timeB - timeA;
      });
    },

    // Compresses & strips heavy old image blobs for cloud payload if nearing 1MB limit
    sanitizeStateForCloud(rawState) {
      const cleanState = JSON.parse(JSON.stringify(rawState));
      let jsonString = JSON.stringify(cleanState);
      let byteSize = new Blob([jsonString]).size;

      if (byteSize <= MAX_SAFE_DOC_BYTES) {
        return cleanState;
      }

      console.warn(`⚠️ [TRD CloudSync] Payload size (${Math.round(byteSize / 1024)}KB) exceeds safe threshold. Optimizing old image thumbnails for cloud...`);

      if (Array.isArray(cleanState.trades)) {
        cleanState.trades.forEach((trade, index) => {
          if (index < cleanState.trades.length - 10) {
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
              if (Array.isArray(cloudData.trades)) {
                window.state.trades = this.mergeTradeArrays(window.state.trades, cloudData.trades);
              }
              if (Array.isArray(cloudData.sops) && cloudData.sops.length > 0) {
                window.state.sops = cloudData.sops;
              }
              if (Array.isArray(cloudData.accounts) && cloudData.accounts.length > 0) {
                window.state.accounts = cloudData.accounts;
              }
              if (cloudData.preferences) {
                window.state.preferences = { ...window.state.preferences, ...cloudData.preferences };
              } else if (cloudData.settings) {
                window.state.preferences = { ...window.state.preferences, ...cloudData.settings };
              }
              if (cloudData.dailyPlans) {
                window.state.dailyPlans = { ...window.state.dailyPlans, ...cloudData.dailyPlans };
              }
              if (cloudData.dailyReviews) {
                window.state.dailyReviews = { ...window.state.dailyReviews, ...cloudData.dailyReviews };
              }
              if (cloudData.reflections) {
                window.state.reflections = { ...window.state.reflections, ...cloudData.reflections };
              }
              if (cloudData.playbook) {
                window.state.playbook = { ...window.state.playbook, ...cloudData.playbook };
              }
              if (cloudData.longGame) {
                window.state.longGame = { ...window.state.longGame, ...cloudData.longGame };
              }
              if (cloudData.experience) {
                window.state.experience = { ...window.state.experience, ...cloudData.experience };
              }
              if (Array.isArray(cloudData.backtests)) {
                window.state.backtests = cloudData.backtests;
              }
              if (cloudData.activeSopId) window.state.activeSopId = cloudData.activeSopId;
              if (cloudData.activeAccountId) window.state.activeAccountId = cloudData.activeAccountId;

              // Save locally to IndexedDB without triggering an outbound push
              isApplyingRemoteUpdate = true;
              try {
                if (typeof originalSaveState === "function") {
                  await originalSaveState();
                }
              } finally {
                isApplyingRemoteUpdate = false;
              }

              if (typeof window.renderAll === "function") {
                window.renderAll();
              }
            }
          }
        } else {
          console.log("☁️ [TRD CloudSync] First cloud sync: pushing existing local state.");
          await this.pushToCloudImmediate();
        }
        this.updateSyncIndicator("online", "Live Cloud Synced ✓");
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
      }, 800);
    },

    async pushToCloudImmediate() {
      if (!activeUid || !window.fbDb || isSyncing) return;
      if (!window.state) return;
      isSyncing = true;
      try {
        const stateDocRef = window.fbDb.collection("users").doc(activeUid).collection("data").doc("state");
        const cleanState = this.sanitizeStateForCloud(window.state);
        const timestamp = new Date().toISOString();
        cleanState.updatedAt = timestamp;
        cleanState.tradeCount = (window.state.trades || []).length;
        lastPushedTimestamp = timestamp;

        await stateDocRef.set(cleanState, { merge: true });

        const profileRef = window.fbDb.collection("users").doc(activeUid);
        await profileRef.set({
          lastActiveAt: timestamp,
          tradeCount: cleanState.tradeCount
        }, { merge: true });

        this.updateSyncIndicator("online", "Live Cloud Synced ✓");
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

  // Intercept window.saveState for local user edits only
  window.saveState = async function(options = {}) {
    let result = true;
    if (typeof originalSaveState === "function") {
      result = await originalSaveState();
    }
    if (!isApplyingRemoteUpdate && !(options && options.skipCloudPush)) {
      if (window.TRDCloudSync && typeof window.TRDCloudSync.schedulePush === "function") {
        window.TRDCloudSync.schedulePush();
      }
    }
    return result;
  };
})();
