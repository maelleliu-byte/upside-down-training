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
    var r = await sb.from('cycle_plans').select('id,programme_id').in('id', ids);
    (r.data || []).forEach(function (x) { _progOf[x.id] = x.programme_id || null; });
    cycles().forEach(function (c) { c.programme_id = _progOf[c.id] || null; });
  }

  // enregistre le programme du cycle ouvert s'il a changé
  async function persistProg() {
    var cd = cur();
    if (!cd || !cd.id || _savingProg) return;
    var want = cd.programmeId || null;
    if ((_progOf[cd.id] || null) === want) return;
    _savingProg = true;
    try {
      var r = await sb.from('cycle_plans').update({ programme_id: want }).eq('id', cd.id);
      if (r.error) { console.warn('cycle programme_id', r.error.message); return; }
      _progOf[cd.id] = want;
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
      '.cp-strip{display:flex;gap:6px;overflow-x:auto;margin-top:12px;padding-bottom:4px;scroll-snap-type:x proximity;scrollbar-width:none}',
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
      '.cp-assign select{flex:1;min-width:0}'
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
    if (!$('cp-assign')) {
      var sel = $('cycle-selector');
      var row = sel && sel.parentElement;
      if (row) {
        var a = document.createElement('div'); a.className = 'cp-assign'; a.id = 'cp-assign';
        a.innerHTML = '<label>Programmation</label><select class="form-select" id="cp-assign-sel"></select>';
        row.insertAdjacentElement('afterend', a);
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
    var list = _progs.slice().sort(function (a, b) { return (cnt[b.id] || 0) - (cnt[a.id] || 0) || a.name.localeCompare(b.name); });
    if (_tab !== 'all' && _tab !== 'none' && !list.some(function (p) { return p.id === _tab; })) _tab = 'all';
    if (_tab === 'none' && !none) _tab = 'all';
    var h = '<button class="cp-tab' + (_tab === 'all' ? ' active' : '') + '" data-t="all">Tous<span class="n">' + cycles().length + '</span></button>';
    h += list.map(function (p) {
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
      return '<button class="cp-chip' + (i === idx ? ' sel' : '') + (isNow ? ' now' : '') + '" data-id="' + c.id + '">' +
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

  function render() {
    if (!ensureDom()) return;
    injectCss();
    renderTabs(); renderBox(); renderAssign();
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
        if (typeof window.renderCycleSelector === 'function') window.renderCycleSelector();
        if (typeof window.renderSeasonOverview === 'function') window.renderSeasonOverview();
        render();
      } catch (e) { console.warn('[cycle-progs] loadAll', e); }
      return r;
    };

    var oLoad = window.loadCycle;
    window.loadCycle = async function (id) {
      var r = await oLoad.apply(this, arguments);
      var cd = cur();
      if (cd && id) cd.programmeId = _progOf[id] || null;
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
