/* ============================================================
 * FUN FEATURES — fun-features.js
 * À inclure dans index.html juste avant </body>
 * <script src="fun-features.js"></script>
 *
 * Contient :
 *  1. CONFETTIS + TOAST PR — animation à chaque nouveau record
 *  2. SYSTÈME DE BADGES — 12 badges débloquables, modal de célébration
 *  3. THÈMES DE COULEUR — 8 accent colors avec persistance localStorage
 *  4. CARTE D'ATHLÈTE — profil visuel shareable (screenshot-friendly)
 * ============================================================ */

// ============================================================
// SECTION 1 : CONFETTIS & TOAST PR
// ============================================================

/**
 * Lance une pluie de confettis canvas et affiche un toast de célébration.
 * Appeler : triggerPRCelebration(movementName, value)
 * Exemple  : triggerPRCelebration('Snatch', '90 kg')
 */
function triggerPRCelebration(movementName = '', value = '') {
  _launchConfetti();
  _showPRToast(movementName, value);
  _unlockBadgeIfNew('first_pr'); // premier PR = badge automatique
}

function _launchConfetti() {
  // Crée un canvas temporaire par-dessus tout
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Couleurs assorties à l'accent courant
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e8ff47';
  const colors = [accent, '#ff4444', '#47c8ff', '#ff8c47', '#c847ff', '#ffffff', '#47ff8c'];

  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * -1,
    w: Math.random() * 10 + 5,
    h: Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.2,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 4 + 2,
    opacity: 1,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      if (frame > 60) p.opacity -= 0.015;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frame++;
    if (frame < 120) requestAnimationFrame(draw);
    else canvas.remove();
  }
  draw();
}

