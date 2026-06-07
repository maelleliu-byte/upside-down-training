let _readModalSessionId = null;

async function openReadSession(id) {
  try {
    _readModalSessionId = id;

    const { data: s } = await sb.from('sessions').select('*').eq('id', id).single();
    if (!s) { showToast('❌ Séance introuvable'); return; }

    const color = s.color || '#e8ff47';
    const typeLabel = (typeof TYPE_LABELS !== 'undefined' ? TYPE_LABELS[s.type] : null) || s.type || '—';

    // Programme
    const prog = typeof getProgById === 'function' ? getProgById(s.programme_id) : null;
    const progName = prog ? ((prog.icon ? prog.icon + ' ' : '') + prog.name) : '—';

    // Date
    let dateLabel = s.date || '';
    try {
      if (s.date && typeof formatDate === 'function') dateLabel = formatDate(s.date);
    } catch(e) {}

    document.getElementById('read-modal-prog').textContent = progName;
    document.getElementById('read-modal-date').textContent = dateLabel;

    // Bouton éditer visible seulement pour admin
    const editBtn = document.getElementById('read-modal-edit-btn');
    if (editBtn) {
      editBtn.style.display = (typeof currentProfile !== 'undefined' && currentProfile && currentProfile.role === 'admin') ? '' : 'none';
    }

    // Contenu
    const rawContent = s.content || '';
    let withCharges = rawContent;
    try { if (typeof renderContentWithCharges === 'function') withCharges = renderContentWithCharges(rawContent); } catch(e) {}
    const isHtml = /<[a-z][\s\S]*>/i.test(withCharges);
    const contentHtml = isHtml ? withCharges : withCharges.replace(/\n/g, '<br>');

    // Intensité
    let intHtml = '';
    if (s.intensity) {
      const pct = s.intensity * 10;
      const col = s.intensity <= 4 ? 'var(--blue)' : s.intensity <= 7 ? 'var(--accent)' : 'var(--red)';
      intHtml = '<div class="intensity-bar"><div class="int-row"><span class="int-label">Intensit\u00e9</span><span class="int-val" style="color:' + col + '">' + s.intensity + '/10</span></div><div class="int-track"><div class="int-fill" style="width:' + pct + '%;background:' + col + '"></div></div></div>';
    }

    // Target / Tips
    const targetHtml = s.target ? '<div class="info-block"><div class="info-block-title"><span>\uD83C\uDFAF</span> Target</div><div class="info-block-text">' + s.target + '</div></div>' : '';
    const tipsHtml = s.tips ? '<div class="info-block"><div class="info-block-title"><span>\uD83D\uDCA1</span> Coaching Tips</div><div class="info-block-text">' + s.tips + '</div></div>' : '';

    // Scaling
    const scalingParts = [];
    if (s.scaling_inter) scalingParts.push('<div class="scaling-block scaling-block-inter"><div class="scaling-label" style="color:var(--red)">Interm\u00e9diaire</div><div class="scaling-text">' + s.scaling_inter + '</div></div>');
    if (s.scaling_scaled) scalingParts.push('<div class="scaling-block scaling-block-scaled"><div class="scaling-label" style="color:var(--blue)">Scaled</div><div class="scaling-text">' + s.scaling_scaled + '</div></div>');
    if (s.scaling_foundation) scalingParts.push('<div class="scaling-block scaling-block-found"><div class="scaling-label" style="color:var(--purple)">Fondation</div><div class="scaling-text">' + s.scaling_foundation + '</div></div>');
    const scalingHtml = scalingParts.join('');

    // Vidéos
    let _vids = [];
    try { _vids = Array.isArray(s.videos) ? s.videos : (typeof s.videos === 'string' ? JSON.parse(s.videos) : []); } catch(e) { _vids = []; }
    if ((!_vids || !_vids.length) && s.youtube_url) { _vids = [{ url: s.youtube_url, label: s.youtube_label || '' }]; }
    let videoHtml = '';
    if (_vids.length) {
      videoHtml = '<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">' +
        _vids.map(function(v) {
          return '<a href="' + v.url + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,0,0,.1);border:1px solid rgba(255,0,0,.25);border-radius:10px;text-decoration:none;color:var(--text)"><span style="font-size:22px">\u25B6\uFE0F</span><div><div style="font-size:13px;font-weight:700">' + (v.label || 'Voir la vid\u00e9o') + '</div></div></a>';
        }).join('') + '</div>';
    }

    // Escape helper local
    function esc(str) {
      return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    document.getElementById('read-modal-body').innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
        '<span class="badge badge-' + s.type + '" style="background:' + color + '18;color:' + color + '">' + typeLabel + '</span>' +
        (s.title ? '<span style="font-size:16px;font-weight:700">' + esc(s.title) + '</span>' : '') +
      '</div>' +
      '<div class="session-content" style="font-size:14px;line-height:1.7;margin-bottom:12px">' + contentHtml + '</div>' +
      scalingHtml + intHtml + targetHtml + tipsHtml + videoHtml;

    document.getElementById('read-modal').classList.add('open');

  } catch(err) {
    showToast('Erreur aperçu : ' + err.message);
    console.error('openReadSession error', err);
  }
}

function closeReadModal() {
  document.getElementById('read-modal').classList.remove('open');
  _readModalSessionId = null;
}

function readModalEdit() {
  closeReadModal();
  if (_readModalSessionId) editSession(_readModalSessionId);
}
