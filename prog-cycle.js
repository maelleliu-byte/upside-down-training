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
  var HIDE_TYPES = { separator: 1, warmup: 1, mobility: 1 };
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
      '.pg-none{font-size:12px;color:var(--muted)}'
    ].join('');
    document.head.appendChild(st);
  }

  async function renderCard() {
    var prog = (typeof currentProg !== 'undefined') ? currentProg : null;
    if (!prog || !prog.id || prog.id === '__perso__') return;
    try { if (typeof isOneshotProg === 'function' && isOneshotProg(prog)) return; } catch (e) {}
    try { if (typeof hasAccess === 'function' && !hasAccess(prog)) return; } catch (e) {}
    var area = document.getElementById('sessions-area'); if (!area) return;
    var my = ++_seq;

    var refIso = (typeof selectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) ? selectedDate : iso(new Date());
    var list = await loadCycles(prog.id);
    var c = cycleFor(list, refIso);
    if (!c || my !== _seq) { area.querySelectorAll('.pg-card').forEach(function (n) { n.remove(); }); return; }

    var mon = monday(d12(refIso));
    var days = []; for (var i = 0; i < 7; i++) { var x = new Date(mon); x.setDate(mon.getDate() + i); days.push(x); }
    var isos = days.map(iso);
    var r = await sb.from('sessions').select('date,type,title,color,sort_order,created_at')
      .eq('programme_id', prog.id).gte('date', isos[0]).lte('date', isos[6])
      .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at');
    if (my !== _seq) return;
    var byDay = {}; isos.forEach(function (k) { byDay[k] = []; });
    (r.data || []).forEach(function (s) { if (byDay[s.date] && !HIDE_TYPES[s.type]) byDay[s.date].push(s); });

    var col = hex(colorOf(c));
    var s0 = d12(c.start_date), e0 = endOf(c);
    var n = Math.floor((monday(d12(refIso)) - monday(s0)) / 604800000) + 1;
    var pct = Math.max(4, Math.min(100, Math.round(n / (c.weeks || 1) * 100)));

    var week = days.map(function (d, k) {
      var blocks = byDay[isos[k]];
      var inCycle = isos[k] >= c.start_date && isos[k] <= iso(e0);
      var seen = {}, types = [];
      blocks.forEach(function (b) { var l = shortLabel(b.type); if (!seen[l]) { seen[l] = 1; types.push(l); } });
      var txt = types.join(' + ');
      var sel = isos[k] === refIso;
      return '<div class="pg-cell' + (txt ? '' : ' off') + '" data-d="' + isos[k] + '" style="' +
        (txt && inCycle ? 'background:' + col + '1a;color:' + col + ';' : '') +
        (sel ? 'border-color:' + col + ';' : '') + '">' +
        '<div class="dd">' + SHORT[k] + d.getDate() + '</div>' +
        '<div class="pp">' + (txt ? esc(txt) : (isos[k] > iso(new Date()) ? '·' : 'Repos')) + '</div></div>';
    }).join('');

    var refD = d12(refIso);
    var todayLbl = refIso === iso(new Date()) ? "Aujourd'hui" : DAYS[dow(refD) - 1] + ' ' + refD.getDate();
    var blocks = byDay[refIso] || [];
    var dayHtml = blocks.length ? blocks.map(function (b) {
      var bc = hex(b.color || col);
      return '<div class="pg-blk"><span class="ty" style="background:' + bc + '22;color:' + bc + '">' + esc(label(b.type)) + '</span>' +
        '<span class="ti">' + esc(b.title || label(b.type)) + '</span></div>';
    }).join('') : '<div class="pg-none">' + (refIso > iso(new Date()) ? 'Rien de publié pour l\'instant.' : 'Repos — pas de bloc programmé.') + '</div>';

    css();
    area.querySelectorAll('.pg-card').forEach(function (x) { x.remove(); });
    var el = document.createElement('div');
    el.className = 'pg-card';
    el.style.cssText = 'background:' + col + '0f;border-color:' + col + '33;border-left-color:' + col;
    el.innerHTML =
      '<div class="pg-head"><div class="pg-name" style="color:' + col + '">' + esc(c.name) + '</div>' +
        '<div class="pg-wk">Semaine <b>' + n + '</b> / ' + (c.weeks || '?') + '</div></div>' +
      '<div class="pg-track"><div class="pg-fill" style="width:' + pct + '%;background:' + col + '"></div></div>' +
      '<div class="pg-dates"><span>' + fmt(s0) + '</span><span>' + fmt(e0) + '</span></div>' +
      '<div class="pg-week">' + week + '</div>' +
      '<div class="pg-today"><div class="lbl">' + todayLbl + ' · au programme</div>' + dayHtml + '</div>';
    area.insertBefore(el, area.firstChild);
    el.querySelectorAll('[data-d]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        if (cell.dataset.d !== refIso && typeof window.selectDate === 'function') window.selectDate(cell.dataset.d);
      });
    });
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
