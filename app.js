/* ================================================================
   TodoVerse — app.js
   Full application logic + visual effects
   ================================================================ */

'use strict';

// ================================================================
// CONSTANTS
// ================================================================

const EMOJIS = ['📝','🚀','⭐','🎯','💡','🔥','🌟','📚','🎨','🏆','🌈','💎','🦋','🌊','⚡','🎪','🎭','🦄','🍀','🔮'];

const COLOR_THEMES = [
  { key:'cosmic',   from:'#7c3aed', to:'#a855f7', glow:'rgba(168,85,247,0.5)'  },
  { key:'ocean',    from:'#0891b2', to:'#06b6d4', glow:'rgba(6,182,212,0.5)'   },
  { key:'rose',     from:'#be123c', to:'#f43f5e', glow:'rgba(244,63,94,0.5)'   },
  { key:'emerald',  from:'#059669', to:'#10b981', glow:'rgba(16,185,129,0.5)'  },
  { key:'amber',    from:'#b45309', to:'#f59e0b', glow:'rgba(245,158,11,0.5)'  },
  { key:'azure',    from:'#1d4ed8', to:'#3b82f6', glow:'rgba(59,130,246,0.5)'  },
  { key:'sunset',   from:'#c2410c', to:'#fb923c', glow:'rgba(251,146,60,0.5)'  },
  { key:'sakura',   from:'#9d174d', to:'#f472b6', glow:'rgba(244,114,182,0.5)' },
];

const STORAGE_KEY = 'todoverse_v1';

// Particle tuning constants
const PARTICLE_AREA_DIVISOR = 15000;
const PARTICLE_MAX_COUNT    = 80;
const PARTICLE_LINK_DIST    = 130;

// ================================================================
// STATE
// ================================================================

let state = {
  lists: [],
  currentListId: null,
  newTaskComplex: false,
  editingTaskId: null,
  activeFilter: 'all',
};

// ================================================================
// PERSISTENCE
// ================================================================

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lists: state.lists }));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.lists)) {
      state.lists = parsed.lists;
    }
  } catch (e) {
    console.warn('Could not load from localStorage:', e);
  }
}

// ================================================================
// UTILITIES
// ================================================================

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getTheme(key) {
  return COLOR_THEMES.find(t => t.key === key) || COLOR_THEMES[0];
}

function getCurrentList() {
  return state.lists.find(l => l.id === state.currentListId) || null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ================================================================
// TOAST NOTIFICATIONS
// ================================================================

function showToast(message, type = 'info', icon = null) {
  const container = document.getElementById('toast-container');
  const defaultIcons = { success:'✅', error:'❌', info:'💫' };
  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;
  toastEl.innerHTML = `
    <span class="toast-icon">${icon || defaultIcons[type]}</span>
    <span>${message}</span>
  `;
  container.appendChild(toastEl);
  setTimeout(() => {
    toastEl.classList.add('toast-out');
    toastEl.addEventListener('animationend', () => toastEl.remove(), { once: true });
  }, 3000);
}

// ================================================================
// CONFETTI ENGINE
// ================================================================

const confettiCanvas = document.getElementById('confetti-canvas');
const confettiCtx = confettiCanvas.getContext('2d');
let confettiParticles = [];
let confettiRAF = null;

function resizeConfettiCanvas() {
  confettiCanvas.width  = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeConfettiCanvas();
window.addEventListener('resize', resizeConfettiCanvas);

function launchConfetti(x, y, count = 60) {
  const colors = ['#7c3aed','#a855f7','#06b6d4','#f43f5e','#10b981','#f59e0b','#3b82f6','#f472b6'];
  for (let i = 0; i < count; i++) {
    const angle = (Math.random() * Math.PI * 2);
    const speed = 4 + Math.random() * 8;
    confettiParticles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 5 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: 0.015 + Math.random() * 0.02,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      shape: Math.random() < 0.5 ? 'rect' : 'circle',
    });
  }
  if (!confettiRAF) tickConfetti();
}

function tickConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiParticles = confettiParticles.filter(p => p.life > 0);

  for (const p of confettiParticles) {
    confettiCtx.save();
    confettiCtx.globalAlpha = p.life;
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rotation);
    confettiCtx.fillStyle = p.color;
    if (p.shape === 'rect') {
      confettiCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else {
      confettiCtx.beginPath();
      confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      confettiCtx.fill();
    }
    confettiCtx.restore();

    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3; // gravity
    p.vx *= 0.99;
    p.life -= p.decay;
    p.rotation += p.rotSpeed;
  }

  if (confettiParticles.length > 0) {
    confettiRAF = requestAnimationFrame(tickConfetti);
  } else {
    confettiRAF = null;
  }
}

// ================================================================
// BACKGROUND CANVAS — PARTICLES + GLOW ORBS
// ================================================================

const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');
let bgParticles = [];
let bgOrbs = [];
let bgRAF = null;
let mouseX = 0, mouseY = 0;

