# Localización completa — plan de implementación

> **Para Claude:** SUB-SKILL OBLIGATORIA: usar `executing-plans` para ejecutar este plan tarea a tarea.

**Objetivo:** que la extensión esté localizada de verdad: fecha y relativo en el
formato de cada idioma, mismo idioma que la UI de NotebookLM, manifest
traducido, maquetación RTL y detección de la reproducción en cualquier idioma.

**Arquitectura:** `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` generan
fecha y relativo; solo el prefijo ("Última escucha") vive en una tabla
`LABELS` de `lib.js`. Idioma = `<html lang>` de la página → `navigator.language`
→ inglés. El manifest usa `_locales/` + `__MSG_*__`. El tracker añade una
señal independiente del idioma: el texto `MM:SS` avanza a ritmo de reproducción.

**Stack:** Chrome MV3 (content scripts clásicos sobre `globalThis.NLM`),
Vitest 5 + jsdom, Playwright 1.64 para el e2e.

**Origen:** revisión del 2026-10-16 (hallazgos 1–8). Todo el código de este
plan se prototipó y verificó antes de escribirlo: 73 tests unitarios y 8 e2e
en verde.

## Decisiones

| Decisión | Motivo |
|---|---|
| Fallback a **inglés** (antes español) | Un usuario fr/ja no entiende español; estándar en extensiones públicas. |
| Idioma sin entrada en `LABELS` cae **entero** a inglés | Evita mezclas tipo "Last listened: 2026/10/15 (1 時間前)". |
| Prefijo en `LABELS` (lib.js), **no** en `chrome.i18n.getMessage` | `chrome.i18n` sigue el idioma de Chrome, no el de la página; además rompería los tests sin `chrome`. `_locales` solo para el manifest. |
| `numeric: 'auto', style: 'short'` | Compacto como el formato actual ("hace 3 h") y natural ("ayer"). La franja tiene ~13 px de alto y se trunca. |
| `stallMs = 2500` en la señal de tiempo | El tiempo visible tiene resolución de 1 s y se sondea cada 500 ms; con menos parpadearía entre sonando/pausado. Coste: una pausa < 2,5 s en idiomas sin "paus" no reinicia la sesión. |
| El aviso de consola pasa a "tiempo ilegible" | Con la señal de tiempo, "reproductor abierto sin detección" ya es simplemente "en pausa" (falso positivo tras 60 s de pausa). Lo único indetectable es un DOM sin tiempo legible. |
| e2e con `channel: 'chromium'` | Chrome de marca ignora `--load-extension` desde la v137: el e2e actual falla 4/6 incluso sin cambios (verificado). |

## Comandos

- Unitarios: `npm test` (estado inicial: 53 en verde)
- Un archivo: `npx vitest run tests/<archivo>.test.js`
- e2e: `HEADLESS=1 npm run test:e2e` (requiere la Tarea 7, paso 1)

---

### Tarea 0: Fijar la línea base

El árbol tiene sin commitear el e2e (`tests/e2e/`), `package.json`,
`package-lock.json` y `.gitignore`.

**Paso 1:** `npm test` → esperado: `Tests 53 passed`.

**Paso 2: commit**

```bash
git add .gitignore package.json package-lock.json tests/e2e/run-e2e.mjs
git commit -m "test(e2e): Chrome real con la extensión cargada (Playwright)"
```

---

### Tarea 1: Formato con `Intl` y fallback a inglés

**Archivos:**
- Modificar: `src/lib.js:47-117` (borrar `pad2`, `I18N`, `pickLocale` y los tres formatters) y `src/lib.js:120` (comentario obsoleto "Task 10")
- Modificar: `src/lib.js:156-167` (exports)
- Reescribir: `tests/lib-format.test.js`

**Paso 1: test que falla** — sustituir `tests/lib-format.test.js` entero:

```js
import { describe, it, expect } from 'vitest';
import '../src/lib.js';

const { lib } = globalThis.NLM;

// ICU puede separar "12:44 PM" con U+202F; se normaliza para comparar.
const norm = (s) => s.replace(/\s+/g, ' ');

describe('formatRelative (Intl.RelativeTimeFormat, estilo corto)', () => {
  const base = new Date(2026, 9, 15, 14, 0, 0);
  const rel = (secAgo, lang) =>
    norm(lib.formatRelative(new Date(base.getTime() - secAgo * 1000), base, lang));

  it.each([
    [0, 'ahora', 'now'],
    [30, 'hace 30 s', '30 sec. ago'],
    [5 * 60, 'hace 5 min', '5 min. ago'],
    [3 * 3600, 'hace 3 h', '3 hr. ago'],
    [24 * 3600, 'ayer', 'yesterday'],
    [3 * 24 * 3600, 'hace 3 d', '3 days ago'],
    [14 * 24 * 3600, 'hace 2 sem.', '2 wk. ago'],
    [60 * 24 * 3600, 'hace 2 m', '2 mo. ago'],
    [800 * 24 * 3600, 'hace 2 a', '2 yr. ago'],
  ])('%i s atrás → es "%s" / en "%s"', (sec, es, en) => {
    expect(rel(sec, 'es')).toBe(es);
    expect(rel(sec, 'en')).toBe(en);
  });

  it('un instante futuro (reloj desajustado) es "ahora", nunca negativo', () => {
    expect(rel(-5, 'es')).toBe('ahora');
  });
});

describe('formatLastPlayed', () => {
  const now = new Date(2026, 9, 15, 14, 0);
  const iso = new Date(2026, 9, 15, 12, 44).toISOString();
  const fmt = (lang) => norm(lib.formatLastPlayed(iso, now, lang));

  it('es-ES: DD/MM/AAAA 24 h', () =>
    expect(fmt('es-ES')).toBe('Última escucha: 15/10/2026, 12:44 (hace 1 h)'));
  it('en-US: MM/DD/AAAA 12 h', () =>
    expect(fmt('en-US')).toBe('Last listened: 10/15/2026, 12:44 PM (1 hr. ago)'));
  it('en-GB conserva la región: DD/MM/AAAA 24 h', () =>
    expect(fmt('en-GB')).toBe('Last listened: 15/10/2026, 12:44 (1 hr ago)'));
  it('de: formato alemán', () =>
    expect(fmt('de')).toBe('Zuletzt gehört: 15.10.2026, 12:44 (vor 1 Std.)'));
  it('idioma sin texto propio (ja) cae entero a inglés, sin mezclar', () =>
    expect(fmt('ja')).toBe(fmt('en')));
  it('etiqueta mal formada o ausente cae a inglés', () => {
    expect(fmt('es_ES')).toBe(fmt('en'));
    expect(fmt(undefined)).toBe(fmt('en'));
  });
});

describe('detectLang', () => {
  const docWith = (lang) => ({ documentElement: { lang } });

  it('prioriza el idioma de la página sobre el del navegador', () =>
    expect(lib.detectLang(docWith('en'), { language: 'es-ES' })).toBe('en'));
  it('si la página no declara idioma, usa el del navegador', () =>
    expect(lib.detectLang(docWith(''), { language: 'es-ES' })).toBe('es-ES'));
  it('si la página está en un idioma sin texto propio, prueba el navegador', () =>
    expect(lib.detectLang(docWith('ja'), { language: 'de-DE' })).toBe('de-DE'));
  it('sin ningún idioma soportado, inglés', () =>
    expect(lib.detectLang(docWith('ja'), { language: 'ko' })).toBe('en'));
});
```

> Las cadenas esperadas son la salida real del ICU de Node 24. Si una versión
> de Node distinta cambia alguna abreviatura, ajustar el test, no el código.

**Paso 2:** `npx vitest run tests/lib-format.test.js` → FALLA (`detectLang is not a function`, formatos antiguos).

**Paso 3: implementación** — en `src/lib.js`, sustituir desde `function pad2` hasta el final de `formatLastPlayed` por:

```js
  // Prefijo visible por idioma; fechas y relativos los localiza Intl.
  // Añadir un idioma = añadir una línea aquí. Los idiomas sin entrada caen
  // por completo (prefijo, fecha y relativo) a FALLBACK_LANG.
  const LABELS = {
    en: 'Last listened',
    es: 'Última escucha',
    fr: 'Dernière écoute',
    de: 'Zuletzt gehört',
    pt: 'Última audição',
    it: 'Ultimo ascolto',
  };
  const FALLBACK_LANG = 'en';

  // Etiqueta BCP 47 canónica si su idioma tiene texto propio; si no, null.
  // Conserva la región ('en-GB', 'pt-BR') porque cambia el formato de fecha.
  function supportedTag(lang) {
    if (!lang) return null;
    try {
      const tag = Intl.getCanonicalLocales(lang)[0];
      return LABELS[tag.split('-')[0]] ? tag : null;
    } catch (e) {
      return null; // etiqueta mal formada ('es_ES', '')
    }
  }

  function resolveLang(lang) {
    return supportedTag(lang) || FALLBACK_LANG;
  }

  // Idioma de la página (NotebookLM lo fija según su ajuste, ?hl=) antes que
  // el del navegador: así la etiqueta habla el mismo idioma que la UI.
  function detectLang(doc, nav) {
    const page = doc && doc.documentElement ? doc.documentElement.lang : '';
    return supportedTag(page) || supportedTag(nav && nav.language) || FALLBACK_LANG;
  }

  const DATE_TIME_OPTS = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };

  // es: "15/10/2026, 12:44" | en: "10/15/2026, 12:44 PM" | en-GB: "15/10/2026, 12:44"
  function formatDateTime(date, lang) {
    return new Intl.DateTimeFormat(resolveLang(lang), DATE_TIME_OPTS).format(date);
  }

  // Unidad más grande que cabe en el lapso (meses y años aproximados).
  const UNITS = [
    ['year', 365 * 86400],
    ['month', 30 * 86400],
    ['week', 7 * 86400],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  // es: "ahora" | "hace 5 min" | "ayer" | "hace 2 sem." | "hace 2 a"
  // en: "now" | "5 min. ago" | "yesterday" | "2 wk. ago" | "2 yr. ago"
  // Un instante futuro (reloj desajustado) se trata como "ahora".
  function formatRelative(date, now, lang) {
    const rtf = new Intl.RelativeTimeFormat(resolveLang(lang), {
      numeric: 'auto',
      style: 'short',
    });
    const sec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
    for (const [unit, size] of UNITS) {
      if (sec >= size) return rtf.format(-Math.floor(sec / size), unit);
    }
    return rtf.format(-sec, 'second');
  }

  // es: "Última escucha: 15/10/2026, 12:44 (hace 2 h)"
  // en: "Last listened: 10/15/2026, 12:44 PM (2 hr. ago)"
  function formatLastPlayed(iso, now, lang) {
    const tag = resolveLang(lang);
    const d = new Date(iso);
    return (
      LABELS[tag.split('-')[0]] +
      ': ' +
      formatDateTime(d, tag) +
      ' (' +
      formatRelative(d, now || new Date(), tag) +
      ')'
    );
  }
```

Borrar la línea `// El formato exacto se valida en la fase de inspección (Task 10).`
y ampliar los exports:

```js
  NLM.lib = {
    THRESHOLD_MS,
    MAX_DELTA_SEC,
    FALLBACK_LANG,
    createPlaybackSession,
    resolveLang,
    detectLang,
    formatDateTime,
    ...
```

**Paso 4:** `npx vitest run tests/lib-format.test.js` → PASA. `npm test` →
fallan 3 tests de `label-renderer` (esperan "Última escucha" sin pasar
`lang`). Se arreglan en la Tarea 2.

**Paso 5:** sin commit todavía; la Tarea 2 deja la suite en verde.

---

### Tarea 2: El renderer recibe el idioma y el tooltip pasa a la tarjeta

El `title` en `.nlm-last-played` nunca se ve: la etiqueta tiene
`pointer-events: none` y no recibe hover.

**Archivos:**
- Modificar: `src/label-renderer.js:28-63`
- Modificar: `src/content.js:14,23`
- Modificar: `tests/label-renderer.test.js`

**Paso 1: tests** — en `tests/label-renderer.test.js`:

1. En `setup()`, añadir `lang: 'es',` tras `notebookId: 'nb1',`.
2. En el primer test, sustituir `expect(labels[0].title).toContain('Última escucha');` por:

   ```js
       // tooltip en la tarjeta (la etiqueta no recibe hover: pointer-events: none)
       const card = labels[0].closest('artifact-library-item');
       expect(card.title).toBe(labels[0].textContent);
   ```
