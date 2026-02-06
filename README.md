# WebP Converter (MVP)

Applicazione statica browser-based per convertire immagini in WebP in autonomia.

## Stato attuale
- Upload: JPG/JPEG, PNG, WebP.
- Limiti: max 5 file, 15 MB per file.
- Qualita: slider 50-100.
- Conversione in worker dedicato.
- Indicatori processo: `n/5` + timer elapsed.
- Download singolo o ZIP.

## Avvio locale
Avvia un server statico dalla root progetto, ad esempio:

```bash
python3 -m http.server 8080
```

Poi apri:

`http://localhost:8080`

## Test rapido senza server
Puoi anche aprire direttamente `/Users/garethjax/code/wasm-picture/index.html` con doppio click.
In modalita `file://` l'app usa fallback senza worker (funziona, ma puo essere meno reattiva).

## Nota tecnica
Questa prima versione usa l'encoder WebP del browser nel worker per accelerare l'MVP.
L'interfaccia worker e pronta per sostituire il motore con libwebp WASM nel prossimo step.
