/* Arhiva — Android omotač (Capacitor). Učitava se SAMO u Android aplikaciji, posle capacitor.js.
   Web Arhiva se ne menja: ovde se samo zamenjuje ono što WebView ne ume:
   1) <a download> (rezervna kopija, „Sačuvaj na telefon“) → Android „Sačuvaj kao“ (bira mesto i ime; dodatak SacuvajKao
      u novom APK-u); stariji APK bez dodatka → fajl u Documents/Arhiva
   2) navigator.share sa fajlovima → Android „Podeli“
   3) service worker se ne registruje (aplikacija je već na telefonu)
   4) dugme Nazad na telefonu → isto kao u Chrome-u (istorija Arhive); „Izađi“ zatvara aplikaciju
   5) trake telefona (gore i dole) u boji pozadine teme (dodatak Trake u novom APK-u; stariji APK: bez promene)
   6) zaključavanje (dodatak Zakljucavanje u novom APK-u; logika je u Arhivi, blok ZAKLJUČAVANJE)
   v194: „Sačuvaj kao“ ide redom (više fajlova jedan za drugim)
   7) v196 prečice (dodatak Precica u novom APK-u; logika je u Arhivi, blok PREČICA)
   8) v199 obaveštenja za rokove (dodatak LocalNotifications; logika je u Arhivi, blok OBAVEŠTENJA)
   9) v203 Google Drive: dozvola drive.file (dodatak GoogleDrive u novom APK-u; slanje je u Arhivi, blok GOOGLE DRIVE)
   10) v214 vidžet na početnom ekranu (dodatak Vidzet u novom APK-u; logika je u Arhivi, blok VIDŽET)
   11) v252 Podeli → Arhiva (dodatak Primanje u novom APK-u; logika je u Arhivi, blok PRIJEM) */