function _showPRToast(movementName, value) {
  const existing = document.getElementById('pr-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'pr-toast';
  toast.innerHTML = `
    <div style="font-size:32px;line-height:1;margin-bottom:6px">🏆</div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:var(--accent)">NOUVEAU PR !</div>
    ${movementName ? `<div style="font-size:13px;font-weight:700;margin-top:2px">${movementName}</div>` : ''}
    ${value ? `<div style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px;color:var(--accent);margin-top:4px">${value}</div>` : ''}
  `;
  toast.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.5);
    z-index:10000;background:var(--card2);border:2px solid var(--accent);
    border-radius:20px;padding:24px 32px;text-align:center;
    box-shadow:0 0 40px rgba(232,255,71,0.3);
    transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s;
    opacity:0;color:var(--text);max-width:260px;
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translate(-50%,-50%) scale(1)';
    toast.style.opacity = '1';
  });

  setTimeout(() => {
    toast.style.transform = 'translate(-50%,-50%) scale(0.9)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// Monkey-patch savePR pour déclencher les confettis automatiquement
// (s'exécute après le chargement de planning.js)
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof savePR === 'function') {
      const _originalSavePR = savePR;
      window.savePR = async function () {
        // Lire la valeur AVANT la sauvegarde pour comparer
        const movId = window.currentModalMovement?.id;
        const movName = window.currentModalMovement?.name || '';
        const oldPRs = (window.myPRs && movId) ? (window.myPRs[movId] || []) : [];
        const oldBest = oldPRs.length > 0 ? Math.max(...oldPRs.map(p => p.value)) : null;

        await _originalSavePR.apply(this, arguments);

        // Après sauvegarde, comparer
        const newPRs = (window.myPRs && movId) ? (window.myPRs[movId] || []) : [];
        const newBest = newPRs.length > 0 ? Math.max(...newPRs.map(p => p.value)) : null;

        if (newBest !== null && (oldBest === null || newBest > oldBest)) {
          // Formatage de la valeur affichée
          let displayVal = String(newBest);
          if (typeof formatPRValue === 'function' && typeof getPRModeFor === 'function' && window.currentModalMovement) {
            const fmt = document.querySelector('.pr-format-btn.active')?.dataset?.fmt || null;
            const mode = getPRModeFor(window.currentModalMovement, fmt);
            displayVal = mode === 'number' ? newBest + '' : formatPRValue(newBest, mode);
          }
          triggerPRCelebration(movName, displayVal);
        }
      };
    }
  }, 1000);
});


// ============================================================
// SECTION 2 : SYSTÈME DE BADGES
// ============================================================

const BADGE_DEFINITIONS = [
  { id: 'first_wod',       emoji: '🎯', name: 'Premier WOD',       desc: 'Tu as loggué ton tout premier score.',               check: (s) => s.wodCount >= 1 },
  { id: 'wod_10',          emoji: '💪', name: '10 WODs',           desc: '10 séances enregistrées.',                           check: (s) => s.wodCount >= 10 },
  { id: 'wod_50',          emoji: '🔥', name: '50 WODs',           desc: '50 séances. Tu es régulier.',                        check: (s) => s.wodCount >= 50 },
  { id: 'wod_100',         emoji: '💯', name: '100 WODs',          desc: '100 séances. Légende du box.',                       check: (s) => s.wodCount >= 100 },
  { id: 'first_rx',        emoji: '⚡', name: 'Premier RX',        desc: 'Un score enregistré en RX.',                         check: (s) => s.hasRX },
  { id: 'first_pr',        emoji: '🏆', name: 'Premier PR',        desc: 'Ton tout premier record personnel.',                  check: (s) => s.prCount >= 1 },
  { id: 'pr_10',           emoji: '🎖️', name: '10 PRs',            desc: '10 records personnels au compteur.',                  check: (s) => s.prCount >= 10 },
  { id: 'bench_5',         emoji: '🧪', name: 'Testeur',           desc: '5 benchmarks complétés.',                            check: (s) => s.benchCount >= 5 },
  { id: 'streak_3',        emoji: '📅', name: '3 jours / semaine', desc: '3 séances dans la même semaine.',                     check: (s) => s.weekStreak >= 3 },
  { id: 'streak_5',        emoji: '🗓️', name: '5 jours / semaine', desc: '5 séances dans la même semaine.',                     check: (s) => s.weekStreak >= 5 },
  { id: 'multi_prog',      emoji: '🎽', name: 'Multi-programme',   desc: 'Inscrit à au moins 2 programmes.',                   check: (s) => s.progCount >= 2 },
  { id: 'top3',            emoji: '🥉', name: 'Top 3',             desc: 'Dans le top 3 d\'un leaderboard.',                   check: (s) => s.hasTop3 },
];

function _getBadgeStorage() {
  try { return JSON.parse(localStorage.getItem('upside-badges') || '{}'); } catch (e) { return {}; }
}
function _saveBadgeStorage(data) {
  try { localStorage.setItem('upside-badges', JSON.stringify(data)); } catch (e) {}
}

async function checkAndUnlockBadges() {
  if (!window.currentUser) return;

  // Collecter les stats nécessaires
  const [scores, prs, bench, access] = await Promise.all([
    sb.from('wod_scores').select('id,level,done_at,created_at').eq('athlete_id', currentUser.id),
    sb.from('athlete_prs').select('id', { count: 'exact' }).eq('athlete_id', currentUser.id),
    sb.from('benchmark_scores').select('id', { count: 'exact' }).eq('athlete_id', currentUser.id),
    sb.from('programme_access').select('programme_id').eq('athlete_id', currentUser.id),
  ]);

  const allScores = scores.data || [];
  const wodCount = allScores.length;
  const hasRX = allScores.some(s => s.level === 'rx');
  const prCount = prs.count || 0;
  const benchCount = bench.count || 0;
  const progCount = (access.data || []).length;

  // Calcul du meilleur streak hebdomadaire
  const weekMap = {};
  allScores.forEach(s => {
    const d = new Date(s.done_at || s.created_at);
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = mon.toISOString().split('T')[0];
    weekMap[key] = (weekMap[key] || 0) + 1;
  });
  const weekStreak = Object.values(weekMap).reduce((max, v) => Math.max(max, v), 0);

  // hasTop3 : on ne peut pas facilement le calculer côté client sans full leaderboard scan
  // On le laisse false par défaut (peut être unlocked manuellement via _unlockBadgeIfNew)
  const hasTop3 = false;

  const stats = { wodCount, hasRX, prCount, benchCount, progCount, weekStreak, hasTop3 };
  const stored = _getBadgeStorage();
  const newlyUnlocked = [];

  BADGE_DEFINITIONS.forEach(b => {
    if (!stored[b.id] && b.check(stats)) {
      stored[b.id] = { unlockedAt: Date.now() };
      newlyUnlocked.push(b);
    }
  });

  _saveBadgeStorage(stored);

  // Afficher les nouveaux badges un par un avec délai
  if (newlyUnlocked.length > 0) {
    for (let i = 0; i < newlyUnlocked.length; i++) {
      setTimeout(() => _showBadgeModal(newlyUnlocked[i]), i * 3500);
    }
  }

  // Rafraîchir la section badges sur la page profil si visible
  renderBadgesOnProfil();
}

function _unlockBadgeIfNew(badgeId) {
  const stored = _getBadgeStorage();
  if (!stored[badgeId]) {
    stored[badgeId] = { unlockedAt: Date.now() };
    _saveBadgeStorage(stored);
    const badge = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    if (badge) _showBadgeModal(badge);
    renderBadgesOnProfil();
  }
}

function _showBadgeModal(badge) {
  const existing = document.getElementById('badge-unlock-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'badge-unlock-modal';
  modal.innerHTML = `
    <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:var(--accent);text-transform:uppercase;margin-bottom:8px">Badge débloqué !</div>
    <div style="font-size:56px;line-height:1;margin-bottom:12px;animation:badgePop 0.5s cubic-bezier(0.34,1.56,0.64,1)">${badge.emoji}</div>
    <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px">${badge.name}</div>
    <div style="font-size:13px;color:var(--text2);margin-top:6px;line-height:1.5">${badge.desc}</div>
    <button onclick="document.getElementById('badge-unlock-modal').remove()" style="margin-top:16px;padding:10px 24px;background:var(--accent);color:#000;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer">Super !</button>
  `;
  modal.style.cssText = `
    position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(20px);
    z-index:10001;background:var(--card2);border:1.5px solid var(--accent);
    border-radius:20px;padding:24px 28px;text-align:center;
    box-shadow:0 8px 40px rgba(0,0,0,0.6);
    transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s;
    opacity:0;color:var(--text);max-width:280px;width:calc(100% - 40px);
  `;
  document.body.appendChild(modal);

  // Inject keyframe
  if (!document.getElementById('badge-keyframe')) {
    const s = document.createElement('style');
    s.id = 'badge-keyframe';
    s.textContent = '@keyframes badgePop{0%{transform:scale(0)}60%{transform:scale(1.2)}100%{transform:scale(1)}}';
    document.head.appendChild(s);
  }

  requestAnimationFrame(() => {
    modal.style.transform = 'translateX(-50%) translateY(0)';
    modal.style.opacity = '1';
  });

  setTimeout(() => {
    if (document.getElementById('badge-unlock-modal') === modal) {
      modal.style.opacity = '0';
      modal.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(() => modal.remove(), 400);
    }
  }, 4000);
}

function renderBadgesOnProfil() {
  // Cherche le conteneur de badges sur la page profil
  let container = document.getElementById('profil-badges-section');
  if (!container) return; // Pas encore créé, on le crée si la page profil existe
  const stored = _getBadgeStorage();

  container.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px">
      Mes badges — ${Object.keys(stored).length} / ${BADGE_DEFINITIONS.length}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      ${BADGE_DEFINITIONS.map(b => {
        const unlocked = !!stored[b.id];
        return `<div title="${b.name}: ${b.desc}" style="
          display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;
          background:${unlocked ? 'rgba(232,255,71,0.06)' : 'var(--card2)'};
          border:1px solid ${unlocked ? 'rgba(232,255,71,0.25)' : 'var(--border)'};
          border-radius:12px;cursor:default;
          filter:${unlocked ? 'none' : 'grayscale(1)'};
          opacity:${unlocked ? '1' : '0.4'};
          transition:all 0.2s;
        ">
          <span style="font-size:24px;line-height:1">${b.emoji}</span>
          <span style="font-size:9px;font-weight:700;text-align:center;color:${unlocked ? 'var(--text2)' : 'var(--muted)'};line-height:1.3">${b.name}</span>
        </div>`;
      }).join('')}
    </div>
  `;
}

// Injection de la section badges dans la page profil (après profil-stats)
function _injectBadgesSectionInProfil() {
  const profilPage = document.getElementById('page-profil');
  if (!profilPage || document.getElementById('profil-badges-section')) return;

  const statsDiv = profilPage.querySelector('.profil-stats');
  if (!statsDiv) return;

  const section = document.createElement('div');
  section.id = 'profil-badges-section';
  section.style.cssText = 'margin:0 20px 16px;padding:14px;background:var(--card);border:1px solid var(--border);border-radius:12px';
  statsDiv.insertAdjacentElement('afterend', section);
  renderBadgesOnProfil();
}

// Hook sur goPage pour injecter au bon moment
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof goPage === 'function') {
      const _originalGoPage = goPage;
      window.goPage = async function (page) {
        await _originalGoPage.apply(this, arguments);
        if (page === 'profil') {
          _injectBadgesSectionInProfil();
          checkAndUnlockBadges();
        }
      };
    }
    // Check badges au démarrage après login
    if (typeof initApp === 'function') {
      const _origInit = initApp;
      window.initApp = async function () {
        await _origInit.apply(this, arguments);
        setTimeout(() => checkAndUnlockBadges(), 2000);
      };
    }
  }, 1000);
});


