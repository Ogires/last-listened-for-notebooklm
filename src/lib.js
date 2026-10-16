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

  // Textos visibles por idioma. Añadir un idioma = añadir una entrada aquí.
  // 'ago' envuelve la unidad: es "hace 3 h" / en "3h ago".
  const I18N = {
    es: {
      lastPlayed: 'Última escucha',
      ago: (s) => 'hace ' + s,
      sec: (n) => n + ' s',
      min: (n) => n + ' min',
      hour: (n) => n + ' h',
      day: (n) => n + (n === 1 ? ' día' : ' días'),
      week: (n) => n + (n === 1 ? ' semana' : ' semanas'),
      dateTime: (d) =>
        pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() +
        ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()),
    },
    en: {
      lastPlayed: 'Last listened',
      ago: (s) => s + ' ago',
      sec: (n) => n + 's',
      min: (n) => n + ' min',
      hour: (n) => n + 'h',
      day: (n) => n + (n === 1 ? ' day' : ' days'),
      week: (n) => n + (n === 1 ? ' week' : ' weeks'),
      dateTime: (d) =>
        pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()) + '/' + d.getFullYear() +
        ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()),
    },
  };

  // 'es-ES' -> es ; 'en-US' -> en ; desconocido/ausente -> es
  function pickLocale(lang) {
    const base = String(lang || 'es').toLowerCase().split('-')[0];
    return I18N[base] || I18N.es;
  }

  function formatDateTime(date, lang) {
    return pickLocale(lang).dateTime(date);
  }

  // es: "hace 30 s" | "hace 5 min" | "hace 3 h" | "hace 1 día" | "hace 2 semanas"
  // en: "30s ago" | "5 min ago" | "3h ago" | "1 day ago" | "2 weeks ago"
  function formatRelative(date, now, lang) {
    const L = pickLocale(lang);
    const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (sec < 60) return L.ago(L.sec(sec));
    const min = Math.floor(sec / 60);
    if (min < 60) return L.ago(L.min(min));
    const h = Math.floor(min / 60);
    if (h < 24) return L.ago(L.hour(h));
    const d = Math.floor(h / 24);
    if (d < 7) return L.ago(L.day(d));
    return L.ago(L.week(Math.floor(d / 7)));
  }

  // es: "Última escucha: 15/10/2026 12:44 (hace 2 h)"
  // en: "Last listened: 10/15/2026 12:44 (2h ago)"
  function formatLastPlayed(iso, now, lang) {
    const d = new Date(iso);
    return (
      pickLocale(lang).lastPlayed +
      ': ' +
      formatDateTime(d, lang) +
      ' (' +
      formatRelative(d, now || new Date(), lang) +
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

  // "  00:11 / 19:07" -> 11 ; "1:02:03 / ..." -> 3723 ; sin patrón -> null.
  // Anclado al inicio del componente horario para no aceptar decimales
  // parciales (p. ej. "00:0.5" no debe matchear el "5" suelto).
  function parsePlaybackSeconds(text) {
    const m = /^\s*((?:\d+:)*\d+)\s*\//.exec(text || '');
    if (!m) return null;
    const parts = m[1].split(':');
    return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
  }

  // jslog de NotebookLM: "id;track:...;0:<base64>" donde el base64 decodifica
  // a un array cuyo [0][0] es el UUID del cuaderno y [0][1] el del artefacto
  // (el resumen de audio). Devuelve el UUID del artefacto o null.
  function artifactIdFromJslog(jslog) {
    if (!jslog) return null;
    const m = /0:([A-Za-z0-9+/=]+)/.exec(jslog);
    if (!m) return null;
    try {
      const arr = JSON.parse(global.atob(m[1]));
      const first = Array.isArray(arr) ? arr[0] : null;
      return first && typeof first[1] === 'string' ? first[1] : null;
    } catch (e) {
      return null;
    }
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
    parsePlaybackSeconds,
    artifactIdFromJslog,
  };
})(globalThis);
