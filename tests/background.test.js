import { describe, it, expect, beforeAll } from 'vitest';

// chrome.* mínimo para el service worker: registra las llamadas.
const calls = [];
const listeners = {};
globalThis.chrome = {
  i18n: { getMessage: (k) => 'msg:' + k },
  action: {
    setBadgeText: (o) => calls.push(['badge', o]),
    setBadgeBackgroundColor: (o) => calls.push(['color', o]),
    setTitle: (o) => calls.push(['title', o]),
    onClicked: { addListener: (fn) => (listeners.clicked = fn) },
  },
  runtime: {
    onMessage: { addListener: (fn) => (listeners.message = fn) },
    openOptionsPage: () => calls.push(['options']),
  },
};

beforeAll(async () => {
  await import('../src/background.js');
});

const last = (kind) => calls.filter((c) => c[0] === kind).at(-1)[1];

describe('service worker (icono de la extensión)', () => {
  it('un problema pone "!" y lo explica en el tooltip de esa pestaña', () => {
    listeners.message({ type: 'nlm-health', problems: ['keys'] }, { tab: { id: 7 } });
    expect(last('badge')).toEqual({ tabId: 7, text: '!' });
    expect(last('title')).toEqual({ tabId: 7, title: 'msg:extName\n⚠ msg:health_keys' });
  });

  it('sin problemas retira el "!" y deja el nombre como tooltip', () => {
    listeners.message({ type: 'nlm-health', problems: [] }, { tab: { id: 7 } });
    expect(last('badge')).toEqual({ tabId: 7, text: '' });
    expect(last('title')).toEqual({ tabId: 7, title: 'msg:extName' });
  });

  it('ignora códigos desconocidos y mensajes ajenos', () => {
    const n = calls.length;
    listeners.message({ type: 'otro' }, { tab: { id: 7 } });
    listeners.message({ type: 'nlm-health', problems: ['keys'] }, {}); // sin pestaña
    expect(calls.length).toBe(n);
    listeners.message({ type: 'nlm-health', problems: ['inventado'] }, { tab: { id: 8 } });
    expect(last('badge')).toEqual({ tabId: 8, text: '' });
  });

  it('pulsar el icono abre las opciones', () => {
    listeners.clicked();
    expect(calls.at(-1)).toEqual(['options']);
  });
});
