/* ============================================================
 * BADGES.JS — Système de badges custom créés par les admins
 *
 * INSTALLATION :
 *   1. Exécuter badges-migration.sql dans Supabase > SQL Editor
 *   2. Ajouter dans index.html juste avant </body> :
 *      <script src="badges.js"></script>
 *
 * CE QUE ÇA FAIT :
 *   — Onglet "🏅 Badges" dans le panel admin
 *   — Créer/modifier/supprimer des badges (emoji, nom, desc, rareté, type)
 *   — Attribuer manuellement à n'importe quel athlète avec note du coach
 *   — Badges auto vérifiés à chaque login et à chaque soumission de score
 *   — Célébration animée (confettis + modal) à la réception d'un nouveau badge
 *   — Section badges sur la page Profil de l'athlète
 *   — Carte d'athlète mise à jour automatiquement
 * ============================================================ */

'use strict';

// ── Constantes ─────────────────────────────────────────────
const RARITY_CONFIG = {
  bronze:    { label: 'Bronze',    color: '#cd7f32', glow: 'rgba(205,127,50,0.35)',  stars: 1 },
  silver:    { label: 'Argent',    color: '#c0c0c0', glow: 'rgba(192,192,192,0.35)', stars: 2 },
  gold:      { label: 'Or',        color: '#ffd700', glow: 'rgba(255,215,0,0.45)',   stars: 3 },
  legendary: { label: 'Légendaire',color: '#e8ff47', glow: 'rgba(232,255,71,0.55)',  stars: 4 },
};

const AUTO_TRIGGERS = {
  wod_count:        { label: 'Nombre de WODs loggués',        unit: 'WODs' },
  pr_count:         { label: 'Nombre de PRs enregistrés',     unit: 'PRs' },
  bench_count:      { label: 'Nombre de benchmarks complétés',unit: 'benchmarks' },
  week_streak:      { label: 'Séances dans la même semaine',   unit: 'séances/semaine' },
  rx_count:         { label: 'Nombre de scores RX',           unit: 'scores RX' },
};

// Cache local des badges pour éviter les requêtes répétées
let _badgesCache = null;
let _myBadgesCache = null;

// ── Helpers ────────────────────────────────────────────────
function _rarityBadgeHtml(rarity) {
  const r = RARITY_CONFIG[rarity] || RARITY_CONFIG.bronze;
  const stars = '★'.repeat(r.stars) + '☆'.repeat(4 - r.stars);
  return `<span style="font-size:10px;font-weight:700;color:${r.color};letter-spacing:1px">${stars} ${r.label.toUpperCase()}</span>`;
}

