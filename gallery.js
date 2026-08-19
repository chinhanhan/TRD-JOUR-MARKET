// visionOS 2.0 Spatial Liquid Glass Bento Grid & Dynamic Island Launcher
// Direct single-click 5-module spatial launcher with 3D tilt, LaserFlow background, ClickSpark burst & React Bits StaggeredMenu drawer

class LaserFlowEngine {
  constructor() {
    this.wrapper = document.getElementById('laserFlowBgWrapper');
    this.canvas = document.getElementById('laserFlowCanvas');
    this.revealLayer = document.getElementById('laserFlowRevealLayer');
    this.landing = document.getElementById('landing-gallery');

    if (!this.wrapper || !this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.targetMouse = { x: -9999, y: -9999 };
    this.currentMouse = { x: -9999, y: -9999 };
    this.particles = [];
    this.time = 0;
    this.isHovering = false;

    this.initCanvas();
    this.initParticles();
    this.bindEvents();
    this.animate();
  }

  initCanvas() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  initParticles() {
    this.particles = [];
    const count = 45;
    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let color = 'rgba(56, 189, 248, ';      // Ice Cyan
      if (rand > 0.65) color = 'rgba(139, 92, 246, ';    // Cyber Violet
      else if (rand > 0.35) color = 'rgba(96, 165, 250, ';  // Electric Blue

      this.particles.push({
        x: Math.random() * (this.width || 1200),
        y: Math.random() * (this.height || 800),
        len: 90 + Math.random() * 240,
        speed: 1.2 + Math.random() * 3.2,
        width: 1.5 + Math.random() * 2.5,
        color,
        alpha: 0.25 + Math.random() * 0.65
      });
    }
  }

  bindEvents() {
    if (!this.landing) return;

    this.landing.addEventListener('mousemove', (e) => {
      const rect = this.landing.getBoundingClientRect();
      this.targetMouse.x = e.clientX - rect.left;
      this.targetMouse.y = e.clientY - rect.top;
      this.isHovering = true;
    });

    this.landing.addEventListener('mouseleave', () => {
      this.isHovering = false;
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Lerp mouse coordinates for fluid liquid motion
    if (this.isHovering) {
      this.currentMouse.x += (this.targetMouse.x - this.currentMouse.x) * 0.12;
      this.currentMouse.y += (this.targetMouse.y - this.currentMouse.y) * 0.12;
    } else {
      this.currentMouse.x += (-9999 - this.currentMouse.x) * 0.08;
      this.currentMouse.y += (-9999 - this.currentMouse.y) * 0.08;
    }

    // Update CSS Custom Properties on background wrapper for mask reveal
    if (this.wrapper) {
      this.wrapper.style.setProperty('--mx', `${this.currentMouse.x.toFixed(1)}px`);
      this.wrapper.style.setProperty('--my', `${this.currentMouse.y.toFixed(1)}px`);
    }

    // Draw Laser Flow Wisps on Canvas
    if (!this.ctx) return;
    this.time += 0.015;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw volumetric background laser beam core
    const beamGlow = this.ctx.createLinearGradient(0, 0, this.width, this.height);
    beamGlow.addColorStop(0, 'rgba(255, 121, 198, 0.08)');
    beamGlow.addColorStop(0.5, 'rgba(123, 97, 255, 0.12)');
    beamGlow.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
    this.ctx.fillStyle = beamGlow;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Render wisps moving along laser paths
    this.particles.forEach((p) => {
      p.y -= p.speed;
      if (p.y + p.len < 0) {
        p.y = this.height + Math.random() * 100;
        p.x = Math.random() * this.width;
      }

      const grad = this.ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.len);
      grad.addColorStop(0, p.color + '0)');
      grad.addColorStop(0.5, p.color + p.alpha + ')');
      grad.addColorStop(1, p.color + '0)');

      this.ctx.strokeStyle = grad;
      this.ctx.lineWidth = p.width;
      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.y);
      this.ctx.lineTo(p.x + Math.sin(this.time + p.x * 0.01) * 18, p.y + p.len);
      this.ctx.stroke();
    });
  }
}

// React Bits ClickSpark Particle Burst Engine
class ClickSparkEngine {
  constructor(options = {}) {
    this.canvas = document.getElementById('clickSparkCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.sparkColor = options.sparkColor || '#10B981';
    this.sparkSize = options.sparkSize || 20;
    this.sparkRadius = options.sparkRadius || 42;
    this.sparkCount = options.sparkCount || 10;
    this.duration = options.duration || 450;
    
    this.sparks = [];
    this.isAnimating = false;
    this.initCanvas();
    this.bindEvents();
  }

  initCanvas() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = this.canvas.width = window.innerWidth * dpr;
    this.height = this.canvas.height = window.innerHeight * dpr;
    this.dpr = dpr;
  }