3. Añadir al final del `describe`:

   ```js
     it('no pisa un title propio de la tarjeta', async () => {
       document.body.innerHTML = '';
       const renderer = setup(cardHtml('art-1', 'Resumen uno'), { 'art-1': ISO });
       const card = document.querySelector('artifact-library-item');
       card.title = 'title de NotebookLM';
       await renderer.refresh();
       expect(card.title).toBe('title de NotebookLM');
       renderer.disconnect();
     });

     it('usa el idioma recibido (en)', async () => {
       const renderer = setup(cardHtml('art-1', 'Resumen uno'), { 'art-1': ISO }, { lang: 'en' });
       await new Promise((r) => setTimeout(r, 0));
       expect(document.querySelector('.nlm-last-played').textContent).toMatch(/^Last listened: /);
       renderer.disconnect();
     });
   ```

**Paso 2:** `npx vitest run tests/label-renderer.test.js` → FALLA (`card.title` vacío).

**Paso 3: implementación** — en `src/label-renderer.js`, antes de `renderCard`:

```js
    // El tooltip va en la tarjeta: la etiqueta tiene pointer-events: none y
    // nunca recibe hover. No pisa un title que la tarjeta trajera de origen.
    function setCardTitle(card, text) {
      if (card.title && card.title !== card.dataset.nlmTitle) return;
      card.title = text;
      card.dataset.nlmTitle = text;
    }
```

En `renderCard`, sustituir `el.title = text; // tooltip nativo con el texto completo` por `setCardTitle(card, text);`.
En `refreshRelative`, sustituir `el.title = el.textContent;` por:

```js
          const card = el.closest(NLM.selectors.card);
          if (card) setCardTitle(card, el.textContent);
```

> Escribir `title` en la tarjeta no realimenta el `MutationObserver`: observa
> `childList`/`subtree`, no atributos.

En `src/content.js`, borrar la línea 14 (`const lang = ...`) y en
`createLabelRenderer` sustituir `lang,` por:

```js
      lang: NLM.lib.detectLang(global.document, global.navigator),
```

(Se evalúa en cada `ensureRenderer`, es decir, al cambiar de cuaderno.)

**Paso 4:** `npm test` → `Tests 59 passed`.

**Paso 5: commit**

```bash
git add src/lib.js src/label-renderer.js src/content.js tests/lib-format.test.js tests/label-renderer.test.js
git commit -m "feat(i18n): fecha y relativo con Intl, idioma de la página y fallback a inglés"
```

---

### Tarea 3: Manifest localizado (`_locales`) y CSS RTL

**Archivos:**
- Crear: `_locales/{en,es,fr,de,pt,it}/messages.json`
- Modificar: `manifest.json`
- Modificar: `src/styles.css:8-9`
- Crear: `tests/manifest-i18n.test.js`

**Paso 1: test que falla** — `tests/manifest-i18n.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import '../src/lib.js';

// Rutas desde la raíz del proyecto (cwd de vitest); import.meta.url no es
// file:// bajo el entorno jsdom.
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const locales = readdirSync(resolve(process.cwd(), '_locales'));
const msgKeys = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]);

describe('localización del manifest (_locales)', () => {
  it('declara default_locale y existe su carpeta', () => {
    expect(manifest.default_locale).toBe(globalThis.NLM.lib.FALLBACK_LANG);
    expect(locales).toContain(manifest.default_locale);
  });

  it('usa al menos un __MSG_*__', () => expect(msgKeys.length).toBeGreaterThan(0));

  it.each(locales)('%s define todas las claves usadas en el manifest', (loc) => {
    const messages = JSON.parse(read(`_locales/${loc}/messages.json`));
    for (const k of msgKeys) expect(messages[k] && messages[k].message, `${loc}.${k}`).toBeTruthy();
  });

  it('extDescription cabe en el límite de Chrome (132 caracteres)', () => {
    for (const loc of locales) {
      const { extDescription } = JSON.parse(read(`_locales/${loc}/messages.json`));
      expect(extDescription.message.length, loc).toBeLessThanOrEqual(132);
    }
  });
});

describe('estilos', () => {
  it('posiciona la etiqueta con propiedades lógicas (RTL), no left/right', () => {
    const css = read('src/styles.css');
    expect(css).toMatch(/inset-inline-start:/);
    expect(css).not.toMatch(/^\s*(left|right):/m);
  });
});
```

