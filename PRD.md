# Product Requirements Document (PRD)
## WebP Converter App (Browser-Based)

## 1. Vision
Realizzare una web app leggera che consenta agli utenti di:
- caricare fino a **10 immagini** per volta;
- convertirle in formato WebP con controllo qualità;
- scaricare i file convertiti singolarmente o in un archivio ZIP;
- mantenere tutto il processo lato browser, senza backend di conversione.

Obiettivo: conversione e compressione rapida, privacy-first, UX semplice e moderna per utenti non tecnici.

## 2. Target Users
Utenti non tecnici che:
- devono convertire immagini in WebP rapidamente;
- devono ridurre in modo semplice il peso delle immagini prima della pubblicazione sui siti web;
- operano in ambienti enterprise con policy restrittive;
- non vogliono installare software locale;
- desiderano un'interfaccia chiara e gradevole.

## 3. Scope MVP
### 3.1 In Scope
- Upload drag & drop + file picker.
- Fino a 10 file per batch.
- Formati input: JPEG, PNG, WebP.
- Slider qualità WebP.
- Conversione client-side via WASM in Web Worker.
- Preview output WebP.
- Download singolo e download ZIP.
- Error handling chiaro.

### 3.2 Out of Scope (MVP)
- Resize/crop avanzato.
- Batch multipli concorrenti.
- AVIF/WebP2.
- Editing metadata avanzato.

## 4. Core Features
### 4.1 Upload e selezione file
- Drag & drop area.
- File picker multiplo.
- Validazione immediata:
  - max 10 file;
  - tipi supportati;
  - dimensione massima per file;
  - limite dimensione batch.
- Thumbnail grid con nome file, tipo, peso.

### 4.2 Conversione WebAssembly
- Conversione via libwebp compilato in WASM.
- Esecuzione in **Web Worker** per evitare blocchi UI.
- Coda seriale per file (1 conversione alla volta nel worker) per stabilita memoria.
- Quality slider da 50 a 100 (default: 80).

### 4.3 Risultati e download
- Preview output WebP.
- Download file singolo.
- Download all tramite ZIP (JSZip).
- Indicatore di avanzamento semplice:
  - `file completati / file totali` (es. `1/10`);
  - timer trascorso dall'inizio elaborazione batch (mm:ss).
- Stato per file:
  - queued;
  - converting;
  - done;
  - failed.

## 5. Non-Functional Requirements
### 5.1 Performance & Memory
- Nessun carico server: conversione locale.
- Budget memoria:
  - max 10 file per batch;
  - max **15 MB** per file input;
  - max **50 MP** (megapixel) per immagine;
  - max **120 MP** totale batch.
- Rilascio risorse immediato dopo conversione (revoke object URL non usati).

### 5.2 Usability
- UI responsive desktop/tablet.
- Messaggi d'errore leggibili e azionabili.
- Empty state e stati intermedi chiari.

### 5.3 Security & Privacy
- Nessun upload file verso backend.
- Nessuna persistenza obbligatoria lato server.
- Analytics opzionali, anonimi e disattivabili.

### 5.4 Accessibility
- Navigazione tastiera completa.
- Focus states visibili.
- Label e ARIA per slider, indicatore avanzamento, error modal.
- Contrasto minimo WCAG AA.

## 6. Technical Decisions (Open Questions Risolte)
### 6.1 Binding WASM consigliato
- **Scelta MVP:** `webp-wasm` (wrapper JS + binary WASM) o build custom Emscripten di libwebp.
- **Decisione implementativa:** iniziare con wrapper stabile (`webp-wasm`) per ridurre time-to-market; fallback a build custom se servono opzioni encoder avanzate.

