// React Bits Inspired Dock Engine in Vanilla JS
// Features: Mouse Proximity Spring Magnification (50px -> 70px), Tooltip Labels, and Module Action Triggers

class ReactBitsDockEngine {
  constructor(options = {}) {
    let container = document.getElementById('reactBitsDock');
    if (!container) {
      container = document.createElement('div');
      container.className = 'dock-outer';
      container.id = 'reactBitsDock';
      document.body.appendChild(container);
    }
    this.container = container;

    this.baseItemSize = options.baseItemSize || 50;
    this.magnification = options.magnification || 70;
    this.distance = options.distance || 200;
    this.panelHeight = options.panelHeight || 68;

    this.items = options.items || [
      { module: 'overview', icon: '📅', label: 'Today', onClick: () => window.openModule && window.openModule('overview') },
      { module: 'journal', icon: '✍️', label: 'Journal', onClick: () => window.openModule && window.openModule('journal') },
      { module: 'missions', icon: '🎯', label: 'Missions', onClick: () => window.openModule && window.openModule('missions') },
      { module: 'review', icon: '📊', label: 'Review', onClick: () => window.openModule && window.openModule('review') },
      { module: 'simulation', icon: '🎲', label: 'Simulation', onClick: () => { window.openModule?.('review'); setTimeout(() => document.querySelector('[data-review-panel="simulation"]')?.click(), 50); } },
      { module: 'settings', icon: '⚙️', label: 'System', onClick: () => window.openModule && window.openModule('settings') }
    ];

    this.mouseX = Infinity;
    this.isHovered = false;
    this.itemStates = [];
    this.animFrame = null;

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.startLoop();
  }

  render() {
    this.container.innerHTML = `
      <div class="dock-panel" role="toolbar" aria-label="Application dock">
        ${this.items.map((item, idx) => `
          <div class="dock-item ${idx === 0 ? 'active' : ''}" data-dock-index="${idx}" data-dock-module="${item.module}" tabIndex="0" role="button" aria-label="${item.label}">
            <div class="dock-icon">${item.icon}</div>
            <div class="dock-label">${item.label}</div>
          </div>
        `).join('')}
      </div>
    `;

    const itemEls = this.container.querySelectorAll('.dock-item');
    this.itemStates = Array.from(itemEls).map((el, idx) => ({
      el,
      iconEl: el.querySelector('.dock-icon'),
      currentSize: this.baseItemSize,
      targetSize: this.baseItemSize,
      velocity: 0,
      itemData: this.items[idx]
    }));
  }

  bindEvents() {
    const panel = this.container.querySelector('.dock-panel');
    if (!panel) return;

    panel.addEventListener('mousemove', (e) => {
      this.isHovered = true;
      this.mouseX = e.pageX;
    }, { passive: true });

    panel.addEventListener('mouseleave', () => {
      this.isHovered = false;
      this.mouseX = Infinity;
    }, { passive: true });

    this.itemStates.forEach(state => {
      state.el.addEventListener('click', () => {
        if (window.appleAudioEngine) window.appleAudioEngine.play('dockClick');
        if (state.itemData.onClick) {
          state.itemData.onClick();
        }
      });

      state.el.addEventListener('mouseenter', () => {
        if (window.appleAudioEngine) window.appleAudioEngine.play('dockHover');
        const label = state.el.querySelector('.dock-label');
        if (label) label.classList.add('is-visible');
      });

      state.el.addEventListener('mouseleave', () => {
        const label = state.el.querySelector('.dock-label');
        if (label) label.classList.remove('is-visible');
      });

      state.el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (state.itemData.onClick) state.itemData.onClick();
        }
      });
    });
  }

  startLoop() {
    const lerpSpeed = 0.22;
    const step = () => {
      if (!this.container || !document.body.contains(this.container)) return;
      this.itemStates.forEach((state) => {
        // Measure unmagnified base center of each item directly from its left edge + half base size
        const rect = state.el.getBoundingClientRect();
        const itemBaseCenterX = rect.left + this.baseItemSize / 2;

        let target = this.baseItemSize;
        if (this.isHovered && this.mouseX !== Infinity) {
          const dist = Math.abs(this.mouseX - itemBaseCenterX);
          if (dist < this.distance) {
            const factor = Math.cos((dist / this.distance) * (Math.PI / 2));
            target = this.baseItemSize + (this.magnification - this.baseItemSize) * Math.pow(factor, 2);
          }
        }

        // Hard clamp target size to magnification limit (max 70px)
        target = Math.min(this.magnification, Math.max(this.baseItemSize, target));

        // Butter-smooth 60fps exponential lerp (prevents velocity overshoot & frame jitter)
        state.currentSize += (target - state.currentSize) * lerpSpeed;

        if (Math.abs(target - state.currentSize) < 0.05) {
          state.currentSize = target;
        }

        // Hard clamp currentSize
        state.currentSize = Math.min(this.magnification, Math.max(this.baseItemSize, state.currentSize));

        state.el.style.width = `${state.currentSize}px`;
        state.el.style.height = `${state.currentSize}px`;

        if (state.iconEl) {
          const iconSize = Math.round(20 + ((state.currentSize - 50) / 20) * 8);
          state.iconEl.style.fontSize = `${iconSize}px`;
        }
      });

      this.animFrame = requestAnimationFrame(step);
    };

    step();
  }

  setActiveModule(name) {
    this.itemStates.forEach(state => {
      if (state.itemData.module === name) {
        state.el.classList.add('active');
      } else {
        state.el.classList.remove('active');
      }
    });
  }

  updateDockLanguage(lang) {
    const labels = {
      en: { overview: 'Today', journal: 'Journal', missions: 'Missions', review: 'Review', simulation: 'Simulation', settings: 'System' },
      zh: { overview: '今日', journal: '记录', missions: '任务', review: '复盘', simulation: '沙盒', settings: '系统' }
    };
    const currentMap = labels[lang] || labels.en;
    this.items.forEach((item, idx) => {
      if (currentMap[item.module]) {
        item.label = currentMap[item.module];
        const labelEl = this.container.querySelector(`[data-dock-index="${idx}"] .dock-label`);
        if (labelEl) labelEl.textContent = item.label;
      }
    });
  }
}

// Instantiate immediately and on DOM load
function initDock() {
  if (!window.reactBitsDockEngine) {
    window.reactBitsDockEngine = new ReactBitsDockEngine();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDock);
} else {
  initDock();
}