**Paso 2:** `npx vitest run tests/manifest-i18n.test.js` → FALLA (`ENOENT ... _locales`).

**Paso 3: implementación**

`_locales/<loc>/messages.json`, una por idioma, con esta forma:

```json
{
  "extDescription": {
    "message": "<texto>",
    "description": "Descripción en chrome://extensions y en la Chrome Web Store"
  }
}
```

| loc | message |
|---|---|
| en | Shows the date and time you last listened to each NotebookLM Audio Overview. |
| es | Muestra la fecha y hora de la última vez que escuchaste cada resumen de audio de NotebookLM. |
| fr | Affiche la date et l'heure de votre dernière écoute de chaque résumé audio de NotebookLM. |
| de | Zeigt Datum und Uhrzeit an, wann du jede Audio-Zusammenfassung von NotebookLM zuletzt gehört hast. |
| pt | Mostra a data e a hora em que você ouviu pela última vez cada resumo em áudio do NotebookLM. |
| it | Mostra la data e l'ora dell'ultimo ascolto di ogni riepilogo audio di NotebookLM. |

`manifest.json` (el `name` "last-time" se queda sin traducir: es una marca):

```json
  "version": "0.3.0",
  "description": "__MSG_extDescription__",
  "default_locale": "en",
```

`src/styles.css`, sustituir `left: 44px; ...` y `right: 8px;` por:

```css
  /* Propiedades lógicas: en RTL (ar, he) el icono queda a la derecha. */
  inset-inline-start: 44px; /* salta el icono (32 px + gap 8 px) */
  inset-inline-end: 8px;
```

**Paso 4:** `npm test` → `Tests 69 passed`. Comprobación del test: vaciar
`_locales/fr/messages.json` a `{}` → 2 fallos; restaurarlo.

**Paso 5:** cargar la extensión en `chrome://extensions` → carga sin errores y la descripción sale en el idioma de Chrome.

**Paso 6: commit**

```bash
git add _locales manifest.json src/styles.css tests/manifest-i18n.test.js
git commit -m "feat(i18n): manifest localizado con _locales y etiqueta compatible con RTL"
```

---

### Tarea 4: Detección de la reproducción en cualquier idioma

`"paus"` falla en nl ("Pauzeren"), ru, ja, zh, ko, ar, pl, tr… Se mantiene
como atajo inmediato y se añade la señal del avance del tiempo.

**Archivos:**
- Modificar: `src/selectors.js:21-25`
- Reescribir: `src/player-tracker.js`
- Modificar: `tests/player-tracker.test.js`

**Paso 1: tests** — en `tests/player-tracker.test.js`:

1. Sustituir `setPlayerOpenNotPlaying` por:

   ```js
   // Reproductor abierto con el tiempo ilegible (para el aviso de DOM roto).
   function setPlayerUnreadableTime() {
     document.body.innerHTML = `<div class="player">
         <button class="playback-control-button" aria-label="Play audio player"></button>
         <div class="playback-time-container">--:-- / --:--</div>
       </div>`;
   }
   ```
2. Renombrar el test del aviso a `'avisa en consola si el reproductor tiene el tiempo ilegible'` y cambiar `setPlayerOpenNotPlaying(10);` por `setPlayerUnreadableTime();`. El resto del test no cambia.
3. Tras él, dentro del mismo `describe`:

   ```js
     it('un reproductor en pausa con tiempo legible no avisa', () => {
       const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
       for (let i = 0; i < 5; i++) {
         setPlayer({ playing: true, seconds: 10, artifact: ART_1, label: 'Play audio player' });
         tracker.poll();
       }
       expect(warn).not.toHaveBeenCalled();
       warn.mockRestore();
     });
   ```