function resizeBgCanvas() {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
resizeBgCanvas();
window.addEventListener('resize', () => { resizeBgCanvas(); initBgParticles(); });

function initBgParticles() {
  const count = Math.min(Math.floor(window.innerWidth * window.innerHeight / PARTICLE_AREA_DIVISOR), PARTICLE_MAX_COUNT);
  bgParticles = Array.from({ length: count }, () => ({
    x: Math.random() * bgCanvas.width,
    y: Math.random() * bgCanvas.height,
    r: 0.5 + Math.random() * 2,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    alpha: 0.15 + Math.random() * 0.5,
    baseAlpha: 0.15 + Math.random() * 0.5,
    pulseSpeed: 0.01 + Math.random() * 0.02,
    pulsePhase: Math.random() * Math.PI * 2,
    color: ['#7c3aed','#06b6d4','#f43f5e','#a855f7','#10b981','#f472b6','#3b82f6'][Math.floor(Math.random()*7)],
  }));
}
initBgParticles();

let bgTick = 0;

function tickBg() {
  bgTick++;
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

  // draw connection lines between nearby particles
  for (let i = 0; i < bgParticles.length; i++) {
    for (let j = i + 1; j < bgParticles.length; j++) {
      const dx = bgParticles[i].x - bgParticles[j].x;
      const dy = bgParticles[i].y - bgParticles[j].y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < PARTICLE_LINK_DIST) {
        bgCtx.beginPath();
        bgCtx.strokeStyle = `rgba(124,58,237,${0.15 * (1 - dist/PARTICLE_LINK_DIST)})`;
        bgCtx.lineWidth = 0.5;
        bgCtx.moveTo(bgParticles[i].x, bgParticles[i].y);
        bgCtx.lineTo(bgParticles[j].x, bgParticles[j].y);
        bgCtx.stroke();
      }
    }
  }

  // draw & update particles
  for (const p of bgParticles) {
    // subtle mouse repulsion
    const dx = p.x - mouseX;
    const dy = p.y - mouseY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 120) {
      p.vx += (dx / dist) * 0.06;
      p.vy += (dy / dist) * 0.06;
    }
    p.vx = clamp(p.vx, -1.8, 1.8);
    p.vy = clamp(p.vy, -1.8, 1.8);
    // gentle drag
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = bgCanvas.width;
    if (p.x > bgCanvas.width) p.x = 0;
    if (p.y < 0) p.y = bgCanvas.height;
    if (p.y > bgCanvas.height) p.y = 0;

    // pulsing alpha
    p.alpha = p.baseAlpha + Math.sin(bgTick * p.pulseSpeed + p.pulsePhase) * 0.2;

    // draw glow
    const gradient = bgCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
    gradient.addColorStop(0, p.color);
    gradient.addColorStop(1, 'transparent');
    bgCtx.beginPath();
    bgCtx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
    bgCtx.fillStyle = gradient;
    bgCtx.globalAlpha = p.alpha * 0.3;
    bgCtx.fill();

    // draw core dot
    bgCtx.beginPath();
    bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    bgCtx.fillStyle = p.color;
    bgCtx.globalAlpha = p.alpha;
    bgCtx.fill();
    bgCtx.globalAlpha = 1;
  }

  bgRAF = requestAnimationFrame(tickBg);
}
tickBg();

// ================================================================
// CURSOR GLOW + MOUSE TRAIL
// ================================================================

const cursorGlow = document.getElementById('cursor-glow');
let lastTrailTime = 0;
const trailColors = ['#7c3aed','#a855f7','#06b6d4','#f43f5e','#10b981','#f472b6'];
let trailColorIdx = 0;

window.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursorGlow.style.left = e.clientX + 'px';
  cursorGlow.style.top  = e.clientY + 'px';

  // Mouse trail particles
  const now = Date.now();
  if (now - lastTrailTime > 40) {
    lastTrailTime = now;
    const dot = document.createElement('div');
    dot.className = 'cursor-trail';
    dot.style.left = e.clientX + 'px';
    dot.style.top  = e.clientY + 'px';
    dot.style.background = trailColors[trailColorIdx % trailColors.length];
    trailColorIdx++;
    document.body.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
  }
});

// ================================================================
// SHOOTING STARS
// ================================================================

function spawnComet() {
  const comet = document.createElement('div');
  comet.className = 'comet';
  const startY = Math.random() * window.innerHeight * 0.6;
  const startX = Math.random() * window.innerWidth * 0.3;
  comet.style.top  = startY + 'px';
  comet.style.left = startX + 'px';
  comet.style.transform = `rotate(${20 + Math.random() * 30}deg)`;
  comet.style.opacity = (0.4 + Math.random() * 0.4).toString();
  document.body.appendChild(comet);
  comet.addEventListener('animationend', () => comet.remove(), { once: true });
}

