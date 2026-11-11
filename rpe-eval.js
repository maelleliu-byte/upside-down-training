/* Évaluation du RPE — encart dépliable sous les Coaching Tips des blocs ENGINE et RUN
   (version graphique de l'infographie « Calibre ton RPE », + image complète en plein écran) */
(function () {
  var TYPES = { engine: 1, run: 1 };

  function css() {
    if (document.getElementById('rpe-eval-css')) return;
    var st = document.createElement('style'); st.id = 'rpe-eval-css';
    st.textContent = [
      '.rpe-ev{margin-top:10px}',
      '.info-block>.rpe-ev:first-child{margin-top:0}',
      '.rpe-ev>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--accent);padding:8px 10px;border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);border-radius:8px;background:color-mix(in srgb,var(--accent) 8%,transparent)}',
      '.rpe-ev>summary::-webkit-details-marker{display:none}',
      '.rpe-ev>summary .ch{transition:transform .2s;font-size:12px}',
      '.rpe-ev[open]>summary .ch{transform:rotate(180deg)}',
      '.rpe-ev .rb{margin-top:12px}',
      '.rpe-ev .bb{font-family:"Bebas Neue",sans-serif;letter-spacing:1px}',
      '.rpe-ev .g{position:relative;height:244px;margin-top:6px}',
      '.rpe-ev .g>*{position:absolute;box-sizing:border-box}',
      '.rpe-ev .lvl{top:16px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff}',
      '.rpe-ev .bar{bottom:78px;border-radius:5px 5px 0 0;color:#fff;text-align:center;padding-top:4px;font-size:10px;line-height:1.2;font-weight:700;overflow:hidden}',
      '.rpe-ev .bar b{display:block;font-family:"Bebas Neue",sans-serif;font-size:15px;font-weight:400;letter-spacing:1px}',
      '.rpe-ev .nm{top:169px;transform:translateX(-50%);font-size:10px;color:var(--text2);text-align:center;line-height:1.2;white-space:nowrap}',
      '.rpe-ev .dom{top:198px;height:44px;border-radius:6px;border:1px solid;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;line-height:1.3;font-weight:700;text-align:center}',
      '.rpe-ev .sl1,.rpe-ev .sl2{top:12px;bottom:4px;width:0;border-left:1.5px dashed var(--text2);z-index:2}',
      '.rpe-ev .slt{top:0;transform:translateX(-50%);font-size:9px;font-style:italic;font-weight:700;color:var(--text2);white-space:nowrap}',
      '.rpe-ev .st{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}',
      '.rpe-ev .sc{height:8px;border-radius:4px;background:linear-gradient(90deg,#8fc9de,#a6d3a8,#f2d896,#e8b48a,#d99a8f)}',
      '.rpe-ev .sl{display:flex;justify-content:space-between;font-size:10px;color:var(--text2);margin-top:5px}',
      '.rpe-ev .full{margin-top:14px;font-size:12px;font-weight:700;color:var(--accent);background:none;border:none;padding:0;cursor:pointer;font-family:inherit}',
      '#rpe-ov{position:fixed;inset:0;z-index:10060;background:rgba(0,0,0,.92);overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;align-items:center;padding:calc(12px + env(safe-area-inset-top,0px)) 10px calc(16px + env(safe-area-inset-bottom,0px))}',
      '#rpe-ov img{width:100%;max-width:640px;height:auto;border-radius:10px;display:block}',
      '#rpe-ov.zoom img{width:200%;max-width:none}',
      '#rpe-ov .x{align-self:flex-end;width:38px;height:38px;border-radius:50%;border:1px solid #444;background:#111;color:#ddd;font-size:16px;margin-bottom:10px;cursor:pointer;flex:none}',
      '#rpe-ov .h{color:#888;font-size:11px;margin-top:10px;text-align:center}'
    ].join('');
    document.head.appendChild(st);
  }

  function body() {
    return '<div class="rb">' +
      '<div class="bb" style="font-size:20px">CALIBRE TON <span style="color:var(--accent)">RPE</span></div>' +
      '<div class="g">' +
        '<div class="slt" style="left:25.5%">Seuil #1</div><div class="slt" style="left:55.3%">Seuil #2</div>' +
        '<div class="lvl bb" style="left:0;width:25.2%;background:#3fa35b">FACILE</div>' +
        '<div class="lvl bb" style="left:25.8%;width:29.2%;background:#d8872a">SOUTENU</div>' +
        '<div class="lvl bb" style="left:55.6%;width:44.4%;background:#c0392b">DIFFICILE</div>' +
        '<div class="bar" style="left:0;width:11.8%;height:41px;background:#2e6da4"><b>Z1</b>1</div>' +
        '<div class="bar" style="left:12.8%;width:12.2%;height:54px;background:#3fa35b"><b>Z2</b>2-3</div>' +
        '<div class="bar" style="left:26.1%;width:21.1%;height:65px;background:#e3b23c"><b>Z3</b>4-6</div>' +
        '<div class="bar" style="left:48.2%;width:6.6%;height:77px;background:#d8872a"><b>Z4</b>6-7</div>' +
        '<div class="bar" style="left:55.8%;width:21.4%;height:90px;background:#c0392b"><b>Z5</b>8-10</div>' +
        '<div class="bar" style="left:78.2%;width:9.6%;height:100px;background:#6c3483"><b>Z6</b>9-10</div>' +
        '<div class="bar" style="left:88.6%;width:11.4%;height:112px;background:#b03a8a"><b>Z7</b>%</div>' +
        '<div class="nm" style="left:5.9%">Récup</div><div class="nm" style="left:18.9%">EF</div><div class="nm" style="left:36.6%">Tempo</div><div class="nm" style="left:51.5%">Seuil</div><div class="nm" style="left:66.5%">VO2max</div><div class="nm" style="left:83%">Sprint<br>long</div><div class="nm" style="left:94.3%">Sprint<br>court</div>' +
        '<div class="dom" style="left:0;width:25%;border-color:#3fa35b;color:#3fa35b">Basse<br>RPE 1-3</div>' +
        '<div class="dom" style="left:26.2%;width:26.1%;border-color:#d8872a;color:#d8872a">Moyenne<br>RPE 4-7</div>' +
        '<div class="dom" style="left:53.6%;width:23.4%;border-color:#c0392b;color:#e0584a">Haute<br>RPE 8-10</div>' +
        '<div class="dom" style="left:78.2%;width:21.8%;border-color:#b03a8a;color:#c8509f">Très haute<br>RPE 9-10+</div>' +
        '<div class="sl1" style="left:25.5%"></div><div class="sl2" style="left:55.3%"></div>' +
      '</div>' +
      '<div class="st">Essoufflement</div><div class="sc"></div>' +
      '<div class="sl"><span>0 Repos</span><span>3 Léger</span><span>5 Modéré</span><span>7 Important</span><span>10</span></div>' +
      '<div class="st">Douleur musculaire</div><div class="sc"></div>' +
      '<div class="sl"><span>0 Repos</span><span>3 Légère</span><span>5 Modérée</span><span>7 Importante</span><span>10</span></div>' +
      '<button type="button" class="full" onclick="event.stopPropagation();openRpeInfographic()">🖼 Voir l\'infographie complète</button>' +
    '</div>';
  }

  /* HTML de l'encart pour un bloc (vide si le bloc n'est ni ENGINE ni RUN) */
  window.rpeEvalHtml = function (s) {
    if (!s || !TYPES[String(s.type || '').toLowerCase()]) return '';
    css();
    return '<details class="rpe-ev"><summary><span>📊 Évaluation du RPE</span><span class="ch">▾</span></summary>' + body() + '</details>';
  };

  /* Coaching Tips + encart RPE (même rendu partout où les tips s'affichent) */
  window.tipsWithRpeHtml = function (s) {
    var rpe = window.rpeEvalHtml(s);
    if (s && s.tips) return '<div class="info-block"><div class="info-block-title"><span>💡</span> Coaching Tips</div><div class="info-block-text">' + s.tips + '</div>' + rpe + '</div>';
    return rpe ? '<div class="info-block">' + rpe + '</div>' : '';
  };

  window.openRpeInfographic = function () {
    css();
    var ov = document.createElement('div'); ov.id = 'rpe-ov';
    ov.innerHTML = '<button class="x" aria-label="Fermer">✕</button><img src="/rpe-calibre.jpg" alt="Calibre ton RPE"><div class="h">Touche l\'image pour zoomer</div>';
    ov.querySelector('.x').onclick = function () { ov.remove(); };
    ov.querySelector('img').onclick = function () { ov.classList.toggle('zoom'); };
    document.body.appendChild(ov);
  };
})();