// ============================================================
// SECTION 3 : THÈMES DE COULEUR
// ============================================================

const COLOR_THEMES = [
  { id: 'yellow',  label: 'Sandglass',  dark: '#e8ff47', darkText: '#000', light: '#5a6810', lightText: '#fff' },
  { id: 'blue',    label: 'Aqua',       dark: '#47c8ff', darkText: '#000', light: '#0b5e94', lightText: '#fff' },
  { id: 'orange',  label: 'Ember',      dark: '#ff8c47', darkText: '#000', light: '#a8470a', lightText: '#fff' },
  { id: 'red',     label: 'Fire',       dark: '#ff4444', darkText: '#fff', light: '#b71c1c', lightText: '#fff' },
  { id: 'purple',  label: 'Storm',      dark: '#c847ff', darkText: '#fff', light: '#5b1690', lightText: '#fff' },
  { id: 'green',   label: 'Forest',     dark: '#47ff8c', darkText: '#000', light: '#15703a', lightText: '#fff' },
  { id: 'pink',    label: 'Rose',       dark: '#ff47a0', darkText: '#fff', light: '#8b0045', lightText: '#fff' },
  { id: 'white',   label: 'Ghost',      dark: '#f0f0f0', darkText: '#000', light: '#333333', lightText: '#fff' },
];