// Spawn a comet every 6-14 seconds
(function scheduleCometLoop() {
  spawnComet();
  setTimeout(scheduleCometLoop, 6000 + Math.random() * 8000);
})();

// ================================================================
// SPARKLE BURST (on click anywhere)
// ================================================================

const SPARKLE_CHARS = ['✦','★','✸','✺','✻','✼','❋','✿'];

function spawnSparkles(x, y, count = 6) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.textContent = SPARKLE_CHARS[Math.floor(Math.random() * SPARKLE_CHARS.length)];
    const angle = (i / count) * Math.PI * 2;
    const dist  = 30 + Math.random() * 50;
    s.style.left = x + 'px';
    s.style.top  = y + 'px';
    s.style.color = trailColors[Math.floor(Math.random() * trailColors.length)];
    s.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    s.style.fontSize = (0.7 + Math.random() * 0.6) + 'rem';
    s.style.animationDuration = (0.5 + Math.random() * 0.5) + 's';
    document.body.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
  }
}

document.addEventListener('click', e => {
  // Spawn sparkles on all clicks
  spawnSparkles(e.clientX, e.clientY, 5);
});

// ================================================================
// SCREEN-WIDE RIPPLE ON TASK COMPLETE
// ================================================================

function screenRipple(x, y, color) {
  const ripple = document.createElement('div');
  ripple.className = 'screen-ripple';
  ripple.style.left = x + 'px';
  ripple.style.top  = y + 'px';
  ripple.style.width  = '60px';
  ripple.style.height = '60px';
  ripple.style.border = `2px solid ${color}`;
  ripple.style.boxShadow = `0 0 20px ${color}`;
  document.body.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

// ================================================================
// SCROLL PROGRESS BAR
// ================================================================

const scrollProgressBar = document.createElement('div');
scrollProgressBar.id = 'scroll-progress';
document.body.prepend(scrollProgressBar);

window.addEventListener('scroll', () => {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  const pct = total > 0 ? (window.scrollY / total) * 100 : 0;
  scrollProgressBar.style.width = pct + '%';
}, { passive: true });

// ================================================================
// 3-D CARD TILT EFFECT
// ================================================================

function attachTilt(el) {
  el.addEventListener('mousemove', e => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width  / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    el.style.transform = `perspective(900px) rotateY(${dx * 8}deg) rotateX(${-dy * 8}deg) translateY(-6px) scale(1.02)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
    el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
    setTimeout(() => { el.style.transition = ''; }, 500);
  });
}

// ================================================================
// RIPPLE EFFECT
// ================================================================

function addRipple(el) {
  el.addEventListener('click', e => {
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${e.clientX - rect.left - size/2}px;
      top: ${e.clientY - rect.top  - size/2}px;
    `;
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  });
}

// ================================================================
// DOM HELPERS
// ================================================================

function el(id) { return document.getElementById(id); }

function setCardCssVars(element, theme) {
  element.style.setProperty('--card-from', theme.from);
  element.style.setProperty('--card-to',   theme.to);
}

// ================================================================
// VIEWS
// ================================================================

function showHomeView() {
  const home = el('home-view');
  const list = el('list-view');
  home.classList.add('active');
  home.setAttribute('aria-hidden', 'false');
  list.classList.remove('active');
  list.setAttribute('aria-hidden', 'true');
  state.currentListId = null;
  renderDashboard();
}

function showListView(listId) {
  state.currentListId = listId;
  state.activeFilter = 'all';
  const home = el('home-view');
  const listView = el('list-view');
  home.classList.remove('active');
  home.setAttribute('aria-hidden', 'true');
  listView.classList.add('active');
  listView.setAttribute('aria-hidden', 'false');
  renderListView();
  // set filter back to all
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === 'all');
  });
}

// ================================================================
// RENDER — DASHBOARD
// ================================================================

function renderDashboard() {
  renderStats();
  renderListsGrid();
}

function renderStats() {
  const totalTasks = state.lists.reduce((s, l) => s + l.tasks.length, 0);
  const doneTasks  = state.lists.reduce((s, l) => s + l.tasks.filter(t => t.completed).length, 0);

  animateNumber(el('stat-lists-num'), state.lists.length);
  animateNumber(el('stat-tasks-num'), totalTasks);
  animateNumber(el('stat-done-num'),  doneTasks);
}

function animateNumber(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  el.classList.add('num-pop');
  el.textContent = target;
  el.addEventListener('animationend', () => el.classList.remove('num-pop'), { once: true });
}

