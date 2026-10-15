// Atribuye el audio que suena a un resumen concreto de la lista.
// Estrategia en orden: 1) tarjeta con botón en estado "sonando";
// 2) coincidencia de título con el reproductor expandido; 3) fallback a la
// primera tarjeta (mejor que perder el registro) con aviso en consola.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const overviewKeyFromCardData = NLM.lib.overviewKeyFromCardData;

  function cardKey(card, sel) {
    const index = Array.prototype.indexOf.call(card.parentElement.children, card);
    const titleEl = card.querySelector(sel.cardTitle);
    return overviewKeyFromCardData(titleEl && titleEl.textContent, index);
  }

  function activeOverviewKey(doc, selectorsOverride) {
    const sel = selectorsOverride || NLM.selectors;
    const cards = doc.querySelectorAll(sel.card);
    if (!cards.length) return null;

    // 1) Botón de la tarjeta en estado reproduciendo: el botón ofrece
    // "pausar" (es/pt: "Pausar…", en: "Pause…") solo mientras suena.
    // Ojo: no matchear "Reproducir/Play" — es el estado en reposo.
    const playingRe = /pausa|pause/i;
    for (const card of cards) {
      const btn = card.querySelector(sel.playButton);
      const label = btn && btn.getAttribute('aria-label');
      if (label && playingRe.test(label)) return cardKey(card, sel);
    }

    // 2) Título del reproductor expandido.
    const playerTitle = doc.querySelector(sel.playerTitle);
    if (playerTitle) {
      const t = (playerTitle.textContent || '').trim();
      for (const card of cards) {
        const titleEl = card.querySelector(sel.cardTitle);
        if (titleEl && titleEl.textContent.trim() === t) return cardKey(card, sel);
      }
    }

    // 3) Fallback.
    console.warn('[NLM] no se pudo atribuir la reproducción; usando la primera tarjeta');
    return cardKey(cards[0], sel);
  }

  NLM.identifier = { activeOverviewKey };
})(globalThis);