  bindEvents() {
    window.addEventListener('pointerdown', (e) => {
      this.triggerSparks(e.clientX, e.clientY, e.target);
    });
  }

  triggerSparks(clientX, clientY, target) {
    if (!this.ctx) return;
    
    const x = clientX * this.dpr;
    const y = clientY * this.dpr;
    const now = performance.now();
    
    // Choose harmonized accent color based on clicked element or default to Ice Cyber Cyan (#38BDF8)
    let color = '#38BDF8';
    const card = target ? target.closest('.css3d-card') : null;
    if (card) {
      const mod = card.getAttribute('data-module');
      if (mod === 'overview') color = '#10B981';      // Emerald Green
      else if (mod === 'journal') color = '#F59E0B';   // Gold Amber
      else if (mod === 'missions') color = '#EC4899';  // Neon Rose
      else if (mod === 'review') color = '#38BDF8';     // Ocean Cyan
      else if (mod === 'settings') color = '#34D399';   // Emerald Teal
    } else if (target && target.closest('.island-action-btn')) {
      color = '#A78BFA';                                // Royal Purple
    }

    for (let i = 0; i < this.sparkCount; i++) {
      this.sparks.push({
        x,
        y,
        angle: (2 * Math.PI * i) / this.sparkCount + (Math.random() * 0.2 - 0.1),
        startTime: now,
        color
      });
    }

    if (!this.isAnimating) {
      this.isAnimating = true;
      this.animate();
    }
  }

  animate() {
    if (!this.ctx) {
      this.isAnimating = false;
      return;
    }

    this.ctx.clearRect(0, 0, this.width, this.height);
    if (this.sparks.length === 0) {
      this.isAnimating = false;
      return;
    }

    const now = performance.now();

    this.sparks = this.sparks.filter((spark) => {
      const elapsed = now - spark.startTime;
      if (elapsed >= this.duration) return false;

      const progress = elapsed / this.duration;
      // Ease-out formula: t * (2 - t)
      const eased = progress * (2 - progress);

      const radius = this.sparkRadius * this.dpr;
      const size = this.sparkSize * this.dpr;

      const distance = eased * radius;
      const lineLength = size * (1 - eased);

      const x1 = spark.x + distance * Math.cos(spark.angle);
      const y1 = spark.y + distance * Math.sin(spark.angle);
      const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
      const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

      this.ctx.strokeStyle = spark.color;
      this.ctx.lineWidth = 2.2 * this.dpr;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();

      return true;
    });

    if (this.sparks.length > 0) {
      requestAnimationFrame(() => this.animate());
    } else {
      this.isAnimating = false;
    }
  }
}

// React Bits Inspired StaggeredMenu Drawer & Toggle Button Engine
class StaggeredMenuEngine {
  constructor() {
    this.wrapper = document.getElementById('staggeredMenuWrapper');
    this.toggleBtn = document.getElementById('staggeredMenuToggle');
    this.panel = document.getElementById('staggeredMenuPanel');
    this.items = Array.from(document.querySelectorAll('.sm-panel-item'));
    
    if (!this.wrapper || !this.toggleBtn) return;
    
    this.isOpen = false;
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    this.toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.items.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetModule = item.dataset.module;
        if (targetModule && window.openModule) {
          window.openModule(targetModule);
        }
        this.close();
      });
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;
      if (this.panel && !this.panel.contains(e.target) && !this.toggleBtn.contains(e.target)) {
        this.close();
      }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Update active highlight on module change
    window.addEventListener('moduleChanged', (e) => {
      const modId = e.detail ? e.detail.moduleId : null;
      if (!modId) return;
      this.items.forEach((item) => {
        const isSel = item.dataset.module === modId;
        item.classList.toggle('is-active', isSel);
      });
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.wrapper.classList.add('is-open');
    this.toggleBtn.setAttribute('aria-expanded', 'true');
    if (this.panel) this.panel.setAttribute('aria-hidden', 'false');
  }

  close() {
    this.isOpen = false;
    this.wrapper.classList.remove('is-open');
    this.toggleBtn.setAttribute('aria-expanded', 'false');
    if (this.panel) this.panel.setAttribute('aria-hidden', 'true');
  }
}

class VisionOSBentoLauncher {
  constructor() {
    this.container = document.getElementById('css3d-carousel-container');
    this.cards = Array.from(document.querySelectorAll('.css3d-card'));
    
    if (this.container && this.cards.length > 0) {
      this.initCards();
      this.addEventListeners();
      this.updateDynamicIsland();
      this.updateBentoStats();
    }
  }
  