function _badgeCardHtml(badge, opts = {}) {
  const r = RARITY_CONFIG[badge.rarity] || RARITY_CONFIG.bronze;
  const { compact = false, showActions = false, owned = false } = opts;
  const opacity = owned ? '1' : '0.35';
  const filter  = owned ? 'none' : 'grayscale(1)';

  if (compact) {
    return `<div title="${badge.name} — ${badge.description || ''}\n${r.label}" style="
      display:flex;flex-direction:column;align-items:center;gap:4px;
      padding:10px 6px;border-radius:14px;cursor:default;
      background:${owned ? `rgba(${_hexToRgb(r.color)},0.08)` : 'var(--card2)'};
      border:1px solid ${owned ? r.color + '55' : 'var(--border)'};
      opacity:${opacity};filter:${filter};transition:all 0.2s;
      min-width:64px;flex:0 0 auto;
    ">
      <span style="font-size:28px;line-height:1">${badge.emoji}</span>
      <span style="font-size:9px;font-weight:700;text-align:center;line-height:1.3;color:var(--text2);max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${badge.name}</span>
      <span style="font-size:9px;color:${r.color}">${'★'.repeat(r.stars)}</span>
    </div>`;
  }

  return `<div style="
    background:var(--card);border:1px solid ${r.color}44;border-radius:14px;
    padding:14px;display:flex;align-items:center;gap:12px;position:relative;
    box-shadow:0 0 0 0 ${r.color}00;transition:all 0.2s;
  ">
    <div style="
      width:52px;height:52px;border-radius:12px;flex-shrink:0;
      background:${`rgba(${_hexToRgb(r.color)},0.12)`};border:1.5px solid ${r.color}66;
      display:flex;align-items:center;justify-content:center;font-size:26px;
    ">${badge.emoji}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:700;color:var(--text)">${badge.name}</div>
      ${badge.description ? `<div style="font-size:12px;color:var(--text2);margin-top:2px;line-height:1.4">${badge.description}</div>` : ''}
      <div style="margin-top:5px;display:flex;align-items:center;gap:8px">
        ${_rarityBadgeHtml(badge.rarity)}
        ${badge.award_type === 'auto' && badge.auto_trigger
          ? `<span style="font-size:10px;color:var(--muted)">⚡ Auto · ${badge.auto_threshold} ${AUTO_TRIGGERS[badge.auto_trigger]?.unit || ''}</span>`
          : `<span style="font-size:10px;color:var(--muted)">🎖️ Manuel</span>`
        }
      </div>
    </div>
    ${showActions ? `
      <div style="display:flex;flex-direction:column;gap:4px">
        <button onclick="openAwardBadgeModal('${badge.id}')" style="
          padding:6px 10px;background:var(--accent);color:#000;border:none;
          border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap
        ">Attribuer</button>
        <button onclick="openEditBadgeModal('${badge.id}')" style="
          padding:6px 10px;background:var(--card2);color:var(--text2);
          border:1px solid var(--border2);border-radius:8px;font-size:11px;cursor:pointer
        ">Modifier</button>
        <button onclick="deleteBadge('${badge.id}','${badge.name.replace(/'/g,"\\'")}') " style="
          padding:6px 10px;background:transparent;color:var(--muted);
          border:1px solid var(--border);border-radius:8px;font-size:11px;cursor:pointer
        ">Supprimer</button>
      </div>
    ` : ''}
  </div>`;
}

function _hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '200,200,200';
}

// ── Chargement des badges ──────────────────────────────────
async function loadAllBadges(force = false) {
  if (_badgesCache && !force) return _badgesCache;
  const { data } = await sb.from('badges').select('*').eq('is_active', true).order('rarity').order('name');
  _badgesCache = data || [];
  return _badgesCache;
}

async function loadMyBadges(force = false) {
  if (!window.currentUser) return [];
  if (_myBadgesCache && !force) return _myBadgesCache;
  const { data } = await sb.from('athlete_badges')
    .select('*, badges(*)')
    .eq('athlete_id', currentUser.id)
    .order('awarded_at', { ascending: false });
  _myBadgesCache = data || [];
  return _myBadgesCache;
}

