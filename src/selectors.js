// Selectores del DOM de NotebookLM, validados por inspección en vivo
// (2026-10-15 y 2026-10-18, notebook.google.com) y resistentes al idioma de
// la UI: se priorizan clases/atributos estables sobre textos traducibles.
// Único lugar del código que conoce la estructura de la página.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});

  NLM.selectors = {
    // Biblioteca de artefactos generados (panel Studio).
    cardsContainer: 'artifact-library',
    // Tarjeta de cualquier artefacto (audio, vídeo, cuestionario, tarjetas…).
    card: 'artifact-library-item',
    // Clave de la tarjeta: id="artifact-labels-<UUID del artefacto>". Angular
    // reutiliza los nodos de tarjeta al insertar una nueva y actualiza este
    // id, pero NO el jslog de los botones (queda el del artefacto anterior).
    cardKey: '[id^="artifact-labels-"]',
    cardKeyPrefix: 'artifact-labels-',
    // Respaldo si desapareciera el id: botón de acción con jslog (todos los de
    // la tarjeta llevan el UUID del mismo artefacto, sea cual sea el idioma).
    cardPlayButton: 'nb-icon-button[mattooltip][jslog]',
    // Icono del tipo de artefacto: su texto es el nombre de la ligadura
    // (no se traduce): "audio_spark", "quiz", "copy", "progress_activity"…
    cardIcon: 'mat-icon.artifact-icon',
    // Ligaduras de los artefactos que se escuchan con el reproductor.
    listenableIcons: ['audio_spark'],
    // Ancla visual para inyectar la etiqueta: la fila de contenido de la
    // tarjeta (position: relative, 284x60 con overflow hidden).
    cardLabelAnchor: '.artifact-button-content',
    // Botón central del reproductor (clase estable); su jslog da el artefacto.
    // El reproductor se crea de nuevo en cada escucha: su jslog sí es fiable.
    playerButton: '.playback-control-button',
    // Atajo "sonando" si su etiqueta contiene "paus" (en/es/pt/de/fr/it). Para
    // el resto de idiomas el tracker usa el avance del tiempo.
    playerPlaying:
      '.playback-control-button[aria-label*="paus" i], .playback-control-button[mattooltip*="paus" i]',
    // Texto "MM:SS / MM:SS" con el tiempo actual del reproductor.
    playerTime: '.playback-time-container',
  };
})(globalThis);
