// Punto de entrada: conecta tracker + storage + renderer. NotebookLM es una
// SPA: al cambiar de cuaderno cambia la URL sin recargar, así que el renderer
// se vigila cada segundo y se recrea si cambia el cuaderno o si Angular
// sustituyó el contenedor de tarjetas.
(function (global) {
  'use strict';
  const NLM = global.NLM || (global.NLM = {});
  const getNotebookIdFromUrl = NLM.lib.getNotebookIdFromUrl;
  const storageKey = NLM.lib.storageKey;

  const store = NLM.storage.createLastPlayedStore(global.chrome.storage.local);

  let renderer = null;
  let renderedNotebookId = null;

  function ensureRenderer() {
    const nbId = getNotebookIdFromUrl(global.location.href);
    if (!nbId) {
      // Fuera de un cuaderno (lista): soltar el renderer para que volver al
      // mismo cuaderno lo recree sobre el DOM nuevo.
      if (renderer) renderer.disconnect();
      renderer = null;
      renderedNotebookId = null;
      return;
    }
    if (nbId === renderedNotebookId && !renderer.isStale()) return;
    if (renderer) renderer.disconnect();
    renderedNotebookId = nbId;
    renderer = NLM.labelRenderer.createLabelRenderer({
      notebookId: nbId,
      lang: NLM.lib.detectLang(global.document, global.navigator),
      getTimestamp: (ovKey) => store.get(storageKey(nbId, ovKey)),
    });
  }

  ensureRenderer();
  setInterval(ensureRenderer, 1000);

  NLM.playerTracker.attachPlayerTracker(global.document, async (artifactId) => {
    const nbId = getNotebookIdFromUrl(global.location.href) || 'unknown';
    const ovKey = artifactId || 'unknown';
    const iso = new Date().toISOString();
    console.info('[NLM] escucha registrada:', nbId, ovKey, iso);
    await store.set(storageKey(nbId, ovKey), iso);
    ensureRenderer();
    if (renderer) renderer.refresh();
  });
})(globalThis);
