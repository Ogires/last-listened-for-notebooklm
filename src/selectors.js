// Selectores del DOM de NotebookLM, validados por inspección en vivo
// (2026-10-15, notebook.google.com). Único lugar del código que conoce la
// estructura de la página.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});

  NLM.selectors = {
    // Biblioteca de artefactos generados (panel Studio).
    cardsContainer: 'artifact-library',
    // Tarjeta de un Audio/Video Overview.
    card: 'artifact-library-item',
    // Botón reproducir/pausar de la tarjeta; su jslog lleva el UUID del
    // artefacto. El tooltip cambia entre "Play" y "Pause" según el estado.
    cardPlayButton: 'nb-icon-button[mattooltip="Play"], nb-icon-button[mattooltip="Pause"]',
    // Ancla visual para inyectar la etiqueta: la fila de contenido de la
    // tarjeta (position: relative, 284x60 con overflow hidden).
    cardLabelAnchor: '.artifact-button-content',
    // Botón del reproductor: presente solo mientras el audio SUENA
    // (en pausa vuelve a ser "Play audio player").
    playerPlaying: '[aria-label="Pause audio player"]',
    // Texto "MM:SS / MM:SS" con el tiempo actual del reproductor.
    playerTime: '.playback-time-container',
  };
})(globalThis);
