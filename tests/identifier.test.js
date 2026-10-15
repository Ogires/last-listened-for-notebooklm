import { describe, it, expect, vi } from 'vitest';
import '../src/lib.js';
import '../src/selectors.js';
import '../src/identifier.js';

const { identifier, selectors } = globalThis.NLM;

// Fixture genérico: la estructura real se ajusta en selectors.js; la lógica
// del identifier es independiente de ella.
function fixtureSelectors() {
  return {
    card: '.card',
    cardTitle: 'h3',
    playButton: 'button',
    playerTitle: '.player-title',
  };
}

function mountCards() {
  document.body.innerHTML = `
    <div class="cards">
      <div class="card"><h3>Resumen uno</h3><button aria-label="Reproducir">▶</button></div>
      <div class="card"><h3>Resumen dos</h3><button aria-label="Reproducir">▶</button></div>
    </div>`;
}

describe('activeOverviewKey', () => {
  it('devuelve null si no hay tarjetas', () => {
    document.body.innerHTML = '';
    expect(identifier.activeOverviewKey(document, fixtureSelectors())).toBeNull();
  });

  it('atribuye a la tarjeta cuyo botón está en estado "Pausar" (sonando)', () => {
    mountCards();
    document.querySelectorAll('.card button')[1].setAttribute('aria-label', 'Pausar');
    expect(identifier.activeOverviewKey(document, fixtureSelectors())).toBe('resumen dos');
  });

  it('atribuye por título del reproductor si ningún botón suena', () => {
    mountCards();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="player"><span class="player-title">Resumen uno</span></div>'
    );
    expect(identifier.activeOverviewKey(document, fixtureSelectors())).toBe('resumen uno');
  });

  it('fallback: primera tarjeta (con warn) si no puede atribuir', () => {
    mountCards();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(identifier.activeOverviewKey(document, fixtureSelectors())).toBe('resumen uno');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('usa los selectores globales si no se pasan explícitos', () => {
    mountCards();
    const orig = selectors.card;
    selectors.card = '.card';
    selectors.cardTitle = 'h3';
    selectors.playButton = 'button';
    selectors.playerTitle = '.player-title';
    document.querySelectorAll('.card button')[0].setAttribute('aria-label', 'Pause audio');
    expect(identifier.activeOverviewKey(document)).toBe('resumen uno');
    selectors.card = orig;
  });
});
