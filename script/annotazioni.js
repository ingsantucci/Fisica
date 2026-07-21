/* =============================================================================
   annotazioni.js — barra di annotazione (§ 5.9, v2.9)
   Script classico (§ 5.8), nessuna dipendenza, funziona da file://.

   - Barra a TRE pulsanti (Penna, Gomma, Evidenziatore) al centro del bordo
     destro, con triangoli «◂» per i sottomenu; nessun timer, nessuno
     strumento «mano».
   - Evidenziatore (§ 5.9, v2.9): strumento a sé, struttura identica alla
     penna, con sottomenu proprio (colore, spessore a intervallo più ampio,
     regolatore di trasparenza) e stato persistito a parte. La semitrasparenza
     è resa con l'attributo `opacity` sull'ELEMENTO path (non stroke-opacity
     né rgba): il tratto è rasterizzato una volta e reso trasparente in blocco,
     così l'auto-sovrapposizione dentro lo stesso tratto non scurisce.
   - Interfaccia fissa agganciata al viewport visivo (1:1 a ogni zoom).
   - Inchiostro vettoriale SVG: nitido a ogni zoom, mai bitmap.
   - Slide: strato ancorato al documento (scorre con la riga su cui è posto).
   - Rotazione del dispositivo: i tratti (effimeri) si cancellano su slide e
     mappa (§ 5.9 v2.9); niente ri-ancoraggio del riflusso.
   - Mappa: strato dentro #mondo (segue pan/zoom); ogni tratto è ancorato al
     NODO su cui è tracciato (identità + scostamento) e viene rispostato al
     riassestarsi del layout; se il ramo si chiude il segno esce dalla vista,
     se si riapre riappare. (Obiettivo pieno della scala § 5.9.)
   - Esclusione dei gesti per scenario (§ 5.9): su iPad decide il tipo di
     puntatore (pen disegna, touch naviga, palm-rejection: il touch non
     annota mai); durante un tratto attivo di penna i tocchi sono ignorati
     (micro-sospensione limitata al tratto, fallback pre-approvato).
     Su PC lo strumento attivo comanda il mouse; Ctrl tenuto = navigazione.
   - Persistiti tra le sessioni (localStorage, con fallback silenzioso):
     preset colore, preset attivo, spessore, modalità gomma.
   - Nulla viene salvato su disco: i tratti spariscono al ricaricamento.
   ============================================================================= */
