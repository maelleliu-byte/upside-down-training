// ===================================================
// UTILS — fonctions partagées par tous les modules
// ===================================================

function getScorePlaceholder(type){return{time:'14:32',reps:'87',rounds:'12 + 5',weight:'85',calories:'42'}[type]||'—';}
function extractYTId(url){const m=url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);return m?m[1]:null;}
function formatDate(iso){if(!iso)return'—';const d=new Date(iso+'T12:00:00');return`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}
function escapeHtml(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function stripHtml(s){if(!s)return'';const d=document.createElement('div');d.innerHTML=s.replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<\/div>/gi,'\n');return(d.textContent||d.innerText||'').replace(/\n{3,}/g,'\n\n').trim();}
function formatDateShort(iso){if(!iso)return'';const d=new Date(iso+'T12:00:00');return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});}

// Helpers internes partagés
function _initials(s){return (s||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}
function _isoDate(d){return d.toISOString().split('T')[0];}
function _weekStart(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(0,0,0,0);return x;}
function _addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function getStudioId(){return currentProfile?.studio_id??null;}
