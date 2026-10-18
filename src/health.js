// Autodiagnóstico: detecta que NotebookLM cambió su DOM y la extensión ya no
// puede hacer su trabajo, para avisar (icono de la extensión) en vez de fallar
// en silencio. Un síntoma solo cuenta si persiste persistMs: durante la carga
// o una re-renderización de Angular el DOM pasa por estados intermedios.
// opts.persistMs ({código: ms}) sustituye los márgenes por defecto.
//
// Problemas (códigos estables; su texto está en _locales como health_<código>):
//   cards  — hay tarjetas pero ninguna tiene icono de tipo reconocible
//   keys   — hay tarjetas de audio pero de ninguna se obtiene su identificador
//   player — hay reproductor abierto pero su tiempo es ilegible
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});

  const CODES = ['cards', 'keys', 'player'];

  // Síntomas a partir de las estadísticas del renderer (una pasada de tarjetas).
  function symptomsFromStats(stats) {
    return {
      cards: stats.cards > 0 && stats.unknown === stats.cards,
      keys: stats.listenable > 0 && stats.keyed === 0,
    };
  }

  // El reproductor puede tardar en mostrar el tiempo mientras carga el audio:
  // más margen que para las tarjetas.
  const DEFAULT_PERSIST_MS = { cards: 5000, keys: 5000, player: 30000 };

  function createHealthMonitor(opts) {
    const persistMs = Object.assign({}, DEFAULT_PERSIST_MS, opts && opts.persistMs);
    const now = (opts && opts.now) || Date.now;
    const since = {}; // código -> instante desde el que el síntoma está presente
    let reported = null;

    // symptoms: { código: boolean }; los códigos ausentes no se tocan.
    function update(symptoms) {
      for (const code of Object.keys(symptoms)) {
        if (!symptoms[code]) delete since[code];
        else if (since[code] === undefined) since[code] = now();
      }
      check();
    }

    function problems() {
      return CODES.filter((c) => since[c] !== undefined && now() - since[c] >= persistMs[c]);
    }

    // Notifica solo cuando cambia la lista (y siempre la primera vez).
    function check() {
      const list = problems();
      const sig = list.join(',');
      if (sig === reported) return;
      reported = sig;
      opts.report(list);
    }

    return { update, check, problems };
  }

  NLM.health = { CODES, symptomsFromStats, createHealthMonitor };
})(globalThis);
