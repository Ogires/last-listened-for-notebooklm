import { describe, it, expect } from 'vitest';
import '../src/lib.js';
import '../src/selectors.js';
import '../src/label-renderer.js';

const { labelRenderer } = globalThis.NLM;
const ISO = '2026-10-15T10:44:00.000Z';

function jslog(artifact) {
  return '267035;track:generic_click,impression;0:' + btoa(JSON.stringify([['nb1', artifact]]));
}

function cardHtml(artifact, title) {
  const btn = artifact
    ? `<nb-icon-button mattooltip="Play" jslog="${jslog(artifact)}"></nb-icon-button>`
    : '';
  return `<artifact-library-item><div class="artifact-button-content">${title}${btn}</div></artifact-library-item>`;
}

function setup(cardsHtml, timestamps) {
  document.body.innerHTML = `<artifact-library>${cardsHtml}</artifact-library>`;
  globalThis.NLM.selectors.cardPlayButton =
    'nb-icon-button[mattooltip="Play"], nb-icon-button[mattooltip="Pause"]';
  const getTimestamp = async (key) => timestamps[key] || null;
  return labelRenderer.createLabelRenderer({
    notebookId: 'nb1',
    getTimestamp,
    refreshMs: 60000,
  });
}

describe('createLabelRenderer', () => {
  it('inyecta la etiqueta en tarjetas con registro (clave = UUID del artefacto)', async () => {
    const renderer = setup(
      cardHtml('art-1', 'Resumen uno') + cardHtml('art-2', 'Resumen dos'),
      { 'art-1': ISO }
    );
    await new Promise((r) => setTimeout(r, 0));
    const labels = document.querySelectorAll('.nlm-last-played');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent).toContain('Última escucha: ');
    expect(labels[1].textContent).toBe('');
    renderer.disconnect();
  });

  it('se salta las tarjetas sin jslog (otros tipos de artefacto)', async () => {
    const renderer = setup(cardHtml(null, 'Sin botón') + cardHtml('art-2', 'Resumen dos'), {
      'art-2': ISO,
    });
    await new Promise((r) => setTimeout(r, 0));
    const labels = document.querySelectorAll('.nlm-last-played');
    expect(labels.length).toBe(1);
    expect(labels[0].textContent).toContain('Última escucha');
    renderer.disconnect();
  });

  it('detecta tarjetas añadidas después (MutationObserver)', async () => {
    const renderer = setup(cardHtml('art-1', 'Resumen uno'), {});
    await new Promise((r) => setTimeout(r, 0));
    document.querySelector('artifact-library').insertAdjacentHTML(
      'beforeend',
      cardHtml('art-2', 'Resumen dos')
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.nlm-last-played').length).toBe(2);
    renderer.disconnect();
  });

  it('refresh() actualiza cuando llega un registro nuevo', async () => {
    const timestamps = {};
    const renderer = setup(cardHtml('art-1', 'Resumen uno'), timestamps);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.nlm-last-played').textContent).toBe('');
    timestamps['art-1'] = ISO;
    await renderer.refresh();
    expect(document.querySelector('.nlm-last-played').textContent).toContain('Última escucha');
    renderer.disconnect();
  });

  it('no entra en bucle: converge tras el render inicial', async () => {
    const renderer = setup(cardHtml('art-1', 'Resumen uno'), { 'art-1': ISO });
    await new Promise((r) => setTimeout(r, 20));
    const first = document.querySelector('.nlm-last-played').textContent;
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('.nlm-last-played').textContent).toBe(first);
    expect(document.querySelectorAll('.nlm-last-played').length).toBe(1);
    renderer.disconnect();
  });
});