4. Al final del archivo:

   ```js
   // UI en un idioma sin "paus" en la etiqueta (japonés): solo queda la señal del
   // tiempo. Reloj falso: cada poll avanza 500 ms y el texto, como en la UI real,
   // tiene resolución de 1 s.
   describe('attachPlayerTracker sin etiqueta de pausa reconocible', () => {
     const JA_PAUSE = '一時停止';
     let tracker;
     let onPlayed;
     let clock;

     beforeEach(() => {
       onPlayed = vi.fn();
       clock = 0;
       tracker = playerTracker.attachPlayerTracker(document, onPlayed, {
         pollMs: 60000,
         now: () => clock,
       });
     });

     function step(seconds, artifact = ART_1) {
       clock += 500;
       setPlayer({ playing: true, seconds, artifact, label: JA_PAUSE });
       tracker.poll();
     }

     function play(from, to, artifact) {
       for (let t = from; t <= to; t += 0.5) step(t, artifact);
     }

     it('detecta la reproducción por el avance del tiempo', () => {
       play(0, 5.5);
       expect(onPlayed).not.toHaveBeenCalled(); // 1 s perdido en detectar el avance
       play(6, 6);
       expect(onPlayed).toHaveBeenCalledTimes(1);
       expect(onPlayed).toHaveBeenCalledWith(ART_1);
     });

     it('un seek con el reproductor en pausa no cuenta como reproducción', () => {
       step(0);
       step(240); // salto en la barra
       for (let i = 0; i < 20; i++) step(240); // tiempo parado 10 s
       expect(onPlayed).not.toHaveBeenCalled();
     });

     it('el tiempo parado más de stallMs cierra la sesión; reanudar exige otros 5 s', () => {
       play(0, 3);
       for (let i = 0; i < 10; i++) step(3); // pausa de 5 s (> 2,5 s)
       play(3.5, 7.5); // 4 s más: no suma con los 2 s previos
       expect(onPlayed).not.toHaveBeenCalled();
       play(8, 9.5);
       expect(onPlayed).toHaveBeenCalledTimes(1);
     });
   });
   ```

**Paso 2:** `npx vitest run tests/player-tracker.test.js` → FALLA (japonés no detecta; el aviso no salta con tiempo ilegible).

**Paso 3: implementación**

`src/selectors.js`, sustituir el comentario de `playerPlaying` por:

```js
    // Botón central del reproductor (clase estable); su jslog da el artefacto.
    playerButton: '.playback-control-button',
    // Atajo "sonando" si su etiqueta contiene "paus" (en/es/pt/de/fr/it). Para
    // el resto de idiomas el tracker usa el avance del tiempo.
```

`src/player-tracker.js`, contenido completo:

```js
// Detecta la reproducción sondeando el DOM del reproductor de audio de
// NotebookLM (no existe ningún <audio> accesible: el reproductor es Angular
// Material). Dos señales de "sonando": (1) la etiqueta del botón central es
// de pausa en un idioma conocido — respuesta inmediata; (2) independiente del
// idioma: el texto "MM:SS / MM:SS" avanza a ritmo de reproducción. El jslog
// del botón identifica el artefacto. Reutiliza el acumulador de lib.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const createPlaybackSession = NLM.lib.createPlaybackSession;
  const parsePlaybackSeconds = NLM.lib.parsePlaybackSeconds;
  const artifactIdFromJslog = NLM.lib.artifactIdFromJslog;
  const MAX_DELTA_SEC = NLM.lib.MAX_DELTA_SEC;

  function attachPlayerTracker(doc, onPlayed, opts) {
    const sel = (opts && opts.selectors) || NLM.selectors;
    const pollMs = (opts && opts.pollMs) || 500;
    const now = (opts && opts.now) || Date.now;
    // El tiempo visible tiene resolución de 1 s y se sondea cada 500 ms: se
    // considera que suena mientras haya avanzado hace menos de stallMs.
    const stallMs = (opts && opts.stallMs) || 2500;
    // Aviso si hay reproductor pero su tiempo es ilegible (cambio de DOM):
    // sin tiempo no hay detección posible, mejor decirlo que fallar mudo.
    const warnAfterPolls = (opts && opts.warnAfterPolls) || 120;
    const session = createPlaybackSession();
    let wasPlaying = false;
    let lastArtifact = null;
    let lastTimeSec = null;
    let lastAdvanceAt = -Infinity;
    let unreadable = 0;
    let warned = false;

    function poll() {
      const pauseBtn = doc.querySelector(sel.playerPlaying);
      const button = pauseBtn || doc.querySelector(sel.playerButton);
      const timeEl = doc.querySelector(sel.playerTime);
      const cur = timeEl ? parsePlaybackSeconds(timeEl.textContent) : null;

      if (button && cur === null) {
        unreadable++;
        if (!warned && unreadable >= warnAfterPolls) {
          warned = true;
          console.warn('[NLM] reproductor de audio sin tiempo legible; ¿cambió el DOM de NotebookLM?');
        }
      } else {
        unreadable = 0;
        warned = false;
      }

      // Avance a ritmo de reproducción; los seeks (saltos grandes o hacia
      // atrás) no cuentan como señal de que suena.
      if (cur !== null && lastTimeSec !== null) {
        const delta = cur - lastTimeSec;
        if (delta > 0 && delta <= MAX_DELTA_SEC) lastAdvanceAt = now();
      }
      lastTimeSec = cur;

      const playing =
        !!button && (!!pauseBtn || (cur !== null && now() - lastAdvanceAt < stallMs));
      const artifact = playing ? artifactIdFromJslog(button.getAttribute('jslog')) : null;

      // Sesión nueva al empezar a sonar o al cambiar de artefacto (cola).
      if (playing && (!wasPlaying || artifact !== lastArtifact)) session.play();
      if (!playing && wasPlaying) session.pause();
      wasPlaying = playing;
      lastArtifact = artifact;

      if (!playing || cur === null) return null;
      if (session.tick(cur)) {
        try {
          onPlayed(artifact);
        } catch (e) {
          console.warn('[NLM] error en onPlayed', e);
        }
        return artifact;
      }
      return null;
    }

    const timer = setInterval(poll, pollMs);
    poll();
    return {
      poll,
      disconnect() {
        clearInterval(timer);
      },
    };
  }

  NLM.playerTracker = { attachPlayerTracker };
})(globalThis);
```

