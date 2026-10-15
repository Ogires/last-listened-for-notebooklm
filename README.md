# last-time

Extensión de Chrome que registra y muestra la fecha/hora de la última vez que
escuchaste cada resumen de audio (Audio Overview) de NotebookLM.

- Cuenta una escucha tras 5 segundos efectivos de reproducción.
- Muestra "Última escucha: DD/MM/YYYY HH:MM (hace X)" en la tarjeta del resumen.
- Datos locales (`chrome.storage.local`), sin sincronización.

## Desarrollo

- Pruebas: `npm test`
- Cargar en Chrome: `chrome://extensions` → activar *Modo desarrollador* →
  *Cargar descomprimida* → seleccionar la carpeta del proyecto (raíz, donde
  está `manifest.json`).

Diseño y plan en `docs/plans/`.
