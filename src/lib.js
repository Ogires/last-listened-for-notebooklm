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

  NLM.lib = {
    THRESHOLD_MS,
    MAX_DELTA_SEC,
    createPlaybackSession,
    formatDateTime,
    formatRelative,
    formatLastPlayed,
    getNotebookIdFromUrl,
    storageKey,
    overviewKeyFromCardData,
  };
})(globalThis);
