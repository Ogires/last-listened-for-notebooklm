# NotebookLM — Última Escucha: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extensión de Chrome (MV3) que registra la última vez que el usuario escuchó cada Audio Overview de NotebookLM (≥5 s efectivos) y lo muestra en la tarjeta del resumen.

**Architecture:** Content script único en `https://notebooklm.google.com/*`, sin background worker. Detección por eventos de elementos `<audio>`; atribución al resumen activo por heurísticas de UI; persistencia en `chrome.storage.local`; etiqueta inyectada con MutationObserver. Scripts clásicos compartiendo namespace `globalThis.NLM` (sin build step; la extensión se carga descomprimida).

**Tech Stack:** JavaScript vanilla (ES2020), Manifest V3, Vitest + jsdom para pruebas unitarias.

**Design doc:** `docs/plans/2026-10-15-notebooklm-last-played-design.md`

**Sobre este plan vs. el diseño:** añade `src/selectors.js` (constantes de selectores, único punto a ajustar tras inspección) y `src/identifier.js` (atribución de la reproducción) como archivos propios para poder testearlos por separado.

**Convención de carga:** todos los archivos de `src/` son scripts clásicos (sin `import`/`export`) que cuelgan módulos de `globalThis.NLM`. Se cargan en orden según `manifest.json`. En los tests se importan por sus efectos (`import '../src/lib.js'`).

---

### Task 1: Scaffold del proyecto

**Files:**
- Create: `manifest.json`, `package.json`, `vitest.config.mjs`, `.gitignore`, `README.md`, `tests/scaffold.test.js`

**Step 1: Crear `package.json`**

```json
{
  "name": "notebooklm-last-played",
  "private": true,
  "description": "Extensión de Chrome: última escucha de cada Audio Overview de NotebookLM",
  "scripts": {
    "test": "vitest run"
  }
}
```

**Step 2: Instalar dependencias de desarrollo**

Run: `npm install -D vitest jsdom`
Expected: `package.json` queda con `devDependencies` de `vitest` y `jsdom`.

**Step 3: Crear `vitest.config.mjs`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'jsdom' },
});
```

**Step 4: Crear `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "NotebookLM — Última escucha",
  "version": "0.1.0",
  "description": "Muestra la fecha y hora de la última vez que escuchaste cada resumen de audio de NotebookLM.",
  "permissions": ["storage"],
  "content_scripts": [
    {
      "matches": ["https://notebooklm.google.com/*"],
      "run_at": "document_idle",
      "css": ["src/styles.css"],
      "js": [
        "src/lib.js",
        "src/storage.js",
        "src/player-tracker.js",
        "src/selectors.js",
        "src/identifier.js",
        "src/label-renderer.js",
        "src/content.js"
      ]
    }
  ]
}
```

Nota: los archivos de `src/` aún no existen; se crean en los tasks siguientes. La extensión no se carga hasta el Task 9.

**Step 5: Crear `.gitignore`**

```
node_modules/
```

**Step 6: Crear `README.md`**

```markdown
# NotebookLM — Última escucha

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
```

**Step 7: Escribir el test de humo `tests/scaffold.test.js`**

```js
import { describe, it, expect } from 'vitest';

describe('scaffold', () => {
  it('vitest y jsdom funcionan', () => {
    expect(1 + 1).toBe(2);
    expect(window.document).toBeDefined();
  });
});
```

**Step 8: Verificar que pasa**

Run: `npm test`
Expected: PASS (1 test).

**Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold del proyecto (manifest MV3, vitest+jsdom, README)"
```

---

### Task 2: `lib.js` — sesión de reproducción (acumulador de 5 s)

**Files:**
- Create: `src/lib.js`
- Test: `tests/lib-session.test.js`

**Step 1: Escribir los tests que fallan `tests/lib-session.test.js`**

```js
import { describe, it, expect } from 'vitest';
import '../src/lib.js';

const { lib } = globalThis.NLM;

describe('createPlaybackSession', () => {
  it('registra al acumular 5 s en deltas válidos', () => {
    const s = lib.createPlaybackSession();
    s.play();
    let fired = false;
    for (let t = 0; t <= 5; t += 0.5) if (s.tick(t)) fired = true;
    expect(fired).toBe(true);
  });

  it('no registra si la sesión no supera el umbral', () => {
    const s = lib.createPlaybackSession();
    s.play();
    let fired = false;
    for (let t = 0; t <= 2; t += 0.5) if (s.tick(t)) fired = true;
    s.pause();
    expect(fired).toBe(false);
  });

  it('los seeks (delta grande) no acumulan', () => {
    const s = lib.createPlaybackSession();
    s.play();
    s.tick(0);
    expect(s.tick(120)).toBe(false); // salto a 2:00
    expect(s.tick(121)).toBe(false);
    expect(s.tick(122)).toBe(false);
  });

  it('rebobinar (delta negativo) no acumula', () => {
    const s = lib.createPlaybackSession();
    s.play();
    s.tick(10);
    expect(s.tick(2)).toBe(false);
  });

  it('dispara una sola vez por sesión', () => {
    const s = lib.createPlaybackSession();
    s.play();
    let count = 0;
    for (let t = 0; t <= 10; t += 0.5) if (s.tick(t)) count++;
    expect(count).toBe(1);
  });

  it('una sesión nueva tras pausa vuelve a poder registrar', () => {
    const s = lib.createPlaybackSession();
    s.play();
    for (let t = 0; t <= 6; t += 0.5) s.tick(t);
    s.pause();
    s.play();
    let fired = false;
    for (let t = 0; t <= 6; t += 0.5) if (s.tick(t)) fired = true;
    expect(fired).toBe(true);
  });

  it('tick fuera de sesión activa no acumula', () => {
    const s = lib.createPlaybackSession();
    expect(s.tick(3)).toBe(false);
    s.play();
    s.pause();
    expect(s.tick(4)).toBe(false);
  });
});
```

