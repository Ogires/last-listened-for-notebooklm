import { describe, it, expect } from 'vitest';
import '../src/lib.js';
import '../src/storage.js';

const { storage } = globalThis.NLM;

// Mock de chrome.storage.local estilo MV3 (promesas).
function fakeArea(initial) {
  const data = { ...initial };
  return {
    data,
    get: async (k) => (k === null ? { ...data } : { [k]: data[k] }),
    set: async (obj) => Object.assign(data, obj),
    remove: async (keys) => keys.forEach((k) => delete data[k]),
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

  // storage.onChanged: escucha en otra pestaña o historial borrado.
  it('applyChanges actualiza la caché con valores nuevos y borrados', async () => {
    const store = storage.createLastPlayedStore(fakeArea());
    await store.set('nb|a', 'v1');
    await store.set('nb|b', 'v1');
    const changed = store.applyChanges({
      'nb|a': { oldValue: { lastPlayed: 'v1' }, newValue: { lastPlayed: 'v2' } },
      'nb|b': { oldValue: { lastPlayed: 'v1' } }, // borrado: sin newValue
    });
    expect(changed).toBe(true);
    expect(await store.get('nb|a')).toBe('v2');
    expect(await store.get('nb|b')).toBeNull();
    expect(store.applyChanges({})).toBe(false);
  });
});

describe('historial (página de opciones)', () => {
  const initial = {
    'nb1|a': { lastPlayed: '2026-10-15T10:44:00.000Z' },
    'nb2|b': { lastPlayed: '2026-10-16T10:44:00.000Z' },
    otraCosa: { x: 1 }, // no es una escucha: no se cuenta ni se borra
  };

  it('historyKeys cuenta solo las escuchas', async () => {
    expect((await storage.historyKeys(fakeArea(initial))).sort()).toEqual(['nb1|a', 'nb2|b']);
  });

  it('clearHistory borra solo las escuchas y dice cuántas', async () => {
    const area = fakeArea(initial);
    expect(await storage.clearHistory(area)).toBe(2);
    expect(Object.keys(area.data)).toEqual(['otraCosa']);
    expect(await storage.clearHistory(area)).toBe(0);
  });
});
