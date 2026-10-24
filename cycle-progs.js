/* ============================================================
 * CYCLES PAR PROGRAMMATION — onglet admin « 📅 Cycle »
 * ------------------------------------------------------------
 * Un onglet par programmation (Training, HYROX…). Dans chaque
 * onglet, les cycles sont rangés à la suite (frise chronologique)
 * et on passe de l'un à l'autre avec ‹ ›. « + Cycle suivant »
 * crée le cycle qui démarre juste après le dernier.
 *
 * Lien en base : cycle_plans.programme_id (nullable).
 * Fichier autonome : se greffe sur loadAllCycles / loadCycle /
 * newCycle / renderCycleSelector / renderSeasonOverview et sur les
 * sauvegardes, sans les réécrire.
 * ============================================================ */
(function () {
  if (window.__patchBound_cycleProgs) return;
  window.__patchBound_cycleProgs = true;

  var LS_KEY = 'udt_cycle_prog_tab';
  var _progs = [];            // programmes du studio
  var _progOf = {};           // cycleId -> programme_id
  var _tab = 'all';           // 'all' | 'none' | programme_id
  var _savingProg = false;
  var _colorOf = {};          // cycleId -> couleur choisie (null = auto)
  var _seaYear = new Date().getFullYear();
  var PALETTE = ['#e8ff47', '#2dd4bf', '#ff7a45', '#c084fc', '#47c8ff', '#f87171', '#4ade80', '#fbbf24', '#f472b6', '#a3a3a3'];
  var MONTHS = ['JAN', 'FÉV', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];
  var _opened = false;
  try { _tab = localStorage.getItem(LS_KEY) || 'all'; } catch (e) {}

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function sid() { try { return typeof getStudioId === 'function' ? getStudioId() : null; } catch (e) { return null; } }
  function toast(m) { if (typeof showToast === 'function') showToast(m); }
  function cycles() { try { return allCycles || []; } catch (e) { return []; } }
  function cur() { try { return cycleData; } catch (e) { return null; } }

  function startOf(c) { return c.start_date ? new Date(c.start_date + 'T12:00:00') : null; }
  function endOf(c) {
    var s = startOf(c); if (!s) return null;
    var e = new Date(s); e.setDate(s.getDate() + (parseInt(c.weeks) || 8) * 7 - 1); return e;
  }
  function fmt(d) { return d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') : '?'; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function inTab(c) {
    var p = _progOf[c.id] || null;
    if (_tab === 'all') return true;
    if (_tab === 'none') return !p;
    return p === _tab;
  }
  // cycles de l'onglet, du plus ancien au plus récent (sans date en dernier)
  function tabCycles() {
    return cycles().filter(inTab).slice().sort(function (a, b) {
      if (!a.start_date && !b.start_date) return (a.name || '').localeCompare(b.name || '');
      if (!a.start_date) return 1; if (!b.start_date) return -1;
      return a.start_date.localeCompare(b.start_date);
    });
  }
  function isTraining(p) { return /^training$/i.test((p.name || '').trim()); }
  function sortedProgs(cnt) {
    if (!cnt) { cnt = {}; cycles().forEach(function (c) { var p = _progOf[c.id]; if (p) cnt[p] = (cnt[p] || 0) + 1; }); }
    return _progs.slice().sort(function (a, b) {
      return (isTraining(b) - isTraining(a)) || (cnt[b.id] || 0) - (cnt[a.id] || 0) || a.name.localeCompare(b.name);
    });
  }
  function defaultTab() { var l = sortedProgs(); return l.length ? l[0].id : 'none'; }
  // couleur d'un cycle : choisie, sinon automatique selon son rang dans sa programmation
  function colorOf(c) {
    if (!c) return PALETTE[0];
    if (_colorOf[c.id]) return _colorOf[c.id];
    var p = _progOf[c.id] || null;
    var same = cycles().filter(function (x) { return (_progOf[x.id] || null) === p; })
      .sort(function (a, b) { return (a.start_date || '9').localeCompare(b.start_date || '9') || (a.name || '').localeCompare(b.name || ''); });
    var i = same.findIndex(function (x) { return x.id === c.id; });
    return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
  }
  function progName(id) { var p = _progs.find(function (x) { return x.id === id; }); return p ? p.name : ''; }

  // ---------- données ----------
  async function loadProgs() {
    var q = sb.from('programmes').select('id,name,color,is_active').eq('is_active', true).order('name');
    q = sid() ? q.eq('studio_id', sid()) : q.is('studio_id', null);
    var r = await q;
    _progs = r.data || [];
  }
  async function loadLinks() {
    var ids = cycles().map(function (c) { return c.id; }).filter(Boolean);
    _progOf = {};
    if (!ids.length) return;
    var r = await sb.from('cycle_plans').select('id,programme_id,color').in('id', ids);
    _colorOf = {};
    (r.data || []).forEach(function (x) { _progOf[x.id] = x.programme_id || null; _colorOf[x.id] = x.color || null; });
    cycles().forEach(function (c) { c.programme_id = _progOf[c.id] || null; });
  }

  // enregistre le programme du cycle ouvert s'il a changé
  async function persistProg() {
    var cd = cur();
    if (!cd || !cd.id || _savingProg) return;
    var want = cd.programmeId || null;
    var wantCol = cd.color || _colorOf[cd.id] || null;
    if ((_progOf[cd.id] || null) === want && (_colorOf[cd.id] || null) === wantCol) return;
    _savingProg = true;
    try {
      var r = await sb.from('cycle_plans').update({ programme_id: want, color: wantCol }).eq('id', cd.id);
      if (r.error) { console.warn('cycle programme_id', r.error.message); return; }
      _progOf[cd.id] = want; _colorOf[cd.id] = wantCol;
      var c = cycles().find(function (x) { return x.id === cd.id; });
      if (c) c.programme_id = want;
      render();
    } finally { _savingProg = false; }
  }

  // ---------- rendu ----------
  function injectCss() {
    if ($('cp-styles')) return;
    var st = document.createElement('style'); st.id = 'cp-styles';
    st.textContent = [
      '.cp-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px;scrollbar-width:none}',
      '.cp-tabs::-webkit-scrollbar{display:none}',
      '.cp-tab{flex-shrink:0;background:transparent;border:1.5px solid var(--border2);color:var(--muted);font-family:"Bebas Neue",sans-serif;font-size:15px;letter-spacing:1.5px;padding:7px 14px;border-radius:9px;cursor:pointer;display:flex;align-items:center;gap:7px}',
      '.cp-tab .n{font-family:"DM Sans",sans-serif;font-size:10px;font-weight:700;letter-spacing:0;background:var(--card2);border-radius:6px;padding:1px 6px;color:var(--muted)}',
      '.cp-tab.active{background:var(--accent);color:#000;border-color:var(--accent)}',
      '.cp-tab.active .n{background:rgba(0,0,0,.18);color:#000}',
      '.cp-box{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px;margin-bottom:12px}',
      '.cp-nav{display:flex;align-items:center;gap:8px}',
      '.cp-arrow{flex:0 0 auto;width:38px;height:38px;border-radius:10px;background:var(--card2);border:1px solid var(--border2);color:var(--text);font-size:18px;cursor:pointer}',
      '.cp-arrow:disabled{opacity:.3;cursor:default}',
      '.cp-cur{flex:1;min-width:0;text-align:center}',
      '.cp-cur .t{font-family:"Bebas Neue",sans-serif;font-size:20px;letter-spacing:1.5px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cp-cur .m{font-size:11px;color:var(--muted);margin-top:2px}',
      '.cp-cur .k{color:var(--accent);font-weight:700}',
      '.cp-strip{display:flex;gap:6px;overflow-x:auto;margin-top:6px;padding:8px 0 4px;scroll-snap-type:x proximity;scrollbar-width:none}',
      '.cp-strip::-webkit-scrollbar{display:none}',
      '.cp-chip{flex:0 0 auto;scroll-snap-align:center;min-width:112px;max-width:150px;text-align:left;background:var(--card2);border:1.5px solid var(--border2);border-radius:10px;padding:8px 10px;color:var(--text);font-family:inherit;cursor:pointer;position:relative}',
      '.cp-chip .t{font-family:"Bebas Neue",sans-serif;font-size:14px;letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cp-chip .m{font-size:10px;color:var(--muted);margin-top:2px;white-space:nowrap}',
      '.cp-chip .bar{display:flex;gap:2px;margin-top:6px}',
      '.cp-chip .bar i{flex:1;height:4px;border-radius:2px;background:var(--border2)}',
      '.cp-chip .bar i.on{background:var(--accent)}',
      '.cp-chip.sel{border-color:var(--accent);background:var(--card)}',
      '.cp-chip.now:after{content:"EN COURS";position:absolute;top:-7px;right:8px;font-size:8px;font-weight:800;letter-spacing:.8px;background:var(--accent);color:#000;border-radius:4px;padding:1px 5px}',
      '.cp-chip.add{min-width:96px;border-style:dashed;color:var(--muted);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}',
      '.cp-empty{font-size:12px;color:var(--muted);text-align:center;padding:6px 0}',
      '.cp-assign{display:flex;align-items:center;gap:8px;margin-bottom:12px}',
      '.cp-assign label{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:1px;flex:0 0 auto}',
      '.cp-assign select{flex:1;min-width:0}',
      '.cp-colors{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:-4px 0 12px}',
      '.cp-colors label{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-right:4px}',
      '.cp-sw{width:24px;height:24px;border-radius:7px;border:2px solid transparent;cursor:pointer;padding:0}',
      '.cp-sw.on{border-color:var(--text);box-shadow:0 0 0 2px var(--dark) inset}',
      '.cp-chip{border-left-width:4px}',
      '.cp-sea-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}',
      '.cp-sea-ti{flex:1;min-width:0}',
      '.cp-sea-ti .t{font-family:"Bebas Neue",sans-serif;font-size:19px;letter-spacing:1.5px;line-height:1}',
      '.cp-sea-ti .m{font-size:11px;color:var(--muted);margin-top:3px}',
      '.cp-sea-scroll{overflow-x:auto;margin:0 -12px;padding:0 12px 6px;scrollbar-width:thin}',
      '.cp-sea{display:grid;gap:0;position:relative;min-width:max-content}',
      '.cp-sea .mo{font-family:"Bebas Neue",sans-serif;font-size:13px;letter-spacing:1.2px;color:var(--text2,var(--text));padding:4px 6px;border-left:1px solid var(--border2);background:var(--card2);white-space:nowrap;overflow:hidden}',
      '.cp-sea .mo.now{color:#000;background:var(--accent)}',
      '.cp-sea .wk{font-size:9px;color:var(--muted);text-align:center;padding:4px 0 6px;border-left:1px solid var(--border)}',
      '.cp-sea .wk.m1{border-left-color:var(--border2)}',
      '.cp-sea .wk.now{color:var(--accent);font-weight:800}',
      '.cp-sea .col{border-left:1px solid var(--border);pointer-events:none;position:relative;z-index:0}',
      '.cp-sea .col.m1{border-left-color:var(--border2)}',
      '.cp-sea .col.now{background:rgba(255,255,255,.06);border-left:2px solid var(--accent)}',
      '.cp-sea .bar{margin:3px 1px;border-radius:8px;padding:5px 7px 4px;cursor:pointer;overflow:hidden;min-height:40px;display:flex;flex-direction:column;justify-content:space-between;position:relative;z-index:2;border:1px solid transparent}',
      '.cp-sea .bar .n{font-family:"Bebas Neue",sans-serif;font-size:14px;letter-spacing:1px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#000}',
      '.cp-sea .bar .w{display:grid;font-size:8.5px;font-weight:800;color:rgba(0,0,0,.55);text-align:center;margin:3px -7px 0}',
      '.cp-sea .bar.sel{outline:2px solid var(--text);outline-offset:1px}',
      '.cp-sea .gap{grid-column:1/-1;height:4px}',
      '.cp-sea-leg{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px}',
      '.cp-sea-leg button{display:flex;align-items:center;gap:6px;background:none;border:0;padding:0;color:var(--text);font-family:inherit;font-size:11px;cursor:pointer}',
      '.cp-sea-leg i{width:10px;height:10px;border-radius:3px;display:inline-block}',
      '.cp-sea-leg span{color:var(--muted)}'
    ].join('');
    document.head.appendChild(st);
  }

  function ensureDom() {
    var panel = $('admin-cycle'); if (!panel) return false;
    var years = $('cycle-year-tabs');
    if (!$('cp-tabs')) {
      var tabs = document.createElement('div'); tabs.className = 'cp-tabs'; tabs.id = 'cp-tabs';
      var box = document.createElement('div'); box.className = 'cp-box'; box.id = 'cp-box';
      if (years) { years.insertAdjacentElement('beforebegin', tabs); tabs.insertAdjacentElement('afterend', box); }
      else { panel.insertBefore(box, panel.firstChild); panel.insertBefore(tabs, box); }
    }
    if (!$('cp-season')) {
      var sea = document.createElement('div'); sea.className = 'cp-box'; sea.id = 'cp-season';
      $('cp-box').insertAdjacentElement('afterend', sea);
    }
    // l'ancienne vue « année / saison » est remplacée par la vue saison par programmation
    if (years) years.style.display = 'none';
    var oldSea = $('cycle-season-overview'); if (oldSea) oldSea.style.setProperty('display', 'none', 'important');
    try { if (typeof cycleYearFilter !== 'undefined' && cycleYearFilter !== 'all') cycleYearFilter = 'all'; } catch (e) {}
    if (!$('cp-assign')) {
      var sel = $('cycle-selector');
      var row = sel && sel.parentElement;
      if (row) {
        var a = document.createElement('div'); a.className = 'cp-assign'; a.id = 'cp-assign';
        a.innerHTML = '<label>Programmation</label><select class="form-select" id="cp-assign-sel"></select>';
        row.insertAdjacentElement('afterend', a);
        var cl = document.createElement('div'); cl.className = 'cp-colors'; cl.id = 'cp-colors';
        a.insertAdjacentElement('afterend', cl);
        $('cp-assign-sel').addEventListener('change', function () {
          var cd = cur(); if (!cd) return;
          cd.programmeId = this.value || null;
          if (cd.id) persistProg().then(function () { toast('✅ Cycle rangé dans ' + (progName(cd.programmeId) || 'Sans programmation')); });
        });
      }
    }
    return true;
  }

  function renderTabs() {
    var el = $('cp-tabs'); if (!el) return;
    var cnt = {}; var none = 0;
    cycles().forEach(function (c) { var p = _progOf[c.id]; if (p) cnt[p] = (cnt[p] || 0) + 1; else none++; });
    var list = sortedProgs(cnt);
    if (_tab === 'all' || (_tab !== 'none' && !list.some(function (p) { return p.id === _tab; })) || (_tab === 'none' && !none))
      _tab = defaultTab();
    var h = list.map(function (p) {
      return '<button class="cp-tab' + (_tab === p.id ? ' active' : '') + '" data-t="' + p.id + '">' + esc(p.name) +
        (cnt[p.id] ? '<span class="n">' + cnt[p.id] + '</span>' : '') + '</button>';
    }).join('');
    if (none) h += '<button class="cp-tab' + (_tab === 'none' ? ' active' : '') + '" data-t="none">Sans prog.<span class="n">' + none + '</span></button>';
    el.innerHTML = h;
    el.querySelectorAll('[data-t]').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.dataset.t, true); });
    });
    var act = el.querySelector('.active');
    if (act) try { act.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
  }

  function renderBox() {
    var box = $('cp-box'); if (!box) return;
    if (_tab === 'all') { box.style.display = 'none'; return; }
    box.style.display = '';
    var list = tabCycles();
    var cd = cur();
    var idx = cd && cd.id ? list.findIndex(function (c) { return c.id === cd.id; }) : -1;
    var today = iso(new Date());
    var canAdd = _tab !== 'none';

    if (!list.length) {
      box.innerHTML = '<div class="cp-empty">Aucun cycle dans ' + esc(progName(_tab) || 'cet onglet') + ' pour l\'instant.</div>' +
        (canAdd ? '<div style="text-align:center;margin-top:8px"><button class="cp-chip add" id="cp-add" style="margin:0 auto">+ Premier cycle</button></div>' : '');
      var a0 = $('cp-add'); if (a0) a0.addEventListener('click', addNext);
      return;
    }

    var sel = idx >= 0 ? list[idx] : null;
    var curHtml;
    if (sel) {
      var s = startOf(sel), e = endOf(sel);
      var wkNow = '';
      if (s && e && today >= iso(s) && today <= iso(e)) {
        var n = Math.floor((new Date(today + 'T12:00:00') - s) / 604800000) + 1;
        wkNow = ' · <span class="k">semaine ' + n + '/' + (sel.weeks || '?') + '</span>';
      }
      curHtml = '<div class="t">' + esc(sel.name || 'Cycle sans nom') + '</div>' +
        '<div class="m">Cycle ' + (idx + 1) + '/' + list.length + ' · ' + (s ? fmt(s) + ' → ' + fmt(e) : 'sans date') +
        ' · ' + (sel.weeks || '?') + ' sem.' + wkNow + '</div>';
    } else if (cd && !cd.id && cd.programmeId === _tab) {
      var ns = ($('cycle-start-date') || {}).value, nw = parseInt(($('cycle-weeks') || {}).value) || cd.weeks || 4;
      var nsd = ns ? new Date(ns + 'T12:00:00') : null, ned = nsd ? new Date(nsd) : null;
      if (ned) ned.setDate(ned.getDate() + nw * 7 - 1);
      curHtml = '<div class="t">' + esc(($('cycle-name') || {}).value || 'Nouveau cycle') + '</div>' +
        '<div class="m"><span class="k">Nouveau</span> · ' + (nsd ? fmt(nsd) + ' → ' + fmt(ned) : 'sans date') + ' · ' + nw + ' sem.</div>';
    } else {
      curHtml = '<div class="t" style="color:var(--muted)">' + esc(progName(_tab) || 'Sans programmation') + '</div>' +
        '<div class="m">' + list.length + ' cycle' + (list.length > 1 ? 's' : '') + ' · choisis-en un</div>';
    }

    var chips = list.map(function (c, i) {
      var s = startOf(c), e = endOf(c);
      var isNow = s && e && today >= iso(s) && today <= iso(e);
      var w = parseInt(c.weeks) || 0, done = 0;
      if (s && w) done = Math.max(0, Math.min(w, Math.floor((new Date(today + 'T12:00:00') - s) / 604800000) + (isNow ? 1 : 0)));
      var bars = ''; for (var k = 0; k < Math.min(w, 16); k++) bars += '<i' + (k < done ? ' class="on"' : '') + '></i>';
      var col = colorOf(c);
      bars = bars.replace(/class="on"/g, 'class="on" style="background:' + col + '"');
      return '<button class="cp-chip' + (i === idx ? ' sel' : '') + (isNow ? ' now' : '') + '" data-id="' + c.id + '" style="border-left-color:' + col + '">' +
        '<div class="t">' + esc(c.name || 'Cycle sans nom') + '</div>' +
        '<div class="m">' + (s ? fmt(s) + ' → ' + fmt(e) : 'sans date') + ' · ' + (c.weeks || '?') + ' sem.</div>' +
        (w ? '<div class="bar">' + bars + '</div>' : '') + '</button>';
    }).join('') + (canAdd ? '<button class="cp-chip add" id="cp-add">+ Cycle suivant</button>' : '');

    var prevI = idx < 0 ? -1 : idx - 1, nextI = idx < 0 ? -1 : idx + 1;
    if (idx < 0) {
      // aucun cycle ouvert : ‹ › partent du cycle en cours (ou du dernier)
      var nowI = list.findIndex(function (c) { var s = startOf(c), e = endOf(c); return s && e && today >= iso(s) && today <= iso(e); });
      prevI = nextI = nowI >= 0 ? nowI : list.length - 1;
    }
    box.innerHTML =
      '<div class="cp-nav">' +
        '<button class="cp-arrow" id="cp-prev" ' + (prevI < 0 ? 'disabled' : '') + ' aria-label="Cycle précédent">‹</button>' +
        '<div class="cp-cur">' + curHtml + '</div>' +
        '<button class="cp-arrow" id="cp-next" ' + (nextI < 0 || nextI >= list.length ? 'disabled' : '') + ' aria-label="Cycle suivant">›</button>' +
      '</div>' +
      '<div class="cp-strip" id="cp-strip">' + chips + '</div>';

    $('cp-prev').addEventListener('click', function () { if (prevI >= 0) openCycle(list[prevI].id); });
    $('cp-next').addEventListener('click', function () { if (nextI >= 0 && nextI < list.length) openCycle(list[nextI].id); });
    box.querySelectorAll('.cp-chip[data-id]').forEach(function (b) {
      b.addEventListener('click', function () { openCycle(b.dataset.id); });
    });
    var add = $('cp-add'); if (add) add.addEventListener('click', addNext);
    var selChip = box.querySelector('.cp-chip.sel') || (cd && !cd.id ? $('cp-add') : null) || box.querySelector('.cp-chip.now');
    if (selChip) try { selChip.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
  }

  function renderAssign() {
    var s = $('cp-assign-sel'); if (!s) return;
    var cd = cur();
    var v = cd && cd.programmeId || '';
    s.innerHTML = '<option value="">— Sans programmation —</option>' +
      _progs.map(function (p) { return '<option value="' + p.id + '"' + (p.id === v ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
  }

  function renderColors() {
    var el = $('cp-colors'); if (!el) return;
    var cd = cur();
    var c = cd && cd.id ? cycles().find(function (x) { return x.id === cd.id; }) : null;
    var now = (cd && cd.color) || (c ? colorOf(c) : null);
    el.innerHTML = '<label>Couleur</label>' + PALETTE.map(function (p) {
      return '<button class="cp-sw' + (p === now ? ' on' : '') + '" data-c="' + p + '" style="background:' + p + '" aria-label="Couleur ' + p + '"></button>';
    }).join('');
    el.querySelectorAll('[data-c]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cd2 = cur(); if (!cd2) return;
        cd2.color = b.dataset.c;
        if (cd2.id) { _colorOf[cd2.id] = null; persistProg(); }
        else render();
      });
    });
  }

  // lundi de la semaine d'une date
  function monday(d) { var m = new Date(d); m.setHours(12, 0, 0, 0); var w = m.getDay(); m.setDate(m.getDate() - (w === 0 ? 6 : w - 1)); return m; }

  function renderSeason() {
    var box = $('cp-season'); if (!box) return;
    var Y = _seaYear;
    // semaines de l'année : du lundi de la semaine du 1er janvier au dernier lundi de l'année
    var weeks = [];
    var d = monday(new Date(Y, 0, 1));
    while (d.getFullYear() < Y || (d.getFullYear() === Y)) {
      weeks.push(new Date(d));
      d.setDate(d.getDate() + 7);
      if (d.getFullYear() > Y) break;
    }
    var W = weeks.length;
    var wIso = weeks.map(iso);
    var thisMon = iso(monday(new Date()));
    var nowIdx = wIso.indexOf(thisMon);
    var mOf = weeks.map(function (w) { var t = new Date(w); t.setDate(t.getDate() + 3); return t.getFullYear() === Y ? t.getMonth() : (t.getFullYear() < Y ? 0 : 11); });

    var list = tabCycles().filter(function (c) {
      var s = startOf(c), e = endOf(c); if (!s) return false;
      return s.getFullYear() <= Y && e.getFullYear() >= Y;
    });
    // couloirs : un cycle qui chevauche le précédent passe sur la ligne suivante
    var lanes = [];
    var placed = list.map(function (c) {
      var sI = Math.round((monday(startOf(c)) - weeks[0]) / 604800000);
      var n = parseInt(c.weeks) || 1;
      var a = Math.max(0, sI), b = Math.min(W - 1, sI + n - 1);
      var lane = lanes.findIndex(function (end) { return end < a; });
      if (lane < 0) { lane = lanes.length; lanes.push(b); } else lanes[lane] = b;
      return { c: c, a: a, b: b, first: a - sI + 1, n: n, lane: lane };
    }).filter(function (x) { return x.b >= x.a; });
    var L = Math.max(1, lanes.length);

    var cd = cur();
    var h = '<div class="cp-sea" style="grid-template-columns:repeat(' + W + ',30px);grid-template-rows:auto auto repeat(' + L + ',auto)">';
    // mois
    var i = 0;
    while (i < W) {
      var m = mOf[i], j = i; while (j + 1 < W && mOf[j + 1] === m) j++;
      var isNowM = new Date().getFullYear() === Y && new Date().getMonth() === m;
      h += '<div class="mo' + (isNowM ? ' now' : '') + '" style="grid-column:' + (i + 1) + '/span ' + (j - i + 1) + ';grid-row:1">' + MONTHS[m] + '</div>';
      i = j + 1;
    }
    // semaines (date du lundi) + colonnes de fond
    weeks.forEach(function (w, k) {
      var m1 = k === 0 || mOf[k] !== mOf[k - 1];
      h += '<div class="wk' + (m1 ? ' m1' : '') + (k === nowIdx ? ' now' : '') + '" style="grid-column:' + (k + 1) + ';grid-row:2" title="Semaine du ' + fmt(w) + '">' + String(w.getDate()).padStart(2, '0') + '</div>';
      h += '<div class="col' + (m1 ? ' m1' : '') + (k === nowIdx ? ' now' : '') + '" style="grid-column:' + (k + 1) + ';grid-row:3/span ' + L + '"></div>';
    });
    // cycles
    placed.forEach(function (p) {
      var col = colorOf(p.c);
      var span = p.b - p.a + 1;
      var nums = ''; for (var k = 0; k < span; k++) nums += '<span>' + (p.first + k) + '</span>';
      h += '<div class="bar' + (cd && cd.id === p.c.id ? ' sel' : '') + '" data-id="' + p.c.id + '" title="' + esc(p.c.name) + ' · ' + fmt(startOf(p.c)) + ' → ' + fmt(endOf(p.c)) + ' · ' + p.n + ' sem." ' +
        'style="grid-column:' + (p.a + 1) + '/span ' + span + ';grid-row:' + (p.lane + 3) + ';background:' + col + '">' +
        '<div class="n">' + esc(p.c.name || 'Cycle') + '</div>' +
        '<div class="w" style="grid-template-columns:repeat(' + span + ',1fr)">' + nums + '</div></div>';
    });
    if (!placed.length) h += '<div style="grid-column:1/-1;grid-row:3;font-size:12px;color:var(--muted);padding:14px 4px">Aucun cycle sur ' + Y + '.</div>';
    h += '</div>';

    var totalW = placed.reduce(function (t, p) { return t + (p.b - p.a + 1); }, 0);
    var leg = placed.slice().sort(function (a, b) { return a.a - b.a; }).map(function (p) {
      return '<button data-id="' + p.c.id + '"><i style="background:' + colorOf(p.c) + '"></i>' + esc(p.c.name) +
        ' <span>' + fmt(startOf(p.c)) + ' → ' + fmt(endOf(p.c)) + '</span></button>';
    }).join('');

    box.innerHTML =
      '<div class="cp-sea-head">' +
        '<button class="cp-arrow" id="cp-sea-prev" aria-label="Saison précédente">‹</button>' +
        '<div class="cp-sea-ti" style="text-align:center"><div class="t">Saison ' + Y + '</div>' +
        '<div class="m">' + (progName(_tab) ? esc(progName(_tab)) + ' · ' : '') + placed.length + ' cycle' + (placed.length > 1 ? 's' : '') + ' · ' + totalW + ' semaine' + (totalW > 1 ? 's' : '') + ' programmée' + (totalW > 1 ? 's' : '') + ' sur ' + W + '</div></div>' +
        '<button class="cp-arrow" id="cp-sea-next" aria-label="Saison suivante">›</button>' +
      '</div>' +
      '<div class="cp-sea-scroll" id="cp-sea-scroll">' + h + '</div>' +
      (leg ? '<div class="cp-sea-leg">' + leg + '</div>' : '');

    $('cp-sea-prev').addEventListener('click', function () { _seaYear--; renderSeason(); });
    $('cp-sea-next').addEventListener('click', function () { _seaYear++; renderSeason(); });
    box.querySelectorAll('[data-id]').forEach(function (b) { b.addEventListener('click', function () { openCycle(b.dataset.id); }); });

    // centre sur la semaine en cours (ou le cycle ouvert)
    var sc = $('cp-sea-scroll');
    var target = box.querySelector('.bar.sel') || box.querySelector('.wk.now');
    if (sc && target) {
      var x = target.offsetLeft - sc.clientWidth / 2 + target.offsetWidth / 2;
      sc.scrollLeft = Math.max(0, x);
    }
  }

  function render() {
    if (!ensureDom()) return;
    injectCss();
    renderTabs(); renderBox(); renderAssign(); renderColors(); renderSeason();
  }

  // ---------- actions ----------
  function setTab(t, user) {
    _tab = t;
    try { localStorage.setItem(LS_KEY, t); } catch (e) {}
    if (typeof window.renderCycleSelector === 'function') window.renderCycleSelector();
    if (typeof window.renderSeasonOverview === 'function') window.renderSeasonOverview();
    render();
    // en changeant d'onglet, on ouvre le cycle en cours (ou le dernier) de la programmation
    if (user && t !== 'all') {
      var cd = cur(), list = tabCycles();
      if (cd && cd.id && list.some(function (c) { return c.id === cd.id; })) return;
      if (!list.length) { if (typeof newCycle === 'function') newCycle(); return; }
      var today = iso(new Date());
      var now = list.find(function (c) { var s = startOf(c), e = endOf(c); return s && e && today >= iso(s) && today <= iso(e); });
      var next = list.find(function (c) { return c.start_date && c.start_date > today; });
      openCycle((now || next || list[list.length - 1]).id);
    }
  }

  async function openCycle(id) {
    var sel = $('cycle-selector'); if (sel) sel.value = id;
    await window.loadCycle(id);
  }

  function addNext() {
    if (_tab === 'all' || _tab === 'none') return;
    var list = tabCycles().filter(function (c) { return c.start_date; });
    var last = list[list.length - 1];
    var start;
    if (last) { start = endOf(last); start.setDate(start.getDate() + 1); }
    else { start = new Date(); }
    // on cale sur un lundi
    var dow = start.getDay(); if (dow !== 1) start.setDate(start.getDate() + ((8 - dow) % 7));
    if (typeof newCycle === 'function') newCycle();
    var cd = cur(); if (!cd) return;
    cd.programmeId = _tab;
    cd.weeks = 4;
    var name = (progName(_tab) || 'Cycle') + ' · Cycle ' + (tabCycles().length + 1);
    var n = $('cycle-name'); if (n) n.value = name;
    var w = $('cycle-weeks'); if (w) w.value = '4';
    var d = $('cycle-start-date'); if (d) d.value = iso(start);
    if (typeof renderCycleGrid === 'function') renderCycleGrid();
    render();
    if (typeof scheduleAutoSaveCycle === 'function') scheduleAutoSaveCycle();
    toast('➕ Nouveau cycle : début le ' + fmt(start) + ' — renomme-le si besoin');
  }

  // ---------- greffes ----------
  function hook() {
    if (window.__cpHooked) return true;
    if (typeof window.loadAllCycles !== 'function' || typeof window.loadCycle !== 'function') return false;
    window.__cpHooked = true;

    var oLoadAll = window.loadAllCycles;
    window.loadAllCycles = async function () {
      var r = await oLoadAll.apply(this, arguments);
      try {
        if (!_progs.length) await loadProgs();
        await loadLinks();
        var hasNone = cycles().some(function (c) { return !_progOf[c.id]; });
        if (_tab === 'all' || (_tab === 'none' && !hasNone) || (_tab !== 'none' && !_progs.some(function (p) { return p.id === _tab; }))) _tab = defaultTab();
        if (typeof window.renderCycleSelector === 'function') window.renderCycleSelector();
        if (typeof window.renderSeasonOverview === 'function') window.renderSeasonOverview();
        render();
        var cd0 = cur();
        if (!_opened && (!cd0 || !cd0.id) && !(cd0 && cd0.programmeId)) { _opened = true; setTab(_tab, true); }
      } catch (e) { console.warn('[cycle-progs] loadAll', e); }
      return r;
    };

    var oLoad = window.loadCycle;
    window.loadCycle = async function (id) {
      var r = await oLoad.apply(this, arguments);
      var cd = cur();
      if (cd && id) {
        cd.programmeId = _progOf[id] || null;
        cd.color = null;
        var c = cycles().find(function (x) { return x.id === id; });
        if (c && c.start_date) _seaYear = startOf(c).getFullYear();
      }
      render();
      return r;
    };

    var oNew = window.newCycle;
    window.newCycle = function () {
      var r = oNew.apply(this, arguments);
      var cd = cur();
      if (cd) cd.programmeId = (_tab !== 'all' && _tab !== 'none') ? _tab : null;
      render();
      return r;
    };

    // sélecteur filtré par onglet (et par année)
    window.renderCycleSelector = function () {
      var sel = $('cycle-selector'); if (!sel) return;
      var yf = (typeof cycleYearFilter !== 'undefined') ? cycleYearFilter : 'all';
      var list = cycles().filter(inTab).filter(function (c) {
        return yf === 'all' || String(typeof _cycleYear === 'function' ? _cycleYear(c) : '') === yf;
      });
      var v = sel.value;
      sel.innerHTML = '<option value="">— Sélectionner un cycle —</option>' + list.map(function (c) {
        var y = typeof _cycleYear === 'function' ? _cycleYear(c) : null;
        var p = _tab === 'all' && _progOf[c.id] ? ' · ' + progName(_progOf[c.id]) : '';
        return '<option value="' + c.id + '">' + esc(c.name) + (y ? ' · ' + y : '') + esc(p) + '</option>';
      }).join('');
      var cd = cur();
      var want = v || (cd && cd.id) || '';
      if (want && list.some(function (c) { return c.id === want; })) sel.value = want;
    };

    // vue saison : uniquement les cycles de l'onglet
    var oSeason = window.renderSeasonOverview;
    if (typeof oSeason === 'function') {
      window.renderSeasonOverview = function () {
        var all = cycles();
        try { allCycles = all.filter(inTab); return oSeason.apply(this, arguments); }
        finally { allCycles = all; }
      };
    }

    // sauvegardes : le programme est écrit juste après (création comprise)
    ['autoSaveCycleNow', 'saveCycle'].forEach(function (fn) {
      var o = window[fn];
      if (typeof o !== 'function') return;
      window[fn] = async function () {
        var r = await o.apply(this, arguments);
        try { await persistProg(); } catch (e) { console.warn('[cycle-progs] save', e); }
        return r;
      };
    });

    var oDel = window.deleteCycle;
    if (typeof oDel === 'function') {
      window.deleteCycle = async function () {
        var r = await oDel.apply(this, arguments);
        render(); return r;
      };
    }
    return true;
  }

  function boot() {
    if (hook()) { if ($('admin-cycle') && cycles().length) window.loadAllCycles(); return; }
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (hook() || tries > 40) {
        clearInterval(iv);
        if (window.__cpHooked && cycles().length) window.loadAllCycles();
      }
    }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__cycleProgs = { render: render, setTab: setTab };
})();
