import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../src/lib.js';
import '../src/selectors.js';
import '../src/player-tracker.js';

const { playerTracker } = globalThis.NLM;

const ART_1 = 'art-1111';
const ART_2 = 'art-2222';

function jslog(artifact) {
  return '267035;track:generic_click,impression;0:' + btoa(JSON.stringify([['nb', artifact]]));
}

// Simula el DOM del reproductor en un instante dado.
function setPlayer({ playing, seconds, artifact }) {
  document.body.innerHTML = playing
    ? `<div class="player">
         <button aria-label="Pause audio player" jslog="${jslog(artifact)}"></button>
         <div class="playback-time-container">${fmt(seconds)} / 19:07</div>
       </div>`
    : '';
}

function fmt(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

// Simula la escucha: avanza el tiempo de 0.5 s en 0.5 s.
function listen(tracker, onPlayed, { from = 0, to, artifact = ART_1 } = {}) {
  for (let t = Math.round(from * 2) / 2; t <= to; t += 0.5) {
    setPlayer({ playing: true, seconds: t, artifact });
    tracker.poll();
  }
}

describe('attachPlayerTracker (DOM)', () => {
  let tracker;
  let onPlayed;

  beforeEach(() => {
    onPlayed = vi.fn();
    tracker = playerTracker.attachPlayerTracker(document, onPlayed, { pollMs: 60000 });
  });

  it('notifica tras 5 s de escucha efectiva con el artefacto correcto', () => {
    listen(tracker, onPlayed, { to: 5 });
    expect(onPlayed).toHaveBeenCalledTimes(1);
    expect(onPlayed).toHaveBeenCalledWith(ART_1);
  });

  it('no notifica si no llega al umbral', () => {
    listen(tracker, onPlayed, { to: 2 });
    setPlayer({ playing: false });
    tracker.poll();
    expect(onPlayed).not.toHaveBeenCalled();
  });

  it('los seeks no acumulan (salto en la barra)', () => {
    listen(tracker, onPlayed, { to: 1 });
    setPlayer({ playing: true, seconds: 240, artifact: ART_1 }); // seek a 4:00
    tracker.poll();
    setPlayer({ playing: true, seconds: 240.5, artifact: ART_1 });
    tracker.poll();
    expect(onPlayed).not.toHaveBeenCalled();
  });

  it('pausar cierra la sesión; reanudar exige otros 5 s', () => {
    listen(tracker, onPlayed, { to: 6 });
    expect(onPlayed).toHaveBeenCalledTimes(1); // primera sesión
    setPlayer({ playing: false });
    tracker.poll();
    // reanuda en el minuto 3: sesión nueva, otros 5 s efectivos (183..187)
    listen(tracker, onPlayed, { from: 180, to: 182, artifact: ART_1 });
    expect(onPlayed).toHaveBeenCalledTimes(1); // aún sin segunda notificación
    listen(tracker, onPlayed, { from: 182, to: 187, artifact: ART_1 });
    expect(onPlayed).toHaveBeenCalledTimes(2); // segunda sesión completa
    expect(onPlayed).toHaveBeenLastCalledWith(ART_1);
  });

  it('cambiar de artefacto (cola) inicia sesión nueva y notifica al nuevo', () => {
    listen(tracker, onPlayed, { to: 5, artifact: ART_1 });
    expect(onPlayed).toHaveBeenCalledWith(ART_1);
    // salta a otro resumen: el tiempo se reinicia y el jslog cambia
    listen(tracker, onPlayed, { from: 0, to: 5, artifact: ART_2 });
    expect(onPlayed).toHaveBeenLastCalledWith(ART_2);
    expect(onPlayed).toHaveBeenCalledTimes(2);
  });

  it('sin botón de pausa no hace nada (nada sonando)', () => {
    setPlayer({ playing: false });
    expect(tracker.poll()).toBeNull();
    expect(onPlayed).not.toHaveBeenCalled();
  });
});
