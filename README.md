# Last listened for NotebookLM

Extensión de Chrome que registra y muestra la fecha/hora de la última vez que
escuchaste cada resumen de audio (Audio Overview) de NotebookLM
(`notebook.google.com`).

- Cuenta una escucha tras 5 segundos efectivos de reproducción.
- Muestra "Última escucha: 15/10/2026, 12:44 (hace 2 h)" en la tarjeta del
  resumen, con fecha y relativo en el formato de cada idioma (`Intl`).
- Idioma: el de la UI de NotebookLM (`<html lang>`), si no el del navegador;
  textos en en/es/fr/de/pt/it, el resto cae a inglés.
- Detecta la reproducción con la UI en cualquier idioma.
- Datos locales (`chrome.storage.local`), sin sincronización. Al pulsar el
  icono de la extensión se abren las opciones: escuchas guardadas y *Borrar
  historial*.
- Autodiagnóstico: si NotebookLM cambia y la extensión deja de poder leerlo,
  el icono muestra un "!" rojo en esa pestaña y explica el problema al pasar
  el ratón.
- Los resúmenes de vídeo, cuestionarios y tarjetas didácticas se ignoran.

Disponible en la [Chrome Web Store](https://chromewebstore.google.com/detail/mfeoclpimjaobffmgeaiemanabphjopo)
(pendiente de revisión).

## Desarrollo

- Pruebas: `npm test`
- e2e: `npx playwright install chromium` (una vez) y `HEADLESS=1 npm run test:e2e`
- Paquete para la Chrome Web Store: `npm run pack` → `dist/last-listened-for-notebooklm-<versión>.zip`
  (solo manifest, `_locales`, `src` e iconos). Ficha y privacidad en
  `docs/store/listing.md` y `PRIVACY.md`.
- CI: GitHub Actions pasa los tests unitarios y el e2e en cada push a `main`
  y en cada pull request. Para publicar una versión: subir `version` en
  `manifest.json`, crear la etiqueta `vX.Y.Z` y hacer push de la etiqueta; la
  release de GitHub sale con el zip adjunto y el workflow lo sube a la Chrome
  Web Store y lo envía a revisión (variables del repo `CWS_*` y `GCP_*`; sin
  `CWS_PUBLISHER_ID` la subida se omite).
- Iconos: editar `icons/icon.svg` y regenerar los PNG con `npm run icons`.
- Cargar en Chrome: `chrome://extensions` → activar *Modo desarrollador* →
  *Cargar descomprimida* → seleccionar la carpeta del proyecto (raíz, donde
  está `manifest.json`).

Diseño y plan en `docs/plans/`.