**Step 2: Verificar que fallan**

Run: `npx vitest run tests/lib-session.test.js`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'createPlaybackSession')`.

**Step 3: Implementar en `src/lib.js`**

```js
// Núcleo compartido por los content scripts. Se carga primero en manifest.json.
// Scripts clásicos sin import/export: todo cuelga de globalThis.NLM.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});

  const THRESHOLD_MS = 5000; // escucha efectiva mínima para registrar
  const MAX_DELTA_SEC = 1.5; // deltas mayores entre timeupdate = seek, no escucha

  // Sesión de reproducción: de play() a pause()/ended. tick(currentTimeSec)
  // devuelve true una única vez por sesión, al alcanzar el umbral.
  function createPlaybackSession(opts) {
    const thresholdMs = (opts && opts.thresholdMs) || THRESHOLD_MS;
    const maxDeltaSec = (opts && opts.maxDeltaSec) || MAX_DELTA_SEC;
    let active = false;
    let registered = false;
    let accumulatedMs = 0;
    let lastTime = null;

    return {
      play() {
        active = true;
        registered = false;
        accumulatedMs = 0;
        lastTime = null;
      },
      pause() {
        active = false;
        lastTime = null;
      },
      tick(currentTimeSec) {
        if (!active) return false;
        if (lastTime !== null) {
          const delta = currentTimeSec - lastTime;
          if (delta > 0 && delta <= maxDeltaSec) accumulatedMs += delta * 1000;
        }
        lastTime = currentTimeSec;
        if (!registered && accumulatedMs >= thresholdMs) {
          registered = true;
          return true;
        }
        return false;
      },
    };
  }

  NLM.lib = {
    THRESHOLD_MS,
    MAX_DELTA_SEC,
    createPlaybackSession,
  };
})(globalThis);
```

**Step 4: Verificar que pasan**

Run: `npx vitest run tests/lib-session.test.js`
Expected: PASS (7 tests).

**Step 5: Commit**

```bash
git add src/lib.js tests/lib-session.test.js
git commit -m "feat(lib): sesión de reproducción con umbral de 5 s efectivos"
```

---

### Task 3: `lib.js` — formato de fecha y tiempo relativo

**Files:**
- Modify: `src/lib.js`
- Test: `tests/lib-format.test.js`

**Step 1: Escribir los tests que fallan `tests/lib-format.test.js`**

```js
import { describe, it, expect } from 'vitest';
import '../src/lib.js';

const { lib } = globalThis.NLM;

describe('formatRelative', () => {
  const base = new Date(2026, 9, 15, 14, 0, 0); // 15/10/2026 14:00:00 local

  function rel(secAgo) {
    return lib.formatRelative(new Date(base.getTime() - secAgo * 1000), base);
  }

  it('segundos', () => expect(rel(30)).toBe('hace 30 s'));
  it('minutos', () => expect(rel(5 * 60)).toBe('hace 5 min'));
  it('horas', () => expect(rel(3 * 3600)).toBe('hace 3 h'));
  it('un día', () => expect(rel(24 * 3600)).toBe('hace 1 día'));
  it('varios días', () => expect(rel(3 * 24 * 3600)).toBe('hace 3 días'));
  it('semanas', () => expect(rel(14 * 24 * 3600)).toBe('hace 2 semanas'));
});

