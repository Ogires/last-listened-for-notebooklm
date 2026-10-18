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

4. **Localización y selectores blindados (2026-10-16, v0.2.0)**: los textos
   visibles siguen `navigator.language` (es/en, fallback es) vía tabla I18N
   en `lib.js`. Los selectores evitan textos traducibles: el botón central del
   reproductor se detecta por su clase estable `playback-control-button` +
   subcadena "paus" (pause/pausa/pausar…), y las tarjetas se clavean por
   cualquier botón `[mattooltip][jslog]` (el UUID del artefacto es común a
   todos los botones de la tarjeta). Si el reproductor está abierto ~60 s sin
   detección posible, se emite un aviso en consola en vez de fallar en
   silencio.

5. **Localización completa (2026-10-16, v0.3.0)**: fecha y relativo con
   `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` (estilo corto); solo el
   prefijo vive en `LABELS` (lib.js). Idioma = `<html lang>` → `navigator.language`
   → inglés (antes español); un idioma sin prefijo cae entero a inglés. El
   manifest usa `_locales` (descripción). CSS con propiedades lógicas (RTL).
   Tooltip en la tarjeta (la etiqueta no recibe hover). El tracker añade una
   señal independiente del idioma — el tiempo avanza a ritmo de reproducción,
   con 2,5 s de tolerancia — y el aviso de consola pasa a "tiempo ilegible".

6. **Validación en vivo (2026-10-16, Chromium 156, notebook.google.com)**:
   `<html lang>` sigue a `?hl=` (en/es/ja/ar) y no persiste. Un único
   `.playback-control-button`, con jslog del artefacto en "Play audio" y en
   "Pause audio player". Con `?hl=ja` ("オーディオ プレーヤーを一時停止") la
   escucha se registra por avance del tiempo en ~6 s; ja cae al idioma del
   navegador. En `?hl=ar` (RTL) la etiqueta no pisa el icono. El tooltip lo
   aporta la tarjeta. Dos defectos encontrados y corregidos: (a) volver al
   mismo cuaderno por navegación SPA dejaba las tarjetas sin etiqueta —
   Angular recrea `artifact-library` y el renderer observaba el viejo; ahora
   `isStale()` lo detecta y `content.js` suelta el renderer fuera de un
   cuaderno; (b) la etiqueta heredaba Times New Roman: se fija la pila de
   fuentes de `.artifact-details`.

7. **v0.4.0 (2026-10-18): nodos reutilizados, robustez y opciones.**
   - *Defecto en vivo*: al generarse un artefacto nuevo con la página abierta,
     Angular reutiliza los nodos `artifact-library-item` desplazando su
     contenido. Actualiza `id="artifact-labels-<uuid>"` pero **no** el `jslog`
     de los botones, que queda con el artefacto anterior: 3 de 4 etiquetas
     mostraban la fecha de otra tarjeta hasta recargar. Las escuchas se
     guardaban bien (el reproductor se crea de nuevo en cada escucha y su
     `jslog` es fiable). Ahora la clave sale del `id`, con el `jslog` como
     respaldo, y el observer vigila también cambios de `id`.
   - *Tipos de tarjeta*: `mat-icon.artifact-icon` lleva la ligadura del tipo
     (no se traduce): `audio_spark` (audio), `videocam` (vídeo), `quiz`,
     `copy` (tarjetas didácticas), `progress_activity` (generándose). Solo
     se etiqueta `audio_spark`; antes se creaban etiquetas vacías en
     cuestionarios y tarjetas didácticas.
   - *"No leídos"*: NotebookLM ya marca los artefactos sin abrir
     (`span.cdk-visually-hidden` en `.artifact-labels`), así que se descartó
     una marca propia "Sin escuchar" (además marcaría todo lo escuchado antes
     de instalar la extensión).
   - *Vídeo*: se abre en `artifact-viewer` dentro de `studio-panel` y suena en
     un `<video>` estándar, sin `.playback-control-button`: la extensión lo
     ignora. Para soportarlo (pendiente): eventos del `<video>` y el UUID que
     llevan los `jslog` del propio `artifact-viewer`.
   - *Autodiagnóstico* (`health.js`): síntomas que persisten (tarjetas sin tipo
     reconocible, audios sin identificador, reproductor con tiempo ilegible)
     → `!` rojo en el icono de esa pestaña, con la explicación en el tooltip.
   - *Opciones*: escuchas guardadas y Borrar historial; las pestañas abiertas
     se actualizan por `storage.onChanged`.
   - *Segundo plano*: con la pestaña oculta no se repinta; el tracker sigue
     sondeando porque el audio sigue sonando (Chrome limita a 1 s, suficiente).
