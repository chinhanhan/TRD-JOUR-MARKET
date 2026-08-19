// TRD Journey SaaS - Firebase Authentication, Profile & Stripe/TNG Commercial Controller
(function() {
  const STRIPE_CHECKOUT_URL = "https://buy.stripe.com/fZu14n5kJd6721W8ZFdj000";

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
    subscription: { plan: 'free', status: 'active', limit: 20 },
    currentTab: 'signin',
    isInitialized: false
  };

  window.TRDAuth = {
    init() {
      if (!window.fbAuth) {
        console.warn("⚠️ Firebase Auth not available yet.");
        return;
      }

      this.bindDOM();
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
            setTimeout(() => {
              this.openUpgradeModal();
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
        const isPaymentSuccess = window.location.search.includes('upgrade=success') || window.location.search.includes('payment=success');

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
          AuthState.subscription = initialProfile.subscription;
        }

        // Activate Pro if returning from Stripe checkout
        if (isPaymentSuccess && AuthState.subscription.plan !== 'pro') {
          AuthState.subscription = {
            plan: 'pro',
            status: 'active',
            limit: 999999,
            subscribedAt: new Date().toISOString(),
            provider: 'stripe'
          };
          await userDocRef.set({ subscription: AuthState.subscription }, { merge: true });
          alert("🎉 Congratulations! Your TRD Journey Early Bird Pro subscription is now ACTIVE!");
          // Clean up url parameter
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

      const isPro = AuthState.subscription.plan === 'pro';
      if (userPlanBadge) {
        userPlanBadge.className = `user-plan-badge ${isPro ? 'pro' : 'free'}`;
        userPlanBadge.textContent = isPro ? 'PRO' : 'FREE';
      }
      if (dropdownPlan) {
        dropdownPlan.textContent = isPro ? 'Plan: Pro Member ⭐' : 'Plan: Free (20 Limit)';
      }

      this.updateQuotaBadge();
    },

    updateQuotaBadge() {
      const quotaBadge = document.getElementById('headerQuotaBadge');
      if (!quotaBadge) return;

      const isPro = AuthState.subscription.plan === 'pro';
      const tradeCount = (window.state && Array.isArray(window.state.trades)) ? window.state.trades.length : 0;
      const limit = AuthState.subscription.limit || 20;

      if (isPro) {
        quotaBadge.className = 'quota-pill pro';
        quotaBadge.innerHTML = '⭐ Pro Active';
        quotaBadge.title = 'Unlimited Trade Logs';
        quotaBadge.onclick = null;
      } else {
        const isNearLimit = tradeCount >= (limit - 3);
        const isMaxed = tradeCount >= limit;
        quotaBadge.className = `quota-pill free ${isMaxed ? 'maxed' : (isNearLimit ? 'warning' : '')}`;
        quotaBadge.innerHTML = `📊 ${tradeCount}/${limit} Trades`;
        quotaBadge.title = `${tradeCount} of ${limit} free trades used. Click to upgrade.`;
        quotaBadge.onclick = () => this.openUpgradeModal();
      }
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
    },

    openModal(tab = 'signin') {
      this.switchTab(tab);
      const modal = document.getElementById('authModalBackdrop');
      if (modal) modal.classList.add('active');
      this.clearError();
    },

    closeModal() {
      const modal = document.getElementById('authModalBackdrop');
      if (modal) modal.classList.remove('active');
    },

    openUpgradeModal() {
      const modal = document.getElementById('upgradeModalBackdrop');
      if (modal) modal.classList.add('active');
    },

    closeUpgradeModal() {
      const modal = document.getElementById('upgradeModalBackdrop');
      if (modal) modal.classList.remove('active');
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

    startProUpgradeIntent() {
      const user = this.getUser();
      if (user) {
        this.openUpgradeModal();
      } else {
        sessionStorage.setItem('trd_pending_upgrade', 'true');
        this.openModal('signup');
      }
    },

    handleTngWhatsAppClick() {
      const user = this.getUser();
      const email = user ? user.email : 'Guest';
      const msg = encodeURIComponent(`Hi TRD Journey, I have transferred RM19 via Touch 'n Go / DuitNow to activate PRO.\nAccount Email: ${email}`);
      window.open(`https://wa.me/60127790020?text=${msg}`, '_blank');
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

        AuthState.subscription = {
          plan: 'pro',
          status: 'active',
          limit: 999999,
          subscribedAt: new Date().toISOString(),
          provider: 'redeem_code',
          redeemKey: enteredKey
        };

        if (window.fbDb) {
          const userDocRef = window.fbDb.collection('users').doc(user.uid);
          await userDocRef.set({ subscription: AuthState.subscription }, { merge: true });
        }

        feedbackEl.style.color = '#30d158';
        feedbackEl.innerHTML = '🎉 <strong>PRO Activated Successfully!</strong> Unlimited trades unlocked.';
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
        this.openModal('signup');
        return;
      }
      
      const email = encodeURIComponent(user.email || '');
      const uid = encodeURIComponent(user.uid || '');
      const checkoutUrl = `${STRIPE_CHECKOUT_URL}?prefilled_email=${email}&client_reference_id=${uid}`;

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
        this.openModal('signup');
        return false;
      }
      // If Pro member, unlimited
      if (AuthState.subscription.plan === 'pro') return true;

      // If Free member, limit to 20 trades
      const limit = AuthState.subscription.limit || 20;
      if (currentTradeCount >= limit) {
        this.openUpgradeModal();
        return false;
      }
      return true;
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