(function(){
  var C = window.Capacitor;
  if(!(C && C.isNativePlatform && C.isNativePlatform())) return;
  var reg = (window.capacitorExports && capacitorExports.registerPlugin) || C.registerPlugin;
  var Filesystem = reg('Filesystem'), Share = reg('Share'), App = reg('App'), SacuvajKao = reg('SacuvajKao');
  var imaSacuvajKao = !!(C.isPluginAvailable && C.isPluginAvailable('SacuvajKao'));
  window.ARHIVA_NATIVE = true;

  /* 5) Arhiva zove ARHIVA_TRAKE(boja pozadine) iz applyTheme — pri pokretanju i pri promeni teme */
  if(C.isPluginAvailable && C.isPluginAvailable('Trake')){
    var Trake = reg('Trake');
    window.ARHIVA_TRAKE = function(boja, gore){ try{ Trake.boja({ boja: boja, gore: gore || boja }).catch(function(){}); }catch(e){} };   /* v237: gore = gornja traka (stariji APK je zanemari) */
  }

  /* 6) zaključavanje: dok Arhiva ne nacrta svoj ekran, ništa se ne vidi (klasa lk-boot) */
  if(C.isPluginAvailable && C.isPluginAvailable('Zakljucavanje')){
    var Zak = reg('Zakljucavanje');
    try{ var lc = JSON.parse(localStorage.getItem('galerija:lock') || 'null'); if(lc && (lc.mode === 'pin' || lc.mode === 'pat')) document.documentElement.classList.add('lk-boot'); }catch(e){}
    var vis = function(stanje, fn){ document.addEventListener('visibilitychange', function(){ if(document.visibilityState === stanje) fn(); }); };
    window.ARHIVA_ZAKLJ = {
      stanje: function(){ return Zak.stanje(); },
      biometrija: function(o){ return Zak.biometrija(o); },
      potvrdiTelefonom: function(o){ return Zak.potvrdiTelefonom(o); },
      ekran: function(){ return Zak.ekran(); },
      naGasenje: function(fn){ try{ Zak.addListener('ekranUgasen', fn); }catch(e){ console.error('arhiva-native lock', e); } },
      naPovratak: function(fn){ try{ App.addListener('resume', fn); }catch(e){} vis('visible', fn); },
      naOdlasku: function(fn){ try{ App.addListener('pause', fn); }catch(e){} vis('hidden', fn); }
    };
  }

  /* 7) prečice: prava prečica sa sličicom, poslednji dokumenti na ikonici, otvaranje stavke iz prečice */
  if(C.isPluginAvailable && C.isPluginAvailable('Precica')){
    var Pr = reg('Precica');
    window.ARHIVA_PRECICA = {
      podrzano: function(){ return Pr.podrzano(); },
      napravi: function(o){ return Pr.napravi(o); },
      prikvacena: function(id){ return Pr.prikvacena({ id: id }); },   /* v197; stariji APK: greška → Arhiva ne proverava */
      dozvole: function(){ return Pr.dozvole(); },
      poslednji: function(lista){ try{ return Pr.poslednji({ lista: lista }).catch(function(e){ console.error('arhiva-native poslednji', e); }); }catch(e){ return Promise.resolve(); } },
      cekaj: function(){ return Pr.cekaj(); },
      naStavku: function(fn){ try{ Pr.addListener('stavka', fn); }catch(e){ console.error('arhiva-native stavka', e); } }
    };
  }

  /* 11) v252 Podeli → Arhiva: primljeni fajlovi (cekaj = spisak, deo = 1 MB base64, obrisi posle čuvanja) */
  if(C.isPluginAvailable && C.isPluginAvailable('Primanje')){
    var Pm = reg('Primanje');
    window.ARHIVA_PRIMI = {
      cekaj: function(){ return Pm.cekaj(); },
      deo: function(o){ return Pm.deo(o); },
      obrisi: function(){ return Pm.obrisi(); },
      naPrijem: function(fn){ try{ Pm.addListener('primljeno', fn); }catch(e){ console.error('arhiva-native primanje', e); } }
    };
  }

  /* 8) v199 obaveštenja za rokove (dodatak LocalNotifications u novom APK-u; logika je u Arhivi, blok OBAVEŠTENJA) */
  if(C.isPluginAvailable && C.isPluginAvailable('LocalNotifications')){
    var LN = reg('LocalNotifications');
    var disp = function(r){ return (r && r.display) || 'denied'; };
    window.ARHIVA_OBAV = {
      dozvola: function(){ return LN.checkPermissions().then(disp); },
      trazi: function(){ return LN.requestPermissions().then(disp); },
      kanal: function(o){ return LN.createChannel(o); },
      zakazi: function(list){ return LN.schedule({ notifications: list }); },
      otkazi: function(ids){ return ids && ids.length ? LN.cancel({ notifications: ids.map(function(i){ return { id: i }; }) }) : Promise.resolve(); },
      naDodir: function(fn){ try{ LN.addListener('localNotificationActionPerformed', function(e){ fn((e && e.notification && e.notification.extra) || {}); }); }catch(e){ console.error('arhiva-native obav', e); } }
    };
  }

  /* 9) v203 Google Drive: dozvola({interaktivno}) → {ok, token} | {ok:false, razlog:'potrebna'|'otkazano'|'greska'}; prekini({nalog}) */
  if(C.isPluginAvailable && C.isPluginAvailable('GoogleDrive')){
    var GD = reg('GoogleDrive');
    window.ARHIVA_DRIVE = {
      dozvola: function(o){ return GD.dozvola(o || {}); },
      prekini: function(o){ return GD.prekini(o || {}); }
    };
  }

  /* 4) Nazad: dok Arhiva ima istoriju (otvoren list, album, potvrda izlaska) ide nazad kroz nju; na kraju izlazi.
     Ekran zaključavanja ima prednost: Otkaži / ništa / izlaz kad je Arhiva zaključana */
  try{
    App.addListener('backButton', function(e){
      var lk = window.ARHIVA_LK_NAZAD ? window.ARHIVA_LK_NAZAD() : false;
      if(lk === 'izlaz'){ App.exitApp(); return; }
      if(lk) return;
      if(window.ARHIVA_VZ_NAZAD && window.ARHIVA_VZ_NAZAD()) return;   /* v219: nazad u prozor vidžeta — Arhiva prvo ode */
      if(e && e.canGoBack) history.back(); else App.exitApp();
    });
  }catch(e){ console.error('arhiva-native back', e); }
  window.close = function(){ try{ App.exitApp(); }catch(e){} };

  if(navigator.serviceWorker){
    try{ Object.defineProperty(navigator.serviceWorker, 'register', { value: function(){ return Promise.resolve(); }, configurable: true }); }catch(e){}
  }

  function b64(blob){
    return new Promise(function(res, rej){
      var r = new FileReader();
      r.onload = function(){ var s = String(r.result); res(s.slice(s.indexOf(',') + 1)); };
      r.onerror = function(){ rej(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function safe(n){ return String(n || 'fajl').replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().slice(0, 150) || 'fajl'; }
  function en(){ try{ return localStorage.getItem('galerija:lang') === 'en'; }catch(e){ return false; } }
  function say(sr, eng){ var m = en() ? eng : sr; if(typeof window.toast === 'function') window.toast(m); }

  /* 1a) „Sačuvaj kao“: fajl u keš po delovima (veliki ZIP ne ide odjednom kroz most), pa Android pita gde i kako da se zove.
     Vraća {ime} ili {otkazano:true}. Arhiva ga zove za rezervnu kopiju (window.ARHIVA_SACUVAJ_KAO). */
  var DEO = 3 * 1024 * 1024;   /* deljivo sa 3: svaki deo je ceo base64 */
  /* v194: Android otvara samo jedan „Sačuvaj kao“ odjednom — zahtevi idu u red, sledeći kad se prethodni završi */
  var red = Promise.resolve();
  function sacuvajKao(blob, name, mime){
    var p = red.then(function(){ return sacuvajKaoJedan(blob, name, mime); });
    red = p.catch(function(){});
    return p;
  }
  /* v262: upis u keš deo po deo — zajedničko za „Sačuvaj kao“ i deljenje (video od više MB odjednom kroz most nije prolazio).
     v264: dok telefon upisuje deo, sledeći se već priprema (brže); napredak(bajtova) posle svakog dela. */
  async function uKes(blob, putanja, napredak){
    var r, n = Math.max(1, Math.ceil(blob.size / DEO));
    var sledeci = b64(blob.slice(0, DEO));
    for(var i = 0; i < n; i++){
      var data = await sledeci;
      if(i + 1 < n) sledeci = b64(blob.slice((i + 1) * DEO, (i + 2) * DEO));
      if(i === 0) r = await Filesystem.writeFile({ path: putanja, data: data, directory: 'CACHE', recursive: true });
      else await Filesystem.appendFile({ path: putanja, data: data, directory: 'CACHE' });
      if(napredak) napredak(Math.min(blob.size, (i + 1) * DEO));
    }
    return r;
  }
  /* v264 (Zoran): rad koji traje (više od jednog dela) se vidi — obaveštenje sa kružićem, procentom i trakom dok traje */
  function radPocni(sr, eng, ukupno){
    if(ukupno <= DEO || typeof window.toastPersist !== 'function') return null;
    var tx = en() ? eng : sr;
    var f = function(gotovo){ window.toastPersist(tx + ' ' + Math.floor(gotovo / ukupno * 100) + '%', { n: gotovo, total: ukupno }); };
    f.t0 = Date.now(); f.mb = ukupno / 1048576;
    f(0); return f;
  }
  function radKraj(f){ if(f && typeof window.toastHide === 'function') window.toastHide(); }
  /* v265 PRIVREMENO (Zoran 3.11.): merenje pripreme — „Pripremljeno 48 MB za 2,1 s“, 10 s; ukloniti posle merenja */
  function radMera(f){
    if(!f || typeof window.showNote !== 'function') return;
    var s = (Date.now() - f.t0) / 1000, sr = !en();
    var broj = function(x){ var v = x.toFixed(1); return sr ? v.replace('.', ',') : v; };
    window.showNote(sr ? 'Pripremljeno ' + broj(f.mb) + ' MB za ' + broj(s) + ' s' : 'Prepared ' + broj(f.mb) + ' MB in ' + broj(s) + ' s', 10000);
  }
  async function sacuvajKaoJedan(blob, name, mime){
    var fn = safe(name), putanja = 'izvoz/' + Date.now() + '/' + fn;
    var rad = radPocni('Pripremam za čuvanje…', 'Preparing to save…', blob.size);
    try{ await uKes(blob, putanja, rad); } finally { radKraj(rad); }
    radMera(rad);
    return await SacuvajKao.sacuvaj({ putanja: putanja, ime: fn, mime: mime || blob.type || 'application/octet-stream' });
  }
  if(imaSacuvajKao) window.ARHIVA_SACUVAJ_KAO = sacuvajKao;

  /* 1) preuzimanje → „Sačuvaj kao“ (ili Documents/Arhiva/<ime> u starijem APK-u) */
  async function saveDownload(href, name){
    try{
      var blob = await (await fetch(href)).blob();
      if(imaSacuvajKao){
        var r = await sacuvajKao(blob, name);
        if(r && r.otkazano) say('Nije sačuvano.', 'Not saved.');
        else say('Sačuvano: ' + (r && r.ime || safe(name)), 'Saved: ' + (r && r.ime || safe(name)));
        return;
      }
      var fn = safe(name);
      await Filesystem.writeFile({ path: 'Arhiva/' + fn, data: await b64(blob), directory: 'DOCUMENTS', recursive: true });
      say('Sačuvano: Documents/Arhiva/' + fn, 'Saved: Documents/Arhiva/' + fn);
    }catch(e){
      console.error('arhiva-native save', e);
      say('Čuvanje nije uspelo: ' + (e && e.message || e), 'Saving failed: ' + (e && e.message || e));
    }
  }
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){
    if(this.hasAttribute('download') && /^(blob:|data:)/.test(this.href || '')){
      saveDownload(this.href, this.getAttribute('download') || 'fajl');
      return;
    }
    return origClick.call(this);
  };

  /* 2) deljenje fajlova → Android „Podeli“ */
  navigator.canShare = function(d){ return !!(d && ((d.files && d.files.length) || d.text || d.url)); };
  navigator.share = async function(d){
    d = d || {};
    var uris = [];
    var list = d.files || [];
    var ukupno = 0; for(var j = 0; j < list.length; j++) ukupno += list[j].size || 0;
    var rad = radPocni('Pripremam za deljenje…', 'Preparing to share…', ukupno), pre = 0;
    try{
      for(var i = 0; i < list.length; i++){
        var f = list[i];
        var r = await uKes(f, 'deljenje/' + Date.now() + '-' + i + '/' + safe(f.name), rad && function(g){ rad(pre + g); });
        pre += f.size || 0;
        uris.push(r.uri);
      }
    } finally { radKraj(rad); }
    radMera(rad);
    try{
      var o = {};
      if(d.title) o.title = d.title;
      if(d.text) o.text = d.text;
      if(d.url) o.url = d.url;
      if(uris.length) o.files = uris;
      await Share.share(o);
    }catch(e){
      var m = String(e && e.message || e);
      if(/cancel/i.test(m)){ var a = new Error(m); a.name = 'AbortError'; throw a; }
      throw e;
    }
  };
  /* 10) v214 vidžet: postavi(podaci JSON), stanje() → {broj, moze}, naEkran() → {ok}; v218 prozor() */
  if(C.isPluginAvailable && C.isPluginAvailable('Vidzet')){
    var Vz = reg('Vidzet');
    window.ARHIVA_VIDZET = {
      postavi: function(podaci){ return Vz.postavi({ podaci: podaci }); },
      stanje: function(){ return Vz.stanje(); },
      naEkran: function(){ return Vz.naEkran(); },
      prozor: function(){ return Vz.prozor(); },   /* v218 (stariji APK) */
      skloni: function(){ return Vz.skloni(); }    /* v221: Arhiva u pozadinu (nazad sa prozora vidžeta) */
    };
  }

})();
