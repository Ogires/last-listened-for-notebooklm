// Página de opciones: cuántas escuchas hay guardadas y "Borrar historial".
// Las pestañas de NotebookLM abiertas se enteran por storage.onChanged.
(function (global) {
  'use strict';
  const chrome = global.chrome;
  const doc = global.document;
  const area = chrome.storage.local;
  const msg = (key, subs) => chrome.i18n.getMessage(key, subs);

  doc.documentElement.lang = chrome.i18n.getUILanguage();
  doc.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = msg(el.dataset.i18n);
  });

  const countEl = doc.getElementById('count');
  const clearBtn = doc.getElementById('clear');
  const statusEl = doc.getElementById('status');

  async function showCount() {
    const n = (await global.NLM.storage.historyKeys(area)).length;
    countEl.textContent = msg('optionsHistory', [String(n)]);
    clearBtn.disabled = n === 0;
  }

  clearBtn.addEventListener('click', async () => {
    if (!global.confirm(msg('optionsClearConfirm'))) return;
    await global.NLM.storage.clearHistory(area);
    statusEl.textContent = msg('optionsCleared');
    await showCount();
  });

  // Escuchas nuevas mientras la página está abierta.
  chrome.storage.onChanged.addListener((changes, name) => {
    if (name === 'local') showCount();
  });

  showCount();
})(globalThis);
