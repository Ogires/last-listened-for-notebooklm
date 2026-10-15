import { describe, it, expect } from 'vitest';
import '../src/lib.js';
import '../src/selectors.js';
import '../src/label-renderer.js';

const { labelRenderer } = globalThis.NLM;
const ISO = '2026-10-15T10:44:00.000Z';

function setup(cardsHtml, timestamps) {
  document.body.innerHTML = cardsHtml;
  globalThis.NLM.selectors.card = '.card';
  globalThis.NLM.selectors.cardTitle = 'h3';
  globalThis.NLM.selectors.cardsContainer = 'body';
  const getTimestamp = async (key) => timestamps[key] || null;
  return labelRenderer.createLabelRenderer({
    notebookId: 'nb1',
    getTimestamp,
    refreshMs: 60000,
  });
}

describe('createLabelRenderer', () => {
  it('inyecta la etiqueta en tarjetas con registro', async () => {
    const renderer = setup(
      `<div class="card"><h3>Resumen uno</h3></div>
       <div class="card"><h3>Resumen dos</h3></div>`,
      { 'resumen uno': ISO }
    );
    await new Promise((r) => setTimeout(r, 0));
    const labels = document.querySelectorAll('.nlm-last-played');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent).toContain('Última escucha: ');
    expect(labels[1].textContent).toBe('');
    renderer.disconnect();
  });

  it('detecta tarjetas añadidas después (MutationObserver)', async () => {
    const renderer = setup('<div class="card"><h3>Resumen uno</h3></div>', {});
    await new Promise((r) => setTimeout(r, 0));
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="card"><h3>Resumen dos</h3></div>'
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.nlm-last-played').length).toBe(2);
    renderer.disconnect();
  });

  it('refresh() actualiza cuando llega un registro nuevo', async () => {
    const timestamps = {};
    const renderer = setup('<div class="card"><h3>Resumen uno</h3></div>', timestamps);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.nlm-last-played').textContent).toBe('');
    timestamps['resumen uno'] = ISO;
    await renderer.refresh();
    expect(document.querySelector('.nlm-last-played').textContent).toContain('Última escucha');
    renderer.disconnect();
  });

  it('no entra en bucle: converge tras el render inicial', async () => {
    const renderer = setup(
      '<div class="card"><h3>Resumen uno</h3></div>',
      { 'resumen uno': ISO }
    );
    await new Promise((r) => setTimeout(r, 20)); // observer procesa mutaciones propias
    const first = document.querySelector('.nlm-last-played').textContent;
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('.nlm-last-played').textContent).toBe(first);
    expect(document.querySelectorAll('.nlm-last-played').length).toBe(1); // no duplica
    renderer.disconnect();
  });
});