function applyColorTheme(themeId) {
  const theme = COLOR_THEMES.find(t => t.id === themeId) || COLOR_THEMES[0];
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') !== 'light';
  const accentColor = isDark ? theme.dark : theme.light;
  document.documentElement.style.setProperty('--accent', accentColor);
  try { localStorage.setItem('upside-color-theme', themeId); } catch (e) {}
  // Fermer le picker si ouvert
  const picker = document.getElementById('color-theme-picker');
  if (picker) picker.remove();
}

function initColorTheme() {
  try {
    const saved = localStorage.getItem('upside-color-theme');
    if (saved) applyColorTheme(saved);
  } catch (e) {}
}

function openColorThemePicker() {
  const existing = document.getElementById('color-theme-picker');
  if (existing) { existing.remove(); return; }

  const saved = (() => { try { return localStorage.getItem('upside-color-theme') || 'yellow'; } catch (e) { return 'yellow'; } })();

  const picker = document.createElement('div');
  picker.id = 'color-theme-picker';
  picker.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px">Couleur d'accentuation</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      ${COLOR_THEMES.map(t => `
        <button onclick="applyColorTheme('${t.id}')" style="
          display:flex;flex-direction:column;align-items:center;gap:6px;
          background:transparent;border:none;cursor:pointer;padding:8px 4px;
          border-radius:10px;transition:background 0.15s;
        " onmouseover="this.style.background='var(--card2)'" onmouseout="this.style.background='transparent'">
          <div style="
            width:32px;height:32px;border-radius:50%;background:${t.dark};
            border:3px solid ${t.id === saved ? 'var(--text)' : 'transparent'};
            transition:border-color 0.2s;box-shadow:0 0 0 1px rgba(255,255,255,0.1);
          "></div>
          <span style="font-size:10px;font-weight:600;color:var(--text2)">${t.label}</span>
        </button>
      `).join('')}
    </div>
  `;
  picker.style.cssText = `
    position:fixed;bottom:85px;left:50%;transform:translateX(-50%);
    z-index:1000;background:var(--card);border:1px solid var(--border2);
    border-radius:16px;padding:16px;box-shadow:0 8px 40px rgba(0,0,0,0.5);
    width:calc(100% - 40px);max-width:390px;
  `;
  document.body.appendChild(picker);

  // Fermer au clic extérieur
  setTimeout(() => {
    document.addEventListener('click', function _close(e) {
      if (!picker.contains(e.target) && e.target.id !== 'color-theme-trigger') {
        picker.remove();
        document.removeEventListener('click', _close);
      }
    });
  }, 50);
}

