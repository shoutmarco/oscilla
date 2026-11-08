/*! © 2026 attic rain. All rights reserved. OSCILLA and its code may not be copied, modified or reused without written permission. */
// OSCILLA report: Save PDF and Share at the top right (and Share beside Save PDF at the bottom), on the report the device
// writes and on the link page. Share opens the share menu at once with the report's link (the page picks its id), and sends
// the readings and the sound while the menu is open. The sound goes as 8-bit mu-law, mono: about 1.4 MB a minute at 24 kHz.
(function () {
  "use strict";
  var STORE = "https://bold-voice-2354.shoutmarco.workers.dev", LINK = "https://oscilla.atticrain.co/r/?id=";
  var ABC = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  var $ = function (i) { return document.getElementById(i); };

  function newId() { var b = crypto.getRandomValues(new Uint8Array(10)), s = ""; for (var i = 0; i < 10; i++) s += ABC[b[i] % ABC.length]; return s; }
  function b64(u) { var s = ""; for (var i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); }
  function unb64(t) { var b = atob(t), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

  // mu-law, as in G.711: 8 bits a sample, about 38 dB of range, decoded by a 256-entry table
  function ulawEnc(f) {
    var o = new Uint8Array(f.length);
    for (var i = 0; i < f.length; i++) {
      var x = Math.max(-1, Math.min(1, f[i])), s = x < 0 ? 0x80 : 0, v = Math.round(Math.abs(x) * 32635) + 132, e = 7;
      for (var m = 0x4000; (v & m) === 0 && e > 0; m >>= 1) e--;
      o[i] = ~(s | (e << 4) | ((v >> (e + 3)) & 0x0f)) & 0xff;
    }
    return o;
  }
  var DEC = new Float32Array(256);
  for (var k = 0; k < 256; k++) { var u = ~k & 0xff, e = (u >> 4) & 7, m = u & 15, v = (((m << 3) + 132) << e) - 132; DEC[k] = (u & 0x80 ? -v : v) / 32635; }
  function ulawDec(b) { var f = new Float32Array(b.length); for (var i = 0; i < b.length; i++) f[i] = DEC[b[i]]; return f; }

  function gzip(text) {
    if (!window.CompressionStream) return Promise.resolve({ v: 2, json: text });
    var cs = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Response(cs).arrayBuffer().then(function (a) { return { v: 2, gz: b64(new Uint8Array(a)) }; });
  }
  function gunzip(o) {
    if (typeof o.json === "string") return Promise.resolve(o.json);
    var ds = new Blob([unb64(o.gz)]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(ds).text();
  }

  // ---- sending (from the report the device wrote). The link is fixed on the first press; if sending fails, the next press
  // sends again under the same link, so a link already passed on still opens. 409 means that part is already there.
  var job = null;
  function send(D, audio) {
    if (!job) { var id = newId(); job = { id: id, link: LINK + id, state: "" }; }
    if (job.state === "sending" || job.state === "sent") return job;
    var j = job, ok = function (r, what) { if (!r.ok && r.status !== 409) throw new Error(what + " " + r.status); };
    j.state = "sending";
    gzip(JSON.stringify(Object.assign({}, D, { sound: audio ? audio.sr : 0 }))).then(function (o) {
      return fetch(STORE + "/r/" + j.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
    }).then(function (r) {
      ok(r, "readings");
      if (!audio) return null;
      return fetch(STORE + "/s/" + j.id, { method: "PUT", headers: { "X-Oscilla-SR": String(audio.sr) }, body: ulawEnc(audio.L) })
        .then(function (r2) { ok(r2, "sound"); });
    }).then(function () { j.state = "sent"; }, function (e) {
      j.state = "failed"; note("Not sent \u2013 check your connection and press Share again"); if (window.console) console.log("OSCILLA share: " + e);
    });
    return j;
  }
  function note(t) { var n = $("shareNote"); if (n) { n.textContent = t; n.hidden = !t; } }

  function share(getLink) {
    var title = document.title, link = getLink();
    if (!link) return;
    if (navigator.share) {
      navigator.share({ title: title, text: title + "\n" + link, url: link }).catch(function (e) {
        if (!e || e.name !== "AbortError") copy(link);
      });
    } else copy(link);
  }
  function copy(link) {
    var done = function () { note("Link copied"); setTimeout(function () { note(""); }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { window.prompt("Copy this link:", link); });
    else window.prompt("Copy this link:", link);
  }

  // ---- the buttons: top right always, and Share beside Save PDF at the bottom of the report
  function wire(getLink) {
    var tp = $("topPdf"), ts = $("topShare");
    tp.onclick = function () { var b = $("savePdf"); b ? b.click() : print(); };
    ts.onclick = function () { share(getLink); };
    document.addEventListener("click", function (e) { if (e.target && e.target.id === "shareRep") share(getLink); });
    var r = $("report"), sync = function () { tp.hidden = ts.hidden = r.hidden; var p = $("patterns"); if (p) p.hidden = r.hidden; };
    new MutationObserver(sync).observe(r, { attributes: true, attributeFilter: ["hidden"] }); sync();
  }

  // ---- the device's still patterns, folded under the report (sanitised: only the drawing comes through)
  function clean(html) {
    var t = document.createElement("template"); t.innerHTML = html;
    t.content.querySelectorAll("script,iframe,object,embed,foreignObject,link,meta,style,form,input,a").forEach(function (n) { n.remove(); });
    t.content.querySelectorAll("*").forEach(function (n) {
      for (var i = n.attributes.length - 1; i >= 0; i--) { var a = n.attributes[i].name; if (/^on/i.test(a) || /href$/i.test(a)) n.removeAttribute(a); }
    });
    return t.innerHTML;
  }
  function patterns(html) {
    if (!html) return;
    var r = $("report"), s = document.createElement("section"); s.id = "patterns";
    s.innerHTML = '<details><summary>Patterns</summary><div class="pbody">' + clean(html) + "</div></details>";
    r.parentNode.insertBefore(s, r.nextSibling);
    var dt = s.querySelector("details");
    addEventListener("beforeprint", function () { dt.setAttribute("data-was", dt.open ? "1" : ""); dt.open = true; });
    addEventListener("afterprint", function () { dt.open = dt.getAttribute("data-was") === "1"; });
  }

  function open(D, audio) {
    window.OSCILLA_DEVICE = D;
    window.OSCILLA_APP.openReport(D.rec, D.rec.sr, D.info, audio);
    patterns(D.patterns);
  }

  window.OSCILLA_REPORT = {
    // the report the device wrote: its sound arrives in a script after the page
    device: function () {
      var D = window.OSCILLA_DEVICE, opened = false, audio = null;
      if (!D) return;
      function go(a) { if (opened) return; opened = true; audio = a; open(D, a); wire(function () { return send(D, audio).link; }); }
      window.OSCILLA_SOUND_READY = function (S) {
        var b = atob(S.b64), n = b.length >> 1, f = new Float32Array(n), i, v;
        for (i = 0; i < n; i++) { v = b.charCodeAt(2 * i) | b.charCodeAt(2 * i + 1) << 8; f[i] = (v > 32767 ? v - 65536 : v) / 32768; }
        go({ L: f, R: f, sr: S.sr });
      };
      addEventListener("load", function () { go(null); });
    },
    // the link page: readings and sound from the store
    link: function (id, fail) {
      var D;
      readings(id, 0)
        .then(function (o) { if (o.v !== 2) throw { old: o }; return gunzip(o); })
        .then(function (t) { D = JSON.parse(t); document.title = D.info.name + " · OSCILLA report"; return D.sound ? sound(id, 0) : null; })
        .then(function (a) { open(D, a); wire(function () { return location.href; }); }, function (e) { fail(e); });
    },
    ulawEnc: ulawEnc, ulawDec: ulawDec
  };
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function readings(id, tries) {
    return fetch(STORE + "/r/" + id).then(function (r) {
      if (r.status === 404 && tries < 15) return wait(4000).then(function () { return readings(id, tries + 1); });
      if (r.status === 404) throw new Error("404");
      if (!r.ok) throw new Error("store " + r.status);
      return r.json();
    });
  }
  function sound(id, tries) {                          // just shared: the sound may still be on its way for a few seconds
    return fetch(STORE + "/s/" + id).then(function (r) {
      if (r.status === 404 && tries < 10) return wait(3000).then(function () { return sound(id, tries + 1); });
      if (!r.ok) return null;
      var sr = parseInt(r.headers.get("X-Oscilla-SR"), 10) || 24000;
      return r.arrayBuffer().then(function (b) { var f = ulawDec(new Uint8Array(b)); return { L: f, R: f, sr: sr }; });
    }, function () { return null; });
  }
})();