### 6.2 Preview quality before download
- **Si**, preview post-conversione nel grid risultati (non confronto side-by-side nell'MVP).

### 6.3 Limiti dimensione file
- **10 file max**.
- **15 MB per file** hard limit.
- Limiti megapixel per mitigare OOM: 50 MP per file / 120 MP batch.

### 6.4 EXIF e metadata
- Policy MVP: preservare orientamento visivo corretto in output.
- Metadata EXIF non garantiti in output WebP (documentato chiaramente in UI/help).

## 7. Conversion Pipeline (Browser Side)
Upload -> Validazione -> Decode immagine -> passaggio dati al Worker WASM -> encode WebP -> Blob output -> preview + memoria in-app -> (opzionale) ZIP JSZip -> download.

## 8. Detailed User Flows
### Flow A: Upload & Convert
1. L'utente apre la pagina.
2. Trascina o seleziona file (max 10).
3. Il sistema valida file e mostra thumbnail.
4. L'utente imposta qualità (50-100).
5. Clicca "Converti".
6. Il worker converte in coda.
7. Il sistema mostra indicatore `n/5`, timer elapsed e stati per file.
8. L'utente scarica file singoli o ZIP.

### Flow B: Error handling
1. L'utente carica file non validi o oltre limite.
2. Il sistema blocca i file invalidi senza interrompere i validi.
3. UI mostra errore con causa e azione consigliata.

## 9. Error Cases da Gestire
- Formato non supportato (solo JPG/JPEG, PNG, WebP input).
- Più di 10 file.
- File oltre 15 MB.
- Immagine oltre limite megapixel.
- Conversione fallita (WASM/memoria/corruzione file).
- Download URL non disponibile.
- ZIP generation failure.

Ogni errore deve mostrare:
- titolo breve;
- descrizione chiara;
- azione suggerita (es. riduci dimensione, riprova, rimuovi file).

## 10. UI/Design Guide (Tailwind)
### 10.1 Branding
- Primary: `#4A90E2`
- Accent: `#E94E77`
- Neutral: grigi Tailwind `100-900`

### 10.2 Components
- Dropzone card.
- Thumbnail cards (input/output).
- Primary/secondary buttons.
- Slider con valore numerico live.
- Indicatore batch `n/5` + timer elapsed.
- Modal errori.
- Toast di conferma download.

### 10.3 Responsive
- Desktop: grid 3-4 colonne.
- Tablet: grid 2 colonne.
- Mobile (best effort MVP): 1 colonna, CTA full width.

## 11. Architecture
- Frontend: HTML + Tailwind + Alpine.js (o Vanilla JS modulare).
- Build: Vite.
- Conversion engine: WASM libwebp in Web Worker.
- ZIP: JSZip.
- No backend richiesto.

## 12. Milestones & Timeline
- Day 1: setup Vite + Tailwind + scaffold worker.
- Day 2: upload UX + validazioni + thumbnails.
- Day 3: conversione WASM + indicatore `n/5` + timer stati.
- Day 4: download singolo + ZIP.
- Day 5: error UX + accessibilita + test cross-browser.
- Day 6: deploy static + docs (Opalstack) + QA pass.

## 13. Deliverables
- Codice sorgente app frontend.
- Worker WASM conversion.
- Config build/deploy static.
- ZIP download logic.
- Guida deploy Opalstack.
- UX quick guide utenti finali.
- QA checklist.

## 14. Hosting & Deployment (Opalstack)
- Deploy statico:
  - HTML/CSS/JS/WASM;
  - nessuna API obbligatoria;
  - HTTPS attivo.
- Compatibile con altri host static/CDN.

## 15. Success Metrics
- Conversion success rate (% file convertiti con successo).
- Tempo medio conversione per immagine.
- Tempo end-to-end per batch.
- Riduzione media dimensione file.
- Error rate per categoria (validazione, conversione, ZIP).

## 16. QA Checklist (MVP)
- Upload 1..10 file valido.
- Blocco upload >10 file.
- Blocco file >15 MB.
- Validazione tipi input: JPG/JPEG, PNG, WebP.
- Slider qualita influenza output size.
- Download singolo sempre disponibile per file `done`.
- ZIP generato con naming corretto.
- Nessun freeze UI durante conversione.
- Keyboard navigation e focus ring presenti.
- Test su Chrome/Edge/Safari (ultima versione stabile).

## 17. Naming & Copy (IT)
- CTA primaria: `Converti in WebP`
- CTA secondaria: `Scarica tutto (ZIP)`
- Stato coda: `In coda`
- Stato conversione: `Conversione in corso...`
- Stato successo: `Completato`
- Stato errore: `Conversione non riuscita`

## 18. Risks & Mitigations
- OOM su immagini molto grandi:
  - mitigazione: limiti MB + megapixel + coda seriale.
- Blocchi UI:
  - mitigazione: worker dedicato.
- Incompatibilita browser WASM:
  - mitigazione: feature detection + messaggio browser non supportato.
- Qualita percepita variabile:
  - mitigazione: default 80 + hint in UI.

## 19. Repo Conventions
- Branch naming: `codex/<topic>`.
- Commit piccoli e descrittivi.
- Conventional commit consigliati (`feat:`, `fix:`, `docs:`).