// ── Vérification badges automatiques ──────────────────────
async function checkAutoBadges() {
  if (!window.currentUser) return;
  const [allBadges, myBadges, scores, prs, bench] = await Promise.all([
    loadAllBadges(),
    loadMyBadges(true),
    sb.from('wod_scores').select('id,level,done_at,created_at').eq('athlete_id', currentUser.id),
    sb.from('athlete_prs').select('id', { count: 'exact' }).eq('athlete_id', currentUser.id),
    sb.from('benchmark_scores').select('id', { count: 'exact' }).eq('athlete_id', currentUser.id),
  ]);

  const myBadgeIds = new Set(myBadges.map(ab => ab.badge_id));
  const autoBadges = allBadges.filter(b => b.award_type === 'auto' && b.auto_trigger && !myBadgeIds.has(b.id));
  if (!autoBadges.length) return;

  // Calcul des stats
  const allScores = scores.data || [];
  const weekMap = {};
  allScores.forEach(s => {
    const d = new Date(s.done_at || s.created_at);
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = mon.toISOString().split('T')[0];
    weekMap[key] = (weekMap[key] || 0) + 1;
  });

  const stats = {
    wod_count:   allScores.length,
    pr_count:    prs.count || 0,
    bench_count: bench.count || 0,
    week_streak: Object.values(weekMap).reduce((m, v) => Math.max(m, v), 0),
    rx_count:    allScores.filter(s => s.level === 'rx').length,
  };

  // Vérifier chaque badge auto
  for (const badge of autoBadges) {
    const stat = stats[badge.auto_trigger];
    if (stat !== undefined && stat >= badge.auto_threshold) {
      // Attribuer via upsert (ignore si déjà là)
      const { error } = await sb.from('athlete_badges').upsert({
        badge_id: badge.id,
        athlete_id: currentUser.id,
        awarded_by: null,
        seen: false,
      }, { onConflict: 'badge_id,athlete_id', ignoreDuplicates: true });

      if (!error) {
        _myBadgesCache = null; // invalider le cache
      }
    }
  }

  // Charger les nouveaux badges non vus
  await _showUnseenBadges();
}

async function _showUnseenBadges() {
  if (!window.currentUser) return;
  const { data } = await sb.from('athlete_badges')
    .select('*, badges(*)')
    .eq('athlete_id', currentUser.id)
    .eq('seen', false);

  if (!data || !data.length) return;

  for (let i = 0; i < data.length; i++) {
    setTimeout(() => _celebrateBadge(data[i]), i * 3800);
  }

  // Marquer tous comme vus
  await sb.from('athlete_badges')
    .update({ seen: true })
    .eq('athlete_id', currentUser.id)
    .eq('seen', false);

  _myBadgesCache = null;
}

// ── Célébration badge ──────────────────────────────────────
function _celebrateBadge(athleteBadge) {
  const badge = athleteBadge.badges || athleteBadge;
  const r = RARITY_CONFIG[badge.rarity] || RARITY_CONFIG.bronze;

  // Confettis couleur rareté
  _launchColoredConfetti(r.color);

  // Modal de célébration
  const existing = document.getElementById('badge-celebrate-modal');
  if (existing) existing.remove();

  const isLegendary = badge.rarity === 'legendary';
  const modal = document.createElement('div');
  modal.id = 'badge-celebrate-modal';
  modal.innerHTML = `
    <div style="
      position:relative;text-align:center;padding:28px 28px 20px;
      background:var(--card2);border-radius:24px;
      border:2px solid ${r.color};
      box-shadow:0 0 40px ${r.glow};
      max-width:300px;width:calc(100vw - 48px);
    ">
      ${isLegendary ? `<div style="font-size:10px;font-weight:700;letter-spacing:3px;color:${r.color};margin-bottom:8px;animation:legendaryPulse 1.5s ease-in-out infinite">✨ LÉGENDAIRE ✨</div>` : ''}
      <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:${r.color};text-transform:uppercase;margin-bottom:10px">Badge débloqué !</div>
      <div style="
        font-size:64px;line-height:1;margin-bottom:14px;
        display:inline-block;
        animation:badgePop 0.6s cubic-bezier(0.34,1.56,0.64,1);
        filter:drop-shadow(0 0 16px ${r.glow});
      ">${badge.emoji}</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:2px;color:var(--text)">${badge.name}</div>
      <div style="margin-top:6px">${_rarityBadgeHtml(badge.rarity)}</div>
      ${badge.description ? `<div style="font-size:13px;color:var(--text2);margin-top:8px;line-height:1.5">${badge.description}</div>` : ''}
      ${athleteBadge.coach_note ? `
        <div style="margin-top:10px;padding:10px 12px;background:rgba(232,255,71,0.06);border-left:2px solid var(--accent);border-radius:0 8px 8px 0;text-align:left">
          <div style="font-size:9px;font-weight:700;letter-spacing:1.5px;color:var(--muted);margin-bottom:3px">MESSAGE DU COACH</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5">${athleteBadge.coach_note}</div>
        </div>
      ` : ''}
      <button onclick="document.getElementById('badge-celebrate-modal').remove()" style="
        margin-top:16px;padding:11px 28px;background:${r.color};
        color:${badge.rarity === 'bronze' || badge.rarity === 'gold' ? '#000' : badge.rarity === 'legendary' ? '#000' : '#fff'};
        border:none;border-radius:12px;font-family:'DM Sans',sans-serif;
        font-size:14px;font-weight:700;cursor:pointer;width:100%;
      ">🎉 Trop bien !</button>
    </div>
  `;
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10002;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.7);padding:20px;
    backdrop-filter:blur(3px);
    animation:fadeInModal 0.3s ease;
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  // Injecter keyframes si pas encore là
  if (!document.getElementById('badges-keyframes')) {
    const s = document.createElement('style');
    s.id = 'badges-keyframes';
    s.textContent = `
      @keyframes badgePop{0%{transform:scale(0) rotate(-20deg)}60%{transform:scale(1.25) rotate(5deg)}100%{transform:scale(1) rotate(0)}}
      @keyframes legendaryPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(1.05)}}
      @keyframes fadeInModal{from{opacity:0}to{opacity:1}}
    `;
    document.head.appendChild(s);
  }
}

