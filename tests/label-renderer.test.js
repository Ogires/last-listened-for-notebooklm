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
  // El tooltip en español demuestra que la clave es independiente del idioma:
  // el selector solo requiere [mattooltip][jslog].
  const btn = artifact
    ? `<nb-icon-button mattooltip="Reproducir" jslog="${jslog(artifact)}"></nb-icon-button>`
    : '';
  return `<artifact-library-item><div class="artifact-button-content">${title}${btn}</div></artifact-library-item>`;
}

// Estructura real (2026-10-18): icono de tipo (ligadura) + id con el UUID.
// jslogArt permite simular el jslog caducado de un nodo reutilizado.
function realCard(artifact, icon, { jslogArt = artifact } = {}) {
  const id = artifact ? ` id="artifact-labels-${artifact}"` : '';
  const btn = jslogArt
    ? `<nb-icon-button mattooltip="Reproducir" jslog="${jslog(jslogArt)}"></nb-icon-button>`
    : '';
  return `<artifact-library-item><div class="artifact-button-content">
      <mat-icon class="mat-icon artifact-icon">${icon}</mat-icon>
      <span class="artifact-labels"${id}>Título</span>${btn}
    </div></artifact-library-item>`;
}

// Lo que hace Angular al reutilizar un nodo: cambia id e icono, no el jslog.
function reuseCard(card, artifact, icon) {
  card.querySelector('[id^="artifact-labels-"]').id = 'artifact-labels-' + artifact;
  card.querySelector('mat-icon.artifact-icon').textContent = icon;
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const ISO2 = '2026-10-16T08:00:00.000Z';

function setup(cardsHtml, timestamps, optsExtra) {
  document.body.innerHTML = `<artifact-library>${cardsHtml}</artifact-library>`;
  const getTimestamp = async (key) => timestamps[key] || null;
  return labelRenderer.createLabelRenderer({
    notebookId: 'nb1',
    lang: 'es',
    getTimestamp,
    refreshMs: 60000,
    ...optsExtra,
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
    // la etiqueta vive dentro del ancla visual (.artifact-button-content)
    expect(labels[0].parentElement.className).toBe('artifact-button-content');
    // tooltip en la tarjeta (la etiqueta no recibe hover: pointer-events: none)
    const card = labels[0].closest('artifact-library-item');
    expect(card.title).toBe(labels[0].textContent);
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

  it('no pisa un title propio de la tarjeta', async () => {
    document.body.innerHTML = '';
    const renderer = setup(cardHtml('art-1', 'Resumen uno'), { 'art-1': ISO });
    const card = document.querySelector('artifact-library-item');
    card.title = 'title de NotebookLM';
    await renderer.refresh();
    expect(card.title).toBe('title de NotebookLM');
    renderer.disconnect();
  });

  // NotebookLM es una SPA: al volver a un cuaderno, Angular crea un
  // artifact-library nuevo y el observer del viejo ya no ve nada.
  it('isStale() detecta que Angular sustituyó el contenedor de tarjetas', async () => {
    const renderer = setup(cardHtml('art-1', 'Resumen uno'), {});
    expect(renderer.isStale()).toBe(false);
    document.body.innerHTML = '<artifact-library></artifact-library>';
    expect(renderer.isStale()).toBe(true);
    renderer.disconnect();
  });

  it('isStale() es true si se creó antes de que existiera el contenedor', () => {
    document.body.innerHTML = '';
    const renderer = labelRenderer.createLabelRenderer({
      notebookId: 'nb1',
      getTimestamp: async () => null,
    });
    expect(renderer.isStale()).toBe(false); // sigue sin contenedor: vigila body
    document.body.innerHTML = '<artifact-library></artifact-library>';
    expect(renderer.isStale()).toBe(true);
    renderer.disconnect();
  });

  it('etiqueta tarjetas con la estructura real (icono de tipo + id con el UUID)', async () => {
    const renderer = setup(realCard('art-1', 'audio_spark'), { 'art-1': ISO });
    await tick();
    expect(document.querySelector('.nlm-last-played').textContent).toContain('Última escucha');
    renderer.disconnect();
  });

  // Visto en vivo (2026-10-18): al generarse un artefacto nuevo, Angular
  // reutiliza los nodos de tarjeta desplazando su contenido; actualiza el id
  // "artifact-labels-<uuid>" pero deja el jslog del artefacto anterior.
  it('la clave sale del id de la tarjeta, no del jslog caducado', async () => {
    const renderer = setup(realCard('art-2', 'audio_spark', { jslogArt: 'art-1' }), {
      'art-1': ISO,
    });
    await tick();
    // art-2 no tiene escucha: vacía, no la fecha de art-1 que dice el jslog
    expect(document.querySelector('.nlm-last-played').textContent).toBe('');
    renderer.disconnect();
  });

  it('nodo reutilizado: la etiqueta sigue al artefacto, no al nodo', async () => {
    const renderer = setup(
      realCard('art-1', 'audio_spark') + realCard('art-2', 'audio_spark'),
      { 'art-1': ISO, 'art-2': ISO2 }
    );
    await tick();
    const texts = () =>
      [...document.querySelectorAll('artifact-library-item')].map(
        (c) => (c.querySelector('.nlm-last-played') || {}).textContent || ''
      );
    const [t1, t2] = texts();
    expect(t1).not.toBe(t2);
    // Angular inserta "generándose" arriba reutilizando los nodos: el primero
    // pasa a ser el nuevo artefacto, el segundo pasa a ser art-1 (jslog viejo).
    const [c1, c2] = document.querySelectorAll('artifact-library-item');
    reuseCard(c1, 'art-new', 'progress_activity');
    reuseCard(c2, 'art-1', 'audio_spark');
    document.querySelector('artifact-library').insertAdjacentHTML(
      'beforeend',
      realCard('art-2', 'audio_spark')
    );
    await tick(20);
    expect(texts()).toEqual(['', t1, t2]);
    expect(c1.hasAttribute('title')).toBe(false); // tooltip viejo retirado
    renderer.disconnect();
  });

  it('solo etiqueta resúmenes de audio (no cuestionarios ni tarjetas didácticas)', async () => {
    const renderer = setup(
      realCard('quiz-1', 'quiz') + realCard('cards-1', 'copy') + realCard('art-1', 'audio_spark'),
      { 'quiz-1': ISO, 'cards-1': ISO, 'art-1': ISO }
    );
    await tick();
    const labels = document.querySelectorAll('.nlm-last-played');
    expect(labels.length).toBe(1);
    expect(labels[0].closest('artifact-library-item').querySelector('[id]').id).toBe(
      'artifact-labels-art-1'
    );
    renderer.disconnect();
  });

  it('el id cambiado sin mutar hijos también re-renderiza', async () => {
    const renderer = setup(realCard('art-1', 'audio_spark'), { 'art-1': ISO, 'art-2': ISO2 });
    await tick();
    const before = document.querySelector('.nlm-last-played').textContent;
    document.querySelector('[id^="artifact-labels-"]').id = 'artifact-labels-art-2';
    await tick(20);
    expect(document.querySelector('.nlm-last-played').textContent).not.toBe(before);
    renderer.disconnect();
  });

  it('onStats informa de tarjetas, audios, claves y tipos desconocidos', async () => {
    const stats = [];
    const renderer = setup(
      realCard('art-1', 'audio_spark') +
        realCard('quiz-1', 'quiz') +
        cardHtml('art-3', 'Sin icono') +
        realCard(null, 'audio_spark', { jslogArt: null }),
      {},
      { onStats: (s) => stats.push(s) }
    );
    await tick();
    expect(stats[0]).toEqual({ cards: 4, listenable: 2, keyed: 1, unknown: 1 });
    renderer.disconnect();
  });

  it('usa el idioma recibido (en)', async () => {
    const renderer = setup(cardHtml('art-1', 'Resumen uno'), { 'art-1': ISO }, { lang: 'en' });
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.nlm-last-played').textContent).toMatch(/^Last listened: /);
    renderer.disconnect();
  });
});