function renderListsGrid() {
  const grid  = el('lists-grid');
  const empty = el('empty-state');
  grid.innerHTML = '';

  if (state.lists.length === 0) {
    empty.classList.add('visible');
    empty.setAttribute('aria-hidden', 'false');
    return;
  }
  empty.classList.remove('visible');
  empty.setAttribute('aria-hidden', 'true');

  state.lists.forEach((list, idx) => {
    const theme = getTheme(list.color);
    const total = list.tasks.length;
    const done  = list.tasks.filter(t => t.completed).length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'list-card';
    card.setAttribute('role', 'listitem');
    card.style.setProperty('--card-from', theme.from);
    card.style.setProperty('--card-to',   theme.to);
    card.style.animationDelay = `${idx * 0.07}s`;

    // Build CSS floating card particles
    const particlesHTML = Array.from({length: 6}, (_, i) => {
      const angle  = (i / 6) * Math.PI * 2;
      const tx = Math.cos(angle) * (30 + Math.random() * 40) + 'px';
      const ty = Math.sin(angle) * (30 + Math.random() * 40) + 'px';
      return `<div class="card-particle" style="
        left:${20 + Math.random() * 60}%;
        top:${20 + Math.random() * 60}%;
        background:${theme.from};
        --tx:${tx};--ty:${ty};
        --dur:${2 + Math.random() * 2}s;
        --delay:${-Math.random() * 2}s;
      "></div>`;
    }).join('');

    const allDone = total > 0 && done === total;

    card.innerHTML = `
      <div class="card-accent"></div>
      <div class="card-glow"></div>
      <div class="card-particles">${particlesHTML}</div>
      <div class="card-actions">
        <button class="card-action-btn delete-list-card-btn" title="Delete list" aria-label="Delete ${escHtml(list.name)}">✕</button>
      </div>
      <span class="card-emoji" aria-hidden="true">${escHtml(list.emoji)}</span>
      <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem">
        <div class="card-name">${escHtml(list.name)}</div>
        ${allDone && total > 0 ? '<span class="card-done-badge">✦ All done!</span>' : ''}
      </div>
      <div class="card-meta">${total} task${total !== 1 ? 's' : ''} · ${done} done</div>
      <div class="card-progress-wrap">
        <div class="card-progress-track">
          <div class="card-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="card-progress-pct">${pct}%</div>
      </div>
    `;

    // Click to open list
    card.addEventListener('click', e => {
      if (e.target.closest('.card-action-btn')) return;
      showListView(list.id);
    });

    // Delete button on card
    card.querySelector('.delete-list-card-btn').addEventListener('click', e => {
      e.stopPropagation();
      openConfirmModal(`Delete "${list.name}"?`, 'All tasks will be permanently removed.', () => {
        deleteList(list.id);
      });
    });

    attachTilt(card);
    grid.appendChild(card);
  });
}

// ================================================================
// RENDER — LIST VIEW
// ================================================================

function renderListView() {
  const list = getCurrentList();
  if (!list) return showHomeView();

  const theme = getTheme(list.color);

  // header
  el('list-header-emoji').textContent = list.emoji;
  el('list-header-title').textContent = list.name;
  el('list-header').style.setProperty('--card-from', theme.from);
  el('list-header').style.setProperty('--card-to',   theme.to);

  // completion ring
  const total = list.tasks.length;
  const done  = list.tasks.filter(t => t.completed).length;
  const pct   = total > 0 ? (done / total) : 0;
  updateCompletionRing(pct, theme);

  // task input colouring
  el('task-input-shell').style.setProperty('--card-from', theme.from);

  renderTasks();
}

function updateCompletionRing(fraction, theme) {
  const circumference = 2 * Math.PI * 20; // r=20
  const offset = circumference * (1 - fraction);
  el('ring-fill').style.strokeDashoffset = offset;
  el('ring-fill').style.stroke = theme.from;
  el('ring-pct').textContent = Math.round(fraction * 100) + '%';
}

function getFilteredTasks() {
  const list = getCurrentList();
  if (!list) return [];
  return list.tasks.filter(task => {
    if (state.activeFilter === 'all')       return true;
    if (state.activeFilter === 'active')    return !task.completed;
    if (state.activeFilter === 'completed') return task.completed;
    if (state.activeFilter === 'complex')   return task.complex;
    return true;
  });
}

function renderTasks() {
  const container = el('tasks-container');
  const listEmpty = el('list-empty');
  const list = getCurrentList();
  if (!list) return;

  const tasks = getFilteredTasks();
  container.innerHTML = '';

  if (tasks.length === 0) {
    listEmpty.classList.add('visible');
    listEmpty.setAttribute('aria-hidden', 'false');
  } else {
    listEmpty.classList.remove('visible');
    listEmpty.setAttribute('aria-hidden', 'true');
  }

  const theme = getTheme(list.color);

  tasks.forEach((task, idx) => {
    const card = buildTaskCard(task, theme, idx);
    container.appendChild(card);
  });
}