**Paso 4:** `npm test` → `Tests 73 passed` (los 8 tests anteriores del tracker siguen en verde gracias al atajo "paus").

**Paso 5: commit**

```bash
git add src/selectors.js src/player-tracker.js tests/player-tracker.test.js
git commit -m "feat(tracker): detección de reproducción independiente del idioma por avance del tiempo"
```

---

### Tarea 5: e2e — Chromium de Playwright y nuevos casos de idioma

**Archivos:** Modificar `tests/e2e/run-e2e.mjs`

**Paso 1:** `npx playwright install chromium` (descarga el Chromium que pide Playwright 1.64; es la que carga extensiones).

**Paso 2: cambios en `tests/e2e/run-e2e.mjs`**

- Comentario de cabecera: "lanza un Chrome real (el instalado en el sistema, channel "chrome")" → "lanza el Chromium de Playwright (channel "chromium"; Chrome de marca ignora --load-extension desde la v137)".
- `channel: 'chrome',` → `channel: 'chromium',`.
- Tras `const ART2`: `const ART3 = 'e2e-art-3';`. Tras `const NB`:
  ```js
  // Idioma que declara la página (<html lang>); '' = sin declarar.
  let pageLang = '';
  ```
- En `fixtureHtml`, antes del `return`: `` const langAttr = pageLang ? ` lang="${pageLang}"` : ''; `` y usar `<html${langAttr}>`; añadir `${card(ART3, 'Resumen tres')}` a `artifact-library`.
- Test de inyección: esperar `3` contenedores.
- Test en INGLÉS: regex nueva y tooltip en la tarjeta:
  ```js
      assert.match(t, /^Última escucha: \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} \((ahora|hace \d+ s)\)$/, t);
      const tooltip = await page.evaluate(
        () => document.querySelectorAll('artifact-library-item')[0].title
      );
      assert.equal(tooltip, t, 'el tooltip de la tarjeta debe replicar el texto');
  ```
- Antes de "los datos persisten tras recargar la página":
  ```js
    await test('UI en JAPONÉS ("一時停止"): detecta por avance del tiempo', async () => {
      await page.evaluate(() => { window.__sim.playing = false; window.__sim.open = false; });
      await page.waitForTimeout(1000);
      await simulateListening(page, { artifact: ART3, pauseLabel: '一時停止', seconds: 7 });
      const t = await waitFor(() => labelOf(page, 2).then((x) => (x ? x : null)), 8000, 'etiqueta tarjeta 3');
      assert.match(t, /^Última escucha: /, t);
    });
  ```
