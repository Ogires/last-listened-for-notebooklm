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
