// TRD Journey SaaS - Firebase Authentication, Profile & Stripe/TNG Commercial Controller
(function() {
  const STRIPE_LINKS = {
    monthly: "https://buy.stripe.com/fZu14n5kJdG721W8ZFdjO00",
    quarterly: "https://buy.stripe.com/aFa8wP28x31t8qka3JdjO02",
    yearly: "https://buy.stripe.com/4gMdR9fZn6dFcGAejZdjO03",
    lifetime: "https://buy.stripe.com/8x25kD8wV45xeOI7VBdjO01"
  };

  // Valid VIP Redeem Code patterns for manual approval (e.g. TNG transfer or promotions)
  const VALID_REDEEM_KEYS = [
    "TRD-PRO-VIP",
    "TRD-EARLYBIRD-2026",
    "TRD-MALAYSIA-PRO",
    "TRD-COMMUNITY-VIP",
    "TRD-SPECIAL-PRO"
  ];

  const AuthState = {
    currentUser: null,
    profile: null,
    subscription: { plan: 'free', status: 'active', limit: 20, trialUntil: null },
    currentTab: 'signin',
    isInitialized: false
  };

  window.TRDAuth = {
    init() {
      this.bindDOM();
      this.applyProFeatureGating();
      this.updateQuotaBadge();

      if (!window.fbAuth) {
        console.warn("⚠️ Firebase Auth not available yet.");
        return;
      }

      this.listenAuth();
    },

    bindDOM() {
      // Auth Modal Openers
      const openSignInBtns = document.querySelectorAll('.open-signin-trigger');
      openSignInBtns.forEach(btn => btn.addEventListener('click', () => this.openModal('signin')));

      const openSignUpBtns = document.querySelectorAll('.open-signup-trigger');
      openSignUpBtns.forEach(btn => btn.addEventListener('click', () => this.openModal('signup')));

      // Close Modal
      const closeBtn = document.getElementById('authCloseBtn');
      const backdrop = document.getElementById('authModalBackdrop');
      if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) this.closeModal();
        });
      }

      // Upgrade Modal Openers & Close
      const upgradeBtns = document.querySelectorAll('.open-upgrade-trigger');
      upgradeBtns.forEach(btn => btn.addEventListener('click', () => this.openUpgradeModal()));

      const upgradeCloseBtn = document.getElementById('upgradeCloseBtn');
      const upgradeModal = document.getElementById('upgradeModalBackdrop');
      if (upgradeCloseBtn) upgradeCloseBtn.addEventListener('click', () => this.closeUpgradeModal());
      if (upgradeModal) {
        upgradeModal.addEventListener('click', (e) => {
          if (e.target === upgradeModal) this.closeUpgradeModal();
        });
      }

      // Escape Key to Close Modals
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeModal();
          this.closeUpgradeModal();
        }
      });

      // Tab Switching
      const tabSignIn = document.getElementById('authTabSignIn');
      const tabSignUp = document.getElementById('authTabSignUp');
      if (tabSignIn) tabSignIn.addEventListener('click', () => this.switchTab('signin'));
      if (tabSignUp) tabSignUp.addEventListener('click', () => this.switchTab('signup'));

      const toForgotBtn = document.getElementById('toForgotPassBtn');
      if (toForgotBtn) toForgotBtn.addEventListener('click', () => this.switchTab('forgot'));

      const backToSignIn = document.getElementById('backToSignInBtn');
      if (backToSignIn) backToSignIn.addEventListener('click', () => this.switchTab('signin'));

      // Form Submits
      const authForm = document.getElementById('authMainForm');
      if (authForm) authForm.addEventListener('submit', (e) => this.handleAuthSubmit(e));

      // User Profile Dropdown
      const profileBtn = document.getElementById('userProfileTriggerBtn');
      const dropdownCard = document.getElementById('userDropdownCard');
      if (profileBtn && dropdownCard) {
        profileBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdownCard.classList.toggle('show');
        });
        document.addEventListener('click', () => dropdownCard.classList.remove('show'));
      }

      // Logout
      const logoutBtn = document.getElementById('authLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => this.signOut());
      }
    },

    listenAuth() {
      window.fbAuth.onAuthStateChanged(async (user) => {
        AuthState.currentUser = user;
        AuthState.isInitialized = true;

        if (user) {
          console.log("👤 [TRD Auth] User signed in:", user.email, user.uid);
          await this.loadUserProfile(user);
          this.renderAuthenticatedUI(user);
          this.closeModal();

          // Initialize cloud trade sync
          if (window.TRDCloudSync) {
            window.TRDCloudSync.init(user.uid);
          }

          // Handle Pending Upgrade Intent from Landing Page
          if (sessionStorage.getItem('trd_pending_upgrade') === 'true') {
            sessionStorage.removeItem('trd_pending_upgrade');
            const pendingTier = sessionStorage.getItem('trd_pending_tier');
            if (pendingTier) {
              AuthState.selectedTier = pendingTier;
              sessionStorage.removeItem('trd_pending_tier');
            }
            setTimeout(() => {
              this.openUpgradeModal();
              if (pendingTier) this.selectUpgradeTier(pendingTier);
            }, 600);
          }
        } else {
          console.log("🚪 [TRD Auth] User signed out.");
          AuthState.profile = null;
          AuthState.subscription = { plan: 'free', status: 'active', limit: 20 };
          this.clearLocalUserData();
          this.renderAnonymousUI();
        }
      });
    },

    clearLocalUserData() {
      // Clear in-memory trades and reset to clean state to prevent data leakage between users
      if (window.state) {
        window.state.trades = [];
        window.state.sops = [];
        window.state.accounts = [];
        window.state.activeSopId = "";
        window.state.activeAccountId = "";
      }
      try {
        const STORAGE_KEY = "trd-journey-os-v1";
        localStorage.removeItem(STORAGE_KEY);
        if (window.idbSet) {
          window.idbSet(STORAGE_KEY, null);
        }
      } catch (e) {}

      if (typeof window.renderAll === "function") {
        window.renderAll();
      }
    },

    async loadUserProfile(user) {
      if (!window.fbDb) return;
      try {
        const userDocRef = window.fbDb.collection('users').doc(user.uid);
        const docSnap = await userDocRef.get();

        // Check if user returned from successful Stripe payment
        const isPaymentSuccess = window.location.search.includes('upgrade=success') || window.location.search.includes('payment=success') || window.location.search.includes('session_id=');

        if (docSnap.exists) {
          AuthState.profile = docSnap.data();
          if (AuthState.profile.subscription) {
            AuthState.subscription = AuthState.profile.subscription;
          }
        } else {
          // Initialize new user profile document
          const initialProfile = {
            email: user.email,
            createdAt: new Date().toISOString(),
            subscription: {
              plan: 'free',
              status: 'active',
              limit: 20,
              subscribedAt: new Date().toISOString()
            }
          };
          await userDocRef.set(initialProfile, { merge: true });
          AuthState.profile = initialProfile;
          AuthState.subscription = initialProfile.subscription || { plan: 'free', limit: 20 };

          // Auto-Expiration Check for Pro Subscriptions (Stripe & TNG, Skip Lifetime)
          const isLifetime = AuthState.subscription.tier === 'lifetime' || (AuthState.subscription.validUntil && new Date(AuthState.subscription.validUntil).getFullYear() > 2090);
          if (!isLifetime && AuthState.subscription.plan === 'pro' && AuthState.subscription.validUntil) {
            const expiryTime = new Date(AuthState.subscription.validUntil).getTime();
            if (Date.now() > expiryTime) {
              console.log("⏰ [TRD Auth] Pro subscription has expired. Auto-locking to Free tier.");
              AuthState.subscription.plan = 'free';
              AuthState.subscription.status = 'expired';
              AuthState.subscription.limit = 20;

            }
          }
        }

        // Activate or Extend Pro if returning from Stripe checkout (Multi-Tier Duration Handling)
        if (isPaymentSuccess) {
          const now = new Date();
          const paidTier = localStorage.getItem('trd_pending_checkout_tier') || 'lifetime';
          localStorage.removeItem('trd_pending_checkout_tier');

          let validUntil = '2099-12-31T23:59:59.999Z';
          let successMsg = "🎉 Congratulations! Your TRD Journey Founder Lifetime Pass is now ACTIVE! 👑";

          if (paidTier === 'monthly') {
            const baseTime = (AuthState.subscription.validUntil && new Date(AuthState.subscription.validUntil).getTime() > now.getTime())
              ? new Date(AuthState.subscription.validUntil).getTime()
              : now.getTime();
            validUntil = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString();
            successMsg = "🎉 Your TRD Journey Pro Monthly subscription is active! 30 days added.";
          } else if (paidTier === 'quarterly') {
            const baseTime = (AuthState.subscription.validUntil && new Date(AuthState.subscription.validUntil).getTime() > now.getTime())
              ? new Date(AuthState.subscription.validUntil).getTime()
              : now.getTime();
            validUntil = new Date(baseTime + 90 * 24 * 60 * 60 * 1000).toISOString();
            successMsg = "🎉 Congratulations! Your TRD Journey Quarterly Pro is active! 90 days added.";
          } else if (paidTier === 'yearly') {
            const baseTime = (AuthState.subscription.validUntil && new Date(AuthState.subscription.validUntil).getTime() > now.getTime())
              ? new Date(AuthState.subscription.validUntil).getTime()
              : now.getTime();
            validUntil = new Date(baseTime + 365 * 24 * 60 * 60 * 1000).toISOString();
            successMsg = "🎉 Congratulations! Your TRD Journey Annual Pro is active! 365 days added.";
          }

          AuthState.subscription = {
            plan: 'pro',
            tier: paidTier,
            status: 'active',
            limit: 999999,
            subscribedAt: AuthState.subscription.subscribedAt || now.toISOString(),
            validUntil: validUntil,
            provider: 'stripe'
          };
          await userDocRef.set({ subscription: AuthState.subscription }, { merge: true });
          
          if (typeof confetti === 'function') {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          }
          if (window.toast) {
            window.toast(successMsg, "win");
          } else {
            alert(successMsg);
          }

          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      }
    },

    renderAuthenticatedUI(user) {
      // Hide Landing Page overlay, show App Shell with smooth fade
      const landingOverlay = document.getElementById('landingPageOverlay');
      const appShell = document.getElementById('appShell');
      if (landingOverlay) landingOverlay.classList.remove('active');
      if (appShell) {
        appShell.style.display = 'flex';
        appShell.style.opacity = '1';
      }

      // Update Header Auth Bar
      const authAnonSection = document.getElementById('headerAuthAnon');
      const authUserSection = document.getElementById('headerAuthUser');
      const userEmailEl = document.getElementById('headerUserEmail');
      const userAvatarEl = document.getElementById('headerUserAvatar');
      const userPlanBadge = document.getElementById('headerUserPlanBadge');
      const dropdownEmail = document.getElementById('dropdownUserEmail');
      const dropdownPlan = document.getElementById('dropdownUserPlan');

      if (authAnonSection) authAnonSection.style.display = 'none';
      if (authUserSection) authUserSection.style.display = 'flex';

      const initial = (user.email || 'U').charAt(0).toUpperCase();
      if (userAvatarEl) userAvatarEl.textContent = initial;
      if (userEmailEl) userEmailEl.textContent = user.email;
      if (dropdownEmail) dropdownEmail.textContent = user.email;

      // UI gating: hide premium features for free users
      const premiumFeatures = document.querySelectorAll('.premium-feature');
      const isPro = AuthState.subscription.plan === 'pro';
      const isLifetime = isPro && (AuthState.subscription.tier === 'lifetime' || (AuthState.subscription.validUntil && new Date(AuthState.subscription.validUntil).getFullYear() > 2090));

      if (isPro) {
        premiumFeatures.forEach(el => el.style.display = '');
      } else {
        premiumFeatures.forEach(el => el.style.display = 'none');
      }

      if (userPlanBadge) {
        userPlanBadge.className = `user-plan-badge ${isPro ? (isLifetime ? 'pro lifetime' : 'pro') : 'free'}`;
        userPlanBadge.textContent = isLifetime ? 'LIFETIME' : (isPro ? 'PRO' : 'FREE');
      }
      if (dropdownPlan) {
        dropdownPlan.textContent = isLifetime ? 'Plan: Founder Lifetime 👑' : (isPro ? 'Plan: Pro Member ⭐' : 'Plan: Free (20 Limit)');
      }

      const dropdownUpgradeBtn = document.querySelector('#userDropdownCard .open-upgrade-trigger');
      if (dropdownUpgradeBtn) {
        if (isLifetime) {
          dropdownUpgradeBtn.style.display = 'none';
        } else if (isPro) {
          dropdownUpgradeBtn.style.display = '';
          dropdownUpgradeBtn.textContent = '👑 Upgrade to Lifetime (RM199)';
        } else {
          dropdownUpgradeBtn.style.display = '';
          dropdownUpgradeBtn.textContent = '⭐ Upgrade to Pro / Lifetime';
        }
      }

      this.applyProFeatureGating();
      this.updateQuotaBadge();
    },

    updateQuotaBadge() {
      const quotaBadge = document.getElementById('headerQuotaBadge');
      if (!quotaBadge) return;

      const isPro = AuthState.subscription.plan === 'pro';
      const isLifetime = isPro && (AuthState.subscription.tier === 'lifetime' || (AuthState.subscription.validUntil && new Date(AuthState.subscription.validUntil).getFullYear() > 2090));
      const tradeCount = (window.state && Array.isArray(window.state.trades)) ? window.state.trades.length : 0;
      const limit = 20;

      const renewalBanner = document.getElementById('headerRenewalNotice');
      const renewalDaysEl = document.getElementById('renewalNoticeDaysText');

      this.applyProFeatureGating();

      if (isPro) {
        quotaBadge.className = `quota-pill pro ${isLifetime ? 'lifetime' : ''}`;
        quotaBadge.innerHTML = isLifetime ? '👑 Lifetime Pro' : '⭐ Pro Active';
        quotaBadge.title = isLifetime ? 'Founder Lifetime - Unlimited Trade Logs' : 'Unlimited Trade Logs';
        quotaBadge.onclick = null;

        // Check if expiring within 3 days (only for non-lifetime members)
        if (!isLifetime && AuthState.subscription.validUntil && renewalBanner) {
          const daysLeft = Math.ceil((new Date(AuthState.subscription.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 3 && daysLeft >= 0) {
            renewalBanner.style.display = 'flex';
            if (renewalDaysEl) {
              renewalDaysEl.textContent = daysLeft === 0 
                ? 'Your Pro membership expires today.' 
                : `Your Pro membership expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`;
            }
          } else {
            renewalBanner.style.display = 'none';
          }
        } else if (renewalBanner) {
          renewalBanner.style.display = 'none';
        }
      } else {
        if (renewalBanner) renewalBanner.style.display = 'none';
        const isNearLimit = tradeCount >= (limit - 3);
        const isMaxed = tradeCount >= limit;
        quotaBadge.className = `quota-pill free ${isMaxed ? 'maxed' : (isNearLimit ? 'warning' : '')}`;
        quotaBadge.innerHTML = isMaxed ? `📊 ${tradeCount}/${limit} Full` : `📊 ${tradeCount}/${limit} Trades`;
        quotaBadge.title = `${tradeCount} of ${limit} free trades used. Click to upgrade.`;
        quotaBadge.onclick = () => this.openUpgradeModal();
      }
    },

    handleQuickRenewWhatsApp() {
      const user = this.getUser();
      const email = user ? user.email : 'Pro Member';
      const msg = encodeURIComponent(`Hi TRD Journey, I want to renew my TRD Journey Pro membership via Touch 'n Go / DuitNow QR.\n\nMy Account Email: ${email}`);
      window.open(`https://wa.me/601126633131?text=${msg}`, '_blank');
    },

    renderAnonymousUI() {
      // If user is not logged in, show Landing Page for visitors
      const landingOverlay = document.getElementById('landingPageOverlay');
      const appShell = document.getElementById('appShell');
      const authAnonSection = document.getElementById('headerAuthAnon');
      const authUserSection = document.getElementById('headerAuthUser');

      if (landingOverlay) landingOverlay.classList.add('active');
      if (appShell) {
        appShell.style.display = 'none';
        appShell.style.opacity = '0';
      }

      if (authAnonSection) authAnonSection.style.display = 'flex';
      if (authUserSection) authUserSection.style.display = 'none';

      this.applyProFeatureGating();
    },

    openModal(tab = 'signin') {
      this.switchTab(tab);
      const modal = document.getElementById('authModalBackdrop');
      if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
      this.clearError();
    },

    closeModal() {
      const modal = document.getElementById('authModalBackdrop');
      if (modal) {
        modal.classList.remove('active');
        if (!document.getElementById('upgradeModalBackdrop')?.classList.contains('active')) {
          document.body.style.overflow = '';
        }
      }
    },

    openUpgradeModal(targetTier = null) {
      const modal = document.getElementById('upgradeModalBackdrop');
      if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }

      this.selectUpgradeTier(targetTier || AuthState.selectedTier || 'lifetime');

      // Dynamically populate value review report card
      const trades = (window.state && Array.isArray(window.state.trades)) ? window.state.trades : [];
      const limit = AuthState.subscription.limit || 20;
      const countEl = document.getElementById('reportTradeCount');
      const sopEl = document.getElementById('reportSopRate');
      const mistakeEl = document.getElementById('reportMistakes');

      if (countEl) countEl.textContent = `${trades.length}/${limit}`;

      if (trades.length > 0) {
        const passedCount = trades.filter(t => t.preFlightChecklist?.passed !== false).length;
        const sopPercent = Math.round((passedCount / trades.length) * 100);
        if (sopEl) sopEl.textContent = `${sopPercent}%`;

        const mistakeCount = trades.filter(t => t.mistakes && t.mistakes.length > 0).length;
        if (mistakeEl) mistakeEl.textContent = `${mistakeCount} Audited`;
      } else {
        if (sopEl) sopEl.textContent = '100%';
        if (mistakeEl) mistakeEl.textContent = '0 Audited';
      }
    },

    closeUpgradeModal() {
      const modal = document.getElementById('upgradeModalBackdrop');
      if (modal) {
        modal.classList.remove('active');
        if (!document.getElementById('authModalBackdrop')?.classList.contains('active')) {
          document.body.style.overflow = '';
        }
      }
    },

    switchUpgradeTab(tab) {
      const tabStripe = document.getElementById('upgradeTabStripe');
      const tabTng = document.getElementById('upgradeTabTng');
      const secStripe = document.getElementById('upgradeStripeSection');
      const secTng = document.getElementById('upgradeTngSection');

      if (tab === 'stripe') {
        if (tabStripe) tabStripe.classList.add('active');
        if (tabTng) tabTng.classList.remove('active');
        if (secStripe) secStripe.style.display = 'block';
        if (secTng) secTng.style.display = 'none';
      } else {
        if (tabStripe) tabStripe.classList.remove('active');
        if (tabTng) tabTng.classList.add('active');
        if (secStripe) secStripe.style.display = 'none';
        if (secTng) secTng.style.display = 'block';
      }
    },

    startProUpgradeIntent(tier) {
      if (tier) {
        AuthState.selectedTier = tier;
      }
      const user = this.getUser();
      if (user) {
        this.openUpgradeModal();
        if (tier) this.selectUpgradeTier(tier);
      } else {
        sessionStorage.setItem('trd_pending_upgrade', 'true');
        if (tier) sessionStorage.setItem('trd_pending_tier', tier);
        this.openModal('signup');
      }
    },

    selectUpgradeTier(tier) {
      AuthState.selectedTier = tier || 'lifetime';

      const tierMonthly = document.getElementById('pricingTierMonthly');
      const tierQuarterly = document.getElementById('pricingTierQuarterly');
      const tierYearly = document.getElementById('pricingTierYearly');
      const tierLifetime = document.getElementById('pricingTierLifetime');

      if (tierMonthly) tierMonthly.classList.toggle('active', tier === 'monthly');
      if (tierQuarterly) tierQuarterly.classList.toggle('active', tier === 'quarterly');
      if (tierYearly) tierYearly.classList.toggle('active', tier === 'yearly');
      if (tierLifetime) tierLifetime.classList.toggle('active', tier === 'lifetime');

      // Update Stripe Section
      const stripeTitle = document.getElementById('upgradeStripePlanTitle');
      const stripePrice = document.getElementById('upgradeStripePlanPrice');
      const stripeUnit = document.getElementById('upgradeStripePlanPriceUnit');
      const stripeBtn = document.getElementById('upgradeSubmitBtn');

      // Update TNG Section
      const tngPrice = document.getElementById('upgradeTngPrice');
      const tngPlanName = document.getElementById('upgradeTngPlanName');
      const tngBtn = document.getElementById('upgradeTngWhatsAppBtn');

      if (tier === 'monthly') {
        if (stripeTitle) stripeTitle.textContent = 'Monthly Pro';
        if (stripePrice) stripePrice.textContent = 'RM 19';
        if (stripeUnit) stripeUnit.textContent = ' / month';
        if (stripeBtn) stripeBtn.textContent = 'Lock in Monthly RM19/mo →';

        if (tngPrice) tngPrice.textContent = 'RM 19.00';
        if (tngPlanName) tngPlanName.textContent = 'Monthly Pro (RM 19/mo)';
        if (tngBtn) tngBtn.textContent = '📲 WhatsApp Receipt (RM 19 Monthly) →';
      } else if (tier === 'quarterly') {
        if (stripeTitle) stripeTitle.textContent = 'Quarterly Pro Trader (Save 15%)';
        if (stripePrice) stripePrice.textContent = 'RM 49';
        if (stripeUnit) stripeUnit.textContent = ' / 3 months (RM16.33/mo)';
        if (stripeBtn) stripeBtn.textContent = 'Claim Quarterly Pro RM49/3mo →';

        if (tngPrice) tngPrice.textContent = 'RM 49.00';
        if (tngPlanName) tngPlanName.textContent = 'Quarterly Pro (RM 49 / 3-Months)';
        if (tngBtn) tngBtn.textContent = '📲 WhatsApp Receipt (RM 49 Quarterly) →';
      } else if (tier === 'yearly') {
        if (stripeTitle) stripeTitle.textContent = 'Annual Pro Trader (Save 30%)';
        if (stripePrice) stripePrice.textContent = 'RM 159';
        if (stripeUnit) stripeUnit.textContent = ' / year (RM13.25/mo)';
        if (stripeBtn) stripeBtn.textContent = 'Claim Annual Pro RM159/yr →';

        if (tngPrice) tngPrice.textContent = 'RM 159.00';
        if (tngPlanName) tngPlanName.textContent = 'Annual Pro (RM 159 / Year - Save 30%)';
        if (tngBtn) tngBtn.textContent = '📲 WhatsApp Receipt (RM 159 Annual) →';
      } else { // 'lifetime'
        if (stripeTitle) stripeTitle.textContent = '👑 Founder Lifetime Pass (Limited 100 Seats)';
        if (stripePrice) stripePrice.textContent = 'RM 199';
        if (stripeUnit) stripeUnit.textContent = ' One-Time Buyout (Never Pay Again)';
        if (stripeBtn) stripeBtn.textContent = '🔥 Claim Founder Lifetime RM199 (One-Time) →';

        if (tngPrice) tngPrice.textContent = 'RM 199.00';
        if (tngPlanName) tngPlanName.textContent = '👑 Founder Lifetime (RM 199 One-Time)';
        if (tngBtn) tngBtn.textContent = '🔥 WhatsApp Receipt (RM 199 Founder Lifetime) →';
      }
    },

    handleTngWhatsAppClick() {
      const user = this.getUser();
      const email = user ? user.email : 'Guest';
      const tier = AuthState.selectedTier || 'lifetime';

      let planText = "👑 Founder Lifetime Plan (RM199 One-Time - Limited 100 Seats)";
      if (tier === 'monthly') planText = "Monthly Pro Plan (RM19/month)";
      else if (tier === 'quarterly') planText = "Quarterly Pro Plan (RM49/3-months)";
      else if (tier === 'yearly') planText = "Annual Pro Plan (RM159/year - Save 30%)";

      const msg = encodeURIComponent(`Hi TRD Journey, I have transferred via Touch 'n Go / DuitNow for the ${planText}.\nAccount Email: ${email}`);
      window.open(`https://wa.me/601126633131?text=${msg}`, '_blank');
    },

    togglePasswordVisibility() {
      const passInput = document.getElementById('authPasswordInput');
      const toggleBtn = document.getElementById('togglePasswordVisibilityBtn');
      if (!passInput) return;
      if (passInput.type === 'password') {
        passInput.type = 'text';
        if (toggleBtn) toggleBtn.textContent = '🔒';
      } else {
        passInput.type = 'password';
        if (toggleBtn) toggleBtn.textContent = '👁️';
      }
    },

    toggleRedeemBox() {
      const box = document.getElementById('redeemInputBox');
      if (box) {
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
      }
    },

    async handleRedeemKey() {
      const keyInput = document.getElementById('redeemKeyInput');
      const feedbackEl = document.getElementById('redeemFeedbackMsg');
      if (!keyInput || !feedbackEl) return;

      const enteredKey = keyInput.value.trim().toUpperCase();
      if (!enteredKey) {
        feedbackEl.style.display = 'block';
        feedbackEl.style.color = '#ff453a';
        feedbackEl.textContent = 'Please enter an activation code.';
        return;
      }

      const isValid = VALID_REDEEM_KEYS.includes(enteredKey) || enteredKey.startsWith("TRD-PRO-");
      if (!isValid) {
        feedbackEl.style.display = 'block';
        feedbackEl.style.color = '#ff453a';
        feedbackEl.textContent = 'Invalid activation key. Please contact support via WhatsApp.';
        return;
      }

      const user = this.getUser();
      if (!user) {
        feedbackEl.style.display = 'block';
        feedbackEl.style.color = '#ff9f0a';
        feedbackEl.textContent = 'Please sign in or create an account first.';
        return;
      }

      try {
        feedbackEl.style.display = 'block';
        feedbackEl.style.color = '#0a84ff';
        feedbackEl.textContent = 'Verifying key & upgrading...';

        // 1. Check if key has already been consumed by another user in Firestore
        if (window.fbDb) {
          const keyDocRef = window.fbDb.collection('redeemed_keys').doc(enteredKey);
          const keyDocSnap = await keyDocRef.get();

          if (keyDocSnap.exists) {
            const keyData = keyDocSnap.data();
            if (keyData && keyData.usedBy && keyData.usedBy !== user.uid) {
              feedbackEl.style.color = '#ff453a';
              feedbackEl.innerHTML = '⚠️ <strong>This activation code has already been redeemed</strong> by another user. Each code is valid for 1 account only.';
              return;
            }
          }
        }

        const isLifetimeKey = enteredKey.includes('LIFETIME') || enteredKey.includes('FOREVER') || enteredKey.includes('FOUNDER');
        const isAnnualKey = enteredKey.includes('YEAR') || enteredKey.includes('ANNUAL');
        const isQuarterlyKey = enteredKey.includes('QUARTER') || enteredKey.includes('QTR');

        const now = new Date();
        let validUntil = '2099-12-31T23:59:59.999Z';
        let keyTier = 'lifetime';
        let successNotice = '🎉 VIP Key Redeemed! You now have Founder Lifetime Access! 👑';

        if (isLifetimeKey) {
          validUntil = '2099-12-31T23:59:59.999Z';
          keyTier = 'lifetime';
          successNotice = '🎉 VIP Key Redeemed! You now have Founder Lifetime Access! 👑';
        } else if (isAnnualKey) {
          const baseTime = (AuthState.subscription.validUntil && new Date(AuthState.subscription.validUntil).getTime() > now.getTime())
            ? new Date(AuthState.subscription.validUntil).getTime()
            : now.getTime();
          validUntil = new Date(baseTime + 365 * 24 * 60 * 60 * 1000).toISOString();
          keyTier = 'yearly';
          successNotice = '🎉 VIP Key Redeemed! 365 Days of Annual Pro Access added!';
        } else if (isQuarterlyKey) {
          const baseTime = (AuthState.subscription.validUntil && new Date(AuthState.subscription.validUntil).getTime() > now.getTime())
            ? new Date(AuthState.subscription.validUntil).getTime()
            : now.getTime();
          validUntil = new Date(baseTime + 90 * 24 * 60 * 60 * 1000).toISOString();
          keyTier = 'quarterly';
          successNotice = '🎉 VIP Key Redeemed! 90 Days of Quarterly Pro Access added!';
        } else {
          const baseTime = (AuthState.subscription.validUntil && new Date(AuthState.subscription.validUntil).getTime() > now.getTime())
            ? new Date(AuthState.subscription.validUntil).getTime()
            : now.getTime();
          validUntil = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString();
          keyTier = 'monthly';
          successNotice = '🎉 VIP Key Redeemed! 30 Days of Pro Access added!';
        }

        AuthState.subscription = {
          plan: 'pro',
          tier: keyTier,
          status: 'active',
          limit: 999999,
          subscribedAt: AuthState.subscription.subscribedAt || now.toISOString(),
          validUntil: validUntil,
          provider: 'redeem_code',
          redeemKey: enteredKey
        };

        if (window.fbDb) {
          // Atomically mark key as redeemed by this user
          const keyDocRef = window.fbDb.collection('redeemed_keys').doc(enteredKey);
          await keyDocRef.set({
            key: enteredKey,
            tier: keyTier,
            usedBy: user.uid,
            userEmail: user.email,
            usedAt: now.toISOString(),
            validUntil: validUntil
          }, { merge: true });

          const userDocRef = window.fbDb.collection('users').doc(user.uid);
          await userDocRef.set({ subscription: AuthState.subscription }, { merge: true });
        }

        if (typeof confetti === 'function') {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }

        feedbackEl.style.color = '#30d158';
        feedbackEl.innerHTML = successNotice;
        this.renderAuthenticatedUI(user);
        setTimeout(() => this.closeUpgradeModal(), 2000);
      } catch (e) {
        feedbackEl.style.color = '#ff453a';
        feedbackEl.textContent = 'Activation failed: ' + e.message;
      }
    },

    handleUpgradeClick() {
      const user = this.getUser();
      if (!user) {
        this.closeUpgradeModal();
        sessionStorage.setItem('trd_pending_upgrade', 'true');
        sessionStorage.setItem('trd_pending_tier', AuthState.selectedTier || 'lifetime');
        this.openModal('signup');
        return;
      }
      
      const currentTier = AuthState.selectedTier || 'lifetime';
      localStorage.setItem('trd_pending_checkout_tier', currentTier);

      const email = encodeURIComponent(user.email || '');
      const uid = encodeURIComponent(user.uid || '');
      
      const customLink = STRIPE_LINKS[currentTier] || STRIPE_LINKS.lifetime;
      const isPlaceholder = !customLink || !customLink.startsWith("https://buy.stripe.com/") || customLink.includes('example.com');

      if (isPlaceholder) {
        // Safe Fallback: If live Stripe link is not yet set, route smoothly to WhatsApp direct line for instant payment link / VIP key
        let planText = "👑 Founder Lifetime Pass (RM 199 One-Time Buyout)";
        if (currentTier === 'monthly') planText = "Monthly Pro Plan (RM 19/mo)";
        else if (currentTier === 'quarterly') planText = "Quarterly Pro Plan (RM 49/3mo)";
        else if (currentTier === 'yearly') planText = "Annual Pro Plan (RM 159/yr)";

        const msg = encodeURIComponent(`Hi Han! I would like to upgrade to TRD Journey: ${planText}.\nPayment Method: Card / Apple Pay / Online Banking / TNG\nAccount Email: ${user.email || 'Trader'}\nUser ID: ${user.uid || ''}\nPlease send me the payment link or VIP key!`);
        
        window.open(`https://wa.me/601126633131?text=${msg}`, '_blank');
        
        // Also seamlessly toggle to Touch 'n Go & QR section inside modal
        this.switchUpgradeTab('tng');
        if (window.toast) {
          window.toast("💬 WhatsApp direct payment opened! You can also scan the QR code to pay instantly.", "success");
        }
        return;
      }

      const checkoutUrl = `${customLink}?prefilled_email=${email}&client_reference_id=${uid}`;

      // Smooth feedback
      const upgradeBtn = document.getElementById('upgradeSubmitBtn');
      if (upgradeBtn) {
        upgradeBtn.disabled = true;
        upgradeBtn.textContent = "Redirecting to Secure Stripe Checkout...";
      }

      // Open Stripe Checkout
      window.location.href = checkoutUrl;
    },

    switchTab(tab) {
      AuthState.currentTab = tab;
      const tabSignIn = document.getElementById('authTabSignIn');
      const tabSignUp = document.getElementById('authTabSignUp');
      const modalTitle = document.getElementById('authModalTitle');
      const modalSubtitle = document.getElementById('authModalSubtitle');
      const submitBtn = document.getElementById('authSubmitBtn');
      const forgotPassRow = document.getElementById('authForgotRow');
      const backToSignInRow = document.getElementById('authBackSignInRow');
      const passGroup = document.getElementById('authPasswordGroup');

      if (tab === 'signin') {
        if (tabSignIn) tabSignIn.classList.add('active');
        if (tabSignUp) tabSignUp.classList.remove('active');
        if (modalTitle) modalTitle.textContent = "Welcome Back";
        if (modalSubtitle) modalSubtitle.textContent = "Sign in to access your cloud journal";
        if (submitBtn) submitBtn.textContent = "Sign In";
        if (passGroup) passGroup.style.display = 'block';
        if (forgotPassRow) forgotPassRow.style.display = 'flex';
        if (backToSignInRow) backToSignInRow.style.display = 'none';
      } else if (tab === 'signup') {
        if (tabSignIn) tabSignIn.classList.remove('active');
        if (tabSignUp) tabSignUp.classList.add('active');
        if (modalTitle) modalTitle.textContent = "Start Your Journey";
        if (modalSubtitle) modalSubtitle.textContent = "Create your free 20-trade performance account";
        if (submitBtn) submitBtn.textContent = "Create Free Account";
        if (passGroup) passGroup.style.display = 'block';
        if (forgotPassRow) forgotPassRow.style.display = 'none';
        if (backToSignInRow) backToSignInRow.style.display = 'none';
      } else if (tab === 'forgot') {
        if (tabSignIn) tabSignIn.classList.remove('active');
        if (tabSignUp) tabSignUp.classList.remove('active');
        if (modalTitle) modalTitle.textContent = "Reset Password";
        if (modalSubtitle) modalSubtitle.textContent = "Enter your email to receive a password reset link";
        if (submitBtn) submitBtn.textContent = "Send Reset Link";
        if (passGroup) passGroup.style.display = 'none';
        if (forgotPassRow) forgotPassRow.style.display = 'none';
        if (backToSignInRow) backToSignInRow.style.display = 'flex';
      }
    },

    async handleAuthSubmit(e) {
      e.preventDefault();
      const email = document.getElementById('authEmailInput').value.trim();
      const password = document.getElementById('authPasswordInput').value;
      const submitBtn = document.getElementById('authSubmitBtn');

      if (!email) {
        this.showError("Please enter your email address.");
        return;
      }

      this.clearError();
      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Processing...";

      try {
        if (AuthState.currentTab === 'signin') {
          await window.fbAuth.signInWithEmailAndPassword(email, password);
        } else if (AuthState.currentTab === 'signup') {
          if (!password || password.length < 6) {
            throw new Error("Password must be at least 6 characters.");
          }
          await window.fbAuth.createUserWithEmailAndPassword(email, password);
        } else if (AuthState.currentTab === 'forgot') {
          await window.fbAuth.sendPasswordResetEmail(email);
          this.showSuccess(`Password reset email sent to <strong>${email}</strong>.<br><span style="font-size: 11.5px; color: #ff9f0a; display: block; margin-top: 6px;">💡 Note: If not received within 1 minute, please check your <strong>Spam (垃圾邮件)</strong> or Promotions folder.</span>`);
          setTimeout(() => this.switchTab('signin'), 5000);
        }
      } catch (err) {
        let msg = err.message;
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          msg = "Invalid email or password.";
        } else if (err.code === 'auth/email-already-in-use') {
          msg = "This email is already registered. Please sign in instead.";
        }
        this.showError(msg);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    },

    async signOut() {
      if (!window.fbAuth) return;
      try {
        await window.fbAuth.signOut();
      } catch (err) {
        console.error("Sign out error:", err);
      }
    },

    canCreateTrade(currentTradeCount) {
      // Check if user is logged in
      if (!AuthState.currentUser) {
        const count = currentTradeCount ?? (window.state?.trades || []).length;
        if (count >= 20) {
          this.openModal('signup');
          if (window.toast) {
            window.toast("📊 Guest capacity full (20 trades). Sign in to unlock cloud sync.", "warning");
          }
          return false;
        }
        return true;
      }

      // Real-time Auto-Expiration Check before logging ANY trade (Skip if Lifetime member)
      const isLifetime = AuthState.subscription.tier === 'lifetime' || (AuthState.subscription.validUntil && new Date(AuthState.subscription.validUntil).getFullYear() > 2090);
      if (!isLifetime && AuthState.subscription.plan === 'pro' && AuthState.subscription.validUntil) {
        const expiryTime = new Date(AuthState.subscription.validUntil).getTime();
        if (Date.now() > expiryTime) {
          console.log("⏰ Pro subscription expired. Downgrading to Free tier.");
          AuthState.subscription.plan = 'free';
          AuthState.subscription.status = 'expired';
          AuthState.subscription.limit = 20;

          if (window.fbDb && AuthState.currentUser) {
            window.fbDb.collection('users').doc(AuthState.currentUser.uid).set({
              subscription: AuthState.subscription
            }, { merge: true });
          }

          this.updateQuotaBadge();
          if (window.toast) {
            window.toast("⏰ Your Pro subscription has ended. Please renew to unlock unlimited logging.", "warning");
          }
          this.openUpgradeModal();
          return false;
        }
      }

      // If Pro member, unlimited
      if (AuthState.subscription.plan === 'pro') return true;

      // Hard limit for free tier (20 trades)
      const limit = AuthState.subscription.limit || 20;
      if (AuthState.subscription.plan === 'free' && currentTradeCount >= limit) {
        this.openUpgradeModal();
        if (window.toast) {
          window.toast("📊 Free capacity full (20/20 trades). Upgrade to Pro for unlimited journaling.", "warning");
        }
        return false;
      }

      return true;
    },

    applyProFeatureGating() {
      const isPro = AuthState.subscription.plan === 'pro';
      
      // Pro-locked panels in Review module
      const proPanelIds = ['sessionHeatmapCard', 'maeMfeScatterPanel', 'monteCarloPanel'];
      proPanelIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        
        let overlay = el.querySelector('.pro-lock-overlay');
        if (isPro) {
          el.classList.remove('pro-feature-locked-container', 'is-locked');
          if (overlay) overlay.remove();
        } else {
          el.classList.add('pro-feature-locked-container', 'is-locked');
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'pro-lock-overlay';
            overlay.innerHTML = `
              <div class="pro-lock-badge">⭐ PRO EXCLUSIVE</div>
              <div class="pro-lock-title">Unlock Deep Quantitative Edge Diagnostics</div>
              <div class="pro-lock-sub">Gain instant visibility into your highest-expectancy trading sessions, MAE/MFE stop-loss retention, and Monte Carlo probability trials.</div>
              <button class="pro-lock-btn" type="button" onclick="window.TRDAuth.openUpgradeModal()">Unlock Pro & Lifetime Pass →</button>
            `;
            el.appendChild(overlay);
          }
        }
      });

      // If just upgraded to Pro, trigger real-time re-render of quantitative charts
      if (isPro) {
        if (typeof window.executeAndRenderMonteCarlo === 'function') window.executeAndRenderMonteCarlo();
        if (typeof window.renderSessionHeatmap === 'function') window.renderSessionHeatmap();
        if (typeof window.renderMaeMfeScatter === 'function') window.renderMaeMfeScatter();
      }
    },

    showError(msg) {
      const banner = document.getElementById('authErrorBanner');
      if (banner) {
        banner.className = 'auth-error-banner';
        banner.innerHTML = msg;
        banner.style.display = 'block';
      }
    },

    showSuccess(msg) {
      const banner = document.getElementById('authErrorBanner');
      if (banner) {
        banner.className = 'auth-error-banner success';
        banner.innerHTML = msg;
        banner.style.display = 'block';
      }
    },

    clearError() {
      const banner = document.getElementById('authErrorBanner');
      if (banner) banner.style.display = 'none';
    },

    getUser() {
      return AuthState.currentUser;
    },

    getSubscription() {
      return AuthState.subscription;
    }
  };

  // Auto initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.TRDAuth.init());
  } else {
    window.TRDAuth.init();
  }
})();
