// Service worker: muestra en el icono de la extensión, por pestaña, si el
// autodiagnóstico del content script (health.js) detecta un problema, y abre
// la página de opciones al pulsar el icono. Sin estado propio: Chrome borra
// el badge de una pestaña al cerrarla y el content script lo reenvía al cargar.
(function (global) {
  'use strict';
  const chrome = global.chrome;
  const KNOWN = ['cards', 'keys', 'player'];

  function showHealth(tabId, problems) {
    const codes = (Array.isArray(problems) ? problems : []).filter((c) => KNOWN.includes(c));
    const title = [chrome.i18n.getMessage('extName')]
      .concat(codes.map((c) => '⚠ ' + chrome.i18n.getMessage('health_' + c)))
      .join('\n');
    chrome.action.setBadgeText({ tabId, text: codes.length ? '!' : '' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#b3261e' });
    chrome.action.setTitle({ tabId, title });
  }

  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg && msg.type === 'nlm-health' && sender.tab && sender.tab.id !== undefined) {
      showHealth(sender.tab.id, msg.problems);
    }
  });

  chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

  global.NLMBackground = { showHealth };
})(globalThis);
