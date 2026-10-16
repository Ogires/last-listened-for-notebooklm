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

  // https://notebooklm.google.com/notebook/<id>... -> "<id>"
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
    FALLBACK_LANG,
    createPlaybackSession,
    resolveLang,
    detectLang,
    formatDateTime,
    formatRelative,
    formatLastPlayed,
    getNotebookIdFromUrl,
    storageKey,
    parsePlaybackSeconds,
    artifactIdFromJslog,
  };
})(globalThis);
