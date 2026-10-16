# last-time

Extensión de Chrome que registra y muestra la fecha/hora de la última vez que
escuchaste cada resumen de audio (Audio Overview) de NotebookLM
(`notebook.google.com`).

- Cuenta una escucha tras 5 segundos efectivos de reproducción.
- Muestra "Última escucha: 15/10/2026, 12:44 (hace 2 h)" en la tarjeta del
  resumen, con fecha y relativo en el formato de cada idioma (`Intl`).
- Idioma: el de la UI de NotebookLM (`<html lang>`), si no el del navegador;
  textos en en/es/fr/de/pt/it, el resto cae a inglés.
- Detecta la reproducción con la UI en cualquier idioma.
- Datos locales (`chrome.storage.local`), sin sincronización.

## Desarrollo

- Pruebas: `npm test`
- e2e: `npx playwright install chromium` (una vez) y `HEADLESS=1 npm run test:e2e`
- Cargar en Chrome: `chrome://extensions` → activar *Modo desarrollador* →
  *Cargar descomprimida* → seleccionar la carpeta del proyecto (raíz, donde
  está `manifest.json`).

Diseño y plan en `docs/plans/`.
