/* =============================================================================
   struttura.js — tabella nodo → etichetta/titolo/file (script classico, § 5.8)

   ARTEFATTO DERIVATO — NON MODIFICARE A MANO.
   Fonte: Appendice A (etichette dei nodi e gerarchia) e Appendice B (codici V,
   titoli, nomi-file) di istruzioni-progetto.md; per i rami futuri,
   mappe/mappa-<ramo>.md (§ 6). Ogni modifica strutturale passa dall'Appendice
   in una sessione Claude Code e rigenera questo file (§ 5.2-bis).
   Allineamento verificato dal controllo d'integrità a tre vie
   Appendice A/B ↔ index.html ↔ struttura.js a ogni passata [T] (§ 6, DoD 13).

   Usi: breadcrumb delle slide (slide.js, § 5.7 — derivato dalla struttura,
   non scritto a mano); controlli d'integrità. Il genitore di un nodo si
   deriva dal numero (tutto meno l'ultimo segmento); il macro-argomento «●»
   è l'antenato 1.X (§ 5.7).
   ============================================================================= */
var STRUTTURA = {
  "1":                        { v: "V01", etichetta: "La Fisica",                    titolo: "La Fisica",                                              file: "1-la-fisica.html" },
  "1.1":                      { v: "V02", etichetta: "I fenomeni naturali",          titolo: "I fenomeni naturali",                                    file: "1-1-fenomeni-naturali.html", macro: true },
  "1.1.1":                    { v: "V03", etichetta: "Il metodo sperimentale",       titolo: "Il metodo sperimentale",                                 file: "1-1-1-metodo-sperimentale.html" },
  "1.1.2":                    { v: "V04", etichetta: "Misure",                       titolo: "Le misure",                                              file: "1-1-2-misure.html" },
  "1.1.2.1":                  { v: "V05", etichetta: "Notazione e rappresentazione", titolo: "Notazione e rappresentazione di una misura",             file: "1-1-2-1-notazione-e-rappresentazione.html" },
  "1.1.2.1.1":                { v: "V06", etichetta: "Multipli e sottomultipli",     titolo: "Multipli e sottomultipli",                               file: "1-1-2-1-1-multipli-e-sottomultipli.html" },
  "1.1.2.1.1.1":              { v: "V07", etichetta: "Equivalenze",                  titolo: "Le equivalenze",                                         file: "1-1-2-1-1-1-equivalenze.html" },
  "1.1.2.1.2":                { v: "V08", etichetta: "Notazione scientifica",        titolo: "La notazione scientifica",                               file: "1-1-2-1-2-notazione-scientifica.html" },
  "1.1.2.1.3":                { v: "V09", etichetta: "Ordine di grandezza",          titolo: "L'ordine di grandezza",                                  file: "1-1-2-1-3-ordine-di-grandezza.html" },
  "1.1.2.2":                  { v: "V10", etichetta: "Cifre significative",          titolo: "Le cifre significative",                                 file: "1-1-2-2-cifre-significative.html" },
  "1.1.2.3":                  { v: "V11", etichetta: "Tipologia",                    titolo: "Tipologia delle misure",                                 file: "1-1-2-3-tipologia.html" },
  "1.1.2.3.1":                { v: "V12", etichetta: "Dirette",                      titolo: "Le misure dirette",                                      file: "1-1-2-3-1-misure-dirette.html" },
  "1.1.2.3.1.1":              { v: "V13", etichetta: "Strumenti di misura",          titolo: "Gli strumenti di misura",                                file: "1-1-2-3-1-1-strumenti-di-misura.html" },
  "1.1.2.3.1.1.1":            { v: "V14", etichetta: "Caratteristiche fondamentali", titolo: "Le caratteristiche fondamentali degli strumenti di misura", file: "1-1-2-3-1-1-1-caratteristiche-fondamentali.html" },
  "1.1.2.3.1.2":              { v: "V15", etichetta: "Errori e incertezze",          titolo: "Le incertezze nelle misure",                             file: "1-1-2-3-1-2-incertezze.html" },
  "1.1.2.3.1.2.1":            { v: "V16", etichetta: "Tipi di errore",               titolo: "I tipi di errore",                                       file: "1-1-2-3-1-2-1-tipi-di-errore.html" },
  "1.1.2.3.1.2.2":            { v: "V17", etichetta: "Come si determinano",          titolo: "Come si determina l'incertezza",                         file: "1-1-2-3-1-2-2-come-si-determinano.html" },
  "1.1.2.3.2":                { v: "V18", etichetta: "Indirette",                    titolo: "Le misure indirette",                                    file: "1-1-2-3-2-misure-indirette.html" },
  "1.1.2.3.2.1":              { v: "V19", etichetta: "Come si propagano le incertezze", titolo: "Come si propagano le incertezze",                     file: "1-1-2-3-2-1-propagazione-incertezze.html" },
  "1.1.2.4":                  { v: "V20", etichetta: "Relazioni di proporzionalità", titolo: "Le relazioni di proporzionalità",                        file: "1-1-2-4-relazioni-di-proporzionalita.html" },
  "1.1.2.4.1":                { v: "V21", etichetta: "Diretta",                      titolo: "La proporzionalità diretta",                             file: "1-1-2-4-1-proporzionalita-diretta.html" },
  "1.1.2.4.2":                { v: "V22", etichetta: "Inversa",                      titolo: "La proporzionalità inversa",                             file: "1-1-2-4-2-proporzionalita-inversa.html" },
  "1.1.2.4.3":                { v: "V23", etichetta: "Quadratica diretta",           titolo: "La proporzionalità quadratica diretta",                  file: "1-1-2-4-3-proporzionalita-quadratica-diretta.html" },
  "1.1.2.5":                  { v: "V24", etichetta: "Grandezze fisiche",            titolo: "Le grandezze fisiche (tre criteri di classificazione)",  file: "1-1-2-5-grandezze-fisiche.html" },
  "1.1.2.5.1":                { v: "V25", etichetta: "Origine/definizione",          titolo: "Origine e definizione delle grandezze",                  file: "1-1-2-5-1-origine-e-definizione.html" },
  "1.1.2.5.1.1":              { v: "V26", etichetta: "Fondamentali",                 titolo: "Le grandezze fondamentali",                              file: "1-1-2-5-1-1-grandezze-fondamentali.html" },
  "1.1.2.5.1.2":              { v: "V27", etichetta: "Derivate",                     titolo: "Le grandezze derivate",                                  file: "1-1-2-5-1-2-grandezze-derivate.html" },
  "1.1.2.5.2":                { v: "V28", etichetta: "Natura matematica",            titolo: "La natura matematica delle grandezze",                   file: "1-1-2-5-2-natura-matematica.html" },
  "1.1.2.5.2.1":              { v: "V29", etichetta: "Scalari",                      titolo: "Le grandezze scalari",                                   file: "1-1-2-5-2-1-grandezze-scalari.html" },
  "1.1.2.5.2.2":              { v: "V30", etichetta: "Vettoriali",                   titolo: "Le grandezze vettoriali",                                file: "1-1-2-5-2-2-grandezze-vettoriali.html" },
  "1.1.2.5.2.2.1":            { v: "V31", etichetta: "Definizione",                  titolo: "La definizione di vettore",                              file: "1-1-2-5-2-2-1-definizione-di-vettore.html" },
  "1.1.2.5.2.2.2":            { v: "V32", etichetta: "Operazioni",                   titolo: "Le operazioni con i vettori",                            file: "1-1-2-5-2-2-2-operazioni-con-i-vettori.html" },
  "1.1.2.5.2.2.2.1":          { v: "V33", etichetta: "Somma",                        titolo: "La somma di vettori",                                    file: "1-1-2-5-2-2-2-1-somma-di-vettori.html" },
  "1.1.2.5.2.2.2.1.1":        { v: "V34", etichetta: "Matematicamente",              titolo: "La somma per componenti",                                file: "1-1-2-5-2-2-2-1-1-somma-matematicamente.html" },
  "1.1.2.5.2.2.2.1.2":        { v: "V35", etichetta: "Graficamente",                 titolo: "La somma grafica",                                       file: "1-1-2-5-2-2-2-1-2-somma-graficamente.html" },
  "1.1.2.5.2.2.2.1.2.1":      { v: "V36", etichetta: "Metodo punta-coda",            titolo: "Il metodo punta-coda",                                   file: "1-1-2-5-2-2-2-1-2-1-metodo-punta-coda.html" },
  "1.1.2.5.2.2.2.1.2.2":      { v: "V37", etichetta: "Metodo del parallelogramma",   titolo: "Il metodo del parallelogramma",                          file: "1-1-2-5-2-2-2-1-2-2-metodo-del-parallelogramma.html" },
  "1.1.2.5.2.2.2.2":          { v: "V38", etichetta: "Moltiplicazione",              titolo: "La moltiplicazione di vettori",                          file: "1-1-2-5-2-2-2-2-moltiplicazione.html" },
  "1.1.2.5.2.2.2.2.1":        { v: "V39", etichetta: "Per uno scalare",              titolo: "La moltiplicazione per uno scalare",                     file: "1-1-2-5-2-2-2-2-1-moltiplicazione-per-uno-scalare.html" },
  "1.1.2.5.2.2.2.2.2":        { v: "V40", etichetta: "Prodotto scalare",             titolo: "Il prodotto scalare",                                    file: "1-1-2-5-2-2-2-2-2-prodotto-scalare.html" },
  "1.1.2.5.2.2.2.2.3":        { v: "V41", etichetta: "Prodotto vettoriale",          titolo: "Il prodotto vettoriale",                                 file: "1-1-2-5-2-2-2-2-3-prodotto-vettoriale.html" },
  "1.1.2.5.2.2.3":            { v: "V42", etichetta: "Le forze",                     titolo: "Le forze: esempio di grandezze vettoriali",              file: "1-1-2-5-2-2-3-le-forze.html" },
  "1.1.2.5.2.2.3.1":          { v: "V43", etichetta: "Peso",                         titolo: "La forza peso",                                          file: "1-1-2-5-2-2-3-1-forza-peso.html" },
  "1.1.2.5.2.2.3.2":          { v: "V44", etichetta: "Elastica",                     titolo: "La forza elastica",                                      file: "1-1-2-5-2-2-3-2-forza-elastica.html" },
  "1.1.2.5.2.2.3.3":          { v: "V45", etichetta: "Attrito",                      titolo: "La forza di attrito",                                    file: "1-1-2-5-2-2-3-3-forza-di-attrito.html" },
  "1.1.2.5.3":                { v: "V46", etichetta: "Confrontabilità",              titolo: "La confrontabilità tra grandezze",                       file: "1-1-2-5-3-confrontabilita.html" },
  "1.1.2.5.3.1":              { v: "V47", etichetta: "Omogenee",                     titolo: "Le grandezze omogenee",                                  file: "1-1-2-5-3-1-grandezze-omogenee.html" },
  "1.1.2.5.3.2":              { v: "V48", etichetta: "Non omogenee",                 titolo: "Le grandezze non omogenee",                              file: "1-1-2-5-3-2-grandezze-non-omogenee.html" }
};
