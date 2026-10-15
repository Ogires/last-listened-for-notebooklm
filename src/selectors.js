// Selectores del DOM de NotebookLM. ⚠ PLACEHOLDER HEURÍSTICO: se validan y
// ajustan en la fase de inspección real (Task 10). Único lugar del código
// que conoce la estructura de la página.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});

  NLM.selectors = {
    // Contenedor de la lista de Audio Overviews (panel Studio).
    cardsContainer: 'body',
    // Tarjeta individual de un Audio Overview.
    card: '[class*="udioverview" i], [class*="audio-overview" i]',
    // Título visible del resumen dentro de la tarjeta.
    cardTitle: 'h1, h2, h3, h4, [class*="title" i]',
    // Botón de reproducir/pausar de la tarjeta (aria-label cambia con el estado).
    playButton: 'button',
    // Título en el reproductor expandido.
    playerTitle: '[class*="title" i]',
  };
})(globalThis);
