/* =============================================================================
   mappa.js — navigazione della mappa concettuale (script classico, § 5.8)
   Copre: due bersagli del nodo (§ 5.1), linee SVG generiche + parole-legame
   (§ 5.3, § 5.3-quater), pan/zoom/centratura (§ 5.3-ter), stato nel fragment
   URL con regole del ricordare/dimenticare (§ 5.3), ricerca globale (§ 5.3-bis).
   Nessuna dipendenza esterna; funziona da file://.
   ============================================================================= */
(function () {
  "use strict";

  /* --- Riferimenti --- */
  var VISTA, MONDO, ALBERO, SVGL, LEGAMI, AVVISO;
  var RICERCA, RICAMPO, RICONT;

  /* --- Stato della vista (pan + zoom, § 5.3-ter) --- */
  var vx = 0, vy = 0, scala = 1;
  var ZOOM_MIN = 0.2, ZOOM_MAX = 3;
  /* Soglia di leggibilità: etichette da 15px non sotto i 14px resi (§ 5.11). */
  var SOGLIA_LEGGIBILITA = 14 / 15;
  var ZOOM_MAX_CENTRATURA = 1.2;

  /* --- Stato interno --- */
  var toggleProgrammatici = 0;   // distingue i toggle nostri da quelli esterni
  var soppressioneClickFinoA = 0; // dopo un pan, il click non apre nulla
  var timerFragment = null;
  var timerAvviso = null;
  var animazioneRamo = null;     // apertura/chiusura di un ramo in corso
  var rafRamo = 0;               // frame del motore di animazione dei rami
  var timerRotella = null;       // rotellina "in corso" (raffica di eventi)

  /* --- Ricerca (§ 5.3-bis) --- */
  var ricercaAttiva = false;
  var statoPreRicerca = null;    // fotografia per la chiusura completa
  var indiceNodi = [];           // {el, scatola, numero, testo normalizzato}

  /* ==========================================================================
     Utilità
     ========================================================================== */

  function $(sel) { return document.querySelector(sel); }

  function tuttiIDettagli() {
    return Array.prototype.slice.call(document.querySelectorAll("details.nodo"));
  }

  function scatolaDi(el) {
    // el è details.nodo oppure div.nodo-foglia
    var s = el.querySelector(":scope > summary > .nodo-scatola");
    return s || el.querySelector(":scope > .nodo-scatola");
  }

  function antenatiNumeri(numero) {
    var parti = numero.split(".");
    var lista = [];
    for (var i = 1; i < parti.length; i++) {
      lista.push(parti.slice(0, i).join("."));
    }
    return lista; // es. "1.1.2" -> ["1", "1.1"]
  }

  /* Unica durata di tutte le transizioni (variabile CSS, § 5.5): con
     prefers-reduced-motion vale 0 e le transizioni diventano istantanee. */
  function durataTransizione() {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue("--durata-transizione").trim();
    var ms = parseFloat(v);
    if (!isFinite(ms)) return 300;
    if (v.indexOf("ms") < 0 && v.indexOf("s") >= 0) ms *= 1000;
    return ms;
  }

  /* Curva delle transizioni: la stessa «ease» del CSS
     (cubic-bezier(0.25, 0.1, 0.25, 1)), risolta numericamente per bisezione.
     Serve al motore JS dei rami: curva percepita identica alla vista. */
  function curvaEase(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var bez = function (u, a, b) {
      var v = 1 - u;
      return 3 * v * v * u * a + 3 * v * u * u * b + u * u * u;
    };
    var u0 = 0, u1 = 1, u = t;
    for (var i = 0; i < 24; i++) {
      var x = bez(u, 0.25, 0.25);
      if (Math.abs(x - t) < 0.0005) break;
      if (x < t) u0 = u; else u1 = u;
      u = (u0 + u1) / 2;
    }
    return bez(u, 0.1, 1);
  }

  function normalizza(testo) {
    return testo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  /* Coordinate nello spazio-mondo: catena degli offset fino a #mondo.
     Indipendenti dalla trasformazione corrente (anche a transizione in corso). */
  function rettMondo(el) {
    var x = 0, y = 0, n = el;
    while (n && n !== MONDO) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }

  /* ==========================================================================
     Trasformazione della vista (pan + zoom via transform CSS)
     ========================================================================== */

  function applicaTrasforma() {
    MONDO.style.transform =
      "translate(" + vx + "px," + vy + "px) scale(" + scala + ")";
  }

  /* --- Promozione a strato solo durante il movimento (nitidezza allo zoom).
     La classe «fluida» (will-change: transform, vedi stile.css) si accende
     all'inizio di un movimento guidato da JS — gesto accertato di pan, pinch,
     raffica di rotellina, motore dei rami — e si spegne quando NESSUNA di
     queste sorgenti è più attiva: a riposo il browser ri-rasterizza il testo
     alla scala corrente. Le transizioni CSS della vista sono coperte a parte
     dalla classe «anima». --- */
  function iniziaFluida() {
    MONDO.classList.add("fluida");
  }

  function fineFluida() {
    if (animazioneRamo || (pan && pan.mosso) || pizzico || timerRotella) return;
    MONDO.classList.remove("fluida");
  }

  function animaVerso(nvx, nvy, nscala, poi) {
    MONDO.classList.add("anima");
    vx = nvx; vy = nvy; scala = nscala;
    applicaTrasforma();
    var fine = function () {
      MONDO.classList.remove("anima");
      MONDO.removeEventListener("transitionend", fine);
      /* Riafferma il valore finale se la transizione è stata interrotta:
         cancella le transizioni residue e riapplica (no-op a transizione
         conclusa normalmente). */
      if (MONDO.getAnimations) {
        MONDO.getAnimations().forEach(function (a) { a.cancel(); });
      }
      MONDO.style.transform = "";
      applicaTrasforma();
      if (poi) poi();
    };
    MONDO.addEventListener("transitionend", fine);
    // rete di sicurezza se transitionend non arriva
    setTimeout(fine, durataTransizione() + 150);
  }

  /* Se la vista sta transitando (§ 5.3-ter) e l'utente prende il controllo
     (pan accertato, pinch, rotellina), la transizione si congela sul valore
     interpolato corrente: la mappa segue il gesto senza elastici né salti.
     Se la vista è guidata dal motore dei rami, il motore la cede all'utente
     (vx/vy/scala sono già i valori correnti) e il ramo finisce da sé. */
  function congelaVista() {
    if (animazioneRamo) animazioneRamo.vistaA = null;
    if (!MONDO.classList.contains("anima")) return;
    var t = getComputedStyle(MONDO).transform;
    MONDO.classList.remove("anima");
    if (t && t.indexOf("matrix(") === 0) {
      // matrix(a, b, c, d, e, f): scala uniforme = a, traslazione = e, f
      var n = t.slice(7, -1).split(",").map(parseFloat);
      if (n.length === 6 && n.every(isFinite)) {
        scala = n[0]; vx = n[4]; vy = n[5];
      }
    }
    if (MONDO.getAnimations) {
      MONDO.getAnimations().forEach(function (a) { a.cancel(); });
    }
    MONDO.style.transform = "";
    applicaTrasforma();
  }

  function zoomVerso(cx, cy, nuovaScala) {
    congelaVista();
    nuovaScala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nuovaScala));
    var wx = (cx - vx) / scala;
    var wy = (cy - vy) / scala;
    vx = cx - wx * nuovaScala;
    vy = cy - wy * nuovaScala;
    scala = nuovaScala;
    applicaTrasforma();
    salvaFragmentDebounce();
  }

  /* Vista che centra un insieme di rettangoli-mondo (§ 5.3-ter).
     Se leggibilità e "tutto visibile" confliggono, prevale la leggibilità. */
  function vistaPerRett(bb, centroPrioritario, minScala) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var margine = 48;
    var s = Math.min(
      (vw - 2 * margine) / bb.w,
      (vh - 2 * margine) / bb.h,
      ZOOM_MAX_CENTRATURA
    );
    var cx, cy;
    if (s < minScala) {
      s = minScala; // leggibilità prima di tutto: ramo raggiungibile col pan
      cx = centroPrioritario.x;
      cy = centroPrioritario.y;
    } else {
      cx = bb.x + bb.w / 2;
      cy = bb.y + bb.h / 2;
    }
    return { x: vw / 2 - cx * s, y: vh / 2 - cy * s, s: s };
  }

  function centraRett(bb, centroPrioritario, minScala, anima) {
    var v = vistaPerRett(bb, centroPrioritario, minScala);
    if (anima) {
      animaVerso(v.x, v.y, v.s, salvaFragmentDebounce);
    } else {
      vx = v.x; vy = v.y; scala = v.s;
      applicaTrasforma();
      salvaFragmentDebounce();
    }
  }

  function unione(rette) {
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    rette.forEach(function (r) {
      x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y);
      x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h);
    });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  /* Misura il ramo (nodo + figli diretti visibili) nello spazio-mondo:
     serve alla centratura, anche calcolata in anticipo sul layout finale
     (tecnica FLIP, apertura/chiusura animate). Un ".figli" nascosto con
     display:none — usato per misurare il layout post-chiusura senza toccare
     "open" — non contribuisce. */
  function raccogliRamo(dett) {
    var rette = [rettMondo(scatolaDi(dett))];
    var figli = dett.querySelector(":scope > .figli");
    if (dett.open && figli && figli.style.display !== "none") {
      Array.prototype.forEach.call(figli.children, function (f) {
        var s = scatolaDi(f);
        if (s) rette.push(rettMondo(s));
      });
    }
    var bb = unione(rette);
    var scat = rettMondo(scatolaDi(dett));
    return { bb: bb, centro: { x: scat.x + scat.w / 2, y: scat.y + scat.h / 2 } };
  }

  /* Centra il nodo appena aperto con i suoi figli diretti (§ 5.3-ter). */
  function centraRamo(dett) {
    var r = raccogliRamo(dett);
    centraRett(r.bb, r.centro, SOGLIA_LEGGIBILITA, true);
  }

  /* ==========================================================================
     Linee di collegamento + parole-legame (§ 5.3, § 5.3-quater)
     Geometrie calcolate a runtime, per classi: nessun valore per singolo nodo.
     ========================================================================== */

  /* Gli elementi grafici (path SVG e caselle parola-legame) si riusano tra
     un ridisegno e l'altro: durante le animazioni questo ciclo gira a ogni
     frame, e ricrearli da zero (com'era in origine) produceva churn di DOM
     e pause di garbage collection — la causa dei singhiozzi alle durate
     lunghe. Qui si aggiornano solo geometria, testo e opacità. */
  var scortaArchi = [], scortaLegami = [];

  function ridisegnaLinee() {
    var w = ALBERO.offsetWidth, h = ALBERO.offsetHeight;
    SVGL.setAttribute("width", w);
    SVGL.setAttribute("height", h);
    SVGL.setAttribute("viewBox", "0 0 " + w + " " + h);

    /* Il ritaglio del ramo in animazione (overflow del suo .figli) non
       arriva a questo strato globale: gli archi interni al ramo seguono
       la stessa dissolvenza del contenitore, il cui valore è noto al
       motore (nessuna lettura di stile calcolato per frame). */
    var figliAnim = animazioneRamo ? animazioneRamo.figli : null;
    var opAnim = animazioneRamo ? animazioneRamo.opacita : 1;
    var nArchi = 0, nLegami = 0;

    tuttiIDettagli().forEach(function (dett) {
      if (!dett.open) return;
      var figli = dett.querySelector(":scope > .figli");
      if (!figli) return;
      var sommario = dett.querySelector(":scope > summary");
      var pr = rettMondo(sommario); // scatola + icona di espansione
      var px = pr.x + pr.w / 2;
      var py = pr.y + pr.h;

      Array.prototype.forEach.call(figli.children, function (figlio) {
        var scat = scatolaDi(figlio);
        if (!scat) return;
        var cr = rettMondo(scat);
        var cx = cr.x + cr.w / 2;
        var cy = cr.y;
        var g = Math.max(18, (cy - py) * 0.5);

        var path = scortaArchi[nArchi];
        if (!path) {
          path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          SVGL.appendChild(path);
          scortaArchi.push(path);
        }
        nArchi++;
        path.setAttribute("d",
          "M " + px + " " + py +
          " C " + px + " " + (py + g) + ", " + cx + " " + (cy - g) +
          ", " + cx + " " + cy);
        var nelRamoAnim = figliAnim && figliAnim.contains(figlio);
        if (nelRamoAnim) path.setAttribute("opacity", opAnim);
        else path.removeAttribute("opacity");

        /* Casella parola-legame: esiste su ogni arco; senza testo non
           disegna nulla (§ 5.3-quater). */
        var testo = figlio.dataset.legame;
        if (testo) {
          // punto medio della cubica a t = 0.5
          var mx = (px + 3 * px + 3 * cx + cx) / 8;
          var my = (py + 3 * (py + g) + 3 * (cy - g) + cy) / 8;
          var eti = scortaLegami[nLegami];
          if (!eti) {
            eti = document.createElement("span");
            eti.className = "parola-legame";
            LEGAMI.appendChild(eti);
            scortaLegami.push(eti);
          }
          nLegami++;
          if (eti.textContent !== testo) eti.textContent = testo;
          eti.style.left = mx + "px";
          eti.style.top = my + "px";
          eti.style.opacity = nelRamoAnim ? opAnim : "";
        }
      });
    });

    while (scortaArchi.length > nArchi) SVGL.removeChild(scortaArchi.pop());
    while (scortaLegami.length > nLegami) LEGAMI.removeChild(scortaLegami.pop());
  }

  /* ==========================================================================
     Stato della mappa nel fragment URL (§ 5.3, P-4)
     Formato: #a=1,1.1,...&v=x,y,scala
     ========================================================================== */

  function apertiCorrenti() {
    var s = [];
    tuttiIDettagli().forEach(function (d) { if (d.open) s.push(d.dataset.numero); });
    return s;
  }

  function scriviFragment() {
    var frag = "#a=" + apertiCorrenti().join(",") +
      "&v=" + vx.toFixed(1) + "," + vy.toFixed(1) + "," + scala.toFixed(3);
    try {
      history.replaceState(null, "", location.pathname + location.search + frag);
    } catch (e) {
      location.hash = frag; // ripiego se replaceState non è disponibile
    }
  }

  function salvaFragmentDebounce() {
    if (ricercaAttiva) return; // l'anteprima di ricerca non lascia traccia
    clearTimeout(timerFragment);
    timerFragment = setTimeout(scriviFragment, 150);
  }

  function leggiFragment() {
    var h = location.hash;
    if (!h || h.indexOf("a=") < 0) return null;
    var stato = { aperti: [], vista: null };
    h.replace(/^#/, "").split("&").forEach(function (parte) {
      var kv = parte.split("=");
      if (kv[0] === "a" && kv[1]) stato.aperti = kv[1].split(",");
      if (kv[0] === "v" && kv[1]) {
        var n = kv[1].split(",").map(parseFloat);
        if (n.length === 3 && n.every(isFinite)) {
          stato.vista = { x: n[0], y: n[1], s: n[2] };
        }
      }
    });
    return stato;
  }

  function impostaAperti(numeri) {
    fineAnimazioneRamo(); // mai impostare lo stato sopra un'animazione in corso
    var insieme = {};
    numeri.forEach(function (n) { insieme[n] = true; });
    tuttiIDettagli().forEach(function (d) {
      var voluto = !!insieme[d.dataset.numero];
      if (d.open !== voluto) {
        toggleProgrammatici++;
        d.open = voluto;
      }
    });
    ridisegnaLinee();
  }

  /* ==========================================================================
     Due bersagli del nodo (§ 5.1) + regole del ricordare/dimenticare (§ 5.3)
     ========================================================================== */

  /* --- Apertura/chiusura animata dei rami ------------------------------
     Motore unico in JavaScript, cadenzato da requestAnimationFrame con
     progresso calcolato sui TIMESTAMP (non sui frame): la durata è tempo
     di orologio, identica su schermi a 60 e a 120 Hz per costruzione, e
     non esiste la corsa di avvio delle transizioni CSS su proprietà di
     layout (che su alcuni motori partivano a singhiozzo o non partivano).
     Ogni frame, nello stesso passo: ingombro esterno del .figli
     (width/height/padding-top in px, con dissolvenza; il contenuto interno
     resta a misura naturale, ritagliato da overflow:hidden — vedi
     stile.css), trasformazione della vista (centratura § 5.3-ter, stessa
     curva e durata) e ridisegno delle linee dal layout corrente: nodi,
     vista e linee si muovono insieme per costruzione. La centratura è
     misurata in anticipo sul layout finale (tecnica FLIP). */

  /* Porta l'animazione in corso (se c'è) direttamente allo stato finale:
     mai due animazioni insieme, mai stati intermedi ambigui. Alla chiusura
     è QUI che si azzera lo stato interno del ramo (regola del dimenticare,
     § 5.3): la logica è identica, cambia solo il momento del DOM. */
  function fineAnimazioneRamo() {
    if (!animazioneRamo) return;
    var a = animazioneRamo;
    animazioneRamo = null;
    clearTimeout(a.timer);
    if (rafRamo) { cancelAnimationFrame(rafRamo); rafRamo = 0; }
    a.figli.classList.remove("anima-dimensioni");
    a.figli.style.width = "";
    a.figli.style.height = "";
    a.figli.style.paddingTop = "";
    a.figli.style.opacity = "";
    a.dett.classList.remove("in-chiusura");
    if (a.tipo === "chiusura") {
      toggleProgrammatici++;
      a.dett.open = false;
      Array.prototype.forEach.call(
        a.dett.querySelectorAll("details.nodo[open]"),
        function (d) { toggleProgrammatici++; d.open = false; }
      );
    }
    if (a.vistaA) {
      /* La vista arriva comunque al bersaglio (se l'utente non l'ha presa
         in mano con un gesto, § 5.3-ter): nessuno scatto residuo dopo. */
      vx = a.vistaA.x; vy = a.vistaA.y; scala = a.vistaA.s;
      applicaTrasforma();
    }
    ridisegnaLinee();
    fineFluida();
    salvaFragmentDebounce();
  }

  /* Applica al ramo e alla vista il fotogramma al progresso k ∈ [0,1]. */
  function quadroAnimazione(k) {
    var a = animazioneRamo;
    a.figli.style.width = (a.da.w + (a.a.w - a.da.w) * k) + "px";
    a.figli.style.height = (a.da.h + (a.a.h - a.da.h) * k) + "px";
    a.figli.style.paddingTop = (a.da.pt + (a.a.pt - a.da.pt) * k) + "px";
    a.opacita = a.da.o + (a.a.o - a.da.o) * k;
    a.figli.style.opacity = a.opacita;
    if (a.vistaA) {
      vx = a.vistaDa.x + (a.vistaA.x - a.vistaDa.x) * k;
      vy = a.vistaDa.y + (a.vistaA.y - a.vistaDa.y) * k;
      scala = a.vistaDa.s + (a.vistaA.s - a.vistaDa.s) * k;
      applicaTrasforma();
    }
    ridisegnaLinee();
  }

  function passoAnimazione(ora) {
    var a = animazioneRamo;
    if (!a) { rafRamo = 0; return; }
    /* Il cronometro parte al primo frame dipinto, non alla chiamata: il
       costo di impaginazione iniziale non mangia la durata visibile. */
    if (!a.t0) a.t0 = ora;
    var t = Math.min(1, (ora - a.t0) / a.durata);
    if (t >= 1) { rafRamo = 0; fineAnimazioneRamo(); return; }
    quadroAnimazione(curvaEase(t));
    rafRamo = requestAnimationFrame(passoAnimazione);
  }

  function avviaAnimazioneRamo(dett, figli, tipo, vistaA) {
    var nat = {
      w: figli.offsetWidth,
      h: figli.offsetHeight,
      pt: parseFloat(getComputedStyle(figli).paddingTop) || 0
    };
    var da, a;
    if (tipo === "apertura") {
      da = { w: 0, h: 0, pt: 0, o: 0 };
      a = { w: nat.w, h: nat.h, pt: nat.pt, o: 1 };
    } else {
      da = { w: nat.w, h: nat.h, pt: nat.pt, o: 1 };
      a = { w: 0, h: 0, pt: 0, o: 0 };
      dett.classList.add("in-chiusura"); // l'icona mostra subito «>»
    }
    figli.classList.add("anima-dimensioni"); // solo il ritaglio (overflow)
    iniziaFluida(); // il ramo muove vista e layout a ogni frame
    animazioneRamo = {
      dett: dett, figli: figli, tipo: tipo, da: da, a: a,
      vistaDa: { x: vx, y: vy, s: scala }, vistaA: vistaA,
      t0: 0, durata: durataTransizione(), opacita: da.o,
      /* Rete di sicurezza se i frame non arrivano (es. scheda in secondo
         piano): lo stato si porta comunque a destinazione. */
      timer: setTimeout(fineAnimazioneRamo, durataTransizione() + 400)
    };
    quadroAnimazione(0); // stato di partenza dipinto subito, stesso task
    rafRamo = requestAnimationFrame(passoAnimazione);
  }

  function commutaNodo(dett) {
    /* Un nuovo comando completa all'istante l'animazione in corso e poi
       agisce sullo stato risultante: un'azione resta un'azione (§ 5.1). */
    fineAnimazioneRamo();
    var figli = dett.querySelector(":scope > .figli");
    var animabile = figli && durataTransizione() > 0;

    if (dett.open) {
      /* Regola del dimenticare: chiudere azzera lo stato interno del ramo.
         § 5.3-ter: anche alla chiusura la vista si riassesta — il genitore
         che resta aperto e i suoi figli devono restare visibili (per la
         radice, la radice stessa); prevalenza della leggibilità invariata. */
      var genitore = dett.parentElement.closest("details.nodo");
      if (!animabile) {
        toggleProgrammatici++;
        dett.open = false;
        Array.prototype.forEach.call(
          dett.querySelectorAll("details.nodo[open]"),
          function (d) { toggleProgrammatici++; d.open = false; }
        );
        ridisegnaLinee();
        centraRamo(genitore || dett);
        salvaFragmentDebounce();
        return;
      }
      /* Layout finale misurato nascondendo il .figli (equivale al layout
         chiuso senza toccare "open"), nello stesso task: nessun lampo. */
      figli.style.display = "none";
      var rFine = raccogliRamo(genitore || dett);
      figli.style.display = "";
      avviaAnimazioneRamo(dett, figli, "chiusura",
        vistaPerRett(rFine.bb, rFine.centro, SOGLIA_LEGGIBILITA));
    } else {
      toggleProgrammatici++;
      dett.open = true;
      if (!animabile) {
        ridisegnaLinee();
        centraRamo(dett); // centratura sul ramo aperto (§ 5.3-ter)
        return;
      }
      /* Ad apertura appena avvenuta il layout È quello finale: si misurano
         qui ingombro e bersaglio della centratura, poi si anima da 0. */
      var rApre = raccogliRamo(dett);
      avviaAnimazioneRamo(dett, figli, "apertura",
        vistaPerRett(rApre.bb, rApre.centro, SOGLIA_LEGGIBILITA));
    }
  }

  /* Il percorso della slide si deriva SEMPRE da struttura.js (nessun refuso
     di slug possibile): data-pronto è il solo marcatore scritto a mano,
     apposto da Claude Code alla passata [T] di ciascuna voce (§ 7.2). */
  function apriSlide(scatola) {
    var pronto = scatola.hasAttribute("data-pronto");
    var dett = scatola.closest("[data-numero]");
    var voce = pronto && dett && window.STRUTTURA && STRUTTURA[dett.dataset.numero];
    if (!voce) {
      mostraAvviso("Voce non ancora disponibile");
      return;
    }
    fineAnimazioneRamo(); // lo stato fotografato è quello finale, non intermedio
    scriviFragment(); // lo stato resta nell'indirizzo: «indietro» lo ritrova
    location.href = "voci/" + voce.file;
  }

  function mostraAvviso(msg) {
    AVVISO.textContent = msg;
    AVVISO.hidden = false;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(function () { AVVISO.hidden = true; }, 1800);
  }

  function gestioneClick(e) {
    var sommario = e.target.closest("summary");
    /* S-40: mai la doppia azione del summary nativo — il toggle nativo
       viene sempre annullato, i due bersagli decidono da soli. */
    if (sommario) e.preventDefault();

    if (Date.now() < soppressioneClickFinoA) return; // era un trascinamento

    if (ricercaAttiva) {
      var match = e.target.closest(".nodo-scatola.match");
      if (match) scegliRisultato(match.closest("[data-numero]"));
      return; // durante la ricerca la mappa sotto non si altera (§ 5.3-bis)
    }

    var toggle = e.target.closest(".nodo-toggle");
    if (toggle) { commutaNodo(toggle.closest("details.nodo")); return; }

    var scatola = e.target.closest(".nodo-scatola");
    if (scatola) apriSlide(scatola);
  }

  /* Enter/Spazio sul summary replicano il comando «>» (mai doppia azione). */
  function gestioneTastoSummary(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      var dett = e.target.closest("details.nodo");
      if (dett && !ricercaAttiva) commutaNodo(dett);
    }
  }

  /* Toggle non originati da noi (es. "trova nella pagina" che espande un
     details chiuso): riallinea linee e stato. */
  function gestioneToggleEsterno() {
    if (toggleProgrammatici > 0) { toggleProgrammatici--; return; }
    ridisegnaLinee();
    salvaFragmentDebounce();
  }

  /* ==========================================================================
     Pan e zoom senza barre (§ 5.3-ter): pointer events, nessuna inerzia
     ========================================================================== */

  var puntatori = {};   // pointerId -> {x, y}
  var pan = null;       // {x0, y0, vx0, vy0, mosso}
  var pizzico = null;   // {d0, scala0, vx0, vy0}
  var SOGLIA_DRAG = 6;  // px: sotto è un tocco, sopra è un trascinamento

  function numPuntatori() { return Object.keys(puntatori).length; }

  function centroPuntatori() {
    var xs = 0, ys = 0, n = 0;
    for (var id in puntatori) { xs += puntatori[id].x; ys += puntatori[id].y; n++; }
    return { x: xs / n, y: ys / n };
  }

  function distanzaPuntatori() {
    var ids = Object.keys(puntatori);
    var a = puntatori[ids[0]], b = puntatori[ids[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /* La cattura si prende solo a gesto accertato (drag oltre soglia, pinch):
     presa già al pointerdown, su Chromium ridirige il click su #vista e i
     bersagli del nodo (corpo, «>/<») non lo ricevono mai col mouse. */
  function catturaPuntatore(id) {
    try { VISTA.setPointerCapture(id); } catch (err) { /* puntatore già chiuso */ }
  }

  function giuPuntatore(e) {
    if (e.target.closest("#comandi") || e.target.closest("#ricerca-barra")) return;
    puntatori[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (numPuntatori() === 1) {
      pan = { x0: e.clientX, y0: e.clientY, vx0: vx, vy0: vy, mosso: false };
      pizzico = null;
    } else if (numPuntatori() === 2) {
      pan = null;
      congelaVista(); // gesto accertato: la base del pinch è la vista corrente
      iniziaFluida();
      Object.keys(puntatori).forEach(function (id) { catturaPuntatore(Number(id)); });
      var c = centroPuntatori();
      pizzico = { d0: distanzaPuntatori(), scala0: scala, c0: c, vx0: vx, vy0: vy };
    }
  }

  function muoviPuntatore(e) {
    if (!(e.pointerId in puntatori)) return;
    puntatori[e.pointerId] = { x: e.clientX, y: e.clientY };

    if (pan && numPuntatori() === 1) {
      var dx = e.clientX - pan.x0, dy = e.clientY - pan.y0;
      if (!pan.mosso && Math.hypot(dx, dy) > SOGLIA_DRAG) {
        pan.mosso = true;
        /* Gesto accertato: se la vista stava transitando, si congela e il
           pan riparte dalla posizione congelata (niente elastici). */
        congelaVista();
        iniziaFluida();
        pan.x0 = e.clientX; pan.y0 = e.clientY;
        pan.vx0 = vx; pan.vy0 = vy;
        dx = 0; dy = 0;
        catturaPuntatore(e.pointerId);
        VISTA.classList.add("trascinamento");
      }
      if (pan.mosso) {
        vx = pan.vx0 + dx;
        vy = pan.vy0 + dy;
        applicaTrasforma();
      }
    } else if (pizzico && numPuntatori() === 2) {
      var c = centroPuntatori();
      var rapporto = distanzaPuntatori() / pizzico.d0;
      var ns = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pizzico.scala0 * rapporto));
      var wx = (pizzico.c0.x - pizzico.vx0) / pizzico.scala0;
      var wy = (pizzico.c0.y - pizzico.vy0) / pizzico.scala0;
      vx = c.x - wx * ns;
      vy = c.y - wy * ns;
      scala = ns;
      applicaTrasforma();
    }
  }

  function suPuntatore(e) {
    if (!(e.pointerId in puntatori)) return;
    delete puntatori[e.pointerId];
    var eraPan = pan && pan.mosso;
    var eraPizzico = !!pizzico;
    if (numPuntatori() === 0) {
      /* Nessuna inerzia: la mappa si ferma qui (§ 5.3-ter). */
      if (eraPan || eraPizzico) {
        soppressioneClickFinoA = Date.now() + 350;
        salvaFragmentDebounce();
      }
      pan = null;
      pizzico = null;
      VISTA.classList.remove("trascinamento");
      fineFluida(); // a riposo: ri-rasterizzazione alla scala corrente
    } else if (numPuntatori() === 1) {
      /* Da pizzico a un dito: si riparte con un pan pulito. */
      pizzico = null;
      var id = Object.keys(puntatori)[0];
      pan = { x0: puntatori[id].x, y0: puntatori[id].y, vx0: vx, vy0: vy, mosso: true };
      soppressioneClickFinoA = Date.now() + 350;
    }
  }

  function rotella(e) {
    e.preventDefault();
    /* La raffica di rotellina è un movimento: strato promosso finché gira,
       poi (200 ms dall'ultimo scatto) a riposo si torna nitidi. */
    iniziaFluida();
    clearTimeout(timerRotella);
    timerRotella = setTimeout(function () {
      timerRotella = null;
      fineFluida();
    }, 200);
    var fattore = Math.exp(-e.deltaY * 0.0015);
    zoomVerso(e.clientX, e.clientY, scala * fattore);
  }

  /* ==========================================================================
     Ricerca globale (§ 5.3-bis) — schermata sopra la mappa, mai alterante
     ========================================================================== */

  function costruisciIndice() {
    indiceNodi = [];
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-numero]"),
      function (el) {
        var scat = scatolaDi(el);
        /* Testi degli antenati: servono alle query a più parole (§ 5.3-bis),
           es. «misure dirette» → «Dirette» sotto «Misure». */
        var percorso = [];
        var p = el.parentElement.closest("[data-numero]");
        while (p) {
          percorso.push(normalizza(scatolaDi(p).textContent));
          p = p.parentElement.closest("[data-numero]");
        }
        indiceNodi.push({
          el: el,
          scatola: scat,
          numero: el.dataset.numero,
          testo: normalizza(scat.textContent),
          percorso: percorso.join(" ")
        });
      }
    );
  }

  function apriRicerca() {
    if (ricercaAttiva) return;
    fineAnimazioneRamo(); // la fotografia dello stato dev'essere quella finale
    statoPreRicerca = { aperti: apertiCorrenti(), vx: vx, vy: vy, scala: scala };
    ricercaAttiva = true;
    RICERCA.hidden = false;
    RICAMPO.value = "";
    RICONT.textContent = "";
    RICAMPO.focus();
  }

  function pulisciEvidenze() {
    Array.prototype.forEach.call(
      document.querySelectorAll(".nodo-scatola.match"),
      function (s) { s.classList.remove("match"); }
    );
  }

  function aggiornaRicerca() {
    var q = normalizza(RICAMPO.value.trim());
    pulisciEvidenze();
    if (q.length < 2) {
      impostaAperti(statoPreRicerca.aperti);
      RICONT.textContent = q.length === 1 ? "almeno 2 caratteri" : "";
      return;
    }
    /* Più parole: ognuna deve trovare riscontro, di cui almeno una nel
       testo del nodo stesso e le altre eventualmente negli antenati.
       A parola singola il criterio coincide con quello di sempre
       (riscontro nel testo del nodo). */
    var parole = q.split(/\s+/);
    var trovati = indiceNodi.filter(function (n) {
      var nelNodo = false;
      var tutte = parole.every(function (p) {
        if (n.testo.indexOf(p) >= 0) { nelNodo = true; return true; }
        return n.percorso.indexOf(p) >= 0;
      });
      return tutte && nelNodo;
    });
    if (trovati.length === 0) {
      impostaAperti(statoPreRicerca.aperti);
      RICONT.textContent = "nessuna corrispondenza";
      return;
    }
    /* Anteprima: rami dei match aperti sopra lo stato di partenza. */
    var daAprire = statoPreRicerca.aperti.slice();
    trovati.forEach(function (n) {
      antenatiNumeri(n.numero).forEach(function (a) {
        if (daAprire.indexOf(a) < 0) daAprire.push(a);
      });
    });
    impostaAperti(daAprire);
    var rette = [];
    trovati.forEach(function (n) {
      n.scatola.classList.add("match");
      rette.push(rettMondo(n.scatola));
    });
    RICONT.textContent = trovati.length === 1
      ? "1 risultato" : trovati.length + " risultati";
    /* Tutti i match inquadrati insieme (zoom-to-fit); con uno solo,
       vista centrata su di esso. */
    var bb = unione(rette);
    centraRett(bb, { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 }, ZOOM_MIN, true);
  }

  /* Tocco su un risultato: la ricerca si chiude, mappa centrata sul nodo,
     rami necessari aperti; da lì è mappa normale (§ 5.3-bis). */
  function scegliRisultato(nodoEl) {
    var numero = nodoEl.dataset.numero;
    pulisciEvidenze();
    RICERCA.hidden = true;
    ricercaAttiva = false;
    var aperti = statoPreRicerca.aperti.slice();
    antenatiNumeri(numero).forEach(function (a) {
      if (aperti.indexOf(a) < 0) aperti.push(a);
    });
    impostaAperti(aperti);
    var scat = rettMondo(scatolaDi(nodoEl));
    centraRett(scat, { x: scat.x + scat.w / 2, y: scat.y + scat.h / 2 },
      SOGLIA_LEGGIBILITA, true);
    statoPreRicerca = null;
  }

  /* Chiusura completa senza scelta: mappa esattamente com'era prima
     (regola del ricordare) — la ricerca-lampo non lascia traccia. */
  function chiudiRicerca() {
    pulisciEvidenze();
    RICERCA.hidden = true;
    ricercaAttiva = false;
    if (statoPreRicerca) {
      impostaAperti(statoPreRicerca.aperti);
      vx = statoPreRicerca.vx;
      vy = statoPreRicerca.vy;
      scala = statoPreRicerca.scala;
      applicaTrasforma();
      statoPreRicerca = null;
    }
    salvaFragmentDebounce();
  }

  /* ==========================================================================
     Avvio: render KaTeX -> font pronti -> misura -> linee -> stato (S-02)
     ========================================================================== */

  function avvia() {
    VISTA = $("#vista"); MONDO = $("#mondo"); ALBERO = $("#albero");
    SVGL = $("#linee"); LEGAMI = $("#legami"); AVVISO = $("#avviso");
    RICERCA = $("#ricerca"); RICAMPO = $("#ricerca-campo");
    RICONT = $("#ricerca-contatore");

    /* Sulla mappa lo zoom è SOLO la trasformazione di #mondo: il pinch
       nativo di Safari (eventi gesture* proprietari) non deve mai
       ridimensionare la pagina, nemmeno partendo sopra i controlli —
       cintura oltre al touch-action: none dei controlli (§ 5.3-ter). */
    ["gesturestart", "gesturechange", "gestureend"].forEach(function (tipo) {
      document.addEventListener(tipo, function (e) { e.preventDefault(); },
        { passive: false });
    });

    /* Pipeline KaTeX sulle etichette (§ 5.6: vale anche per la mappa). */
    if (window.renderMathInElement) {
      window.renderMathInElement(ALBERO, {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false
      });
    }

    document.fonts.ready.then(function () {
      costruisciIndice();

      var stato = leggiFragment();
      if (stato) {
        impostaAperti(stato.aperti);
        if (stato.vista) {
          vx = stato.vista.x; vy = stato.vista.y; scala = stato.vista.s;
          applicaTrasforma();
        } else {
          centraRamo($("#n-1"));
        }
      } else {
        /* Vista d'apertura (§ 5.3): espanso il solo nodo 1. */
        impostaAperti(["1"]);
        centraRamo($("#n-1"));
      }

      /* Bersagli e gesti. */
      ALBERO.addEventListener("click", gestioneClick);
      Array.prototype.forEach.call(
        document.querySelectorAll("summary"),
        function (s) { s.addEventListener("keydown", gestioneTastoSummary); }
      );
      tuttiIDettagli().forEach(function (d) {
        d.addEventListener("toggle", gestioneToggleEsterno);
      });

      VISTA.addEventListener("pointerdown", giuPuntatore);
      VISTA.addEventListener("pointermove", muoviPuntatore);
      VISTA.addEventListener("pointerup", suPuntatore);
      VISTA.addEventListener("pointercancel", suPuntatore);
      VISTA.addEventListener("wheel", rotella, { passive: false });

      /* Lo scroll nativo non deve mai spostare la vista trasformata
         (guardia per "trova nella pagina", S-13). */
      VISTA.addEventListener("scroll", function () {
        VISTA.scrollLeft = 0; VISTA.scrollTop = 0;
      });

      $("#btn-zoom-piu").addEventListener("click", function () {
        zoomVerso(window.innerWidth / 2, window.innerHeight / 2, scala * 1.25);
      });
      $("#btn-zoom-meno").addEventListener("click", function () {
        zoomVerso(window.innerWidth / 2, window.innerHeight / 2, scala / 1.25);
      });
      $("#btn-ricerca").addEventListener("click", apriRicerca);
      $("#ricerca-chiudi").addEventListener("click", chiudiRicerca);
      RICAMPO.addEventListener("input", aggiornaRicerca);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", avvia);
  } else {
    avvia();
  }
})();
