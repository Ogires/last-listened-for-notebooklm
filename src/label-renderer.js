// Inyecta y actualiza "Última escucha: ..." en cada tarjeta de resumen.
// Anti-bucle: el observer ignora mutaciones cuya meta es una etiqueta propia
// y solo se escribe textContent cuando cambia.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const formatLastPlayed = NLM.lib.formatLastPlayed;
  const artifactIdFromJslog = NLM.lib.artifactIdFromJslog;

  const LABEL_CLASS = 'nlm-last-played';

  function createLabelRenderer(opts) {
    const doc = opts.doc || document;

    // La etiqueta vive dentro del ancla visual de la tarjeta (.artifact-
    // button-content), no como hija directa de la tarjeta (display: inline).
    function labelEl(card) {
      const anchor = card.querySelector(NLM.selectors.cardLabelAnchor) || card;
      let el = anchor.querySelector(':scope > .' + LABEL_CLASS);
      if (!el) {
        el = doc.createElement('div');
        el.className = LABEL_CLASS;
        anchor.appendChild(el);
      }
      return el;
    }

    // El tooltip va en la tarjeta: la etiqueta tiene pointer-events: none y
    // nunca recibe hover. No pisa un title que la tarjeta trajera de origen.
    function setCardTitle(card, text) {
      if (card.title && card.title !== card.dataset.nlmTitle) return;
      card.title = text;
      card.dataset.nlmTitle = text;
    }

    // Clave de la tarjeta: UUID del artefacto leído del jslog de su botón.
    // Tarjetas sin jslog (p. ej. tipos de artefacto sin tracker) se saltan.
    async function renderCard(card) {
      const btn = card.querySelector(NLM.selectors.cardPlayButton);
      const key = btn ? artifactIdFromJslog(btn.getAttribute('jslog')) : null;
      if (!key) return;
      const iso = await opts.getTimestamp(key);
      const el = labelEl(card);
      const text = iso ? formatLastPlayed(iso, new Date(), opts.lang) : '';
      if (el.textContent !== text) el.textContent = text;
      setCardTitle(card, text);
      el.dataset.nlmIso = iso || '';
    }

    async function renderAll() {
      const cards = doc.querySelectorAll(NLM.selectors.card);
      const jobs = [];
      cards.forEach((card) => {
        try {
          jobs.push(renderCard(card));
        } catch (e) {
          console.warn('[NLM] renderCard', e);
        }
      });
      await Promise.all(jobs);
    }

    // Refresca solo los relativos, sin releer storage (usa data-nlm-iso).
    function refreshRelative() {
      doc.querySelectorAll('.' + LABEL_CLASS).forEach((el) => {
        if (el.dataset.nlmIso && el.textContent) {
          el.textContent = formatLastPlayed(el.dataset.nlmIso, new Date(), opts.lang);
          const card = el.closest(NLM.selectors.card);
          if (card) setCardTitle(card, el.textContent);
        }
      });
    }

    const relativeTimer = setInterval(refreshRelative, opts.refreshMs || 60000);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const t = m.target;
        if (!(t.classList && t.classList.contains(LABEL_CLASS))) {
          renderAll();
          return;
        }
      }
    });
    const container = doc.querySelector(NLM.selectors.cardsContainer);
    observer.observe(container || doc.body, { childList: true, subtree: true });

    renderAll();

    return {
      refresh: renderAll,
      // true si el contenedor observado ya no es el de la página (Angular lo
      // recreó al navegar, o apareció después de crear el renderer).
      isStale() {
        const current = doc.querySelector(NLM.selectors.cardsContainer);
        return current !== container && current !== null;
      },
      disconnect() {
        observer.disconnect();
        clearInterval(relativeTimer);
      },
    };
  }

  NLM.labelRenderer = { createLabelRenderer, LABEL_CLASS };
})(globalThis);
