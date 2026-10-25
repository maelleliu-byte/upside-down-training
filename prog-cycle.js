/* ============================================================
 * CYCLE EN COURS — page Prog, onglets de programmation
 * ------------------------------------------------------------
 * Même visuel que le cycle de l'espace perso, pour les athlètes
 * qui suivent une programmation (Training, HYROX…) :
 *  - le cycle en cours de la programmation (ex. CF OCTOBRE · semaine 1/4)
 *  - la semaine, jour par jour, avec les blocs prévus (Force + WOD…)
 *  - le contenu du jour sélectionné, bloc par bloc, avec son titre
 * Données : RPC programme_cycles (nom, dates, couleur — rien d'autre)
 *           + sessions de la programmation pour la semaine affichée.
 * ============================================================ */
(function () {
  if (window.__patchBound_progCycle) return;
  window.__patchBound_progCycle = true;

  var PALETTE = ['#e8ff47', '#2dd4bf', '#ff7a45', '#c084fc', '#47c8ff', '#f87171', '#4ade80', '#fbbf24', '#f472b6', '#a3a3a3'];
  var DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  var SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var HIDE_TYPES = { warmup: 1, mobility: 1 };
  var _cyc = {};      // programme_id -> [cycles]
  var _seq = 0;

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function d12(s) { return new Date(s + 'T12:00:00'); }
  function fmt(d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
  function dow(d) { var n = d.getDay(); return n === 0 ? 7 : n; }
  function monday(d) { var m = new Date(d); m.setHours(12, 0, 0, 0); m.setDate(m.getDate() - (dow(m) - 1)); return m; }
  function endOf(c) { var e = d12(c.start_date); e.setDate(e.getDate() + (c.weeks || 1) * 7 - 1); return e; }
  function colorOf(c) { return c.color || PALETTE[((c.rank || 1) - 1) % PALETTE.length]; }
  function label(t) { try { return (TYPE_LABELS && TYPE_LABELS[t]) || t || ''; } catch (e) { return t || ''; } }
  var SHORT_T = { strength: 'Force', wod: 'WOD', weightlifting: 'Haltéro', gymnastics: 'Gym', bodybuilding: 'Bodyb.', renforcement: 'Renfo', engine: 'Engine', skill: 'Skill', run: 'Run' };
  function shortLabel(t) { return SHORT_T[t] || label(t); }
  function hex(c) { return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#e8ff47'; }

  async function loadCycles(pid) {
    if (_cyc[pid]) return _cyc[pid];
    var r = await sb.rpc('programme_cycles', { p_programme: pid });
    if (r.error) { console.warn('[prog-cycle]', r.error.message); return (_cyc[pid] = []); }
    return (_cyc[pid] = r.data || []);
  }
  function cycleFor(list, isoDate) {
    var hit = list.filter(function (c) { return c.start_date <= isoDate && iso(endOf(c)) >= isoDate; });
    return hit.length ? hit[hit.length - 1] : null;
  }

  function css() {
    if (document.getElementById('pg-styles')) return;
    var st = document.createElement('style'); st.id = 'pg-styles';
    st.textContent = [
      '.pg-card{border-radius:14px;padding:14px;margin-bottom:14px;border:1px solid transparent;border-left-width:4px}',
      '.pg-head{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}',
      '.pg-name{font-family:"Bebas Neue",sans-serif;font-size:21px;letter-spacing:1.5px;line-height:1;flex:1;min-width:0}',
      '.pg-wk{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);white-space:nowrap}',
      '.pg-wk b{font-size:15px;font-family:"Bebas Neue",sans-serif;letter-spacing:1px;color:var(--text)}',
      '.pg-track{height:5px;border-radius:3px;background:var(--border2);overflow:hidden;margin-bottom:4px}',
      '.pg-fill{height:100%;border-radius:3px}',
      '.pg-dates{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:12px}',
      '.pg-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}',
      '.pg-cell{border-radius:8px;padding:6px 2px;text-align:center;min-height:54px;background:var(--card2);border:1.5px solid transparent;cursor:pointer}',
      '.pg-cell .dd{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:4px}',
      '.pg-cell .pp{font-size:9.5px;font-weight:700;line-height:1.25;overflow-wrap:anywhere;hyphens:auto}',
      '.pg-cell.off .pp{color:var(--muted);font-weight:400;opacity:.5}',
      '.pg-today{margin-top:12px;padding-top:10px;border-top:1px solid var(--border2)}',
      '.pg-today .lbl{font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:6px}',
      '.pg-blk{display:flex;align-items:center;gap:10px;padding:5px 0}',
      '.pg-blk .ty{flex:0 0 auto;font-size:9.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;padding:3px 8px;border-radius:6px;min-width:64px;text-align:center}',
      '.pg-blk .ti{font-family:"Bebas Neue",sans-serif;font-size:18px;letter-spacing:1px;line-height:1.1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pg-none{font-size:12px;color:var(--muted)}',
      '.pg-recap{background:var(--card);border:1px solid var(--border);border-left-width:1px;padding:12px 14px}',
      '.pg-recap .lbl{font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:4px}',
      '.cyc-phase{padding:0 20px 8px}',
      '.cyc-row{display:flex;align-items:baseline;gap:10px}',
      '.cyc-nm{font-family:"Bebas Neue",sans-serif;font-size:17px;letter-spacing:1.5px;line-height:1;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cyc-wk{font-size:10.5px;color:var(--muted);white-space:nowrap}',
      '.cyc-wk b{color:var(--text);font-size:12px}',
      '.cyc-track{height:3px;border-radius:2px;background:var(--border2);overflow:hidden;margin-top:6px}',
      '.cyc-track i{display:block;height:100%;border-radius:2px}',
      '.pg-cell .px{font-size:8.5px;font-weight:600;line-height:1.2;margin-top:3px;opacity:.75;overflow-wrap:anywhere}',
      '.pg-sep{display:flex;align-items:center;gap:8px;margin:8px 0 4px;font-size:9.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase}',
      '.pg-sep i{flex:1;height:1px}',
      '.pg-sep span{flex:0 0 auto}'
    ].join('');
    document.head.appendChild(st);
  }

  // Phase du cycle, au-dessus des jours (partagée avec l'espace perso)
  function setPhase(o) {
    css();
    var strip = document.getElementById('day-strip'); if (!strip) return;
    var el = document.getElementById('cyc-phase');
    if (!o) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'cyc-phase'; el.className = 'cyc-phase'; }
    if (el.nextElementSibling !== strip) strip.parentNode.insertBefore(el, strip);
    var col = hex(o.color);
    var pct = Math.max(4, Math.min(100, Math.round(o.n / (o.weeks || 1) * 100)));
    el.innerHTML = '<div class="cyc-row"><span class="cyc-nm" style="color:' + col + '">' + esc(o.name) + '</span>' +
      '<span class="cyc-wk">' + (o.start ? fmt(o.start) + ' → ' + fmt(o.end) + ' · ' : '') + 'Sem. <b>' + o.n + '</b>/' + (o.weeks || '?') + '</span></div>' +
      '<div class="cyc-track"><i style="width:' + pct + '%;background:' + col + '"></i></div>';
  }
  window.__cyclePhase = { set: setPhase, clear: function () { setPhase(null); } };

  async function renderCard() {
    var prog = (typeof currentProg !== 'undefined') ? currentProg : null;
    if (!prog || !prog.id || prog.id === '__perso__') return;
    var area = document.getElementById('sessions-area'); if (!area) return;
    var clearAll = function () { area.querySelectorAll('.pg-card').forEach(function (n) { n.remove(); }); setPhase(null); };
    try { if (typeof hasAccess === 'function' && !hasAccess(prog)) { clearAll(); return; } } catch (e) {}
    var my = ++_seq;
    var oneshot = false;
    try { oneshot = typeof isOneshotProg === 'function' && isOneshotProg(prog); } catch (e) {}

    var phase = null, lbl = '', future = false, q;
    if (oneshot) {
      // programmation à durée fixe : bandeau « semaine n / total » de la programmation
      var m = (typeof selectedDate === 'string') && selectedDate.match(/^__w(\d+)d(\d+)$/);
      if (!m) { clearAll(); return; }
      var wN = parseInt(m[1], 10), dN = parseInt(m[2], 10);
      phase = { name: prog.name, color: prog.color || '#2dd4bf', n: wN, weeks: prog.total_weeks || 8 };
      lbl = DAYS[dN] + ' · semaine ' + wN;
      q = sb.from('sessions').select('type,title,color,sort_order,created_at')
        .eq('programme_id', prog.id).eq('week_number', wN).eq('day_of_week', dN);
    } else {
      var refIso = (typeof selectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) ? selectedDate : iso(new Date());
      var c = cycleFor(await loadCycles(prog.id), refIso);
      if (my !== _seq) return;
      if (c) {
        var s0 = d12(c.start_date);
        phase = { name: c.name, color: colorOf(c), n: Math.floor((monday(d12(refIso)) - monday(s0)) / 604800000) + 1,
          weeks: c.weeks, start: s0, end: endOf(c) };
      }
      var refD = d12(refIso);
      lbl = refIso === iso(new Date()) ? "Aujourd'hui" : DAYS[dow(refD) - 1] + ' ' + refD.getDate();
      future = refIso > iso(new Date());
      q = sb.from('sessions').select('type,title,color,sort_order,created_at')
        .eq('programme_id', prog.id).eq('date', refIso);
    }
    var r = await q.order('sort_order', { ascending: true, nullsFirst: false }).order('created_at');
    if (my !== _seq) return;

    var blocks = (r.data || []).filter(function (b) { return !HIDE_TYPES[b.type]; });
    // un séparateur seul (sans bloc après) n'est pas affiché
    blocks = blocks.filter(function (b, i) { return b.type !== 'separator' || blocks.slice(i + 1).some(function (x) { return x.type !== 'separator'; }); });
    var col = hex(phase ? phase.color : (prog.color || '#2dd4bf'));

    css();
    setPhase(phase);
    area.querySelectorAll('.pg-card').forEach(function (x) { x.remove(); });
    if (!blocks.some(function (b) { return b.type !== 'separator'; })) return;   // le fil affiche déjà « pas de séance »

    var dayHtml = blocks.map(function (b) {
      if (b.type === 'separator') {
        var t = '#2dd4bf';
        return '<div class="pg-sep" style="color:' + t + '"><i style="background:' + t + '55"></i><span>' + esc(b.title || 'Bloc supplémentaire') + '</span><i style="background:' + t + '55"></i></div>';
      }
      var bc = hex(b.color || col);
      return '<div class="pg-blk"><span class="ty" style="background:' + bc + '22;color:' + bc + '">' + esc(label(b.type)) + '</span>' +
        '<span class="ti">' + esc(b.title || label(b.type)) + '</span></div>';
    }).join('');

    var el = document.createElement('div');
    el.className = 'pg-card pg-recap';
    el.innerHTML = '<div class="lbl">' + esc(lbl) + ' · au programme</div>' + dayHtml;
    area.insertBefore(el, area.firstChild);
  }

  function bind() {
    if (window.__pgBound || typeof window.renderSessions !== 'function') return !!window.__pgBound;
    window.__pgBound = true;
    var prev = window.renderSessions;
    window.renderSessions = async function () {
      var r = await prev.apply(this, arguments);
      try { await renderCard(); } catch (e) { console.warn('[prog-cycle]', e); }
      return r;
    };
    // si une programmation est déjà affichée
    setTimeout(function () { renderCard().catch(function () {}); }, 300);
    return true;
  }
  if (!bind()) {
    var t = 0, iv = setInterval(function () { if (bind() || ++t > 40) clearInterval(iv); }, 250);
  }
  window.__progCycle = { refresh: function () { _cyc = {}; return renderCard(); } };
})();
