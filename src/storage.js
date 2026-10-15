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
