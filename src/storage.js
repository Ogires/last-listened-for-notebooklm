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

      // Aplica un evento chrome.storage.onChanged: escuchas en otra pestaña o
      // "Borrar historial" en las opciones. Devuelve si cambió alguna clave.
      applyChanges(changes) {
        const keys = Object.keys(changes || {});
        for (const key of keys) {
          const v = changes[key].newValue;
          cache.set(key, v && v.lastPlayed ? v.lastPlayed : null);
        }
        return keys.length > 0;
      },
    };
  }

  // Claves de escuchas guardadas ("<cuaderno>|<resumen>" -> {lastPlayed}).
  async function historyKeys(area) {
    const all = (await area.get(null)) || {};
    return Object.keys(all).filter((k) => k.includes('|') && all[k] && all[k].lastPlayed);
  }

  // Para la página de opciones. Solo borra escuchas, nada más del área.
  async function clearHistory(area) {
    const keys = await historyKeys(area);
    if (keys.length) await area.remove(keys);
    return keys.length;
  }

  NLM.storage = { createLastPlayedStore, historyKeys, clearHistory };
})(globalThis);