// Injection du bouton thème dans le menu profil
function _injectColorThemeButton() {
  if (document.getElementById('color-theme-trigger')) return;
  const themeItem = document.querySelector('.menu-item [id="theme-label"]')?.closest('.menu-item');
  if (!themeItem) return;

  const btn = document.createElement('div');
  btn.className = 'menu-item';
  btn.id = 'color-theme-trigger';
  btn.style.cursor = 'pointer';
  btn.onclick = openColorThemePicker;
  btn.innerHTML = `<span class="menu-item-label">🎨 Couleur de l'app</span><span>›</span>`;
  themeItem.insertAdjacentElement('afterend', btn);
}

// Init thème couleur au chargement
document.addEventListener('DOMContentLoaded', () => {
  initColorTheme();
  setTimeout(_injectColorThemeButton, 1200);
});


// ============================================================
// SECTION 4 : CARTE D'ATHLÈTE
// ============================================================

/**
 * Ouvre la carte d'athlète dans une modal fullscreen.
 * La carte est optimisée pour le screenshot mobile.
 */
async function openAthleteCard() {
  const existing = document.getElementById('athlete-card-modal');
  if (existing) { existing.remove(); return; }

  // Collecter les données
  const profile = window.currentProfile || {};
  const name = profile.full_name || 'Athlète';
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const avatarUrl = profile.avatar_url || null;

  // Stats depuis Supabase
  const [scores, prs, bench, access] = await Promise.all([
    sb.from('wod_scores').select('id,level', { count: 'exact' }).eq('athlete_id', currentUser.id),
    sb.from('athlete_prs').select('id', { count: 'exact' }).eq('athlete_id', currentUser.id),
    sb.from('benchmark_scores').select('id', { count: 'exact' }).eq('athlete_id', currentUser.id),
    sb.from('programme_access').select('programme_id').eq('athlete_id', currentUser.id),
  ]);

  const wodCount = scores.count || 0;
  const prCount = prs.count || 0;
  const benchCount = bench.count || 0;
  const progCount = (access.data || []).length;
  const rxCount = (scores.data || []).filter(s => s.level === 'rx').length;
  const rxPct = wodCount > 0 ? Math.round((rxCount / wodCount) * 100) : 0;

  // Badges débloqués
  const badgeStorage = _getBadgeStorage();
  const unlockedBadges = BADGE_DEFINITIONS.filter(b => badgeStorage[b.id]);

  // Programmes actifs
  const myProgs = (window.programmes || []).filter(p => {
    return (access.data || []).some(a => a.programme_id === p.id);
  });

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e8ff47';
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') !== 'light';

  const avatarSection = avatarUrl
    ? `<div style="width:72px;height:72px;border-radius:50%;background:url('${avatarUrl}') center/cover;border:3px solid ${accent};flex-shrink:0"></div>`
    : `<div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.08);border:3px solid ${accent};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:28px;color:${accent}">${initials}</div>`;

  const modal = document.createElement('div');
  modal.id = 'athlete-card-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.85);
    display:flex;align-items:center;justify-content:center;padding:20px;
    backdrop-filter:blur(4px);
  `;

  modal.innerHTML = `
    <!-- CARD ITSELF — optimized for screenshot -->
    <div id="athlete-card-inner" style="
      background:${isDark ? '#111' : '#fff'};
      border:1px solid rgba(255,255,255,0.08);
      border-radius:24px;width:100%;max-width:360px;overflow:hidden;
      position:relative;
    ">

      <!-- TOP ACCENT BAR -->
      <div style="height:5px;background:${accent};width:100%"></div>

      <!-- HEADER -->
      <div style="padding:20px 20px 16px;display:flex;align-items:center;gap:14px;border-bottom:1px solid rgba(255,255,255,0.07)">
        ${avatarSection}
        <div style="flex:1;min-width:0">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1.5px;color:${isDark ? '#f0f0f0' : '#111'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name.toUpperCase()}</div>
          <div style="font-size:11px;color:${accent};font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-top:2px">ATHLÈTE</div>
          ${myProgs.length > 0 ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${myProgs.slice(0, 3).map(p => `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${p.color || accent}22;color:${p.color || accent};border:1px solid ${p.color || accent}44">${p.name}</span>`).join('')}</div>` : ''}
        </div>
      </div>

      <!-- STATS GRID -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid rgba(255,255,255,0.07)">
        ${[
          { val: wodCount, lbl: 'WODs' },
          { val: prCount,  lbl: 'PRs' },
          { val: benchCount, lbl: 'Benchmarks' },
          { val: rxPct + '%', lbl: 'RX rate' },
        ].map((s, i) => `
          <div style="
            padding:14px 8px;text-align:center;
            ${i < 3 ? 'border-right:1px solid rgba(255,255,255,0.07);' : ''}
          ">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:1px;color:${accent}">${s.val}</div>
            <div style="font-size:9px;font-weight:700;color:${isDark ? '#666' : '#aaa'};letter-spacing:1px;text-transform:uppercase;margin-top:1px">${s.lbl}</div>
          </div>
        `).join('')}
      </div>

      <!-- BADGES -->
      ${unlockedBadges.length > 0 ? `
        <div style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.07)">
          <div style="font-size:9px;font-weight:700;color:${isDark ? '#555' : '#bbb'};letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Badges (${unlockedBadges.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${unlockedBadges.slice(0, 8).map(b => `
              <div title="${b.name}" style="
                width:36px;height:36px;border-radius:10px;
                background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                display:flex;align-items:center;justify-content:center;font-size:18px;
              ">${b.emoji}</div>
            `).join('')}
            ${unlockedBadges.length > 8 ? `<div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${isDark ? '#666' : '#aaa'}">+${unlockedBadges.length - 8}</div>` : ''}
          </div>
        </div>
      ` : ''}

      <!-- FOOTER -->
      <div style="padding:12px 20px;display:flex;align-items:center;justify-content:space-between">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:2px;color:${isDark ? '#333' : '#ccc'}">UPSIDE DOWN TRAINING</div>
        <div style="font-size:10px;color:${isDark ? '#333' : '#ccc'}">${new Date().toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</div>
      </div>
    </div>

    <!-- CLOSE BUTTON -->
    <button onclick="document.getElementById('athlete-card-modal').remove()" style="
      position:absolute;top:16px;right:16px;
      width:36px;height:36px;border-radius:50%;
      background:var(--card2);border:1px solid var(--border2);
      color:var(--text);font-size:16px;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
    ">✕</button>

    <!-- SHARE HINT -->
    <div style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);font-size:11px;color:rgba(255,255,255,0.4);white-space:nowrap">
      📸 Fais une capture d'écran pour partager
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// Injection du bouton "Carte d'athlète" dans le menu profil
function _injectAthleteCardButton() {
  if (document.getElementById('athlete-card-btn')) return;
  const profilPage = document.getElementById('page-profil');
  if (!profilPage) return;
  const logoutBtn = profilPage.querySelector('.btn-logout');
  if (!logoutBtn) return;

  const btn = document.createElement('div');
  btn.className = 'menu-item';
  btn.id = 'athlete-card-btn';
  btn.style.cursor = 'pointer';
  btn.onclick = openAthleteCard;
  btn.innerHTML = `<span class="menu-item-label">🪪 Ma carte d'athlète</span><span>›</span>`;
  logoutBtn.insertAdjacentElement('beforebegin', btn);
}

// Hook goPage pour injecter les boutons sur profil
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof goPage === 'function') {
      // Déjà patché par les badges — on ajoute juste l'injection de la carte
      const _existingGoPage = goPage;
      window.goPage = async function (page) {
        await _existingGoPage.apply(this, arguments);
        if (page === 'profil') {
          _injectAthleteCardButton();
          _injectColorThemeButton();
        }
      };
    }
  }, 1200);
});


// ============================================================
// INIT GLOBAL
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Appliquer le thème couleur sauvegardé immédiatement
  initColorTheme();
});