(function () {
  "use strict";

  var SU_MAPPA = false;         // pagina mappa o pagina voce
  var MONDO = null;             // solo mappa
  var STRATO = null;            // svg dell'inchiostro
  var tratti = [];              // {punti, colore, spessore, el, anc}
  var trattoAttivo = null;      // {dati, pointerId, tipo}
  var rafAncore = 0;

  /* --- Stato degli strumenti (default § 5.9 / convenzioni.md) --- */
  var stato = {
    strumento: null,                      // null | "penna" | "gomma" | "evidenziatore"
    preset: ["#f4c400", "#d23c2a", "#1c2733"],  // giallo, rosso, nero
    presetAttivo: 1,                      // rosso di default
    spessore: 4,
    gommaModo: "pixel",                   // "pixel" | "oggetti"
    /* Evidenziatore (§ 5.9 v2.9): stato PROPRIO, indipendente dalla penna. */
    evidPreset: ["#f4c400", "#7ee081", "#5ec6f0"], // giallo, verde, azzurro
    evidPresetAttivo: 0,                  // giallo di default
    evidSpessore: 22,                     // spesso di default (range più ampio)
    evidOpacita: 0.4                      // semitrasparente di default
  };

  /* Intervallo dello spessore dell'evidenziatore: più ampio della penna
     (penna 1–14). E limiti dell'opacità del tratto (il sottomenu regola la
     TRASPARENZA, cioè 1 − opacità: cursore a destra = più trasparente). */
  var EVID_SP_MIN = 8, EVID_SP_MAX = 40;
  var EVID_OP_MIN = 0.12, EVID_OP_MAX = 0.6;

  /* --- Persistenza (ricordati tra le sessioni, § 5.9) --- */
  function caricaStato() {
    try {
      var p = JSON.parse(localStorage.getItem("annota-preset"));
      if (Array.isArray(p) && p.length === 3) stato.preset = p;
      var a = parseInt(localStorage.getItem("annota-preset-attivo"), 10);
      if (a >= 0 && a <= 2) stato.presetAttivo = a;
      var s = parseFloat(localStorage.getItem("annota-spessore"));
      if (s >= 1 && s <= 20) stato.spessore = s;
      var g = localStorage.getItem("annota-gomma-modo");
      if (g === "pixel" || g === "oggetti") stato.gommaModo = g;
      /* Evidenziatore: chiavi dedicate (§ 5.9 v2.9). */
      var ep = JSON.parse(localStorage.getItem("annota-evid-preset"));
      if (Array.isArray(ep) && ep.length === 3) stato.evidPreset = ep;
      var ea = parseInt(localStorage.getItem("annota-evid-preset-attivo"), 10);
      if (ea >= 0 && ea <= 2) stato.evidPresetAttivo = ea;
      var es = parseFloat(localStorage.getItem("annota-evid-spessore"));
      if (es >= EVID_SP_MIN && es <= EVID_SP_MAX) stato.evidSpessore = es;
      var eo = parseFloat(localStorage.getItem("annota-evid-opacita"));
      if (eo >= EVID_OP_MIN && eo <= EVID_OP_MAX) stato.evidOpacita = eo;
    } catch (e) { /* storage non disponibile da file://: si parte dai default */ }
  }
  function salvaStato() {
    try {
      localStorage.setItem("annota-preset", JSON.stringify(stato.preset));
      localStorage.setItem("annota-preset-attivo", String(stato.presetAttivo));
      localStorage.setItem("annota-spessore", String(stato.spessore));
      localStorage.setItem("annota-gomma-modo", stato.gommaModo);
      localStorage.setItem("annota-evid-preset", JSON.stringify(stato.evidPreset));
      localStorage.setItem("annota-evid-preset-attivo", String(stato.evidPresetAttivo));
      localStorage.setItem("annota-evid-spessore", String(stato.evidSpessore));
      localStorage.setItem("annota-evid-opacita", String(stato.evidOpacita));
    } catch (e) { /* idem: i default restano validi nella sessione */ }
  }

  /* Colore in uso dalla penna (usato anche dalla barra per il bordo del
     pulsante Penna e il colore libero). L'evidenziatore ha il suo. */
  function coloreAttivo() { return stato.preset[stato.presetAttivo]; }
  function coloreEvid() { return stato.evidPreset[stato.evidPresetAttivo]; }

  /* Proprietà visive del tratto secondo lo strumento attivo. Per la penna
     opacita = null (tratto pieno); per l'evidenziatore l'opacità va
     sull'ELEMENTO path (anti-chiazze, § 5.9 v2.9). */
  function trattoCorrente() {
    if (stato.strumento === "evidenziatore") {
      return { colore: coloreEvid(), spessore: stato.evidSpessore,
               opacita: stato.evidOpacita };
    }
    return { colore: coloreAttivo(), spessore: stato.spessore, opacita: null };
  }

  /* ==========================================================================
     Coordinate
     ========================================================================== */

  /* Mappa: da coordinate schermo a spazio-mondo (lo strato vive dentro il
     contenitore trasformato, quindi l'inchiostro segue pan e zoom da sé). */
  function versoSpazioDisegno(cx, cy) {
    if (SU_MAPPA) {
      var r = MONDO.getBoundingClientRect();
      var scala = MONDO.offsetWidth ? r.width / MONDO.offsetWidth : 1;
      return { x: (cx - r.left) / scala, y: (cy - r.top) / scala };
    }
    /* Slide: coordinate di documento (il tratto scorre con il contenuto). */
    return { x: cx + window.scrollX, y: cy + window.scrollY };
  }

  /* Posizione corrente di un elemento nello spazio-mondo (catena offset). */
  function posizioneMondo(el) {
    var x = 0, y = 0, n = el;
    while (n && n !== MONDO) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return n === MONDO ? { x: x, y: y } : null; // null: staccato o nascosto
  }

  /* ==========================================================================
     Tratti
     ========================================================================== */

  /* opacita: null → tratto pieno (penna); un numero → tratto evidenziatore,
     con `opacity` sull'ELEMENTO (non stroke-opacity/rgba): rasterizzato una
     volta e reso trasparente in blocco, l'auto-sovrapposizione nello stesso
     tratto non scurisce (§ 5.9 v2.9). Sulla mappa aggiornaAncore ricompone
     questo valore base con l'opacità dell'animazione del ramo. */
  function nuovoPath(colore, spessore, opacita) {
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("class", opacita != null
      ? "annota-tratto annota-tratto--evidenziatore" : "annota-tratto");
    p.setAttribute("stroke", colore);
    p.setAttribute("stroke-width", spessore);
    if (opacita != null) p.setAttribute("opacity", opacita);
    STRATO.appendChild(p);
    return p;
  }

  /* Il tracciato è reso come CURVA LISCIA, non come polilinea: la spezzata di
     segmenti diritti raccordati ad angolo si vedeva a spessore fine e a zoom
     alto (i punti, campionati in spazio-schermo, distano molto una volta
     ingranditi). Si interpolano i punti con Catmull-Rom convertito in Bézier
     cubiche (fattore 1/6, tangente = (P[i+1]−P[i−1])/6, estremi ripiegati su
     sé stessi). L'hit-testing della gomma resta sui punti grezzi (cancellaIn
     usa t.punti), quindi la resa liscia non lo tocca. */
  function disegnaPath(t) {
    var pts = t.punti, n = pts.length;
    if (n === 1) {
      /* Un tocco senza movimento resta un punto visibile (linecap round). */
      t.el.setAttribute("d",
        "M " + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1) + " l 0.01 0");
      return;
    }
    var d = "M " + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
    if (n === 2) {
      d += " L " + pts[1].x.toFixed(1) + " " + pts[1].y.toFixed(1);
      t.el.setAttribute("d", d);
      return;
    }
    for (var i = 0; i < n - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i],
          p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += " C " + c1x.toFixed(1) + " " + c1y.toFixed(1) + " " +
                   c2x.toFixed(1) + " " + c2y.toFixed(1) + " " +
                   p2.x.toFixed(1) + " " + p2.y.toFixed(1);
    }
    t.el.setAttribute("d", d);
  }

  function rimuoviTratto(t) {
    if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
    var i = tratti.indexOf(t);
    if (i >= 0) tratti.splice(i, 1);
  }

  /* Scatola visibile di un nodo [data-numero] (il riquadro del summary o
     della foglia). L'àncora misura LEI, mai il contenitore details: il
     details abbraccia l'intero sotto-albero e il suo angolo può restare
     fermo mentre la scatola — centrata sopra la riga dei figli — si sposta
     quando il ventaglio si allarga (era la causa del tratto «inchiodato»
     all'apertura/chiusura di altri nodi). */
  function scatolaDiNodo(nodo) {
    return nodo.querySelector(":scope > summary > .nodo-scatola") ||
           nodo.querySelector(":scope > .nodo-scatola");
  }

  /* Ancoraggio al nodo (mappa): il nodo sotto il punto di partenza, o il
     più vicino tra quelli visibili. Registra numero + posizione della
     scatola al momento del tracciamento: lo scostamento resta costante,
     la scatola si muove col layout. */
  function ancoraANodo(cx, cy) {
    /* Conta solo il CORPO del nodo (.nodo-scatola): il contenitore details
       copre l'intero sotto-albero e ancorerebbe i tratti profondi a un
       antenato che resta visibile a ramo chiuso. */
    var el = document.elementFromPoint(cx, cy);
    var scat = el && el.closest(".nodo-scatola");
    var nodo = scat ? scat.closest("[data-numero]") : null;
    if (!nodo) {
      var minD = Infinity;
      document.querySelectorAll("[data-numero]").forEach(function (c) {
        var s = c.querySelector(".nodo-scatola");
        /* Nei Chrome recenti i figli di un details chiuso conservano un box
           di layout: «visibile» va chiesto agli antenati, non a offsetParent. */
        if (!s || c.parentElement.closest("details:not([open])")) return;
        var r = s.getBoundingClientRect();
        var d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
        if (d < minD) { minD = d; nodo = c; }
      });
    }
    if (!nodo) return null;
    var pos = posizioneMondo(scatolaDiNodo(nodo) || nodo);
    if (!pos) return null;
    return { numero: nodo.dataset.numero, x0: pos.x, y0: pos.y };
  }

  /* Rispostamento dei tratti ancorati: gira con requestAnimationFrame solo
     quando sulla mappa esistono tratti; a riposo le letture sono a layout
     stabile (nessuna invalidazione: costo trascurabile). */
  function aggiornaAncore() {
    rafAncore = 0;
    if (!SU_MAPPA || tratti.length === 0) return;
    tratti.forEach(function (t) {
      if (!t.anc) return;
      var nodo = document.getElementById("n-" + t.anc.numero.replace(/\./g, "-"));
      /* Nodo dentro un ramo chiuso: nei Chrome recenti conserva un box di
         layout (content-visibility), quindi la visibilità si legge dagli
         antenati details, non dalla presenza del box. Il corpo del nodo
         resta visibile se a chiudersi è il nodo stesso (non un antenato). */
      var pos = nodo && !nodo.parentElement.closest("details:not([open])")
        ? posizioneMondo(scatolaDiNodo(nodo) || nodo) : null;
      if (!pos) {
        /* Ramo chiuso: il segno esce dalla vista; riappare alla riapertura. */
        t.el.setAttribute("visibility", "hidden");
        return;
      }
      t.el.removeAttribute("visibility");
      /* Sincronizzazione con l'animazione del ramo: se il nodo ancorato è
         dentro un .figli in apertura/chiusura, il tratto ne segue l'OPACITÀ,
         così inchiostro e nodo compaiono e spariscono insieme. Prima la sola
         visibilità booleana dipendeva dallo stato `open`, che scatta in
         anticipo: l'inchiostro era l'ultimo a sparire (in chiusura open resta
         true fino a fine animazione) e il primo ad apparire (in apertura open
         è messo true subito). closest(): il .figli in animazione è quello del
         nodo toggolato — antenato del nodo ancorato solo quando quest'ultimo è
         un discendente che collassa/si espande (l'unico caso in cui «il nodo
         sparisce/appare»). */
      /* Opacità base del tratto: piena per la penna (null), il valore
         dell'evidenziatore altrimenti. Durante l'animazione del ramo la si
         MOLTIPLICA per l'opacità del .figli, così la semitrasparenza
         dell'evidenziatore è preservata anche in apertura/chiusura (non
         azzerata né portata a 1). */
      var base = t.opacita != null ? t.opacita : 1;
      var figliAnim = nodo.closest(".figli.anima-dimensioni");
      if (figliAnim) {
        var fo = parseFloat(figliAnim.style.opacity || "1");
        t.el.setAttribute("opacity", String(base * fo));
      } else if (t.opacita != null) {
        t.el.setAttribute("opacity", String(t.opacita));
      } else {
        t.el.removeAttribute("opacity");
      }
      var dx = pos.x - t.anc.x0, dy = pos.y - t.anc.y0;
      if (dx || dy) {
        t.el.setAttribute("transform", "translate(" + dx + " " + dy + ")");
      } else {
        t.el.removeAttribute("transform");
      }
    });
    rafAncore = requestAnimationFrame(aggiornaAncore);
  }
  function avviaAncore() {
    if (SU_MAPPA && !rafAncore && tratti.length) {
      rafAncore = requestAnimationFrame(aggiornaAncore);
    }
  }

  /* ==========================================================================
     Gomma (§ 5.9): a pixel (porzione sotto la punta) o a oggetti (tratto
     intero). Nessun «cancella tutto».
     ========================================================================== */

  function cancellaIn(cx, cy) {
    var p = versoSpazioDisegno(cx, cy);
    var raggio = Math.max(10, stato.spessore * 2);
    tratti.slice().forEach(function (t) {
      /* I tratti ancorati sono traslati: si riporta la gomma nel loro
         sistema locale sottraendo la traslazione corrente. */
      var dx = 0, dy = 0;
      var tr = t.el.getAttribute("transform");
      if (tr) {
        var m = /translate\(([-\d.]+)[ ,]([-\d.]+)\)/.exec(tr);
        if (m) { dx = parseFloat(m[1]); dy = parseFloat(m[2]); }
      }
      var vicino = function (pt) {
        return Math.hypot(pt.x + dx - p.x, pt.y + dy - p.y) <= raggio;
      };
      if (!t.punti.some(vicino)) return;
      if (stato.gommaModo === "oggetti") { rimuoviTratto(t); return; }
      /* A pixel: si tolgono i punti sotto la punta e il tratto si spezza
         nei segmenti restanti. */
      var segmenti = [], corrente = [];
      t.punti.forEach(function (pt) {
        if (vicino(pt)) {
          if (corrente.length > 1) segmenti.push(corrente);
          corrente = [];
        } else {
          corrente.push(pt);
        }
      });
      if (corrente.length > 1) segmenti.push(corrente);
      rimuoviTratto(t);
      segmenti.forEach(function (seg) {
        /* I frammenti EREDITANO l'opacità/tipo evidenziatore, oltre a
           colore/spessore/ancora (§ 5.9 v2.9): spezzare un tratto
           evidenziatore lascia bande omogenee, non frammenti opachi. */
        var nt = {
          punti: seg, colore: t.colore, spessore: t.spessore, anc: t.anc,
          opacita: t.opacita,
          el: nuovoPath(t.colore, t.spessore, t.opacita)
        };
        if (tr) nt.el.setAttribute("transform", tr);
        disegnaPath(nt);
        tratti.push(nt);
      });
    });
  }

  /* ==========================================================================
     Gesti (§ 5.9) — capture: lo strato di disegno decide PRIMA della mappa
     ========================================================================== */

  function bersaglioInterfaccia(e) {
    return e.target.closest &&
      e.target.closest(".annota, .chiudi-x, #comandi, #ricerca-barra, .collegamenti");
  }

  /* Il puntatore disegna? pen: sempre (se c'è uno strumento attivo);
     touch: mai (il dito naviga, palm-rejection); mouse: se non è tenuto
     Ctrl (tasto modificatore = navigazione, scenario PC). */
  function puntatoreDisegna(e) {
    if (!stato.strumento) return false;
    if (e.pointerType === "pen") return true;
    if (e.pointerType === "mouse") return e.button === 0 && !e.ctrlKey;
    return false;
  }

  function giuDisegno(e) {
    /* Una nuova pressione è un gesto nuovo: la finestra che inghiotte il
       click residuo del tratto appena concluso si azzera qui, così non
       mangia mai un tocco legittimo dato subito dopo. */
    clickDiDisegnoFinoA = 0;
    if (bersaglioInterfaccia(e)) return;
    /* Micro-sospensione nel tratto (fallback pre-approvato § 5.9): mentre
       la penna scrive, i tocchi di dita/palmo non arrivano alla mappa. */
    if (trattoAttivo && e.pointerType === "touch") {
      e.stopPropagation(); e.preventDefault();
      return;
    }
    if (!puntatoreDisegna(e) || trattoAttivo) return;
    e.stopPropagation();
    e.preventDefault();
    chiudiTendine(); /* si scrive/cancella: la barra si riduce ai tre pulsanti */
    if (stato.strumento === "gomma") {
      trattoAttivo = { gomma: true, pointerId: e.pointerId,
                       gx: e.clientX, gy: e.clientY };
      cancellaIn(e.clientX, e.clientY);
      return;
    }
    var p = versoSpazioDisegno(e.clientX, e.clientY);
    var tc = trattoCorrente();  /* penna o evidenziatore, con le sue proprietà */
    var t = {
      punti: [p],
      colore: tc.colore,
      spessore: tc.spessore,
      opacita: tc.opacita,
      anc: SU_MAPPA ? ancoraANodo(e.clientX, e.clientY) : null,
      el: nuovoPath(tc.colore, tc.spessore, tc.opacita)
    };
    disegnaPath(t);
    tratti.push(t);
    trattoAttivo = { dati: t, pointerId: e.pointerId };
  }

  function muoviDisegno(e) {
    if (!trattoAttivo) return;
    if (e.pointerId !== trattoAttivo.pointerId) {
      if (e.pointerType === "touch") { e.stopPropagation(); e.preventDefault(); }
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    if (trattoAttivo.gomma) {
      /* La mano veloce salta molti pixel tra un evento e l'altro: si
         campiona lungo il segmento, così la gomma non «buca» il gesto. */
      var gdx = e.clientX - trattoAttivo.gx;
      var gdy = e.clientY - trattoAttivo.gy;
      var passi = Math.max(1, Math.ceil(Math.hypot(gdx, gdy) / 6));
      for (var i = 1; i <= passi; i++) {
        cancellaIn(trattoAttivo.gx + gdx * i / passi,
                   trattoAttivo.gy + gdy * i / passi);
      }
      trattoAttivo.gx = e.clientX;
      trattoAttivo.gy = e.clientY;
      return;
    }
    var t = trattoAttivo.dati;
    var p = versoSpazioDisegno(e.clientX, e.clientY);
    var u = t.punti[t.punti.length - 1];
    if (Math.hypot(p.x - u.x, p.y - u.y) < 1.2) return;
    t.punti.push(p);
    disegnaPath(t);
  }

  function suDisegno(e) {
    if (!trattoAttivo || e.pointerId !== trattoAttivo.pointerId) return;
    e.stopPropagation();
    /* Annullare il pointerdown NON sopprime il click sintetico di fine
       gesto: senza questa finestra, un tratto terminato sopra un nodo con
       slide aprirebbe la slide a metà annotazione (§ 5.9: a strumento
       attivo l'apertura dei nodi è sospesa). */
    clickDiDisegnoFinoA = Date.now() + 350;
    trattoAttivo = null;
    avviaAncore();
  }

  var clickDiDisegnoFinoA = 0;
  function inghiottiClickDisegno(e) {
    if (Date.now() < clickDiDisegnoFinoA && !bersaglioInterfaccia(e)) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  /* Safari/iPadOS: il gesto di scroll della Pencil sulle slide non passa dai
     pointer events; si intercetta il touch «stylus» (touch-action resta
     libero per le dita). I bersagli d'interfaccia sono ESENTI: annullare il
     touchstart sopprimerebbe il click sintetico e i pulsanti diventerebbero
     sordi alla Pencil (« tutti i pulsanti azionabili con dito e penna, in
     ogni momento»). Da confermare sul dispositivo reale (colonna B). */
  function bloccaScrollStilo(e) {
    if (!stato.strumento) return;
    if (bersaglioInterfaccia(e)) return;
    var tt = e.touches && e.touches[0] && e.touches[0].touchType;
    if (tt === "stylus") e.preventDefault();
  }

  /* ==========================================================================
     Barra (DOM generato qui; aspetto in stile.css) — § 5.9 v2.9.
     A riposo: tre pulsanti trasparenti — Penna, Gomma, Evidenziatore — al
     centro del bordo destro. A sinistra di ciascuno un triangolo «◂» che
     apre/chiude il sottomenu dello strumento (colore/spessore; tipo di gomma;
     colore/spessore/trasparenza dell'evidenziatore). Nessun
     timer: i sottomenu si chiudono ricliccando il triangolo o da soli al
     primo tratto/cancellatura. Nessuno strumento «mano»: il riclic sul
     pulsante evidenziato spegne lo strumento e si torna a navigare.
     Ogni scelta in un sottomenu attiva lo strumento di quel sottomenu
     (attivazione intelligente).
     ========================================================================== */

  var UI = {};

  function el(tag, cls, testo) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (testo) n.textContent = testo;
    return n;
  }

  /* La barra si riduce ai tre pulsanti: chiamata al primo tratto/cancellatura
     e dal riclic sui triangoli (mai a tempo). */
  function chiudiTendine() {
    if (!UI.tendPenna) return;
    if (UI.tendPenna.hidden && UI.tendGomma.hidden && UI.tendEvid.hidden) return;
    UI.tendPenna.hidden = true;
    UI.tendGomma.hidden = true;
    UI.tendEvid.hidden = true;
    aggiornaBarra();
  }

  function attivaStrumento(nome) {
    stato.strumento = stato.strumento === nome ? null : nome;
    aggiornaBarra();
  }

  function costruisciBarra() {
    var box = el("div", "annota");
    box.id = "annota";

    /* --- Sottomenu della penna: preset colore, colore libero, spessore.
       Ogni scelta attiva la penna (attivazione intelligente, § 5.9). --- */
    UI.tendPenna = el("div", "annota-tendina");
    UI.tendPenna.hidden = true;
    var rigaPreset = el("div", "annota-preset-riga");
    UI.preset = [];
    stato.preset.forEach(function (c, i) {
      var b = el("button", "annota-preset");
      b.type = "button";
      b.setAttribute("aria-label", "Colore " + (i + 1));
      b.style.background = c;
      b.addEventListener("click", function () {
        stato.presetAttivo = i;
        stato.strumento = "penna";
        salvaStato();
        aggiornaBarra();
      });
      UI.preset.push(b);
      rigaPreset.appendChild(b);
    });
    UI.libero = document.createElement("input");
    UI.libero.type = "color";
    UI.libero.setAttribute("aria-label", "Colore libero (sostituisce il preset attivo)");
    UI.libero.addEventListener("input", function () {
      stato.preset[stato.presetAttivo] = UI.libero.value;
      stato.strumento = "penna";
      salvaStato();
      aggiornaBarra();
    });
    rigaPreset.appendChild(UI.libero);
    UI.tendPenna.appendChild(rigaPreset);
    var etichettaSp = el("label", null, "Spessore");
    UI.spessore = document.createElement("input");
    UI.spessore.type = "range";
    UI.spessore.min = "1";
    UI.spessore.max = "14";
    UI.spessore.step = "1";
    UI.spessore.setAttribute("aria-label", "Spessore della penna");
    UI.spessore.addEventListener("input", function () {
      stato.spessore = parseFloat(UI.spessore.value);
      stato.strumento = "penna";
      salvaStato();
      aggiornaBarra();
    });
    etichettaSp.appendChild(UI.spessore);
    UI.tendPenna.appendChild(etichettaSp);

    /* --- Sottomenu della gomma: modalità. La scelta attiva la gomma. --- */
    UI.tendGomma = el("div", "annota-tendina");
    UI.tendGomma.hidden = true;
    UI.gommaPixel = el("button", "annota-modo", "A pixel — cancella sotto la punta");
    UI.gommaOggetti = el("button", "annota-modo", "A oggetti — cancella il tratto intero");
    [UI.gommaPixel, UI.gommaOggetti].forEach(function (b) { b.type = "button"; });
    UI.gommaPixel.addEventListener("click", function () {
      stato.gommaModo = "pixel";
      stato.strumento = "gomma";
      salvaStato();
      aggiornaBarra();
    });
    UI.gommaOggetti.addEventListener("click", function () {
      stato.gommaModo = "oggetti";
      stato.strumento = "gomma";
      salvaStato();
      aggiornaBarra();
    });
    UI.tendGomma.appendChild(UI.gommaPixel);
    UI.tendGomma.appendChild(UI.gommaOggetti);

    /* --- Sottomenu dell'evidenziatore (§ 5.9 v2.9): come la penna
       (preset colore + colore libero + spessore, con intervallo più ampio),
       più un regolatore di TRASPARENZA sotto lo spessore. Ogni scelta attiva
       l'evidenziatore (attivazione intelligente). --- */
    UI.tendEvid = el("div", "annota-tendina");
    UI.tendEvid.hidden = true;
    var rigaEvid = el("div", "annota-preset-riga");
    UI.evidPreset = [];
    stato.evidPreset.forEach(function (c, i) {
      var b = el("button", "annota-preset");
      b.type = "button";
      b.setAttribute("aria-label", "Colore evidenziatore " + (i + 1));
      b.style.background = c;
      b.addEventListener("click", function () {
        stato.evidPresetAttivo = i;
        stato.strumento = "evidenziatore";
        salvaStato();
        aggiornaBarra();
      });
      UI.evidPreset.push(b);
      rigaEvid.appendChild(b);
    });
    UI.evidLibero = document.createElement("input");
    UI.evidLibero.type = "color";
    UI.evidLibero.setAttribute("aria-label",
      "Colore libero dell'evidenziatore (sostituisce il preset attivo)");
    UI.evidLibero.addEventListener("input", function () {
      stato.evidPreset[stato.evidPresetAttivo] = UI.evidLibero.value;
      stato.strumento = "evidenziatore";
      salvaStato();
      aggiornaBarra();
    });
    rigaEvid.appendChild(UI.evidLibero);
    UI.tendEvid.appendChild(rigaEvid);

    var etichettaEvidSp = el("label", null, "Spessore");
    UI.evidSpessore = document.createElement("input");
    UI.evidSpessore.type = "range";
    UI.evidSpessore.min = String(EVID_SP_MIN);
    UI.evidSpessore.max = String(EVID_SP_MAX);
    UI.evidSpessore.step = "1";
    UI.evidSpessore.setAttribute("aria-label", "Spessore dell'evidenziatore");
    UI.evidSpessore.addEventListener("input", function () {
      stato.evidSpessore = parseFloat(UI.evidSpessore.value);
      stato.strumento = "evidenziatore";
      salvaStato();
      aggiornaBarra();
    });
    etichettaEvidSp.appendChild(UI.evidSpessore);
    UI.tendEvid.appendChild(etichettaEvidSp);

    /* Cursore della TRASPARENZA: value = 1 − opacità (a destra = più
       trasparente). L'opacità così scelta pilota l'attributo `opacity`. */
    var etichettaEvidOp = el("label", null, "Trasparenza");
    UI.evidOpacita = document.createElement("input");
    UI.evidOpacita.type = "range";
    UI.evidOpacita.min = (1 - EVID_OP_MAX).toFixed(2);
    UI.evidOpacita.max = (1 - EVID_OP_MIN).toFixed(2);
    UI.evidOpacita.step = "0.04";
    UI.evidOpacita.setAttribute("aria-label", "Trasparenza dell'evidenziatore");
    UI.evidOpacita.addEventListener("input", function () {
      /* Arrotondato: 1 − 0.8 in virgola mobile darebbe 0.19999… */
      stato.evidOpacita = Math.round((1 - parseFloat(UI.evidOpacita.value)) * 100) / 100;
      stato.strumento = "evidenziatore";
      salvaStato();
      aggiornaBarra();
    });
    etichettaEvidOp.appendChild(UI.evidOpacita);
    UI.tendEvid.appendChild(etichettaEvidOp);

    /* --- Pulsanti strumento: attivazione istantanea con le ultime
       impostazioni; riclic sul pulsante evidenziato = spegni. --- */
    UI.btnPenna = el("button", "annota-strumento", "✎");
    UI.btnPenna.setAttribute("aria-label", "Penna");
    UI.btnPenna.addEventListener("click", function () { attivaStrumento("penna"); });

    UI.btnGomma = el("button", "annota-strumento", "⌫");
    UI.btnGomma.setAttribute("aria-label", "Gomma");
    UI.btnGomma.addEventListener("click", function () { attivaStrumento("gomma"); });

    /* Il glifo «▬» dell'evidenziatore prende il colore dell'evidenziatore
       (impostato in aggiornaBarra): il pulsante è già un campione di colore. */
    UI.btnEvid = el("button", "annota-strumento annota-strumento--evidenziatore", "▬");
    UI.btnEvid.setAttribute("aria-label", "Evidenziatore");
    UI.btnEvid.addEventListener("click", function () { attivaStrumento("evidenziatore"); });

    /* --- Triangoli «◂»: apertura/chiusura manuale del sottomenu; aprire
       l'uno chiude l'altro. --- */
    UI.frecciaPenna = el("button", "annota-freccia", "◂");
    UI.frecciaPenna.setAttribute("aria-label", "Impostazioni della penna");
    UI.frecciaPenna.addEventListener("click", function () {
      UI.tendPenna.hidden = !UI.tendPenna.hidden;
      UI.tendGomma.hidden = true;
      UI.tendEvid.hidden = true;
      aggiornaBarra();
    });
    UI.frecciaGomma = el("button", "annota-freccia", "◂");
    UI.frecciaGomma.setAttribute("aria-label", "Impostazioni della gomma");
    UI.frecciaGomma.addEventListener("click", function () {
      UI.tendGomma.hidden = !UI.tendGomma.hidden;
      UI.tendPenna.hidden = true;
      UI.tendEvid.hidden = true;
      aggiornaBarra();
    });
    UI.frecciaEvid = el("button", "annota-freccia", "◂");
    UI.frecciaEvid.setAttribute("aria-label", "Impostazioni dell'evidenziatore");
    UI.frecciaEvid.addEventListener("click", function () {
      UI.tendEvid.hidden = !UI.tendEvid.hidden;
      UI.tendPenna.hidden = true;
      UI.tendGomma.hidden = true;
      aggiornaBarra();
    });

    [UI.btnPenna, UI.btnGomma, UI.btnEvid,
     UI.frecciaPenna, UI.frecciaGomma, UI.frecciaEvid]
      .forEach(function (b) { b.type = "button"; });

    /* --- Due righe: [sottomenu] [◂] [strumento], allineate a destra. --- */
    function riga(tendina, freccia, strumento) {
      var r = el("div", "annota-riga");
      r.appendChild(tendina);
      r.appendChild(freccia);
      r.appendChild(strumento);
      return r;
    }
    box.appendChild(riga(UI.tendPenna, UI.frecciaPenna, UI.btnPenna));
    box.appendChild(riga(UI.tendGomma, UI.frecciaGomma, UI.btnGomma));
    box.appendChild(riga(UI.tendEvid, UI.frecciaEvid, UI.btnEvid));
    (ANCORA || document.body).appendChild(box);

    aggiornaBarra();
  }

  function aggiornaBarra() {
    UI.preset.forEach(function (b, i) {
      b.style.background = stato.preset[i];
      b.classList.toggle("attivo", i === stato.presetAttivo);
    });
    UI.libero.value = coloreAttivo();
    UI.spessore.value = String(stato.spessore);
    /* Evidenziatore: preset, colore libero, spessore, e trasparenza (value =
       1 − opacità). */
    UI.evidPreset.forEach(function (b, i) {
      b.style.background = stato.evidPreset[i];
      b.classList.toggle("attivo", i === stato.evidPresetAttivo);
    });
    UI.evidLibero.value = coloreEvid();
    UI.evidSpessore.value = String(stato.evidSpessore);
    UI.evidOpacita.value = (1 - stato.evidOpacita).toFixed(2);
    UI.btnPenna.classList.toggle("selezionato", stato.strumento === "penna");
    UI.btnGomma.classList.toggle("selezionato", stato.strumento === "gomma");
    UI.btnEvid.classList.toggle("selezionato", stato.strumento === "evidenziatore");
    UI.gommaPixel.classList.toggle("selezionato", stato.gommaModo === "pixel");
    UI.gommaOggetti.classList.toggle("selezionato", stato.gommaModo === "oggetti");
    /* Il bordo della penna mostra sempre l'ultimo colore in uso; il pulsante
       dell'evidenziatore (bordo + glifo) mostra il suo colore. */
    UI.btnPenna.style.borderColor = coloreAttivo();
    UI.btnEvid.style.borderColor = coloreEvid();
    UI.btnEvid.style.color = coloreEvid();
    UI.frecciaPenna.classList.toggle("aperta", !UI.tendPenna.hidden);
    UI.frecciaGomma.classList.toggle("aperta", !UI.tendGomma.hidden);
    UI.frecciaEvid.classList.toggle("aperta", !UI.tendEvid.hidden);
    UI.frecciaPenna.setAttribute("aria-expanded", String(!UI.tendPenna.hidden));
    UI.frecciaGomma.setAttribute("aria-expanded", String(!UI.tendGomma.hidden));
    UI.frecciaEvid.setAttribute("aria-expanded", String(!UI.tendEvid.hidden));
    document.body.classList.toggle("annota-penna", stato.strumento === "penna");
    document.body.classList.toggle("annota-gomma", stato.strumento === "gomma");
    document.body.classList.toggle("annota-evidenziatore",
      stato.strumento === "evidenziatore");
  }

  /* ==========================================================================
     Interfaccia agganciata al viewport visivo — «X», barra, comandi e avvisi
     restano fissi, 1:1 e dentro l'area visibile a qualunque zoom: pinch
     nativo (visual viewport, iPad/Safari e Chrome) e zoom di pagina del
     browser su PC (letto da devicePixelRatio). Il riferimento 1:1 è la
     taglia al caricamento della pagina. Gli elementi fissi vengono spostati
     in un contenitore la cui trasformazione (traslazione sull'offset del
     visual viewport + scala inversa) li riporta esattamente sull'area
     visibile: al loro interno «position: fixed» equivale per costruzione a
     «fisso rispetto a ciò che si vede». Stessa impostazione della mappa:
     i controlli vivono fuori da ciò che si trasforma.
     ========================================================================== */

  var ANCORA = null;
  var dprBase = 1;
  var rafAncoraggio = 0;

  function aggiornaAncoraggio() {
    rafAncoraggio = 0;
    if (!ANCORA) return;
    var vv = window.visualViewport;
    var zrel = (window.devicePixelRatio || dprBase) / dprBase;
    var s = (vv ? vv.scale : 1) * zrel;
    /* Il contenitore copre il layout viewport (misura compensata dello zoom
       di pagina: clientWidth cala di quanto zrel cresce, il prodotto resta
       la taglia al caricamento); la trasformazione lo posa sull'area
       visibile e i figli conservano posizione e taglia apparente. */
    ANCORA.style.width = (document.documentElement.clientWidth * zrel) + "px";
    ANCORA.style.height = (document.documentElement.clientHeight * zrel) + "px";
    ANCORA.style.transform =
      "translate(" + (vv ? vv.offsetLeft : 0) + "px," +
      (vv ? vv.offsetTop : 0) + "px) scale(" + (1 / s) + ")";
  }

  function pianificaAncoraggio() {
    if (!rafAncoraggio) rafAncoraggio = requestAnimationFrame(aggiornaAncoraggio);
  }

  /* Cancellazione dei tratti alla rotazione del dispositivo (§ 5.9 v2.9): i
     tratti sono effimeri (già spariscono al ricaricamento) e alla rotazione
     si azzerano su slide e mappa — niente ri-ancoraggio del riflusso. La
     rotazione è l'inversione dell'orientamento del viewport di LAYOUT
     (innerWidth/innerHeight): il pinch-zoom muove solo il viewport visivo,
     quindi non cancella. */
  var orientamento = null;
  function orientamentoCorrente() {
    return (window.innerWidth >= window.innerHeight) ? "L" : "P";
  }
  function cancellaTutti() {
    trattoAttivo = null;
    tratti.forEach(function (t) {
      if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
    });
    tratti.length = 0;
    if (rafAncore) { cancelAnimationFrame(rafAncore); rafAncore = 0; }
  }
  function verificaRotazione() {
    var o = orientamentoCorrente();
    if (orientamento === null) { orientamento = o; return; }
    if (o !== orientamento) { orientamento = o; cancellaTutti(); }
  }

  function creaAncoraggio() {
    ANCORA = el("div");
    ANCORA.id = "ancora-interfaccia";
    /* Elementi fissi esistenti nella pagina (la barra vi si aggiunge da
       costruisciBarra): mappa e slide hanno inventari diversi. */
    var selettori = SU_MAPPA
      ? ["#comandi", "#ricerca", "#avviso"]
      : [".chiudi-x", "#avviso"];
    selettori.forEach(function (sel) {
      var n = document.querySelector(sel);
      if (n) ANCORA.appendChild(n);
    });
    document.body.appendChild(ANCORA);
    dprBase = window.devicePixelRatio || 1;
    orientamento = orientamentoCorrente();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", pianificaAncoraggio);
      window.visualViewport.addEventListener("scroll", pianificaAncoraggio);
    }
    window.addEventListener("resize", pianificaAncoraggio);
    /* Rotazione del dispositivo → i tratti effimeri si cancellano (§ 5.9 v2.9). */
    window.addEventListener("resize", verificaRotazione);
    window.addEventListener("orientationchange", verificaRotazione);
    aggiornaAncoraggio();
  }

  /* ==========================================================================
     Avvio
     ========================================================================== */

  function creaStrato() {
    STRATO = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    STRATO.setAttribute("aria-hidden", "true");
    if (SU_MAPPA) {
      STRATO.id = "inchiostro-mappa";
      MONDO.appendChild(STRATO);
    } else {
      /* Strato a misura zero (vedi stile.css): i tratti vivono in coordinate
         di documento e restano visibili per overflow, e lo strato non può
         mai produrre scroll spurio — nessuna misura da aggiornare alla
         rotazione (chiude il sospeso «dimensionato solo al caricamento»). */
      STRATO.id = "inchiostro-slide";
      document.body.appendChild(STRATO);
    }
  }

  function avvia() {
    SU_MAPPA = document.body.classList.contains("pagina-mappa");
    if (SU_MAPPA) {
      MONDO = document.getElementById("mondo");
      if (!MONDO) return;
    }
    caricaStato();
    creaStrato();
    creaAncoraggio();
    costruisciBarra();

    /* Capture: il disegno decide prima dei gesti della mappa (pan/zoom) e
       dello scroll della slide; senza strumento attivo non intercetta nulla. */
    document.addEventListener("pointerdown", giuDisegno, true);
    document.addEventListener("pointermove", muoviDisegno, true);
    document.addEventListener("pointerup", suDisegno, true);
    document.addEventListener("pointercancel", suDisegno, true);
    document.addEventListener("click", inghiottiClickDisegno, true);
    document.addEventListener("touchstart", bloccaScrollStilo,
      { capture: true, passive: false });
    document.addEventListener("touchmove", bloccaScrollStilo,
      { capture: true, passive: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", avvia);
  } else {
    avvia();
  }
})();
