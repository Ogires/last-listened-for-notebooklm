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
