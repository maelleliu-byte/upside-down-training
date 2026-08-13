// ===== STUDIOS ADMIN (superadmin Upside Down uniquement) =====

// Palette de couleurs prédéfinies pour accent_color (inclut le teal du pricing)
var STUDIO_COLOR_PALETTE = [
  '#2DD4BF', // teal (pricing page "Le plus populaire")
  '#E8FF47', // jaune Upside Down (couleur historique "Activer")
  '#FF6B4A', // orange corail
  '#FF4747', // rouge
  '#FF47A3', // rose
  '#B347FF', // violet
  '#4762FF', // bleu indigo
  '#47B4FF', // bleu ciel
  '#47FF8C', // vert menthe
  '#FFC947', // ambre
  '#FF8C47', // orange
  '#9CA3AF'  // gris neutre
];

function loadAdminStudios(){
  var container=document.getElementById('admin-studios');
  if(!container)return;
  container.innerHTML='<div class="spinner"></div>';
  sb.from('studios').select('*').order('created_at',{ascending:false}).then(function(res){
    if(res.error){container.innerHTML='<p style="color:#ff4747;padding:20px">'+res.error.message+'</p>';return;}
    var studios=res.data||[];
    if(!studios.length){container.innerHTML='<p style="color:#888;padding:20px">Aucun studio.</p>';return;}
    var html='';
    for(var i=0;i<studios.length;i++){
      var s=studios[i];
      var accentColor=s.accent_color||'#e8ff47';
      // Badge Stripe Connect
      var stripeBadge='';
      if(s.stripe_onboarding_complete){
        stripeBadge='<span style="font-size:11px;background:#47ff8020;border:1px solid #47ff8040;color:#80ffb0;border-radius:20px;padding:2px 8px;font-weight:700">Stripe ✓</span>';
      } else if(s.stripe_account_id){
        stripeBadge='<span style="font-size:11px;background:#ff8c4720;border:1px solid #ff8c4740;color:#ff8c47;border-radius:20px;padding:2px 8px;font-weight:700">Stripe en cours</span>';
      } else {
        stripeBadge='<span style="font-size:11px;background:#33333350;border:1px solid #333;color:#555;border-radius:20px;padding:2px 8px;font-weight:700">Stripe non connecté</span>';
      }
      html+='<div style="background:#111;border:1px solid #222;border-radius:12px;padding:16px;margin:12px 20px">';
      html+='<div style="display:flex;align-items:center;gap:12px">';
      if(s.logo_url){html+='<img src="'+s.logo_url+'" style="width:40px;height:40px;border-radius:8px;object-fit:contain">';}
      else{html+='<div style="width:40px;height:40px;border-radius:8px;background:#222;flex-shrink:0"></div>';}
      html+='<div style="flex:1;min-width:0">';
      html+='<div style="font-weight:700;color:#f0f0f0">'+s.name+'</div>';
      html+='<div style="font-size:12px;color:#666;margin-bottom:4px">/'+s.slug+'</div>';
      html+=stripeBadge;
      html+='</div>';
      html+='<div style="display:flex;gap:8px;flex-shrink:0;align-items:center">';
      // Pastille couleur cliquable -> ouvre la palette
      html+='<button onclick="toggleColorPalette(\''+s.id+'\')" title="Changer la couleur du studio" style="width:32px;height:32px;border-radius:50%;background:'+accentColor+';border:2px solid #333;cursor:pointer;padding:0;flex-shrink:0"></button>';
      html+='<a href="/'+s.slug+'/settings" style="background:#1a1a1a;color:#aaa;border:1px solid #333;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:5px">⚙️ <span style="font-size:12px">Paramètres</span></a>';
      var btnBg=s.is_active?'#333':'#e8ff47';
      var btnColor=s.is_active?'#f0f0f0':'#0a0a0a';
      var btnLabel=s.is_active?'Désactiver':'Activer';
      html+='<button onclick="toggleStudio(\''+s.id+'\','+s.is_active+')" style="background:'+btnBg+';color:'+btnColor+';border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer">'+btnLabel+'</button>';
      html+='</div>';
      html+='</div>';
      // Palette de couleurs (cachée par défaut)
      html+='<div id="palette-'+s.id+'" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid #222">';
      html+='<div style="font-size:11px;color:#888;margin-bottom:8px;font-weight:700">CHOISIR UNE COULEUR</div>';
      html+='<div style="display:flex;flex-wrap:wrap;gap:8px">';
      for(var c=0;c<STUDIO_COLOR_PALETTE.length;c++){
        var col=STUDIO_COLOR_PALETTE[c];
        var isSelected=(accentColor.toLowerCase()===col.toLowerCase());
        var border=isSelected?'3px solid #fff':'2px solid #333';
        html+='<button onclick="setStudioColor(\''+s.id+'\',\''+col+'\')" title="'+col+'" style="width:36px;height:36px;border-radius:50%;background:'+col+';border:'+border+';cursor:pointer;padding:0"></button>';
      }
      html+='</div>';
      // Couleur personnalisée (input color natif)
      html+='<div style="margin-top:10px;display:flex;align-items:center;gap:8px">';
      html+='<span style="font-size:11px;color:#888">Ou couleur personnalisée :</span>';
      html+='<input type="color" value="'+accentColor+'" onchange="setStudioColor(\''+s.id+'\',this.value)" style="width:36px;height:28px;border:none;border-radius:6px;cursor:pointer;background:none;padding:0">';
      html+='</div>';
      html+='</div>';
      html+='</div>';
    }
    container.innerHTML=html;
  });
}

function toggleColorPalette(studioId){
  var el=document.getElementById('palette-'+studioId);
  if(!el)return;
  // Ferme les autres palettes ouvertes
  var all=document.querySelectorAll('[id^="palette-"]');
  for(var i=0;i<all.length;i++){
    if(all[i]!==el)all[i].style.display='none';
  }
  el.style.display=(el.style.display==='none'||!el.style.display)?'block':'none';
}

function setStudioColor(studioId,color){
  sb.from('studios').update({accent_color:color}).eq('id',studioId).then(function(res){
    if(res.error){alert('Erreur: '+res.error.message);return;}
    loadAdminStudios();
  });
}

function toggleStudio(studioId,currentActive){
  sb.from('studios').update({is_active:!currentActive}).eq('id',studioId).then(function(res){
    if(res.error){alert('Erreur: '+res.error.message);return;}
    loadAdminStudios();
  });
}