describe('formatLastPlayed', () => {
  it('formatea fecha, hora y relativo', () => {
    const now = new Date(2026, 9, 15, 14, 0);
    const iso = new Date(2026, 9, 15, 12, 44).toISOString();
    expect(lib.formatLastPlayed(iso, now)).toBe(
      'Última escucha: 15/10/2026 12:44 (hace 1 h)'
    );
  });
});
```

**Step 2: Verificar que fallan**

Run: `npx vitest run tests/lib-format.test.js`
Expected: FAIL — `TypeError: lib.formatRelative is not a function`.

**Step 3: Añadir a `src/lib.js` (dentro del IIFE, antes de `NLM.lib = {...}`)**

```js
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  // "15/10/2026 12:44" en hora local, sin depender del locale del sistema.
  function formatDateTime(date) {
    return (
      pad2(date.getDate()) +
      '/' +
      pad2(date.getMonth() + 1) +
      '/' +
      date.getFullYear() +
      ' ' +
      pad2(date.getHours()) +
      ':' +
      pad2(date.getMinutes())
    );
  }

  // "hace 30 s" | "hace 5 min" | "hace 3 h" | "hace 1 día" | "hace 2 semanas"
  function formatRelative(date, now) {
    const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (sec < 60) return 'hace ' + sec + ' s';
    const min = Math.floor(sec / 60);
    if (min < 60) return 'hace ' + min + ' min';
    const h = Math.floor(min / 60);
    if (h < 24) return 'hace ' + h + ' h';
    const d = Math.floor(h / 24);
    if (d < 7) return 'hace ' + d + (d === 1 ? ' día' : ' días');
    const w = Math.floor(d / 7);
    return 'hace ' + w + (w === 1 ? ' semana' : ' semanas');
  }

  // "Última escucha: 15/10/2026 12:44 (hace 2 h)"
  function formatLastPlayed(iso, now) {
    const d = new Date(iso);
    return (
      'Última escucha: ' +
      formatDateTime(d) +
      ' (' +
      formatRelative(d, now || new Date()) +
      ')'
    );
  }
```

Y exportarlas en el objeto `NLM.lib`:

```js
  NLM.lib = {
    THRESHOLD_MS,
    MAX_DELTA_SEC,
    createPlaybackSession,
    formatDateTime,
    formatRelative,
    formatLastPlayed,
  };
```

**Step 4: Verificar que pasan**

Run: `npx vitest run tests/lib-format.test.js`
Expected: PASS (7 tests).

**Step 5: Commit**

```bash
git add src/lib.js tests/lib-format.test.js
git commit -m "feat(lib): formato de fecha/hora y tiempo relativo en español"
```

---

### Task 4: `lib.js` — claves de cuaderno y resumen

**Files:**
- Modify: `src/lib.js`
- Test: `tests/lib-keys.test.js`

**Step 1: Escribir los tests que fallan `tests/lib-keys.test.js`**

```js
import { describe, it, expect } from 'vitest';
import '../src/lib.js';

const { lib } = globalThis.NLM;

describe('getNotebookIdFromUrl', () => {
  it('extrae el id del cuaderno de la URL', () => {
    expect(
      lib.getNotebookIdFromUrl('https://notebooklm.google.com/notebook/abc-123?tab=studio')
    ).toBe('abc-123');
  });
  it('devuelve null si no hay cuaderno en la URL', () => {
    expect(lib.getNotebookIdFromUrl('https://notebooklm.google.com/')).toBeNull();
  });
  it('devuelve null con URL vacía', () => {
    expect(lib.getNotebookIdFromUrl(null)).toBeNull();
  });
});

describe('storageKey', () => {
  it('combina cuaderno y resumen con separador', () => {
    expect(lib.storageKey('nb1', 'mi resumen')).toBe('nb1|mi resumen');
  });
});

