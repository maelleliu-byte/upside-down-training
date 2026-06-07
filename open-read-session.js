// open-read-session.js
// Gère la modale d'aperçu d'une séance (clic sur bloc calendrier admin)

let _readModalSessionId = null;

async function openReadSession(id) {
  _readModalSessionId = id;

  const { data: s } = await sb.from('sessions').select('*').eq('id', id).single();
  if (!s) return;

  // Header : prog name + date
  const prog = getProgById(s.programme_id);
  document.getElementById('read-modal-prog').textContent = prog ? (prog.icon ? prog.icon + ' ' + prog.name : prog.name) : '—';
  document.getElementById('read-modal-date').textContent = s.date ? formatDate(s.date) : '';

  // Bouton éditer : visible seulement pour les admins
  const editBtn = document.getElementById('read-modal-edit-btn');
  if (editBtn) {
    editBtn.style.display = (currentProfile && currentProfile.role === 'admin') ? '' : 'none';
  }

  // Body
  const color = s.color || '#e8ff47';
  const typeLabel = TYPE_LABELS[s.type] || s.type;

  const rawContent = s.content || '';
  const withCharges = typeof renderContentWithCharges === 'function' ? renderContentWithCharges(rawContent) : rawContent;
  const isHtml = /<[a-z][\s\S]*>/i.test(withCharges);
  const contentHtml = isHtml ? withCharges : withCharges.replace(/\n/g, '<br>');

  let intHtml = '';
  if (s.intensity) {
    const pct = s.intensity * 10;
    const col = s.intensity <= 4 ? 'var(--blue)' : s.intensity <= 7 ? 'var(--accent)' : 'var(--red)';
    intHtml = `<div class="intensity-bar"><div class="int-row"><span class="int-label">Intensité</span><span class="int-val" style="color:${col}">${s.intensity}/10</span></div><div class="int-track"><div class="int-fill" style="width:${pct}%;background:${col}"></div></div></div>`;
  }

  const targetHtml = s.target ? `<div class="info-block"><div class="info-block-title"><span>🎯</span> Target</div><div class="info-block-text">${s.target}</div></div>` : '';
  const tipsHtml = s.tips ? `<div class="info-block"><div class="info-block-title"><span>💡</span> Coaching Tips</div><div class="info-block-text">${s.tips}</div></div>` : '';

  const scalingHtml = [
    s.scaling_inter ? `<div class="scaling-block scaling-block-inter"><div class="scaling-label" style="color:var(--red)">Intermédiaire</div><div class="scaling-text">${s.scaling_inter}</div></div>` : '',
    s.scaling_scaled ? `<div class="scaling-block scaling-block-scaled"><div class="scaling-label" style="color:var(--blue)">Scaled</div><div class="scaling-text">${s.scaling_scaled}</div></div>` : '',
    s.scaling_foundation ? `<div class="scaling-block scaling-block-found"><div class="scaling-label" style="color:var(--purple)">Fondation</div><div class="scaling-text">${s.scaling_foundation}</div></div>` : ''
  ].join('');

  let _vids = [];
  try { _vids = Array.isArray(s.videos) ? s.videos : (typeof s.videos === 'string' ? JSON.parse(s.videos) : []); } catch (e) { _vids = []; }
  if ((!_vids || !_vids.length) && s.youtube_url) { _vids = [{ url: s.youtube_url, label: s.youtube_label || '' }]; }
  const videoHtml = _vids.length ? `<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">${_vids.map(v => `<a href="${v.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,0,0,.1);border:1px solid rgba(255,0,0,.25);border-radius:10px;text-decoration:none;color:var(--text)"><span style="font-size:22px">▶️</span><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${v.label || 'Voir la vidéo démo'}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Ouvrir sur YouTube</div></div><span style="margin-left:auto;color:var(--muted);font-size:16px">↗</span></a>`).join('')}</div>` : '';

  document.getElementById('read-modal-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span class="badge badge-${s.type}" style="background:${color}18;color:${color}">${typeLabel}</span>
      ${s.title ? `<span style="font-size:16px;font-weight:700">${escapeHtml(s.title)}</span>` : ''}
    </div>
    <div class="session-content" style="font-size:14px;line-height:1.7;margin-bottom:12px">${contentHtml}</div>
    ${scalingHtml}
    ${intHtml}${targetHtml}${tipsHtml}${videoHtml}
  `;

  document.getElementById('read-modal').classList.add('open');
}

function closeReadModal() {
  document.getElementById('read-modal').classList.remove('open');
  _readModalSessionId = null;
}

function readModalEdit() {
  closeReadModal();
  if (_readModalSessionId) editSession(_readModalSessionId);
}
