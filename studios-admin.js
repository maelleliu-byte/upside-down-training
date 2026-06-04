// ===== STUDIOS ADMIN (superadmin Upside Down uniquement) =====

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
      html+='<div style="background:#111;border:1px solid #222;border-radius:12px;padding:16px;margin:12px 20px;display:flex;align-items:center;gap:12px">';
      if(s.logo_url){html+='<img src="'+s.logo_url+'" style="width:40px;height:40px;border-radius:8px;object-fit:contain">';}
      else{html+='<div style="width:40px;height:40px;border-radius:8px;background:#222"></div>';}
      html+='<div style="flex:1">';
      html+='<div style="font-weight:700;color:#f0f0f0">'+s.name+'</div>';
      html+='<div style="font-size:12px;color:#666">/'+s.slug+'</div>';
      html+='</div>';
      var btnBg=s.is_active?'#333':'#e8ff47';
      var btnColor=s.is_active?'#f0f0f0':'#0a0a0a';
      var btnLabel=s.is_active?'Desactiver':'Activer';
      html+='<button onclick="toggleStudio(\''+s.id+'\','+s.is_active+')" style="background:'+btnBg+';color:'+btnColor+';border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer">'+btnLabel+'</button>';
      html+='</div>';
    }
    container.innerHTML=html;
  });
}

function toggleStudio(studioId,currentActive){
  sb.from('studios').update({is_active:!currentActive}).eq('id',studioId).then(function(res){
    if(res.error){alert('Erreur: '+res.error.message);return;}
    loadAdminStudios();
  });
}