function buildTaskCard(task, theme, idx) {
  const card = document.createElement('div');
  card.className = `task-card${task.completed ? ' completed' : ''}`;
  card.dataset.taskId = task.id;
  card.setAttribute('role', 'listitem');
  card.style.animationDelay = `${idx * 0.06}s`;

  card.innerHTML = `
    <div class="task-card-accent" style="--card-from:${theme.from};--card-to:${theme.to}"></div>

    <label class="task-check" aria-label="Mark task as ${task.completed ? 'incomplete' : 'complete'}">
      <input type="checkbox" ${task.completed ? 'checked' : ''} />
      <div class="task-check-box">
        <svg class="check-svg" viewBox="0 0 12 10">
          <polyline points="1,5 4.5,8.5 11,1"/>
        </svg>
      </div>
    </label>

    <div class="task-body">
      <div class="task-text">
        ${escHtml(task.text)}
        ${task.complex ? '<span class="complex-badge">◈ Complex</span>' : ''}
      </div>
      ${task.complex ? buildProgressHTML(task, theme) : ''}
    </div>

    <div class="task-actions">
      <button class="task-action-btn task-edit-btn" title="Edit task" aria-label="Edit task">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="task-action-btn task-delete-btn" title="Delete task" aria-label="Delete task">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      </button>
    </div>
  `;

  // Checkbox toggle
  const checkbox = card.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => {
    toggleTaskComplete(task.id, checkbox.checked, card);
  });

  // Edit
  card.querySelector('.task-edit-btn').addEventListener('click', () => {
    openEditTaskModal(task.id);
  });

  // Delete
  card.querySelector('.task-delete-btn').addEventListener('click', () => {
    removeTaskWithAnimation(card, task.id);
  });

  // Progress bar for complex tasks
  if (task.complex) {
    initProgressBar(card, task, theme);
  }

  return card;
}

function buildProgressHTML(task, theme) {
  const pct = task.progress || 0;
  const progressColor = getProgressColor(pct);

  return `
    <div class="complex-progress-wrap">
      <div class="progress-header">
        <span class="progress-label">Progress</span>
        <div class="progress-pct-input">
          <input type="number" class="pct-input" value="${pct}" min="0" max="100" aria-label="Progress percentage" />
          <span class="pct-symbol">%</span>
        </div>
      </div>
      <div class="progress-slider-wrap">
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%;background:${progressColor};--progress-color:${progressColor}">
            <div class="progress-fill-glow"></div>
          </div>
          <div class="progress-thumb" style="left:${pct}%;--thumb-color:${getProgressThumbColor(pct)}"></div>
        </div>
      </div>
    </div>
  `;
}

function getProgressColor(pct) {
  if (pct < 25)  return 'linear-gradient(90deg, #7c3aed, #a855f7)';
  if (pct < 50)  return 'linear-gradient(90deg, #1d4ed8, #3b82f6)';
  if (pct < 75)  return 'linear-gradient(90deg, #0891b2, #06b6d4)';
  if (pct < 100) return 'linear-gradient(90deg, #b45309, #f59e0b)';
  return 'linear-gradient(90deg, #059669, #10b981)';
}

function getProgressThumbColor(pct) {
  if (pct < 25)  return '#a855f7';
  if (pct < 50)  return '#3b82f6';
  if (pct < 75)  return '#06b6d4';
  if (pct < 100) return '#f59e0b';
  return '#10b981';
}

