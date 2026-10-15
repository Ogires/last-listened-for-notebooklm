// Inyecta y actualiza "Última escucha: ..." en cada tarjeta de resumen.
// Anti-bucle: el observer ignora mutaciones cuya meta es una etiqueta propia
// y solo se escribe textContent cuando cambia.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const formatLastPlayed = NLM.lib.formatLastPlayed;
  const overviewKeyFromCardData = NLM.lib.overviewKeyFromCardData;

  const LABEL_CLASS = 'nlm-last-played';

  function createLabelRenderer(opts) {
    const doc = opts.doc || document;

    function labelEl(card) {
      let el = card.querySelector(':scope > .' + LABEL_CLASS);
      if (!el) {
        el = doc.createElement('div');
        el.className = LABEL_CLASS;
        card.appendChild(el);
      }
      return el;
    }

    async function renderCard(card, index) {
      const titleEl = card.querySelector(NLM.selectors.cardTitle);
      const ovKey = overviewKeyFromCardData(titleEl && titleEl.textContent, index);
      const iso = await opts.getTimestamp(ovKey);
      const el = labelEl(card);
      const text = iso ? formatLastPlayed(iso, new Date()) : '';
      if (el.textContent !== text) el.textContent = text;
      el.dataset.nlmIso = iso || '';
    }

    async function renderAll() {
      const cards = doc.querySelectorAll(NLM.selectors.card);
      const jobs = [];
      cards.forEach((card, i) => {
        try {
          jobs.push(renderCard(card, i));
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
          el.textContent = formatLastPlayed(el.dataset.nlmIso, new Date());
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
    const container = doc.querySelector(NLM.selectors.cardsContainer) || doc.body;
    observer.observe(container, { childList: true, subtree: true });

    renderAll();

    return {
      refresh: renderAll,
      disconnect() {
        observer.disconnect();
        clearInterval(relativeTimer);
      },
    };
  }

  NLM.labelRenderer = { createLabelRenderer, LABEL_CLASS };
})(globalThis);
