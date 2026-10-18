// Inyecta y actualiza "Última escucha: ..." en cada tarjeta de resumen.
// Anti-bucle: el observer ignora mutaciones cuya meta es una etiqueta propia
// y solo se escribe textContent cuando cambia.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const formatLastPlayed = NLM.lib.formatLastPlayed;
  const artifactIdFromJslog = NLM.lib.artifactIdFromJslog;

  const LABEL_CLASS = 'nlm-last-played';

  // UUID del artefacto de la tarjeta. Primero el id de sus etiquetas (Angular
  // lo actualiza al reutilizar el nodo); el jslog solo como respaldo, porque
  // en nodos reutilizados apunta al artefacto que ocupaba antes la tarjeta.
  function cardKey(card) {
    const sel = NLM.selectors;
    const el = card.querySelector(sel.cardKey);
    if (el && el.id.length > sel.cardKeyPrefix.length) return el.id.slice(sel.cardKeyPrefix.length);
    const btn = card.querySelector(sel.cardPlayButton);
    return btn ? artifactIdFromJslog(btn.getAttribute('jslog')) : null;
  }

  // 'listenable' (audio), 'other' (cuestionario, generándose…) o 'unknown'
  // (sin icono reconocible: el DOM cambió; se etiqueta igual si hay clave).
  function cardKind(card) {
    const icon = card.querySelector(NLM.selectors.cardIcon);
    if (!icon) return 'unknown';
    return NLM.selectors.listenableIcons.includes(icon.textContent.trim()) ? 'listenable' : 'other';
  }

  function createLabelRenderer(opts) {
    const doc = opts.doc || document;

    // La etiqueta vive dentro del ancla visual de la tarjeta (.artifact-
    // button-content), no como hija directa de la tarjeta (display: inline).
    function labelEl(card, create) {
      const anchor = card.querySelector(NLM.selectors.cardLabelAnchor) || card;
      let el = anchor.querySelector(':scope > .' + LABEL_CLASS);
      if (!el && create) {
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

    // Nodo reutilizado para algo que no se etiqueta: quitar lo que hubiera.
    function clearCard(card) {
      const el = labelEl(card, false);
      if (el) el.remove();
      if (card.dataset.nlmTitle !== undefined) {
        if (card.title === card.dataset.nlmTitle) card.removeAttribute('title');
        delete card.dataset.nlmTitle;
      }
    }

    async function renderCard(card, key) {
      const iso = await opts.getTimestamp(key);
      // Angular pudo reutilizar el nodo mientras se leía storage.
      if (cardKey(card) !== key) return;
      const el = labelEl(card, true);
      const text = iso ? formatLastPlayed(iso, new Date(), opts.lang) : '';
      if (el.textContent !== text) el.textContent = text;
      setCardTitle(card, text);
      el.dataset.nlmIso = iso || '';
    }

    async function renderAll() {
      const stats = { cards: 0, listenable: 0, keyed: 0, unknown: 0 };
      const jobs = [];
      doc.querySelectorAll(NLM.selectors.card).forEach((card) => {
        try {
          stats.cards++;
          const kind = cardKind(card);
          if (kind === 'unknown') stats.unknown++;
          if (kind === 'other') return clearCard(card);
          if (kind === 'listenable') stats.listenable++;
          const key = cardKey(card);
          if (!key) return clearCard(card);
          if (kind === 'listenable') stats.keyed++;
          jobs.push(renderCard(card, key));
        } catch (e) {
          console.warn('[NLM] renderCard', e);
        }
      });
      if (opts.onStats) opts.onStats(stats);
      await Promise.all(jobs);
    }

    // Refresca solo los relativos, sin releer storage (usa data-nlm-iso).
    // En una pestaña oculta no hay nada que ver: se pone al día al volver.
    function refreshRelative() {
      if (doc.hidden) return;
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
    // 'id': un nodo reutilizado puede cambiar de artefacto sin mutar hijos.
    observer.observe(container || doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id'],
    });

    renderAll();

    return {
      refresh: renderAll,
      refreshRelative,
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

  NLM.labelRenderer = { createLabelRenderer, cardKey, cardKind, LABEL_CLASS };
})(globalThis);
