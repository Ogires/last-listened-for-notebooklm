# Diseño: NotebookLM — Última escucha (extensión de Chrome)

Fecha: 2026-10-15
Estado: aprobado por el usuario

## Objetivo

Extensión de Chrome que registra la fecha y hora de la última vez que el usuario
escuchó cada resumen de audio (Audio Overview) de NotebookLM, y la muestra en la
propia tarjeta del resumen modificando el DOM.

## Requisitos decididos

- **Sitio objetivo:** NotebookLM (`https://notebooklm.google.com`), tras login de Google.
- **Criterio de "reproducido":** haber escuchado al menos **5 segundos efectivos**
  en una sesión de reproducción (de `play` a `pause`/`ended`). Los saltos con la
  barra de progreso no acumulan tiempo. Reanudar tras pausa inicia una sesión
  nueva: si supera otros 5 s, se actualiza el timestamp (refleja la reanudación).
- **Formato mostrado:** `Última escucha: DD/MM/YYYY HH:MM (hace X)`, con el
  relativo refrescado cada minuto.
- **Persistencia:** `chrome.storage.local`, solo en el equipo local.

## Arquitectura

Manifest V3 **sin background service worker**: todo vive en un content script
inyectado únicamente en `https://notebooklm.google.com/*`.

- Permisos: `storage`; `host_permissions`: `https://notebooklm.google.com/*`.
- Vanilla JS, sin dependencias ni paso de build.
- Carga como extensión descomprimida (chrome://extensions → Modo desarrollador).

### Archivos

| Archivo | Responsabilidad |
|---|---|
| `manifest.json` | MV3, content script + permisos |
| `content.js` | Punto de entrada, coordinación de módulos |
| `lib.js` | Lógica pura testeable (acumulador, claves, formato) |
| `player-tracker.js` | Detección de reproducción vía `<audio>` |
| `label-renderer.js` | Inyección de la etiqueta en las tarjetas |
| `styles.css` | Estilo de la etiqueta (tema claro/oscuro) |

## Componentes

### 1. PlayerTracker

- Al cargar, engancha listeners a los elementos `<audio>` existentes; un
  MutationObserver engancha los que aparezcan después (la lista de resúmenes
  y el reproductor se renderizan dinámicamente — Angular SPA).
- Eventos: `play`, `timeupdate`, `pause`, `ended`.
- Acumula tiempo efectivo por sesión: en cada `timeupdate` suma el delta de
  `currentTime` solo si es positivo y ≤ 1,5 s (descarta seeks).
- Al alcanzar 5 s en una sesión: notifica "reproducido" (una vez por sesión) y
  marca la sesión como registrada.

### 2. OverviewIdentifier

- Atribuye el audio que suena a un resumen concreto: al dispararse "reproducido",
  localiza la tarjeta activa en la UI (reproductor abierto / botón en estado
  reproducido).
- Clave estable: `notebookId` (de la URL) + contenido visible de la tarjeta
  (título y diferenciadores visibles como fecha de creación). Los IDs internos
  de Angular no son estables y no se usan.
- **Fallback:** si no encuentra la tarjeta, guarda con clave `notebookId` +
  posición en la lista, antes que perder el dato; registra aviso en consola.

### 3. Storage

- Esquema: `{ "<notebookId>|<overviewKey>": { "lastPlayed": "<ISO 8601>" } }`.
- Caché en memoria para lecturas frecuentes; escritura inmediata en cada registro.

### 4. LabelRenderer

- MutationObserver sobre el panel Studio (lista de resúmenes de audio).
- Para cada tarjeta: resuelve su clave, consulta la caché/storage e inyecta una
  línea `Última escucha: 15/10/2026 12:44 (hace 2 h)` con estilo discreto que
  hereda colores del tema claro/oscuro de NotebookLM.
- `setInterval` de 1 min para refrescar solo los tiempos relativos.
- Guards en todo el render: si la estructura del DOM no encaja, no inyecta nada
  y no lanza errores visibles (degradación limpia ante rediseños).

## Flujo de datos

`<audio>` supera 5 s efectivos → OverviewIdentifier resuelve la clave →
escritura en `chrome.storage.local` + caché → LabelRenderer actualiza la
tarjeta al instante (y al recargar la página, desde storage).

## Incertidumbre principal y mitigación

La estructura del DOM de NotebookLM no es inspeccionable sin sesión iniciada
(SPA tras login). El plan de implementación comienza con una **fase de
inspección real del DOM** (panel Studio, tarjetas de Audio Overview, elemento
`<audio>`) para validar los selectores de atribución y render. El resto del
diseño (eventos, umbral, storage, formato) no depende de esa estructura.

## Pruebas

- **Unitarias (vitest)** sobre `lib.js`: acumulador de 5 s (pausas, seeks,
  sesiones múltiples), formato fecha+relativo, construcción de claves.
- **Checklist manual** con la extensión cargada:
  1. Reproducir un resumen >5 s → aparece etiqueta con fecha/hora actual.
  2. Pausar antes de 5 s → NO se guarda ni actualiza.
  3. Recargar la página → la etiqueta persiste.
  4. Reproducir un segundo resumen → cada tarjeta con su propia fecha.
  5. Reanudar otro día → timestamp se actualiza.
  6. Tema claro y oscuro → etiqueta legible en ambos.

## Fuera de alcance (YAGNI)

- Historial de escuchas o contador de reproducciones (solo "última").
- Resúmenes de vídeo (solo Audio Overviews).
- Sincronización entre equipos (`storage.sync`).
- Publicación en Chrome Web Store.

## Addendum tras inspección en vivo (2026-10-15)

La inspección real con sesión iniciada cambió tres supuestos del diseño:

1. **Dominio**: NotebookLM vive en `notebook.google.com` (no
   `notebooklm.google.com`). El manifest incluye ambos.
2. **No existe `<audio>` accesible** (`querySelectorAll('audio')` = 0 incluso
   reproduciendo). El reproductor es Angular Material. Plan B aplicado: el
   tracker sondea el DOM cada 500 ms — el botón `Pause audio player` presente
   significa que suena; el tiempo efectivo se acumula desde el texto
   `MM:SS / MM:SS` reutilizando el acumulador de 5 s (seeks no cuentan).
3. **Atribución por UUID de artefacto**: el atributo `jslog` de los botones
   codifica en base64 `[[notebookId, artifactId, ...]]`. La clave de storage
   pasa de `notebookId|título` a `notebookId|artifactUUID` (estable y única).
   `identifier.js` deja de ser necesario y se elimina.

Tarjetas: `artifact-library-item` dentro de `artifact-library` (33 resúmenes
de audio en el cuaderno de prueba, cada uno con UUID propio verificado).