- Último test, antes de `} finally {` (va al final porque cambia `pageLang`):
  ```js
    await test('página con lang="en" → etiqueta en inglés (manda la página, no el navegador)', async () => {
      pageLang = 'en';
      await page.reload();
      await page.waitForTimeout(2000);
      const t = await waitFor(() => labelOf(page, 0).then((x) => (x ? x : null)), 8000, 'etiqueta en inglés');
      assert.match(t, /^Last listened: \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}\s[AP]M \(/, t);
    });
  ```

**Paso 3:** `rm -rf .e2e-profile && HEADLESS=1 npm run test:e2e` → `8 tests, 8 ok, 0 fallos`.

**Paso 4: commit**

```bash
git add tests/e2e/run-e2e.mjs
git commit -m "test(e2e): Chromium de Playwright, UI en japonés e idioma de la página"
```

---

### Tarea 6: Documentación

**Archivos:** `README.md:8-10`, `docs/plans/2026-10-15-notebooklm-last-played-design.md` (tras el punto 4)

**Paso 1:** README: sustituir las viñetas del formato y del idioma por:

```markdown
- Muestra "Última escucha: 15/10/2026, 12:44 (hace 2 h)" en la tarjeta del
  resumen, con fecha y relativo en el formato de cada idioma (`Intl`).
- Idioma: el de la UI de NotebookLM (`<html lang>`), si no el del navegador;
  textos en en/es/fr/de/pt/it, el resto cae a inglés.
- Detecta la reproducción con la UI en cualquier idioma.
```

Y en *Desarrollo*: `- e2e: npx playwright install chromium (una vez) y HEADLESS=1 npm run test:e2e`.

**Paso 2:** addendum en el diseño:

```markdown
5. **Localización completa (2026-10-16, v0.3.0)**: fecha y relativo con
   `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` (estilo corto); solo el
   prefijo vive en `LABELS` (lib.js). Idioma = `<html lang>` → `navigator.language`
   → inglés (antes español); un idioma sin prefijo cae entero a inglés. El
   manifest usa `_locales` (descripción). CSS con propiedades lógicas (RTL).
   Tooltip en la tarjeta (la etiqueta no recibe hover). El tracker añade una
   señal independiente del idioma — el tiempo avanza a ritmo de reproducción,
   con 2,5 s de tolerancia — y el aviso de consola pasa a "tiempo ilegible".
```

**Paso 3: commit**

```bash
git add README.md docs/plans/2026-10-15-notebooklm-last-played-design.md
git commit -m "docs: localización completa (v0.3.0)"
```

---

### Tarea 7: Validación en vivo (manual, en NotebookLM real)

Supuestos que los tests no pueden cubrir. Con la extensión cargada, en
la consola de un cuaderno con resúmenes de audio:

| # | Comprobación | Esperado | Si falla |
|---|---|---|---|
| 1 | `document.documentElement.lang` con `?hl=en`, `?hl=es`, `?hl=ja` | sigue a `hl` | `detectLang` cae al navegador: aceptable, anotarlo en el diseño |
| 2 | `document.querySelectorAll('.playback-control-button').length` con el reproductor abierto | `1` | Si hay varios (retroceder/avanzar), acotar `playerButton` al central |
| 3 | `.playback-control-button` tiene `jslog` también en estado *play* | sí | Sin él, la señal de tiempo no atribuye: usar el jslog del último artefacto que sonó |
| 4 | Con `?hl=ja`: escuchar ≥ 6 s | aparece la etiqueta (en inglés: ja cae a en) | Revisar el formato del texto del tiempo en ja |
| 5 | Pasar el ratón por una tarjeta con etiqueta | tooltip con el texto completo | Si un hijo con `title` propio lo tapa, anotarlo |
| 6 | Con `?hl=ar`: la etiqueta | alineada a la derecha, sin tapar el icono | Ajustar `inset-inline-*` |

Anotar los resultados en el addendum del diseño y hacer commit.

---

## Fuera de alcance

- Más idiomas en `LABELS` (una línea cada uno; cubierto por el fallback).
- Cambiar de idioma sin recargar: NotebookLM recarga al cambiar `hl`.
- `name` del manifest localizado.
