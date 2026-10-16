// Detecta la reproducción sondeando el DOM del reproductor de audio de
// NotebookLM (no existe ningún <audio> accesible: el reproductor es Angular
// Material). Señales: [aria-label="Pause audio player"] presente = sonando;
// el tiempo actual está en "MM:SS / MM:SS"; el jslog del botón identifica el
// artefacto que suena. Reutiliza el acumulador de escucha efectiva de lib.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const createPlaybackSession = NLM.lib.createPlaybackSession;
  const parsePlaybackSeconds = NLM.lib.parsePlaybackSeconds;
  const artifactIdFromJslog = NLM.lib.artifactIdFromJslog;

  function attachPlayerTracker(doc, onPlayed, opts) {
    const sel = (opts && opts.selectors) || NLM.selectors;
    const pollMs = (opts && opts.pollMs) || 500;
    // Aviso si el reproductor está abierto pero nunca se detecta reproducción
    // (p. ej. idioma de UI fuera de los soportados): rompe el silencio de
    // forma visible en vez de fallar sin síntomas.
    const warnAfterPolls = (opts && opts.warnAfterPolls) || 120;
    const session = createPlaybackSession();
    let wasPlaying = false;
    let lastArtifact = null;
    let silence = 0;
    let warned = false;

    function poll() {
      const pauseBtn = doc.querySelector(sel.playerPlaying);
      const timeEl = doc.querySelector(sel.playerTime);
      const playing = !!pauseBtn;
      const artifact = playing ? artifactIdFromJslog(pauseBtn.getAttribute('jslog')) : null;

      if (!playing && timeEl) {
        silence++;
        if (!warned && silence >= warnAfterPolls) {
          warned = true;
          console.warn(
            '[NLM] reproductor de audio abierto pero sin detección de reproducción; ' +
              '¿idioma de la UI no soportado por los selectores?'
          );
        }
      } else {
        silence = 0;
        warned = false;
      }

      // Sesión nueva al empezar a sonar o al cambiar de artefacto (cola).
      if (playing && (!wasPlaying || artifact !== lastArtifact)) session.play();
      if (!playing && wasPlaying) session.pause();
      wasPlaying = playing;
      lastArtifact = artifact;

      if (!playing) return null;
      const cur = timeEl ? parsePlaybackSeconds(timeEl.textContent) : null;
      if (cur === null) return null;
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