describe('overviewKeyFromCardData', () => {
  it('normaliza el título (trim, minúsculas, espacios)', () => {
    expect(lib.overviewKeyFromCardData('  Mi   Resumen ', 0)).toBe('mi resumen');
  });
  it('usa el índice si no hay título', () => {
    expect(lib.overviewKeyFromCardData('', 2)).toBe('#2');
    expect(lib.overviewKeyFromCardData(null, 0)).toBe('#0');
  });
});
```

**Step 2: Verificar que fallan**

Run: `npx vitest run tests/lib-keys.test.js`
Expected: FAIL — `TypeError: lib.getNotebookIdFromUrl is not a function`.

**Step 3: Añadir a `src/lib.js` (dentro del IIFE) y exportar**

```js
  // https://notebooklm.google.com/notebook/<id>... -> "<id>"
  // El formato exacto se valida en la fase de inspección (Task 10).
  function getNotebookIdFromUrl(url) {
    const m = /\/notebook\/([0-9a-zA-Z-]+)/.exec(url || '');
    return m ? m[1] : null;
  }

  function storageKey(notebookId, overviewKey) {
    return String(notebookId) + '|' + String(overviewKey);
  }

  // Clave visible de una tarjeta: título normalizado; si no hay título,
  // índice dentro de la lista. Limitación conocida (ver design doc): dos
  // resúmenes con el mismo título colisionan; se refina en la inspección.
  function overviewKeyFromCardData(title, index) {
    const t = (title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return t || '#' + index;
  }
```

Añadir a `NLM.lib`: `getNotebookIdFromUrl, storageKey, overviewKeyFromCardData`.

**Step 4: Verificar que pasan**

Run: `npx vitest run tests/lib-keys.test.js`
Expected: PASS (6 tests).

**Step 5: Commit**

```bash
git add src/lib.js tests/lib-keys.test.js
git commit -m "feat(lib): claves de cuaderno (URL) y de resumen (título/índice)"
```

---

### Task 5: `storage.js` — persistencia con caché

**Files:**
- Create: `src/storage.js`
- Test: `tests/storage.test.js`

**Step 1: Escribir los tests que fallan `tests/storage.test.js`**

```js
import { describe, it, expect } from 'vitest';
import '../src/lib.js';
import '../src/storage.js';

const { storage } = globalThis.NLM;

// Mock de chrome.storage.local estilo MV3 (promesas).
function fakeArea() {
  const data = {};
  return {
    data,
    get: async (k) => ({ [k]: data[k] }),
    set: async (obj) => Object.assign(data, obj),
  };
}

describe('createLastPlayedStore', () => {
  it('set guarda {lastPlayed} y get lo recupera', async () => {
    const area = fakeArea();
    const store = storage.createLastPlayedStore(area);
    await store.set('nb1|resumen', '2026-10-15T10:44:00.000Z');
    expect(area.data['nb1|resumen']).toEqual({ lastPlayed: '2026-10-15T10:44:00.000Z' });
    expect(await store.get('nb1|resumen')).toBe('2026-10-15T10:44:00.000Z');
  });

  it('get devuelve null para claves sin registro', async () => {
    const store = storage.createLastPlayedStore(fakeArea());
    expect(await store.get('nb1|inexistente')).toBeNull();
  });

  it('la segunda lectura usa la caché sin tocar el área', async () => {
    const area = fakeArea();
    let getCalls = 0;
    const origGet = area.get;
    area.get = async (k) => (getCalls++, origGet(k));
    const store = storage.createLastPlayedStore(area);
    await store.set('k', 'v1');
    await store.get('k');
    await store.get('k');
    expect(getCalls).toBe(0); // tras set, la caché ya tiene el valor
  });

  it('set posterior prevalece', async () => {
    const store = storage.createLastPlayedStore(fakeArea());
    await store.set('k', 'v1');
    await store.set('k', 'v2');
    expect(await store.get('k')).toBe('v2');
  });
});
```

**Step 2: Verificar que fallan**

Run: `npx vitest run tests/storage.test.js`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'createLastPlayedStore')`.

**Step 3: Implementar `src/storage.js`**

```js
// Persistencia en chrome.storage.local con caché en memoria.
// El área se inyecta para poder testear sin Chrome.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});

  function createLastPlayedStore(area) {
    const cache = new Map();

    return {
      async get(key) {
        if (cache.has(key)) return cache.get(key);
        const obj = await area.get(key);
        const value = obj && obj[key] ? obj[key].lastPlayed : null;
        cache.set(key, value);
        return value;
      },

      async set(key, isoTimestamp) {
        cache.set(key, isoTimestamp);
        await area.set({ [key]: { lastPlayed: isoTimestamp } });
      },
    };
  }

  NLM.storage = { createLastPlayedStore };
})(globalThis);
```

**Step 4: Verificar que pasan**

Run: `npx vitest run tests/storage.test.js`
Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add src/storage.js tests/storage.test.js
git commit -m "feat(storage): store de últimas escuchas con caché sobre chrome.storage.local"
```

---

### Task 6: `player-tracker.js` — detección vía elementos `<audio>`

**Files:**
- Create: `src/player-tracker.js`
- Test: `tests/player-tracker.test.js`

**Step 1: Escribir los tests que fallan `tests/player-tracker.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import '../src/lib.js';
import '../src/player-tracker.js';

const { playerTracker } = globalThis.NLM;

function fire(el, type) {
  el.dispatchEvent(new window.Event(type));
}

// Simula 5 s de reproducción efectiva con deltas de 0.5 s.
function playFiveSeconds(el) {
  fire(el, 'play');
  for (let t = 0; t <= 5; t += 0.5) {
    el.currentTime = t;
    fire(el, 'timeupdate');
  }
}

describe('attachAudioTracker', () => {
  it('engancha un <audio> ya presente en el documento', () => {
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    playFiveSeconds(audio);
    expect(onPlayed).toHaveBeenCalledTimes(1);
    expect(onPlayed).toHaveBeenCalledWith(audio);
  });

  it('engancha los <audio> que aparecen después (MutationObserver)', async () => {
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    await new Promise((r) => setTimeout(r, 0)); // deja correr el observer
    playFiveSeconds(audio);
    expect(onPlayed).toHaveBeenCalledTimes(1);
  });

  it('no llama onPlayed si la escucha no llega al umbral', () => {
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    fire(audio, 'play');
    for (let t = 0; t <= 2; t += 0.5) {
      audio.currentTime = t;
      fire(audio, 'timeupdate');
    }
    fire(audio, 'pause');
    expect(onPlayed).not.toHaveBeenCalled();
  });

  it('una sesión nueva vuelve a notificar (reanudación otro día)', () => {
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    playFiveSeconds(audio);
    fire(audio, 'pause');
    playFiveSeconds(audio);
    expect(onPlayed).toHaveBeenCalledTimes(2);
  });

  it('los seeks no disparan la notificación', () => {
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    fire(audio, 'play');
    audio.currentTime = 0;
    fire(audio, 'timeupdate');
    audio.currentTime = 240; // seek al final
    fire(audio, 'timeupdate');
    expect(onPlayed).not.toHaveBeenCalled();
  });

  it('no engancha dos veces el mismo elemento', () => {
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    playerTracker.attachAudioTracker(document, onPlayed);
    playFiveSeconds(audio);
    expect(onPlayed).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Verificar que fallan**

Run: `npx vitest run tests/player-tracker.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'attachAudioTracker')`.

**Step 3: Implementar `src/player-tracker.js`**

```js
// Detecta reproducción en los elementos <audio> de la página: los actuales
// y los que aparezcan después (NotebookLM es SPA). onPlayed(audioEl) se
// llama cuando un audio supera el umbral de escucha efectiva por sesión.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const createPlaybackSession = NLM.lib.createPlaybackSession;

  function attachAudioTracker(doc, onPlayed) {
    const hooked = new WeakSet();

    function hook(audioEl) {
      if (hooked.has(audioEl)) return;
      hooked.add(audioEl);
      const session = createPlaybackSession();

      audioEl.addEventListener('play', () => session.play());
      audioEl.addEventListener('pause', () => session.pause());
      audioEl.addEventListener('ended', () => session.pause());
      audioEl.addEventListener('timeupdate', () => {
        if (session.tick(audioEl.currentTime)) {
          try {
            onPlayed(audioEl);
          } catch (e) {
            console.warn('[NLM] error en onPlayed', e);
          }
        }
      });
    }

    function scan(root) {
      if (root.querySelectorAll) root.querySelectorAll('audio').forEach(hook);
    }

    scan(doc);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'AUDIO') hook(node);
          else scan(node);
        }
      }
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true });

    return { disconnect: () => observer.disconnect() };
  }

  NLM.playerTracker = { attachAudioTracker };
})(globalThis);
```

**Step 4: Verificar que pasan**

Run: `npx vitest run tests/player-tracker.test.js`
Expected: PASS (6 tests).

**Step 5: Commit**

```bash
git add src/player-tracker.js tests/player-tracker.test.js
git commit -m "feat(player): tracker de reproducción sobre elementos <audio> con MutationObserver"
```

---

### Task 7: `selectors.js` + `identifier.js` — atribución al resumen activo

**Files:**
- Create: `src/selectors.js`, `src/identifier.js`
- Test: `tests/identifier.test.js`

**Step 1: Crear `src/selectors.js` (constantes, sin test propio)**

```js
// Selectores del DOM de NotebookLM. ⚠ PLACEHOLDER HEURÍSTICO: se validan y
// ajustan en la fase de inspección real (Task 10). Único lugar del código
// que conoce la estructura de la página.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});

  NLM.selectors = {
    // Contenedor de la lista de Audio Overviews (panel Studio).
    cardsContainer: 'body',
    // Tarjeta individual de un Audio Overview.
    card: '[class*="udioverview" i], [class*="audio-overview" i]',
    // Título visible del resumen dentro de la tarjeta.
    cardTitle: 'h1, h2, h3, h4, [class*="title" i]',
    // Botón de reproducir/pausar de la tarjeta (aria-label cambia con el estado).
    playButton: 'button',
    // Título en el reproductor expandido.
    playerTitle: '[class*="title" i]',
  };
})(globalThis);
```

**Step 2: Escribir los tests que fallan `tests/identifier.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import '../src/lib.js';
import '../src/selectors.js';
import '../src/identifier.js';

const { identifier, selectors } = globalThis.NLM;

// Fixture genérico: la estructura real se ajusta en selectors.js; la lógica
// del identifier es independiente de ella.
function fixtureSelectors() {
  return {
    card: '.card',
    cardTitle: 'h3',
    playButton: 'button',
    playerTitle: '.player-title',
  };
}

function mountCards() {
  document.body.innerHTML = `
    <div class="cards">
      <div class="card"><h3>Resumen uno</h3><button aria-label="Reproducir">▶</button></div>
      <div class="card"><h3>Resumen dos</h3><button aria-label="Reproducir">▶</button></div>
    </div>`;
}

describe('activeOverviewKey', () => {
  it('devuelve null si no hay tarjetas', () => {
    document.body.innerHTML = '';
    expect(identifier.activeOverviewKey(document, fixtureSelectors())).toBeNull();
  });

  it('atribuye a la tarjeta cuyo botón está en estado "Pausar" (sonando)', () => {
    mountCards();
    document.querySelectorAll('.card button')[1].setAttribute('aria-label', 'Pausar');
    expect(identifier.activeOverviewKey(document, fixtureSelectors())).toBe('resumen dos');
  });

  it('atribuye por título del reproductor si ningún botón suena', () => {
    mountCards();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="player"><span class="player-title">Resumen uno</span></div>'
    );
    expect(identifier.activeOverviewKey(document, fixtureSelectors())).toBe('resumen uno');
  });

  it('fallback: primera tarjeta (con warn) si no puede atribuir', () => {
    mountCards();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(identifier.activeOverviewKey(document, fixtureSelectors())).toBe('resumen uno');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('usa los selectores globales si no se pasan explícitos', () => {
    mountCards();
    const orig = selectors.card;
    selectors.card = '.card';
    selectors.cardTitle = 'h3';
    selectors.playButton = 'button';
    selectors.playerTitle = '.player-title';
    document.querySelectorAll('.card button')[0].setAttribute('aria-label', 'Pause audio');
    expect(identifier.activeOverviewKey(document)).toBe('resumen uno');
    selectors.card = orig;
  });
});
```

**Step 3: Verificar que fallan**

Run: `npx vitest run tests/identifier.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'activeOverviewKey')`.

**Step 4: Implementar `src/identifier.js`**

```js
// Atribuye el audio que suena a un resumen concreto de la lista.
// Estrategia en orden: 1) tarjeta con botón en estado "sonando";
// 2) coincidencia de título con el reproductor expandido; 3) fallback a la
// primera tarjeta (mejor que perder el registro) con aviso en consola.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const overviewKeyFromCardData = NLM.lib.overviewKeyFromCardData;

  function cardKey(card, sel) {
    const index = Array.prototype.indexOf.call(card.parentElement.children, card);
    const titleEl = card.querySelector(sel.cardTitle);
    return overviewKeyFromCardData(titleEl && titleEl.textContent, index);
  }

  function activeOverviewKey(doc, selectorsOverride) {
    const sel = selectorsOverride || NLM.selectors;
    const cards = doc.querySelectorAll(sel.card);
    if (!cards.length) return null;

    // 1) Botón de la tarjeta en estado reproduciendo.
    const playingRe = /pause|pausar|playing|reproduc/i;
    for (const card of cards) {
      const btn = card.querySelector(sel.playButton);
      const label = btn && btn.getAttribute('aria-label');
      if (label && playingRe.test(label)) return cardKey(card, sel);
    }

    // 2) Título del reproductor expandido.
    const playerTitle = doc.querySelector(sel.playerTitle);
    if (playerTitle) {
      const t = (playerTitle.textContent || '').trim();
      for (const card of cards) {
        const titleEl = card.querySelector(sel.cardTitle);
        if (titleEl && titleEl.textContent.trim() === t) return cardKey(card, sel);
      }
    }

    // 3) Fallback.
    console.warn('[NLM] no se pudo atribuir la reproducción; usando la primera tarjeta');
    return cardKey(cards[0], sel);
  }

  NLM.identifier = { activeOverviewKey };
})(globalThis);
```

**Step 5: Verificar que pasan**

Run: `npx vitest run tests/identifier.test.js`
Expected: PASS (5 tests).

**Step 6: Commit**

```bash
git add src/selectors.js src/identifier.js tests/identifier.test.js
git commit -m "feat(identifier): atribución del audio en reproducción a su resumen"
```

---

### Task 8: `label-renderer.js` — etiqueta "Última escucha"

**Files:**
- Create: `src/label-renderer.js`
- Test: `tests/label-renderer.test.js`

**Step 1: Escribir los tests que fallan `tests/label-renderer.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import '../src/lib.js';
import '../src/selectors.js';
import '../src/label-renderer.js';

const { labelRenderer } = globalThis.NLM;
const ISO = '2026-10-15T10:44:00.000Z';

function setup(cardsHtml, timestamps) {
  document.body.innerHTML = cardsHtml;
  globalThis.NLM.selectors.card = '.card';
  globalThis.NLM.selectors.cardTitle = 'h3';
  globalThis.NLM.selectors.cardsContainer = 'body';
  const getTimestamp = async (key) => timestamps[key] || null;
  return labelRenderer.createLabelRenderer({
    notebookId: 'nb1',
    getTimestamp,
    refreshMs: 60000,
  });
}

describe('createLabelRenderer', () => {
  it('inyecta la etiqueta en tarjetas con registro', async () => {
    const renderer = setup(
      `<div class="card"><h3>Resumen uno</h3></div>
       <div class="card"><h3>Resumen dos</h3></div>`,
      { 'resumen uno': ISO }
    );
    await new Promise((r) => setTimeout(r, 0));
    const labels = document.querySelectorAll('.nlm-last-played');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent).toContain('Última escucha: ');
    expect(labels[1].textContent).toBe('');
    renderer.disconnect();
  });

  it('detecta tarjetas añadidas después (MutationObserver)', async () => {
    const renderer = setup('<div class="card"><h3>Resumen uno</h3></div>', {});
    await new Promise((r) => setTimeout(r, 0));
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="card"><h3>Resumen dos</h3></div>'
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.nlm-last-played').length).toBe(2);
    renderer.disconnect();
  });

  it('refresh() actualiza cuando llega un registro nuevo', async () => {
    const timestamps = {};
    const renderer = setup('<div class="card"><h3>Resumen uno</h3></div>', timestamps);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.nlm-last-played').textContent).toBe('');
    timestamps['resumen uno'] = ISO;
    await renderer.refresh();
    expect(document.querySelector('.nlm-last-played').textContent).toContain('Última escucha');
    renderer.disconnect();
  });

  it('no entra en bucle: converge tras el render inicial', async () => {
    const renderer = setup(
      '<div class="card"><h3>Resumen uno</h3></div>',
      { 'resumen uno': ISO }
    );
    await new Promise((r) => setTimeout(r, 20)); // observer procesa mutaciones propias
    const first = document.querySelector('.nlm-last-played').textContent;
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('.nlm-last-played').textContent).toBe(first);
    expect(document.querySelectorAll('.nlm-last-played').length).toBe(1); // no duplica
    renderer.disconnect();
  });
});
```

**Step 2: Verificar que fallan**

Run: `npx vitest run tests/label-renderer.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'createLabelRenderer')`.

**Step 3: Implementar `src/label-renderer.js`**

```js
// Inyecta y actualiza "Última escucha: ..." en cada tarjeta de resumen.
// Anti-bucle: el observer ignora mutaciones cuya meta es una etiqueta propia
// y solo se escribe textContent cuando cambia.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const formatLastPlayed = NLM.lib.formatLastPlayed;
  const overviewKeyFromCardData = NLM.lib.overviewKeyFromCardData;
  const storageKey = NLM.lib.storageKey;

  const LABEL_CLASS = 'nlm-last-played';

  function createLabelRenderer(opts) {
    const doc = opts.doc || document;

    function labelEl(card) {
      let el = card.querySelector(':scope > .' + LABEL_CLASS);
      if (!el) {
        el = doc.createElement('div');
        el.className = LABEL_CLASS;
        card.appendChild(el);
      }
      return el;
    }

    async function renderCard(card, index) {
      const titleEl = card.querySelector(NLM.selectors.cardTitle);
      const ovKey = overviewKeyFromCardData(titleEl && titleEl.textContent, index);
      const iso = await opts.getTimestamp(ovKey);
      const el = labelEl(card);
      const text = iso ? formatLastPlayed(iso, new Date()) : '';
      if (el.textContent !== text) el.textContent = text;
      el.dataset.nlmIso = iso || '';
    }

    async function renderAll() {
      const cards = doc.querySelectorAll(NLM.selectors.card);
      const jobs = [];
      cards.forEach((card, i) => {
        try {
          jobs.push(renderCard(card, i));
        } catch (e) {
          console.warn('[NLM] renderCard', e);
        }
      });
      await Promise.all(jobs);
    }

    // Refresca solo los relativos, sin releer storage (usa data-nlm-isoinjectado).
    function refreshRelative() {
      doc.querySelectorAll('.' + LABEL_CLASS).forEach((el) => {
        if (el.dataset.nlmIso && el.textContent) {
          el.textContent = formatLastPlayed(el.dataset.nlmIso, new Date());
        }
      });
    }

    const relativeTimer = setInterval(refreshRelative, opts.refreshMs || 60000);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const t = m.target;
        if (!(t.classList && t.classList.contains(LABEL_CLASS))) {
          renderAll();
          return;
        }
      }
    });
    const container =
      doc.querySelector(NLM.selectors.cardsContainer) || doc.body;
    observer.observe(container, { childList: true, subtree: true });

    renderAll();

    return {
      refresh: renderAll,
      disconnect() {
        observer.disconnect();
        clearInterval(relativeTimer);
      },
    };
  }

  NLM.labelRenderer = { createLabelRenderer, LABEL_CLASS };
})(globalThis);
```

Nota: el comentario de una línea de `refreshRelative` tiene un typo en el nombre; el ejecutor debe escribirlo sin errata: `// Refresca solo los relativos, sin releer storage (usa data-nlm-iso inyectado).`

**Step 4: Verificar que pasan**

Run: `npx vitest run tests/label-renderer.test.js`
Expected: PASS (4 tests).

**Step 5: Suite completa en verde**

Run: `npm test`
Expected: PASS (todos los archivos).

**Step 6: Commit**

```bash
git add src/label-renderer.js tests/label-renderer.test.js
git commit -m "feat(renderer): etiqueta Última escucha en las tarjetas, anti-bucle"
```

---

### Task 9: `content.js` + `styles.css` — cableado final

**Files:**
- Create: `src/content.js`, `src/styles.css`

Sin tests unitarios (solo cableado); la verificación es manual (Tasks 10-11).

**Step 1: Implementar `src/content.js`**

```js
// Punto de entrada: conecta tracker + identifier + storage + renderer.
// NotebookLM es una SPA: al cambiar de cuaderno cambia la URL sin recargar,
// así que el renderer se vigila cada segundo y se recrea si cambia el cuaderno.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const getNotebookIdFromUrl = NLM.lib.getNotebookIdFromUrl;
  const storageKey = NLM.lib.storageKey;

  const store = NLM.storage.createLastPlayedStore(global.chrome.storage.local);

  let renderer = null;
  let renderedNotebookId = null;

  function ensureRenderer() {
    const nbId = getNotebookIdFromUrl(global.location.href);
    if (!nbId || nbId === renderedNotebookId) return;
    if (renderer) renderer.disconnect();
    renderedNotebookId = nbId;
    renderer = NLM.labelRenderer.createLabelRenderer({
      notebookId: nbId,
      getTimestamp: (ovKey) => store.get(storageKey(nbId, ovKey)),
    });
  }

  ensureRenderer();
  setInterval(ensureRenderer, 1000);

  NLM.playerTracker.attachAudioTracker(global.document, async () => {
    const nbId = getNotebookIdFromUrl(global.location.href) || 'unknown';
    const ovKey = NLM.identifier.activeOverviewKey(global.document) || 'unknown';
    const iso = new Date().toISOString();
    console.info('[NLM] escucha registrada:', nbId, ovKey, iso);
    await store.set(storageKey(nbId, ovKey), iso);
    ensureRenderer();
    if (renderer) renderer.refresh();
  });
})(globalThis);
```

**Step 2: Implementar `src/styles.css`**

```css
/* Etiqueta "Última escucha". Hereda el color del texto de la tarjeta para
   funcionar en tema claro y oscuro sin selectores adicionales. */
.nlm-last-played {
  font-size: 12px;
  line-height: 1.4;
  margin-top: 4px;
  opacity: 0.7;
  color: inherit;
}

.nlm-last-played:empty {
  display: none;
}
```

**Step 3: Suite completa sigue en verde**

Run: `npm test`
Expected: PASS (sin cambios; content.js no tiene tests).

**Step 4: Validar manifest**

Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest OK')"`
Expected: `manifest OK`.

**Step 5: Commit**

```bash
git add src/content.js src/styles.css
git commit -m "feat(content): cableado final y estilos de la etiqueta"
```

---

### Task 10: Inspección del DOM real de NotebookLM (ajuste de selectores)

**Files:**
- Modify: `src/selectors.js`, posiblemente `src/lib.js` (`overviewKeyFromCardData` si se encuentra un diferenciador mejor que el título)
- Create: `docs/plans/inspection-notes.md`

La extensión está **inerte** hasta este task: los selectores son placeholders. NotebookLM requiere sesión de Google; quien ejecute este task necesita el navegador con sesión iniciada (usuario, o sesión browser-use en la que el usuario haya hecho login manualmente).

**Step 1: Abrir NotebookLM** con un cuaderno que tenga ≥2 resúmenes de audio generados.

**Step 2: Con DevTools (F12 → Elements/Console), registrar en `docs/plans/inspection-notes.md`:**

1. **URL del cuaderno**: ¿formato `https://notebooklm.google.com/notebook/<id>`? Si difiere, corregir regex en `src/lib.js` (`getNotebookIdFromUrl`) y actualizar `tests/lib-keys.test.js`.
2. **Contenedor de la lista** de Audio Overviews en el panel Studio: selector más estable (priorizar `aria-label`, `data-*`; evitar clases CSS de Angular tipo `ng-tns-*` que cambian entre builds). → `cardsContainer`.
3. **Tarjeta individual**: selector que capture cada resumen. → `card`.
4. **Título dentro de la tarjeta**. → `cardTitle`.
5. **Botón play/pause de la tarjeta**: inspeccionar `aria-label` en reposo vs. reproduciendo (p. ej. "Reproducir" / "Pausar", o en inglés). Ajustar la regex `playingRe` de `src/identifier.js` si hace falta. → `playButton`.
6. **Reproductor expandido**: al reproducir, ¿aparece un panel con el título del resumen? → `playerTitle`.
7. **Elemento `<audio>`**: ejecutar en consola `document.querySelectorAll('audio').length` con la reproducción activa. Debe ser ≥1 (si es 0, el diseño falla: escalar antes de continuar).
8. **Títulos duplicados**: si la UI muestra fecha de creación u otro diferenciador por tarjeta, anotarlo para `overviewKeyFromCardData`.

Snippet de ayuda para la consola:

```js
copy([...document.querySelectorAll('audio')].map(a => ({
  src: (a.currentSrc || a.src || '').slice(0, 100),
  closestClass: a.closest('[class]') && a.closest('[class]').className,
})))
```

**Step 3: Actualizar `src/selectors.js`** con los selectores reales y, si aplica, `src/lib.js` + tests.

**Step 4: Suite completa**

Run: `npm test`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/selectors.js docs/plans/inspection-notes.md
git commit -m "feat(selectors): selectores reales de NotebookLM tras inspección"
```

---

### Task 11: Verificación manual end-to-end

**Files:**
- Modify: los necesarios para arreglar incidencias.

**Step 1: Cargar la extensión**: `chrome://extensions` → Modo desarrollador → Cargar descomprimida → carpeta raíz del proyecto.

**Step 2: Ejecutar el checklist del diseño** (en un cuaderno con ≥2 resúmenes):

1. Reproducir un resumen >5 s → la etiqueta aparece con fecha/hora actual.
2. Pausar antes de 5 s → NO aparece/actualiza etiqueta.
3. Recargar la página → la etiqueta persiste.
4. Reproducir un segundo resumen >5 s → cada tarjeta muestra su propia fecha.
5. (Si es posible) reanudar al día siguiente → timestamp se actualiza.
6. Tema claro y oscuro → etiqueta legible en ambos.

Consola de la página (`F12`) como apoyo: los registros muestran `[NLM] escucha registrada: ...`.

**Step 3: Arreglar incidencias** (selectores, regex de atribución, estilos), re-ejecutando `npm test` y el checklist.

**Step 4: Commit final**

```bash
git add -A
git commit -m "fix: ajustes tras verificación manual end-to-end"
```

---

## Resumen de dependencias

- Tasks 1-9: secuenciales, TDD, cada uno con commit.
- Task 10 requiere sesión de NotebookLM (humana) — bloquea el 11.
- Task 11 requiere Chrome con la extensión cargada.
