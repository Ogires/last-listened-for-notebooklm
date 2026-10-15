// Detecta reproducción en los elementos <audio> de la página: los actuales
// y los que aparezcan después (NotebookLM es SPA). onPlayed(audioEl) se
// llama cuando un audio supera el umbral de escucha efectiva por sesión.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const createPlaybackSession = NLM.lib.createPlaybackSession;

  function attachAudioTracker(doc, onPlayed) {
    // Por llamada: cada tracker gestiona sus propios elementos. Evita el
    // doble enganche dentro de un mismo tracker (scan inicial + observer).
    const hooked = new WeakSet();

    function hook(audioEl) {
      if (hooked.has(audioEl)) return;
      hooked.add(audioEl);
      const session = createPlaybackSession();

      audioEl.addEventListener('play', () => session.play());
      audioEl.addEventListener('pause', () => session.pause());
      audioEl.addEventListener('ended', () => session.pause());
      audioEl.addEventListener('timeupdate', () => {
        if (session.tick(audioEl.currentTime)) {
          try {
            onPlayed(audioEl);
          } catch (e) {
            console.warn('[NLM] error en onPlayed', e);
          }
        }
      });
    }

    function scan(root) {
      if (root.querySelectorAll) root.querySelectorAll('audio').forEach(hook);
    }

    scan(doc);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'AUDIO') hook(node);
          else scan(node);
        }
      }
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true });

    return { disconnect: () => observer.disconnect() };
  }

  NLM.playerTracker = { attachAudioTracker };
})(globalThis);
