/* Arhiva — Android omotač (Capacitor). Učitava se SAMO u Android aplikaciji, posle capacitor.js.
   Web Arhiva se ne menja: ovde se samo zamenjuje ono što WebView ne ume:
   1) <a download> (rezervna kopija, „Sačuvaj na telefon“) → Android „Sačuvaj kao“ (bira mesto i ime; dodatak SacuvajKao
      u novom APK-u); stariji APK bez dodatka → fajl u Documents/Arhiva
   2) navigator.share sa fajlovima → Android „Podeli“
   3) service worker se ne registruje (aplikacija je već na telefonu)
   4) dugme Nazad na telefonu → isto kao u Chrome-u (istorija Arhive); „Izađi“ zatvara aplikaciju */
(function(){
  var C = window.Capacitor;
  if(!(C && C.isNativePlatform && C.isNativePlatform())) return;
  var reg = (window.capacitorExports && capacitorExports.registerPlugin) || C.registerPlugin;
  var Filesystem = reg('Filesystem'), Share = reg('Share'), App = reg('App'), SacuvajKao = reg('SacuvajKao');
  var imaSacuvajKao = !!(C.isPluginAvailable && C.isPluginAvailable('SacuvajKao'));
  window.ARHIVA_NATIVE = true;

  /* 4) Nazad: dok Arhiva ima istoriju (otvoren list, album, potvrda izlaska) ide nazad kroz nju; na kraju izlazi */
  try{
    App.addListener('backButton', function(e){
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
  async function sacuvajKao(blob, name, mime){
    var fn = safe(name), putanja = 'izvoz/' + Date.now() + '/' + fn;
    for(var off = 0; off === 0 || off < blob.size; off += DEO){
      var data = await b64(blob.slice(off, off + DEO));
      if(off === 0) await Filesystem.writeFile({ path: putanja, data: data, directory: 'CACHE', recursive: true });
      else await Filesystem.appendFile({ path: putanja, data: data, directory: 'CACHE' });
    }
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
    for(var i = 0; i < list.length; i++){
      var f = list[i];
      var r = await Filesystem.writeFile({ path: 'deljenje/' + Date.now() + '-' + i + '/' + safe(f.name), data: await b64(f), directory: 'CACHE', recursive: true });
      uris.push(r.uri);
    }
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
})();