function initProgressBar(card, task, theme) {
  const track  = card.querySelector('.progress-track');
  if (!track) return;
  const fill   = card.querySelector('.progress-fill');
  const thumb  = card.querySelector('.progress-thumb');
  const pctIn  = card.querySelector('.pct-input');
  if (!fill || !thumb || !pctIn) return;

  function setProgress(val) {
    val = clamp(Math.round(val), 0, 100);
    const pct = val;
    const color = getProgressColor(pct);
    const thumbColor = getProgressThumbColor(pct);

    fill.style.width = pct + '%';
    fill.style.background = color;
    thumb.style.left = pct + '%';
    thumb.style.setProperty('--thumb-color', thumbColor);
    pctIn.value = pct;

    // neon complete effect
    if (pct === 100) {
      fill.classList.add('neon-complete');
    } else {
      fill.classList.remove('neon-complete');
    }

    // persist
    const list = getCurrentList();
    if (!list) return;
    const t = list.tasks.find(t => t.id === task.id);
    if (!t) return;
    const wasComplete = t.completed;
    t.progress = pct;
    if (pct === 100 && !wasComplete) {
      t.completed = true;
      saveState();
      // animate completion
      const checkbox = card.querySelector('input[type="checkbox"]');
      if (checkbox) { checkbox.checked = true; }
      card.classList.add('completed');
      onTaskComplete(card, t.id);
    } else if (pct < 100 && wasComplete) {
      t.completed = false;
      card.classList.remove('completed');
    }
    saveState();
    updateListHeaderStats();
  }

  // Drag thumb (use Pointer Events with capture to avoid global listeners)
  let dragging = false;
  thumb.addEventListener('pointerdown', e => {
    dragging = true;
    thumb.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  thumb.addEventListener('pointermove', e => {
    if (!dragging) return;
    const rect = track.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setProgress(ratio * 100);
  });
  thumb.addEventListener('pointerup', e => {
    dragging = false;
    try {
      thumb.releasePointerCapture(e.pointerId);
    } catch (_) {
      // ignore if capture was not set
    }
  });
  thumb.addEventListener('pointercancel', e => {
    dragging = false;
    try {
      thumb.releasePointerCapture(e.pointerId);
    } catch (_) {
      // ignore if capture was not set
    }
  });

  // Click on track
  track.addEventListener('click', e => {
    if (e.target === thumb) return;
    const rect = track.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setProgress(ratio * 100);
  });

  // Number input
  pctIn.addEventListener('change', () => {
    setProgress(parseInt(pctIn.value) || 0);
  });
  pctIn.addEventListener('keydown', e => {
    if (e.key === 'Enter') setProgress(parseInt(pctIn.value) || 0);
  });
}

function updateListHeaderStats() {
  const list = getCurrentList();
  if (!list) return;
  const theme = getTheme(list.color);
  const total = list.tasks.length;
  const done  = list.tasks.filter(t => t.completed).length;
  updateCompletionRing(total > 0 ? done / total : 0, theme);
}

// ================================================================
// TASK ACTIONS
// ================================================================

function toggleTaskComplete(taskId, checked, cardEl) {
  const list = getCurrentList();
  if (!list) return;
  const task = list.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (task.complex) {
    // For complex tasks, the checkbox drives progress:
    // checking sets progress to 100 (and triggers completion); unchecking resets progress to 0.
    const progressWrap = cardEl.querySelector('.complex-progress-wrap');
    const targetPct = checked ? 100 : 0;
    task.progress = targetPct;
    task.completed = checked;

    // Sync the progress bar UI if it exists in this card
    if (progressWrap) {
      const fill  = cardEl.querySelector('.progress-fill');
      const thumb = cardEl.querySelector('.progress-thumb');
      const pctIn = cardEl.querySelector('.pct-input');
      if (fill)  { fill.style.width = targetPct + '%'; fill.style.background = getProgressColor(targetPct); }
      if (thumb) { thumb.style.left = targetPct + '%'; thumb.style.setProperty('--thumb-color', getProgressThumbColor(targetPct)); }
      if (pctIn) { pctIn.value = targetPct; }
      if (fill)  { fill.classList.toggle('neon-complete', targetPct === 100); }
    }
  } else {
    task.completed = checked;
  }

  if (checked) {
    cardEl.classList.add('completed');
    onTaskComplete(cardEl, taskId);
  } else {
    cardEl.classList.remove('completed');
  }
  saveState();
  updateListHeaderStats();
  renderDashboard(); // update stats
}

function onTaskComplete(cardEl, taskId) {
  const rect = cardEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;

  // Big confetti burst
  launchConfetti(cx, cy, 80);

  // Screen-wide ripple
  const list = getCurrentList();
  const theme = list ? getTheme(list.color) : COLOR_THEMES[0];
  screenRipple(cx, cy, theme.from);

  // Sparkle burst
  spawnSparkles(cx, cy, 10);

  // Extra confetti from corners (fun!)
  setTimeout(() => launchConfetti(0,                    0,                    15), 100);
  setTimeout(() => launchConfetti(window.innerWidth,    0,                    15), 200);
  setTimeout(() => launchConfetti(0,                    window.innerHeight,   15), 150);
  setTimeout(() => launchConfetti(window.innerWidth,    window.innerHeight,   15), 250);

  showToast('Task completed! 🎉', 'success', '🎊');
}

function removeTaskWithAnimation(cardEl, taskId) {
  cardEl.classList.add('removing');
  cardEl.addEventListener('animationend', () => {
    const list = getCurrentList();
    if (list) {
      list.tasks = list.tasks.filter(t => t.id !== taskId);
      saveState();
      updateListHeaderStats();
      renderDashboard();
      // re-check if list is now empty
      if (getFilteredTasks().length === 0) {
        el('list-empty').classList.add('visible');
      }
    }
    cardEl.remove();
  }, { once: true });
}

function addTask() {
  const input = el('task-input');
  const text  = input.value.trim();
  if (!text) {
    el('task-input-shell').classList.add('shake');
    el('task-input-shell').addEventListener('animationend', () => {
      el('task-input-shell').classList.remove('shake');
    }, { once: true });
    return;
  }

  const list = getCurrentList();
  if (!list) return;

  const task = {
    id: uid(),
    text,
    completed: false,
    complex: state.newTaskComplex,
    progress: 0,
    createdAt: Date.now(),
  };
  list.tasks.push(task);
  saveState();

  input.value = '';
  input.focus();

  const theme = getTheme(list.color);
  const card = buildTaskCard(task, theme, list.tasks.length - 1);
  card.style.animationDelay = '0s';

  const container = el('tasks-container');
  el('list-empty').classList.remove('visible');
  container.appendChild(card);

  // scroll into view
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  updateListHeaderStats();
  renderDashboard();
  showToast('Task added!', 'info', '✨');
}

// ================================================================
// LIST ACTIONS
// ================================================================

function deleteList(listId) {
  state.lists = state.lists.filter(l => l.id !== listId);
  saveState();
  if (state.currentListId === listId) {
    showHomeView();
  } else {
    renderDashboard();
  }
  showToast('List deleted', 'error', '🗑️');
}

// ================================================================
// MODAL — LIST
// ================================================================

let selectedEmoji = EMOJIS[0];
let selectedColor = COLOR_THEMES[0].key;

function openNewListModal() {
  el('list-modal-title').textContent = 'New List';
  el('list-modal-confirm').textContent = 'Create List';
  el('list-name-input').value = '';
  selectedEmoji = EMOJIS[0];
  selectedColor = COLOR_THEMES[0].key;
  renderEmojiGrid();
  renderColorGrid();
  openModal('list-modal');
  setTimeout(() => el('list-name-input').focus(), 300);
}

function renderEmojiGrid() {
  const grid = el('emoji-grid');
  grid.innerHTML = '';
  EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = `emoji-option${emoji === selectedEmoji ? ' selected' : ''}`;
    btn.textContent = emoji;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', emoji === selectedEmoji);
    btn.setAttribute('aria-label', emoji);
    btn.addEventListener('click', () => {
      selectedEmoji = emoji;
      grid.querySelectorAll('.emoji-option').forEach(b => {
        b.classList.toggle('selected', b.textContent === emoji);
        b.setAttribute('aria-checked', b.textContent === emoji);
      });
    });
    grid.appendChild(btn);
  });
}

