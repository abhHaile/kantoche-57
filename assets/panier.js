/* Kantoche 57 — panier partagé (sans login)
   Suit l'utilisateur d'une page à l'autre via localStorage.
   Détecte les lignes .mi (carte) et .di (boissons) avec un prix chiffré,
   ajoute un bouton "+", et affiche un encart de commande flottant
   avec total instantané, fiche PDF "carte postale" et envoi par mail. */
(function(){
  "use strict";
  var KEY='k57_panier_v1';
  var ROUGE=[211,74,58], ENCRE=[36,31,26], SAPIN=[22,97,82], GREY=[120,112,102];

  function euro(n){ return (Math.round(n*100)/100).toFixed(2).replace('.',',')+' €'; }
  function slug(s){ return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,40); }
  function prix(txt){ // "4,50 €" -> 4.5 ; ignore "+0,40", "sur devis"
    if(!txt) return null; txt=txt.trim();
    if(txt.charAt(0)==='+') return null;
    var m=txt.replace(/\s/g,'').match(/(\d+)[.,](\d{2})/) || txt.replace(/\s/g,'').match(/(\d+)\s*€/);
    if(!m) return null;
    return m[2]!==undefined ? parseFloat(m[1]+'.'+m[2]) : parseFloat(m[1]);
  }
  function nomLigne(nEl){ // texte du nom sans le <small> et sans les badges
    var clone=nEl.cloneNode(true);
    clone.querySelectorAll('small,.badges,.trendy').forEach(function(x){x.remove();});
    return clone.textContent.replace(/\s+/g,' ').trim();
  }

  // ---- état ----
  var cart={}; // id -> {nm, pu, q}
  function load(){ try{ var r=localStorage.getItem(KEY); if(r) cart=JSON.parse(r)||{}; }catch(e){ cart={}; } }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(cart)); }catch(e){} }
  function total(){ var t=0; for(var k in cart) t+=cart[k].pu*cart[k].q; return t; }
  function count(){ var c=0; for(var k in cart) c+=cart[k].q; return c; }

  function add(id,nm,pu){ if(!cart[id]) cart[id]={nm:nm,pu:pu,q:0}; cart[id].q++; save(); render(); pulse(); }
  function setQ(id,q){ q=parseInt(q)||0; if(q<=0){ delete cart[id]; } else { if(cart[id]) cart[id].q=q; } save(); render(); }
  // qté absolue avec enregistrement de l'article (utilisé par le configurateur Events)
  function setItem(id,nm,pu,q){ q=parseInt(q)||0; if(q<=0){ delete cart[id]; } else { cart[id]={nm:nm,pu:pu,q:q}; } save(); render(); }
  function qtyOf(id){ return cart[id]?cart[id].q:0; }

  // ---- injection des boutons "+" sur les lignes ----
  function wireRows(){
    document.querySelectorAll('.mi, .di').forEach(function(row){
      if(row.dataset.k57) return;
      var nEl=row.querySelector('.n'), pEl=row.querySelector('.p');
      if(!nEl||!pEl) return;
      var pu=prix(pEl.textContent); if(pu===null) return;
      var nm=nomLigne(nEl); if(!nm) return;
      var id=slug(nm)||('a'+Math.random().toString(36).slice(2,7));
      row.dataset.k57=id;
      var b=document.createElement('button');
      b.type='button'; b.className='k57-add'; b.setAttribute('aria-label','Ajouter '+nm); b.textContent='+';
      b.addEventListener('click',function(e){ e.preventDefault(); add(id,nm,pu); });
      pEl.insertAdjacentElement('afterend', b);
    });
  }

  // ---- UI flottante ----
  var fab, panel, linesEl, totEl, cntEl;
  function buildUI(){
    fab=document.createElement('button');
    fab.className='k57-fab'; fab.type='button';
    fab.innerHTML='<span class="ic">🛒</span><span class="k57-cnt" id="k57-cnt">0</span><span class="k57-fabtot" id="k57-fabtot">0 €</span>';
    fab.addEventListener('click',openPanel);
    document.body.appendChild(fab);

    panel=document.createElement('div'); panel.className='k57-panel'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Votre commande');
    panel.innerHTML=''+
      '<div class="k57-shead"><span>Votre commande</span><button type="button" class="k57-close" aria-label="Fermer">×</button></div>'+
      '<div class="k57-sbody">'+
        '<div class="k57-f"><label>Nom / organisation</label><input id="k57-nom" placeholder="Ton nom ou le secrétariat…"></div>'+
        '<div class="k57-f k57-f2"><div><label>Date</label><input id="k57-date" type="date"></div><div><label>Heure</label><input id="k57-heure" type="time" step="900" value="12:00"></div></div>'+
        '<div class="k57-f"><label>Lieu — livraison ou enlèvement</label><input id="k57-lieu" placeholder="Ex. Rue d\'Irlande 57, local 2"></div>'+
        '<div class="k57-f"><label>Détails / demandes</label><textarea id="k57-det" placeholder="Allergies, régimes, précisions…"></textarea></div>'+
        '<div class="k57-lines" id="k57-lines"></div>'+
        '<div class="k57-total"><span>Total estimé</span><span class="amt" id="k57-tot">0 €</span></div>'+
        '<div class="k57-btns">'+
          '<button type="button" class="k57-btn k57-dl" id="k57-dl">⬇ Télécharger le PDF</button>'+
          '<button type="button" class="k57-btn k57-mail" id="k57-mail">✉ Envoyer par mail</button>'+
        '</div>'+
        '<button type="button" class="k57-vide" id="k57-vide">Vider le panier</button>'+
        '<p class="k57-hint">Estimation indicative TVAC. La commande n\'est confirmée qu\'après notre retour.</p>'+
      '</div>';
    document.body.appendChild(panel);

    var back=document.createElement('div'); back.className='k57-back'; back.addEventListener('click',closePanel); document.body.appendChild(back);
    window._k57back=back;

    linesEl=panel.querySelector('#k57-lines'); totEl=panel.querySelector('#k57-tot'); cntEl=document.getElementById('k57-cnt');
    panel.querySelector('.k57-close').addEventListener('click',closePanel);
    panel.querySelector('#k57-dl').addEventListener('click',telecharger);
    panel.querySelector('#k57-mail').addEventListener('click',envoyerMail);
    panel.querySelector('#k57-vide').addEventListener('click',function(){ cart={}; save(); render(); });

    // date mini = aujourd'hui
    var d=panel.querySelector('#k57-date');
    var t=new Date(); var iso=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
    d.setAttribute('min',iso);
    d.addEventListener('change',function(){ if(d.value && d.value<iso){ alert('La date ne peut pas être dans le passé.'); d.value=''; } });
  }
  function openPanel(){ panel.classList.add('on'); window._k57back.classList.add('on'); }
  function closePanel(){ panel.classList.remove('on'); window._k57back.classList.remove('on'); }
  function pulse(){ fab.classList.remove('pulse'); void fab.offsetWidth; fab.classList.add('pulse'); }

  function render(){
    var c=count(), t=total();
    if(cntEl) cntEl.textContent=c;
    var ft=document.getElementById('k57-fabtot'); if(ft) ft.textContent=euro(t);
    if(fab) fab.classList.toggle('vide', c===0);
    if(!linesEl) return;
    var ks=Object.keys(cart);
    if(ks.length===0){ linesEl.innerHTML='<div class="k57-empty">Ton panier est vide — clique sur « + » à côté d\'un article.</div>'; }
    else{
      linesEl.innerHTML=ks.map(function(k){ var l=cart[k]; return ''+
        '<div class="k57-ln">'+
          '<span class="nm">'+l.nm+'</span>'+
          '<span class="qc"><button type="button" data-m="'+k+'">−</button><b>'+l.q+'</b><button type="button" data-p="'+k+'">+</button></span>'+
          '<span class="tt">'+euro(l.pu*l.q)+'</span>'+
        '</div>'; }).join('');
      linesEl.querySelectorAll('[data-p]').forEach(function(b){ b.addEventListener('click',function(){ var k=b.dataset.p; setQ(k,cart[k].q+1); }); });
      linesEl.querySelectorAll('[data-m]').forEach(function(b){ b.addEventListener('click',function(){ var k=b.dataset.m; setQ(k,cart[k].q-1); }); });
    }
    if(totEl) totEl.textContent=euro(t);
    try{ document.dispatchEvent(new CustomEvent('k57change')); }catch(e){}
  }

  // ---- sorties : texte / PDF / mail ----
  function champs(){
    return {
      nom:(document.getElementById('k57-nom')||{}).value||'—',
      date:(document.getElementById('k57-date')||{}).value||'',
      heure:(document.getElementById('k57-heure')||{}).value||'',
      lieu:(document.getElementById('k57-lieu')||{}).value||'—',
      det:(document.getElementById('k57-det')||{}).value||'—'
    };
  }
  function dateOK(){
    var d=document.getElementById('k57-date'); if(!d||!d.value) return true;
    var t=new Date(); var iso=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
    if(d.value<iso){ alert('La date de livraison ne peut pas être dans le passé.'); return false; }
    return true;
  }
  function fiche(){
    var f=champs(), ks=Object.keys(cart);
    var dh=(f.date||'—')+(f.heure?(' à '+f.heure):'');
    var t='KANTOCHE 57 — VOTRE COMMANDE\n=============================\n\n';
    t+='Nom / organisation : '+f.nom+'\nLivraison le       : '+dh+'\nLieu (livr./enlèv.): '+f.lieu+'\nDétails            : '+f.det+'\n\nARTICLES\n--------\n';
    if(ks.length===0) t+='(panier vide)\n'; else ks.forEach(function(k){ var l=cart[k]; t+=l.q+' x '+l.nm+'  —  '+euro(l.pu)+'/u  =  '+euro(l.pu*l.q)+'\n'; });
    t+='\nTOTAL ESTIMÉ TVAC : '+euro(total())+'\n\nEstimation indicative — commande confirmée après retour de Kantoche 57.\nKantoche 57 · Saint-Luc Bruxelles · abh@gestiamo.be · +32 486 82 48 08\n';
    return t;
  }
  function telecharger(){
    if(!dateOK()) return;
    if(count()===0){ alert('Ton panier est vide.'); return; }
    if(!(window.jspdf && window.jspdf.jsPDF)){ // repli texte
      var blob=new Blob([fiche()],{type:'text/plain;charset=utf-8'}), u=URL.createObjectURL(blob);
      var a=document.createElement('a'); a.href=u; a.download='Kantoche57_commande.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); return;
    }
    var f=champs(), ks=Object.keys(cart);
    var dh=(f.date||'—')+(f.heure?(' à '+f.heure):'');
    var doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'});
    var W=210, M=16, y;
    // bandeau rouge carte postale
    doc.setFillColor(ROUGE[0],ROUGE[1],ROUGE[2]); doc.rect(0,0,W,42,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(255,255,255);
    doc.text('KAN-',M,14); doc.text('TOCHE',M,26);
    doc.setTextColor(ENCRE[0],ENCRE[1],ENCRE[2]); doc.text('57',M,38);
    doc.setTextColor(255,255,255); doc.setFontSize(20); doc.text('VOTRE COMMANDE',W-M,18,{align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text('Boire · Manger · Event & Catering',W-M,26,{align:'right'});
    doc.text('Saint-Luc Bruxelles',W-M,31,{align:'right'});
    y=54;
    doc.setTextColor(ENCRE[0],ENCRE[1],ENCRE[2]); doc.setFontSize(10);
    function info(l,v){ doc.setFont('helvetica','bold'); doc.text(l,M,y); doc.setFont('helvetica','normal'); doc.text(String(v),M+42,y); y+=6.5; }
    info('Nom / organisation',f.nom); info('Livraison le',dh); info('Lieu (livr./enlèv.)',f.lieu);
    doc.setFont('helvetica','bold'); doc.text('Détails',M,y); doc.setFont('helvetica','normal');
    var dl=doc.splitTextToSize(f.det,W-M-M-42); doc.text(dl,M+42,y); y+=Math.max(6.5,dl.length*5.2)+2;
    y+=4; doc.setDrawColor(226,220,207); doc.line(M,y,W-M,y); y+=8;
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(GREY[0],GREY[1],GREY[2]);
    doc.text('ARTICLE',M,y); doc.text('QTÉ',120,y,{align:'right'}); doc.text('P.U.',150,y,{align:'right'}); doc.text('TOTAL',W-M,y,{align:'right'});
    y+=3; doc.line(M,y,W-M,y); y+=6;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(ENCRE[0],ENCRE[1],ENCRE[2]);
    ks.forEach(function(k){ var l=cart[k];
      if(y>250){ doc.addPage(); y=24; }
      doc.text(l.nm,M,y); doc.text(String(l.q),120,y,{align:'right'}); doc.text(euro(l.pu),150,y,{align:'right'}); doc.text(euro(l.pu*l.q),W-M,y,{align:'right'}); y+=6.5;
    });
    y+=2; doc.setDrawColor(ROUGE[0],ROUGE[1],ROUGE[2]); doc.setLineWidth(0.6); doc.line(120,y,W-M,y); y+=8;
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(ROUGE[0],ROUGE[1],ROUGE[2]);
    doc.text('TOTAL ESTIMÉ TVAC',120,y,{align:'right'}); doc.setFontSize(15); doc.text(euro(total()),W-M,y,{align:'right'});
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(GREY[0],GREY[1],GREY[2]);
    doc.text('Estimation indicative — la commande est confirmée après notre retour.',M,274);
    doc.setFillColor(SAPIN[0],SAPIN[1],SAPIN[2]); doc.rect(0,282,W,15,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text('Kantoche 57 · Saint-Luc Bruxelles · abh@gestiamo.be · +32 486 82 48 08',W/2,291,{align:'center'});
    doc.save('Kantoche57_commande_'+(slug(f.nom)||'commande')+'.pdf');
  }
  function envoyerMail(){
    if(!dateOK()) return;
    if(count()===0){ alert('Ton panier est vide.'); return; }
    var sujet='Commande Kantoche 57 — '+((document.getElementById('k57-nom')||{}).value||'');
    window.location.href='mailto:abh@gestiamo.be?subject='+encodeURIComponent(sujet)+'&body='+encodeURIComponent(fiche());
  }

  function init(){ load(); buildUI(); wireRows(); render(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
  window.K57Panier={add:add,open:openPanel,setItem:setItem,qtyOf:qtyOf};
})();
