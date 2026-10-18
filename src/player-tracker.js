// Detecta la reproducción sondeando el DOM del reproductor de audio de
// NotebookLM (no existe ningún <audio> accesible: el reproductor es Angular
// Material). Dos señales de "sonando": (1) la etiqueta del botón central es
// de pausa en un idioma conocido — respuesta inmediata; (2) independiente del
// idioma: el texto "MM:SS / MM:SS" avanza a ritmo de reproducción. El jslog
// del botón identifica el artefacto. Reutiliza el acumulador de lib.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const createPlaybackSession = NLM.lib.createPlaybackSession;
  const parsePlaybackSeconds = NLM.lib.parsePlaybackSeconds;
  const artifactIdFromJslog = NLM.lib.artifactIdFromJslog;
  const MAX_DELTA_SEC = NLM.lib.MAX_DELTA_SEC;

  function attachPlayerTracker(doc, onPlayed, opts) {
    const sel = (opts && opts.selectors) || NLM.selectors;
    const pollMs = (opts && opts.pollMs) || 500;
    const now = (opts && opts.now) || Date.now;
    // El tiempo visible tiene resolución de 1 s y se sondea cada 500 ms: se
    // considera que suena mientras haya avanzado hace menos de stallMs.
    const stallMs = (opts && opts.stallMs) || 2500;
    // Aviso si hay reproductor pero su tiempo es ilegible (cambio de DOM):
    // sin tiempo no hay detección posible, mejor decirlo que fallar mudo.
    const warnAfterPolls = (opts && opts.warnAfterPolls) || 120;
    const session = createPlaybackSession();
    let wasPlaying = false;
    let lastArtifact = null;
    let lastTimeSec = null;
    let lastAdvanceAt = -Infinity;
    let unreadable = 0;
    let warned = false;

    function poll() {
      const pauseBtn = doc.querySelector(sel.playerPlaying);
      const button = pauseBtn || doc.querySelector(sel.playerButton);
      const timeEl = doc.querySelector(sel.playerTime);
      const cur = timeEl ? parsePlaybackSeconds(timeEl.textContent) : null;

      // Para el autodiagnóstico (health.js), que decide si el síntoma persiste.
      if (opts && opts.onSymptom) opts.onSymptom(!!button && cur === null);
      if (button && cur === null) {
        unreadable++;
        if (!warned && unreadable >= warnAfterPolls) {
          warned = true;
          console.warn('[NLM] reproductor de audio sin tiempo legible; ¿cambió el DOM de NotebookLM?');
        }
      } else {
        unreadable = 0;
        warned = false;
      }

      // Avance a ritmo de reproducción; los seeks (saltos grandes o hacia
      // atrás) no cuentan como señal de que suena.
      if (cur !== null && lastTimeSec !== null) {
        const delta = cur - lastTimeSec;
        if (delta > 0 && delta <= MAX_DELTA_SEC) lastAdvanceAt = now();
      }
      lastTimeSec = cur;

      const playing =
        !!button && (!!pauseBtn || (cur !== null && now() - lastAdvanceAt < stallMs));
      const artifact = playing ? artifactIdFromJslog(button.getAttribute('jslog')) : null;

      // Sesión nueva al empezar a sonar o al cambiar de artefacto (cola).
      if (playing && (!wasPlaying || artifact !== lastArtifact)) session.play();
      if (!playing && wasPlaying) session.pause();
      wasPlaying = playing;
      lastArtifact = artifact;

      if (!playing || cur === null) return null;
      if (session.tick(cur)) {
        try {
          onPlayed(artifact);
        } catch (e) {
          console.warn('[NLM] error en onPlayed', e);
        }
        return artifact;
      }
      return null;
    }

    const timer = setInterval(poll, pollMs);
    poll();
    return {
      poll,
      disconnect() {
        clearInterval(timer);
      },
    };
  }

  NLM.playerTracker = { attachPlayerTracker };
})(globalThis);
