// Selectores del DOM de NotebookLM, validados por inspección en vivo
// (2026-10-15, notebook.google.com) y resistentes al idioma de la UI:
// se priorizan clases/atributos estables sobre textos traducibles.
// Único lugar del código que conoce la estructura de la página.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});

  NLM.selectors = {
    // Biblioteca de artefactos generados (panel Studio).
    cardsContainer: 'artifact-library',
    // Tarjeta de un Audio/Video Overview.
    card: 'artifact-library-item',
    // Cualquier botón de acción de la tarjeta con jslog sirve como clave:
    // todos llevan el UUID del mismo artefacto, sea cual sea el idioma
    // (el valor del tooltip "Play"/"Reproducir" es irrelevante aquí).
    cardPlayButton: 'nb-icon-button[mattooltip][jslog]',
    // Ancla visual para inyectar la etiqueta: la fila de contenido de la
    // tarjeta (position: relative, 284x60 con overflow hidden).
    cardLabelAnchor: '.artifact-button-content',
    // Botón central del reproductor. Estado "sonando" = su etiqueta contiene
    // "paus" (Pause/Pausa/Pausar/Pausieren... en en/es/pt/de/fr), anclado a
    // la clase estable del botón para no matchear nada ajeno.
    playerPlaying:
      '.playback-control-button[aria-label*="paus" i], .playback-control-button[mattooltip*="paus" i]',
    // Texto "MM:SS / MM:SS" con el tiempo actual del reproductor.
    playerTime: '.playback-time-container',
  };
})(globalThis);
