# Image Converter (MVP)

Applicazione statica browser-based per convertire immagini tra formati diversi in autonomia.
Parte della suite di tools di [Search Foundry](https://www.searchfoundry.pro).

## Contesto prodotto
L'uso iniziale era riconvertire file WebP caricati con livelli di compressione non ottimali.
Lo strumento e stato esteso per essere piu dinamico: consente conversione da piu formati verso un formato target, con controllo della compressione quando supportata.

## Uso interno (stato attuale)
Questo repository e pensato per demo interna ai colleghi.
La visibilita resta privata finche il tool non viene pubblicato.

## Stato attuale
- Upload: JPG/JPEG, PNG, WebP.
- Limiti: max 10 file, 15 MB per file.
- Formato output selezionabile: WebP, JPEG, PNG.
- Qualita: pulsanti preset 50-100 (step 5), slider e input numerico custom (usato per WebP/JPEG, non applicato a PNG).
- Conversione in worker dedicato.
- Indicatori processo: `n/10` + timer elapsed.
- Download singolo o ZIP.
- Dashboard con versione e commit date.

## Avvio locale
Avvia un server statico dalla root progetto, ad esempio:

```bash
python3 -m http.server 8080
```

Poi apri:

`http://localhost:8080`

## Test rapido senza server
Puoi anche aprire direttamente `index.html` con doppio click.
In modalita `file://` l'app usa fallback senza worker (funziona, ma puo essere meno reattiva).

## Nota tecnica
Questa versione usa l'encoder immagini del browser nel worker per mantenere il tool semplice e veloce.

## ZIP automatico su update
E presente il workflow GitHub Actions `.github/workflows/package-zip.yml`.
Ad ogni push su `main` (o esecuzione manuale) viene creato uno ZIP aggiornato scaricabile dagli artifact del run.
