/* =============================================================================
   slide.js — logica condivisa delle pagine di approfondimento (§ 5.7)
   Script classico (§ 5.8), nessuna dipendenza esterna, funziona da file://.
   Copre: rendering KaTeX (metodo e delimitatori di convenzioni.md, § 5.6),
   breadcrumb derivato dalla struttura (§ 5.7, DoD 14), chiusura «X» e link
   home/mappa con ripristino dello stato (regola del ricordare, § 5.3),
   avviso «non pronto» del pulsante «Esercizi» (§ 5.7).
   Richiede struttura.js caricato prima di questo file.
   ============================================================================= */
(function () {
  "use strict";

  /* Numero-nodo derivato dal nome-file (§ 5.4: slug prefissato dal numero di
     mappa con punti resi come trattini): i gruppi numerici iniziali dello slug.
     Es. "1-1-2-3-1-2-2-come-si-determinano.html" -> "1.1.2.3.1.2.2".
     Nessun numero scritto a mano dentro la pagina. */
  function numeroDalNomeFile() {
    var nome = decodeURIComponent(location.pathname.split("/").pop() || "");
    nome = nome.replace(/\.html?$/i, "");
    var parti = [];
    nome.split("-").some(function (t) {
      if (/^\d+$/.test(t)) { parti.push(t); return false; }
      return true; // primo token non numerico: fine del prefisso
    });
    return parti.length ? parti.join(".") : null;
  }

  /* Breadcrumb (§ 5.7, DoD 14): parte dal macro-argomento «●» (l'antenato
     1.X), mai «La Fisica»; al massimo 4 elementi («…» non conta); ultimi due
     antenati + nodo corrente in grassetto. Per il nodo 1 il breadcrumb è
     assente; per un macro-argomento è il solo suo nome in grassetto. */
  function costruisciBreadcrumb(nav, numero) {
    if (!window.STRUTTURA || !STRUTTURA[numero]) return; // integrità: DoD 13/14
    var parti = numero.split(".");
    nav.textContent = "";

    function aggiungi(testo, corrente) {
      var el = document.createElement(corrente ? "strong" : "span");
      el.textContent = testo;
      nav.appendChild(el);
    }
    function separatore() {
      var s = document.createElement("span");
      s.className = "breadcrumb-sep";
      s.textContent = "›";
      nav.appendChild(s);
    }

    if (parti.length === 1) { nav.hidden = true; return; }       // nodo 1: assente
    if (parti.length === 2) {                                     // macro-argomento
      aggiungi(STRUTTURA[numero].etichetta, true);
      return;
    }

    var macro = parti.slice(0, 2).join(".");
    var intermedi = [];                    // antenati tra macro e nodo corrente
    for (var i = 3; i < parti.length; i++) {
      intermedi.push(parti.slice(0, i).join("."));
    }
    aggiungi(STRUTTURA[macro] ? STRUTTURA[macro].etichetta : macro, false);
    if (intermedi.length > 2) {
      separatore();
      var eli = document.createElement("span");
      eli.className = "breadcrumb-elisione";
      eli.textContent = "…";
      nav.appendChild(eli);
      intermedi = intermedi.slice(-2);
    }
    intermedi.forEach(function (n) {
      separatore();
      aggiungi(STRUTTURA[n] ? STRUTTURA[n].etichetta : n, false);
    });
    separatore();
    aggiungi(STRUTTURA[numero].etichetta, true);
  }

  /* Avviso temporaneo (stesso pattern della mappa, § 5.7). */
  var timerAvviso = null;
  function mostraAvviso(msg) {
    var box = document.getElementById("avviso");
    if (!box) return;
    box.textContent = msg;
    box.hidden = false;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(function () { box.hidden = true; }, 1800);
  }

  /* Ritorno alla mappa nello stato in cui la si era lasciata (§ 5.3): la
     cronologia ripristina il fragment dell'indirizzo della mappa. Il link
     diretto resta il ripiego se la slide è stata aperta senza cronologia. */
  function indietro(e) {
    if (history.length > 1) {
      e.preventDefault();
      history.back();
    }
  }

  function avvia() {
    /* Rendering KaTeX (§ 5.6): metodo e delimitatori registrati in
       convenzioni.md, identici in ogni pagina. */
    if (window.renderMathInElement) {
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false
      });
    }

    var numero = numeroDalNomeFile();
    var nav = document.querySelector(".breadcrumb");
    if (nav && numero) costruisciBreadcrumb(nav, numero);

    var chiudi = document.querySelector(".chiudi-x");
    if (chiudi) chiudi.addEventListener("click", indietro);
    var mappa = document.querySelector(".collegamento-mappa");
    if (mappa) mappa.addEventListener("click", indietro);

    /* «Esercizi» non pronto (§ 5.7): mai un link attivo verso un file
       inesistente; avviso obbligatorio al tocco, oltre al colore attenuato. */
    var esercizi = document.querySelector(".collegamento-esercizi");
    if (esercizi && esercizi.classList.contains("non-pronto")) {
      esercizi.addEventListener("click", function (e) {
        e.preventDefault();
        mostraAvviso("Esercizi non ancora disponibili");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", avvia);
  } else {
    avvia();
  }
})();