function _launchColoredConfetti(color) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10001;pointer-events:none';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e8ff47';
  const cols = [color, accent, '#ffffff', color + 'aa', accent + 'aa'];
  const pieces = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * -0.5,
    w: Math.random() * 10 + 5, h: Math.random() * 6 + 3,
    color: cols[Math.floor(Math.random() * cols.length)],
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.15,
    vx: (Math.random() - 0.5) * 3,
    vy: Math.random() * 3 + 2,
    opacity: 1,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rotSpeed;
      if (frame > 70) p.opacity -= 0.02;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frame++;
    if (frame < 110) requestAnimationFrame(draw); else canvas.remove();
  }
  draw();
}

// ── Affichage profil athlète ──────────────────────────────
async function renderBadgesSection() {
  let container = document.getElementById('profil-badges-section');
  if (!container) {
    const profilPage = document.getElementById('page-profil');
    if (!profilPage) return;
    const statsDiv = profilPage.querySelector('.profil-stats');
    if (!statsDiv) return;
    container = document.createElement('div');
    container.id = 'profil-badges-section';
    container.style.cssText = 'margin:0 20px 16px;padding:14px;background:var(--card);border:1px solid var(--border);border-radius:12px';
    statsDiv.insertAdjacentElement('afterend', container);
  }

  const [allBadges, myBadges] = await Promise.all([loadAllBadges(), loadMyBadges(true)]);
  const myBadgeIds = new Set(myBadges.map(ab => ab.badge_id));
  const unlocked = allBadges.filter(b => myBadgeIds.has(b.id));
  const locked   = allBadges.filter(b => !myBadgeIds.has(b.id));
  const total    = allBadges.length;

  if (total === 0) {
    container.innerHTML = `<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px">Aucun badge créé par le coach pour l'instant.</div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:2px;text-transform:uppercase">
        Badges
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--accent)">${unlocked.length} / ${total}</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${[...unlocked, ...locked].map(b => _badgeCardHtml(b, { compact: true, owned: myBadgeIds.has(b.id) })).join('')}
    </div>
    ${unlocked.length === 0 ? `<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0">Aucun badge obtenu pour l'instant — continue !</div>` : ''}
  `;
}

// ── ADMIN : onglet badges ──────────────────────────────────
async function loadAdminBadgesTab() {
  const panel = document.getElementById('admin-badges-panel');
  if (!panel) return;

  const [allBadges, allAthletes] = await Promise.all([
    loadAllBadges(true),
    sb.from('profiles').select('id,full_name,avatar_url').order('full_name'),
  ]);

  panel.innerHTML = `
    <!-- Formulaire création badge -->
    <div style="background:var(--card2);border:1px solid var(--border2);border-radius:14px;padding:16px;margin-bottom:16px" id="badge-create-form">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:12px">+ Nouveau badge</div>
      <div style="display:flex;gap:8px;margin-bottom:10px;align-items:flex-start;flex-wrap:wrap">
        <input id="nb-emoji" type="text" value="🏅" style="
          width:52px;height:52px;font-size:28px;text-align:center;
          background:var(--card);border:1.5px solid var(--border2);
          border-radius:10px;color:var(--text);outline:none;cursor:pointer;
        " onclick="this.select()" title="Clique et colle un emoji">
        <div style="flex:1;min-width:160px;display:flex;flex-direction:column;gap:8px">
          <input id="nb-name" type="text" placeholder="Nom du badge" style="
            width:100%;background:var(--card);border:1.5px solid var(--border2);
            border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
            font-size:14px;padding:11px 14px;outline:none;
          ">
          <input id="nb-desc" type="text" placeholder="Description (optionnel)" style="
            width:100%;background:var(--card);border:1.5px solid var(--border2);
            border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
            font-size:13px;padding:10px 14px;outline:none;
          ">
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:140px">
          <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Rareté</div>
          <select id="nb-rarity" style="
            width:100%;background:var(--card);border:1.5px solid var(--border2);
            border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
            font-size:13px;padding:10px 14px;outline:none;
          ">
            <option value="bronze">🥉 Bronze</option>
            <option value="silver">🥈 Argent</option>
            <option value="gold" selected>🥇 Or</option>
            <option value="legendary">✨ Légendaire</option>
          </select>
        </div>
        <div style="flex:1;min-width:140px">
          <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Type</div>
          <select id="nb-type" onchange="toggleAutoFields()" style="
            width:100%;background:var(--card);border:1.5px solid var(--border2);
            border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
            font-size:13px;padding:10px 14px;outline:none;
          ">
            <option value="manual">🎖️ Manuel (coach attribue)</option>
            <option value="auto">⚡ Automatique</option>
          </select>
        </div>
      </div>

      <!-- Champs condition auto (masqués par défaut) -->
      <div id="nb-auto-fields" style="display:none;background:rgba(232,255,71,0.04);border:1px solid rgba(232,255,71,0.15);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;color:var(--accent);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">⚡ Condition automatique</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select id="nb-trigger" style="
            flex:1;min-width:160px;background:var(--card);border:1.5px solid var(--border2);
            border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
            font-size:13px;padding:10px 14px;outline:none;
          ">
            ${Object.entries(AUTO_TRIGGERS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <input id="nb-threshold" type="number" min="1" placeholder="Seuil (ex: 50)" style="
            width:120px;background:var(--card);border:1.5px solid var(--border2);
            border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
            font-size:13px;padding:10px 14px;outline:none;
          ">
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">Le badge sera attribué automatiquement dès que l'athlète atteint le seuil.</div>
      </div>

      <button onclick="createBadge()" style="
        width:100%;padding:12px;background:var(--accent);color:#000;
        border:none;border-radius:10px;font-family:'DM Sans',sans-serif;
        font-size:14px;font-weight:700;cursor:pointer;
      ">Créer le badge</button>
    </div>

    <!-- Liste des badges existants -->
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">
      ${allBadges.length} badge${allBadges.length > 1 ? 's' : ''} créé${allBadges.length > 1 ? 's' : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:10px" id="badges-admin-list">
      ${allBadges.length === 0
        ? `<div style="font-size:13px;color:var(--muted);text-align:center;padding:24px">Aucun badge créé pour l'instant.</div>`
        : allBadges.map(b => _badgeCardHtml(b, { showActions: true })).join('')
      }
    </div>
  `;
}

function toggleAutoFields() {
  const sel = document.getElementById('nb-type');
  const fields = document.getElementById('nb-auto-fields');
  if (!sel || !fields) return;
  fields.style.display = sel.value === 'auto' ? 'block' : 'none';
}

async function createBadge() {
  const emoji     = document.getElementById('nb-emoji')?.value.trim() || '🏅';
  const name      = document.getElementById('nb-name')?.value.trim();
  const desc      = document.getElementById('nb-desc')?.value.trim() || null;
  const rarity    = document.getElementById('nb-rarity')?.value || 'bronze';
  const awardType = document.getElementById('nb-type')?.value || 'manual';
  const trigger   = document.getElementById('nb-trigger')?.value || null;
  const threshold = parseInt(document.getElementById('nb-threshold')?.value) || null;

  if (!name) { showToast('⚠️ Le nom est obligatoire'); return; }
  if (awardType === 'auto' && (!trigger || !threshold)) {
    showToast('⚠️ Choisis un déclencheur et un seuil pour le badge automatique');
    return;
  }

  const payload = {
    emoji, name, description: desc, rarity,
    award_type: awardType,
    auto_trigger:    awardType === 'auto' ? trigger   : null,
    auto_threshold:  awardType === 'auto' ? threshold : null,
    created_by: window.currentUser?.id,
  };

  const { error } = await sb.from('badges').insert(payload);
  if (error) { showToast('❌ ' + error.message); return; }

  showToast('✅ Badge créé !');
  _badgesCache = null;
  document.getElementById('nb-name').value = '';
  document.getElementById('nb-desc').value = '';
  document.getElementById('nb-emoji').value = '🏅';
  await loadAdminBadgesTab();
}

async function deleteBadge(id, name) {
  if (!confirm(`Supprimer le badge "${name}" ?\n\nIl sera retiré à tous les athlètes qui l'ont.`)) return;
  const { error } = await sb.from('badges').delete().eq('id', id);
  if (error) { showToast('❌ ' + error.message); return; }
  showToast('🗑️ Badge supprimé');
  _badgesCache = null;
  _myBadgesCache = null;
  await loadAdminBadgesTab();
}

// ── Attribution manuelle ───────────────────────────────────
let _awardingBadgeId = null;

async function openAwardBadgeModal(badgeId) {
  _awardingBadgeId = badgeId;
  const badge = (_badgesCache || []).find(b => b.id === badgeId);
  const { data: athletes } = await sb.from('profiles').select('id,full_name').order('full_name');

  const existing = document.getElementById('award-badge-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'award-badge-modal';
  modal.innerHTML = `
    <div style="
      background:var(--card2);border-radius:20px;padding:20px;
      max-width:340px;width:calc(100% - 40px);
      border:1px solid var(--border2);
    ">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">Attribuer un badge</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:10px;background:var(--card);border-radius:10px">
        <span style="font-size:28px">${badge?.emoji || '🏅'}</span>
        <div>
          <div style="font-size:14px;font-weight:700">${badge?.name || ''}</div>
          <div style="margin-top:2px">${_rarityBadgeHtml(badge?.rarity || 'bronze')}</div>
        </div>
      </div>

      <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Athlète</div>
      <select id="award-athlete-sel" style="
        width:100%;background:var(--card);border:1.5px solid var(--border2);
        border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
        font-size:14px;padding:11px 14px;outline:none;margin-bottom:12px;
      ">
        <option value="">— Choisir un athlète —</option>
        ${(athletes || []).map(a => `<option value="${a.id}">${a.full_name || a.id}</option>`).join('')}
      </select>

      <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Message du coach <span style="font-weight:400;text-transform:none;letter-spacing:0">(optionnel)</span></div>
      <textarea id="award-note" placeholder="Ex: Bravo pour ta régularité ce mois-ci !" style="
        width:100%;background:var(--card);border:1.5px solid var(--border2);
        border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
        font-size:13px;padding:11px 14px;outline:none;resize:none;min-height:72px;
        line-height:1.6;margin-bottom:14px;
      "></textarea>

      <button onclick="confirmAwardBadge()" style="
        width:100%;padding:13px;background:var(--accent);color:#000;
        border:none;border-radius:12px;font-family:'DM Sans',sans-serif;
        font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;
      ">🎖️ Attribuer</button>
      <button onclick="document.getElementById('award-badge-modal').remove()" style="
        width:100%;padding:11px;background:transparent;color:var(--muted);
        border:1px solid var(--border);border-radius:12px;font-family:'DM Sans',sans-serif;
        font-size:13px;cursor:pointer;
      ">Annuler</button>
    </div>
  `;
  modal.style.cssText = `
    position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.75);
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function confirmAwardBadge() {
  const athleteId = document.getElementById('award-athlete-sel')?.value;
  const note      = document.getElementById('award-note')?.value.trim() || null;

  if (!athleteId) { showToast('⚠️ Choisis un athlète'); return; }

  const { error } = await sb.from('athlete_badges').upsert({
    badge_id:   _awardingBadgeId,
    athlete_id: athleteId,
    awarded_by: window.currentUser?.id,
    coach_note: note,
    seen:       false,
  }, { onConflict: 'badge_id,athlete_id' });

  if (error) { showToast('❌ ' + error.message); return; }

  document.getElementById('award-badge-modal')?.remove();
  _myBadgesCache = null;
  showToast('✅ Badge attribué !');
}

// ── Edit badge ─────────────────────────────────────────────
async function openEditBadgeModal(badgeId) {
  const badge = (_badgesCache || []).find(b => b.id === badgeId);
  if (!badge) return;

  const existing = document.getElementById('edit-badge-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'edit-badge-modal';
  modal.innerHTML = `
    <div style="
      background:var(--card2);border-radius:20px;padding:20px;
      max-width:340px;width:calc(100% - 40px);
      border:1px solid var(--border2);
    ">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:12px">Modifier le badge</div>

      <div style="display:flex;gap:8px;margin-bottom:10px;align-items:flex-start">
        <input id="eb-emoji" type="text" value="${badge.emoji}" style="
          width:52px;height:52px;font-size:28px;text-align:center;
          background:var(--card);border:1.5px solid var(--border2);
          border-radius:10px;color:var(--text);outline:none;
        " onclick="this.select()">
        <div style="flex:1;display:flex;flex-direction:column;gap:8px">
          <input id="eb-name" type="text" value="${badge.name}" style="
            width:100%;background:var(--card);border:1.5px solid var(--border2);
            border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
            font-size:14px;padding:11px 14px;outline:none;
          ">
          <input id="eb-desc" type="text" value="${badge.description || ''}" placeholder="Description" style="
            width:100%;background:var(--card);border:1.5px solid var(--border2);
            border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
            font-size:13px;padding:10px 14px;outline:none;
          ">
        </div>
      </div>

      <select id="eb-rarity" style="
        width:100%;background:var(--card);border:1.5px solid var(--border2);
        border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
        font-size:13px;padding:10px 14px;outline:none;margin-bottom:14px;
      ">
        <option value="bronze"  ${badge.rarity==='bronze'  ?'selected':''}>🥉 Bronze</option>
        <option value="silver"  ${badge.rarity==='silver'  ?'selected':''}>🥈 Argent</option>
        <option value="gold"    ${badge.rarity==='gold'    ?'selected':''}>🥇 Or</option>
        <option value="legendary" ${badge.rarity==='legendary'?'selected':''}>✨ Légendaire</option>
      </select>

      <button onclick="saveEditBadge('${badgeId}')" style="
        width:100%;padding:13px;background:var(--accent);color:#000;
        border:none;border-radius:12px;font-family:'DM Sans',sans-serif;
        font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;
      ">Enregistrer</button>
      <button onclick="document.getElementById('edit-badge-modal').remove()" style="
        width:100%;padding:11px;background:transparent;color:var(--muted);
        border:1px solid var(--border);border-radius:12px;font-family:'DM Sans',sans-serif;
        font-size:13px;cursor:pointer;
      ">Annuler</button>
    </div>
  `;
  modal.style.cssText = `
    position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.75);
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function saveEditBadge(badgeId) {
  const emoji  = document.getElementById('eb-emoji')?.value.trim() || '🏅';
  const name   = document.getElementById('eb-name')?.value.trim();
  const desc   = document.getElementById('eb-desc')?.value.trim() || null;
  const rarity = document.getElementById('eb-rarity')?.value || 'bronze';

  if (!name) { showToast('⚠️ Le nom est obligatoire'); return; }

  const { error } = await sb.from('badges').update({ emoji, name, description: desc, rarity }).eq('id', badgeId);
  if (error) { showToast('❌ ' + error.message); return; }

  document.getElementById('edit-badge-modal')?.remove();
  showToast('✅ Badge modifié');
  _badgesCache = null;
  await loadAdminBadgesTab();
}

// ── Injection dans l'UI ────────────────────────────────────

// Injecter l'onglet Badges dans le panel admin
function _injectAdminBadgesTab() {
  if (document.getElementById('admin-badges-tab-btn')) return;

  // Bouton onglet
  const tabBar = document.querySelector('.admin-tab-bar') ||
                 document.querySelector('[onclick="adminTab(\'perso\',this)"]')?.parentElement;
  if (!tabBar) return;

  const btn = document.createElement('button');
  btn.className = 'admin-tab-btn';
  btn.id = 'admin-badges-tab-btn';
  btn.textContent = '🏅 Badges';
  btn.onclick = function () { adminTab('badges', this); };
  tabBar.appendChild(btn);

  // Panel
  const adminPage = document.getElementById('page-admin');
  if (!adminPage) return;

  const panel = document.createElement('div');
  panel.className = 'admin-panel';
  panel.id = 'admin-badges';
  panel.innerHTML = `<div id="admin-badges-panel"><div class="spinner"></div></div>`;
  adminPage.querySelector('.admin-tab-bar')?.insertAdjacentElement('afterend', panel) ||
  adminPage.appendChild(panel);
}

// Hook adminTab pour charger les badges quand on clique sur l'onglet
function _hookAdminTab() {
  if (typeof adminTab !== 'function') return;
  const _orig = adminTab;
  window.adminTab = function (tab, btn) {
    _orig.apply(this, arguments);
    if (tab === 'badges') loadAdminBadgesTab();
  };
}

// Hook goPage pour afficher les badges sur la page profil + vérifier les auto badges
function _hookGoPage() {
  if (typeof goPage !== 'function') return;
  const _orig = goPage;
  window.goPage = async function (page) {
    await _orig.apply(this, arguments);
    if (page === 'profil') {
      renderBadgesSection();
    }
  };
}

// Hook submitScore pour re-vérifier les badges auto après chaque score
function _hookSubmitScore() {
  if (typeof submitScore !== 'function') return;
  const _orig = submitScore;
  window.submitScore = async function () {
    await _orig.apply(this, arguments);
    // Petite pause pour que Supabase traite le score avant qu'on requête
    setTimeout(() => checkAutoBadges(), 1500);
  };
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    _injectAdminBadgesTab();
    _hookAdminTab();
    _hookGoPage();
    _hookSubmitScore();

    // Vérifier les badges auto au démarrage
    if (window.currentUser) {
      setTimeout(() => {
        checkAutoBadges();
        _showUnseenBadges();
      }, 2500);
    }

    // Aussi après login
    if (typeof initApp === 'function') {
      const _origInit = initApp;
      window.initApp = async function () {
        await _origInit.apply(this, arguments);
        setTimeout(() => {
          checkAutoBadges();
          _showUnseenBadges();
        }, 2000);
      };
    }
  }, 1000);
});