  updateDynamicIsland() {
    if (!window.state) return;
    
    const islandGuardrail = document.getElementById('islandGuardrail');
    if (islandGuardrail && window.state.preferences) {
      islandGuardrail.textContent = `Max Loss: -${window.state.preferences.dailyMaxLossR || 2}R`;
    }
    
    const islandStreak = document.getElementById('islandStreak');
    if (islandStreak) {
      const streakCount = window.state.stats ? window.state.stats.disciplineStreak : 5;
      islandStreak.textContent = `${streakCount || 5} Trades`;
    }
  }

  updateBentoStats() {
    if (!window.state || !window.state.trades) return;
    const trades = window.state.trades;
    let totalR = 0;
    const points = [0];
    trades.forEach(t => {
      totalR += (t.resultR || 0);
      points.push(totalR);
    });
    
    const statEl = document.getElementById('bentoEquityStat');
    if (statEl) {
      const formatted = (totalR >= 0 ? '+' : '') + totalR.toFixed(2) + 'R Equity';
      statEl.textContent = formatted;
    }

    // Dynamic SVG Sparkline generator from real trade history
    const sparklinePath = document.getElementById('bentoSparklinePath');
    if (sparklinePath && points.length > 1) {
      const minR = Math.min(...points, 0);
      const maxR = Math.max(...points, 1);
      const range = (maxR - minR) || 1;
      const width = 200;
      const height = 30;
      const padding = 5;
      
      const d = points.map((val, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = height + padding - ((val - minR) / range) * height;
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      
      sparklinePath.setAttribute('d', d);
    }
  }
  
  initCards() {
    this.cards.forEach((card) => {
      card.style.transform = '';
      const targetModule = card.dataset.module;
      
      // Single Click Handler: Instant module launch
      card.addEventListener('click', (e) => {
        if (window.openModule) {
          window.openModule(targetModule);
        }
      });
      
      // visionOS 3D Mouse Parallax Tilt & Specular Glare Sheen
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const tiltX = -((y - centerY) / centerY) * 12;
        const tiltY = ((x - centerX) / centerX) * 12;
        
        const glareX = (x / rect.width) * 100;
        const glareY = (y / rect.height) * 100;
        
        const inner = card.querySelector('.card-inner');
        if (inner) {
          inner.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
          inner.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
          inner.style.setProperty('--glare-x', `${glareX.toFixed(2)}%`);
          inner.style.setProperty('--glare-y', `${glareY.toFixed(2)}%`);
          inner.style.setProperty('--glare-opacity', '0.45');
        }
      }, { passive: true });
      
      card.addEventListener('mouseleave', () => {
        const inner = card.querySelector('.card-inner');
        if (inner) {
          inner.style.setProperty('--tilt-x', '0deg');
          inner.style.setProperty('--tilt-y', '0deg');
          inner.style.setProperty('--glare-opacity', '0');
        }
      }, { passive: true });
    });
  }
  
  addEventListeners() {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
  }
  
  onKeyDown(e) {
    const landing = document.getElementById('landing-gallery');
    if (!landing || !landing.classList.contains('active')) return;
    
    // Quick module launch shortcuts via keyboard 1-5
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      const modules = ['overview', 'journal', 'missions', 'review', 'settings'];
      const target = modules[parseInt(e.key, 10) - 1];
      if (window.openModule) window.openModule(target);
    }
  }
  
  collapseCard() {
    // Compatibility helper
  }
}

// Global helper for Dynamic Island action
window.triggerBentoAction = function(actionStr, moduleName) {
  if (actionStr === 'open-capture') {
    if (window.openSheet) window.openSheet('tradeFormSheet');
    return;
  }
  if (moduleName && window.openModule) {
    window.openModule(moduleName);
  }
};

// Global initializer - Guaranteed 100% execution for all engines
window.initCSS3DCarousel = function() {
  try {
    window.laserFlowEngine = new LaserFlowEngine();
  } catch (err) {
    console.warn('LaserFlowEngine init:', err);
  }
  try {
    window.clickSparkEngine = new ClickSparkEngine();
  } catch (err) {
    console.warn('ClickSparkEngine init:', err);
  }
  try {
    window.staggeredMenuEngine = new StaggeredMenuEngine();
  } catch (err) {
    console.warn('StaggeredMenuEngine init:', err);
  }
  window.css3dCarousel = new VisionOSBentoLauncher();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.initCSS3DCarousel();
  });
} else {
  window.initCSS3DCarousel();
}