function renderColorGrid() {
  const grid = el('color-grid');
  grid.innerHTML = '';
  COLOR_THEMES.forEach(theme => {
    const btn = document.createElement('button');
    btn.className = `color-swatch${theme.key === selectedColor ? ' selected' : ''}`;
    btn.style.background = `linear-gradient(135deg, ${theme.from}, ${theme.to})`;
    btn.style.setProperty('--swatch-glow', theme.glow);
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', theme.key === selectedColor);
    btn.setAttribute('aria-label', theme.key);
    btn.title = theme.key;
    btn.addEventListener('click', () => {
      selectedColor = theme.key;
      grid.querySelectorAll('.color-swatch').forEach(b => {
        const isSel = b.getAttribute('aria-label') === theme.key;
        b.classList.toggle('selected', isSel);
        b.setAttribute('aria-checked', isSel);
      });
    });
    grid.appendChild(btn);
  });
}

function confirmCreateList() {
  const name = el('list-name-input').value.trim();
  if (!name) {
    el('list-name-input').classList.add('shake');
    el('list-name-input').addEventListener('animationend', () => {
      el('list-name-input').classList.remove('shake');
    }, { once: true });
    return;
  }

  const list = {
    id: uid(),
    name,
    emoji: selectedEmoji,
    color: selectedColor,
    createdAt: Date.now(),
    tasks: [],
  };
  state.lists.push(list);
  saveState();
  closeModal('list-modal');
  renderDashboard();
  showToast(`"${name}" created!`, 'success', '🌟');
}

// ================================================================
// MODAL — TASK EDIT
// ================================================================

function openEditTaskModal(taskId) {
  const list = getCurrentList();
  if (!list) return;
  const task = list.tasks.find(t => t.id === taskId);
  if (!task) return;
  state.editingTaskId = taskId;
  el('edit-task-input').value = task.text;
  openModal('task-modal');
  setTimeout(() => el('edit-task-input').focus(), 300);
}

function confirmEditTask() {
  const text = el('edit-task-input').value.trim();
  if (!text) return;
  const list = getCurrentList();
  if (!list) return;
  const task = list.tasks.find(t => t.id === state.editingTaskId);
  if (!task) return;
  task.text = text;
  saveState();
  closeModal('task-modal');
  renderTasks();
  showToast('Task updated!', 'success', '✏️');
}

// ================================================================
// MODAL — CONFIRM
// ================================================================

let confirmCallback = null;

function openConfirmModal(title, text, onConfirm) {
  el('confirm-modal-title').textContent = title;
  el('confirm-modal-text').textContent  = text;
  confirmCallback = onConfirm;
  openModal('confirm-modal');
}

// ================================================================
// MODAL HELPERS
// ================================================================

function openModal(id) {
  const overlay = el(id);
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  // trap focus – find first focusable
  const focusable = overlay.querySelector('input, button:not([aria-label="Close"])');
  if (focusable) setTimeout(() => focusable.focus(), 350);
}

function closeModal(id) {
  const overlay = el(id);
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
}

// close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ================================================================
// IMPORT / EXPORT
// ================================================================

