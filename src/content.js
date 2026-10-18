// Punto de entrada: conecta tracker + storage + renderer + autodiagnóstico.
// NotebookLM es una SPA: al cambiar de cuaderno cambia la URL sin recargar,
// así que el renderer se vigila cada segundo y se recrea si cambia el
// cuaderno o si Angular sustituyó el contenedor de tarjetas.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const getNotebookIdFromUrl = NLM.lib.getNotebookIdFromUrl;
  const storageKey = NLM.lib.storageKey;
  const doc = global.document;

  const store = NLM.storage.createLastPlayedStore(global.chrome.storage.local);

  // El service worker pone "!" en el icono de esta pestaña si hay problemas.
  // Tras actualizar la extensión, el content script viejo pierde el contexto
  // y sendMessage lanza: se ignora (la pestaña nueva ya informa).
  const health = NLM.health.createHealthMonitor({
    report(problems) {
      try {
        global.chrome.runtime.sendMessage({ type: 'nlm-health', problems }).catch(() => {});
      } catch (e) {
        /* contexto de extensión invalidado */
      }
    },
  });

  let renderer = null;
  let renderedNotebookId = null;

  function ensureRenderer() {
    health.check();
    // Pestaña oculta: nada que pintar; se pone al día en visibilitychange.
    if (doc.hidden) return;
    const nbId = getNotebookIdFromUrl(global.location.href);
    if (!nbId) {
      // Fuera de un cuaderno (lista): soltar el renderer para que volver al
      // mismo cuaderno lo recree sobre el DOM nuevo.
      if (renderer) renderer.disconnect();
      renderer = null;
      renderedNotebookId = null;
      health.update({ cards: false, keys: false });
      return;
    }
    if (nbId === renderedNotebookId && !renderer.isStale()) return;
    if (renderer) renderer.disconnect();
    renderedNotebookId = nbId;
    renderer = NLM.labelRenderer.createLabelRenderer({
      notebookId: nbId,
      lang: NLM.lib.detectLang(doc, global.navigator),
      getTimestamp: (ovKey) => store.get(storageKey(nbId, ovKey)),
      onStats: (stats) => health.update(NLM.health.symptomsFromStats(stats)),
    });
  }

  ensureRenderer();
  setInterval(ensureRenderer, 1000);

  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) return;
    ensureRenderer();
    if (renderer) renderer.refreshRelative();
  });

  // Escuchas desde otra pestaña o historial borrado en las opciones.
  global.chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && store.applyChanges(changes) && renderer) renderer.refresh();
  });

  // El tracker sigue sondeando con la pestaña oculta: el audio sigue sonando
  // en segundo plano y la escucha debe contar (Chrome ya limita el intervalo
  // a 1 s en pestañas ocultas, suficiente para el acumulador).
  NLM.playerTracker.attachPlayerTracker(
    doc,
    async (artifactId) => {
      const nbId = getNotebookIdFromUrl(global.location.href) || 'unknown';
      const ovKey = artifactId || 'unknown';
      const iso = new Date().toISOString();
      await store.set(storageKey(nbId, ovKey), iso);
      ensureRenderer();
      if (renderer) renderer.refresh();
    },
    { onSymptom: (bad) => health.update({ player: bad }) }
  );
})(globalThis);