function exportJSON() {
  const data = {
    app: 'TodoVerse',
    version: 1,
    exportedAt: new Date().toISOString(),
    lists: state.lists,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `todoverse-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);

  document.body.classList.add('flash-export');
  setTimeout(() => document.body.classList.remove('flash-export'), 800);
  showToast('Exported successfully!', 'success', '📦');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      const lists = data.lists || (Array.isArray(data) ? data : null);
      if (!Array.isArray(lists)) throw new Error('Invalid format');

      // Merge: add lists that don't already exist (by id)
      const existingIds = new Set(state.lists.map(l => l.id));
      let added = 0;
      for (const list of lists) {
        if (!existingIds.has(list.id)) {
          state.lists.push(list);
          existingIds.add(list.id);
          added++;
        }
      }
      saveState();
      renderDashboard();

      document.body.classList.add('flash-import');
      setTimeout(() => document.body.classList.remove('flash-import'), 800);
      showToast(`Imported ${added} list${added !== 1 ? 's' : ''}!`, 'success', '📥');
    } catch (err) {
      showToast('Invalid JSON file', 'error', '❌');
    }
  };
  reader.readAsText(file);
}

// ================================================================
// HTML ESCAPE
// ================================================================

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ================================================================
// EVENT WIRING
// ================================================================

function wire() {
  // Header buttons
  addRipple(el('new-list-btn'));
  el('new-list-btn').addEventListener('click', openNewListModal);

  addRipple(el('empty-new-list-btn'));
  el('empty-new-list-btn').addEventListener('click', openNewListModal);

  el('back-btn').addEventListener('click', showHomeView);

  el('import-btn').addEventListener('click', () => el('import-file-input').click());
  el('export-btn').addEventListener('click', exportJSON);
  el('import-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) importJSON(file);
    e.target.value = '';
  });

  // Delete list from list view
  el('delete-list-btn').addEventListener('click', () => {
    const list = getCurrentList();
    if (!list) return;
    openConfirmModal(`Delete "${list.name}"?`, 'All tasks will be permanently removed.', () => {
      deleteList(list.id);
    });
  });

  // Task input
  el('task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });
  addRipple(el('add-task-btn'));
  el('add-task-btn').addEventListener('click', addTask);

  // Task type toggle
  el('type-simple').addEventListener('click', () => {
    state.newTaskComplex = false;
    el('type-simple').classList.add('active');
    el('type-complex').classList.remove('active');
  });
  el('type-complex').addEventListener('click', () => {
    state.newTaskComplex = true;
    el('type-complex').classList.add('active');
    el('type-simple').classList.remove('active');
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderTasks();
    });
  });

  // List modal
  el('list-modal-close').addEventListener('click',   () => closeModal('list-modal'));
  el('list-modal-cancel').addEventListener('click',  () => closeModal('list-modal'));
  addRipple(el('list-modal-confirm'));
  el('list-modal-confirm').addEventListener('click', confirmCreateList);
  el('list-name-input').addEventListener('keydown',  e => { if (e.key === 'Enter') confirmCreateList(); });

  // Task modal
  el('task-modal-close').addEventListener('click',   () => closeModal('task-modal'));
  el('task-modal-cancel').addEventListener('click',  () => closeModal('task-modal'));
  addRipple(el('task-modal-confirm'));
  el('task-modal-confirm').addEventListener('click', confirmEditTask);
  el('edit-task-input').addEventListener('keydown',  e => { if (e.key === 'Enter') confirmEditTask(); });

  // Confirm modal
  el('confirm-modal-cancel').addEventListener('click', () => closeModal('confirm-modal'));
  el('confirm-modal-ok').addEventListener('click', () => {
    closeModal('confirm-modal');
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
  });

  // Keyboard: Escape closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['list-modal','task-modal','confirm-modal'].forEach(id => {
        if (el(id).classList.contains('open')) closeModal(id);
      });
    }
  });
}

// ================================================================
// BOOT
// ================================================================

function boot() {
  loadState();
  wire();
  renderDashboard();

  // Greet based on time
  const hour = new Date().getHours();
  const greetings = [
    [0,  5,  'Good night ✨'],
    [5,  12, 'Good morning ☀️'],
    [12, 17, 'Good afternoon 🌤️'],
    [17, 21, 'Good evening 🌆'],
    [21, 24, 'Good night 🌙'],
  ];
  const g = greetings.find(([s, e]) => hour >= s && hour < e);
  if (g) {
    el('greeting-title').textContent = g[2];
    el('greeting-title').setAttribute('data-text', g[2]);
  }

  // Type-writer effect on sub-greeting
  const subEl = document.querySelector('.greeting-sub');
  if (subEl) {
    const original = subEl.textContent;
    subEl.textContent = '';
    let i = 0;
    function typeWriter() {
      if (i <= original.length) {
        subEl.textContent = original.slice(0, i);
        i++;
        setTimeout(typeWriter, 30);
      }
    }
    setTimeout(typeWriter, 500);
  }

  // Initial welcome sparkles
  setTimeout(() => {
    spawnSparkles(window.innerWidth / 2, window.innerHeight / 3, 12);
    spawnComet();
  }, 800);
}

document.addEventListener('DOMContentLoaded', boot);
