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

// Simula el DOM del reproductor en un instante dado. El botón central usa la
// clase estable; el aria-label simula el idioma que toque.
function setPlayer({ playing, seconds, artifact, label }) {
  const aria = label || 'Pause audio player';
  document.body.innerHTML = playing
    ? `<div class="player">
         <button class="playback-control-button" aria-label="${aria}" jslog="${jslog(artifact)}"></button>
         <div class="playback-time-container">${fmt(seconds)} / 19:07</div>
       </div>`
    : '';
}

// Reproductor ABIERTO pero SIN botón de pausa (para el aviso de silencio).
function setPlayerOpenNotPlaying(seconds) {
  document.body.innerHTML = `<div class="player">
      <button class="playback-control-button" aria-label="Play audio player"></button>
      <div class="playback-time-container">${fmt(seconds)} / 19:07</div>
    </div>`;
}

function fmt(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s) % 60).padStart(2, '0');
}

function listen(tracker, { from = 0, to, artifact = ART_1 } = {}) {
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
    tracker = playerTracker.attachPlayerTracker(document, onPlayed, {
      pollMs: 60000,
      warnAfterPolls: 3,
    });
  });

  it('notifica tras 5 s de escucha efectiva con el artefacto correcto', () => {
    listen(tracker, { to: 5 });
    expect(onPlayed).toHaveBeenCalledTimes(1);
    expect(onPlayed).toHaveBeenCalledWith(ART_1);
  });

  it('detecta la reproducción con la UI en español ("Pausar…")', () => {
    listen(tracker, { to: 5 });
    // segunda escucha explícita con etiqueta en español desde el principio
    const onPlayed2 = vi.fn();
    const t2 = playerTracker.attachPlayerTracker(document, onPlayed2, { pollMs: 60000 });
    document.body.innerHTML = '';
    for (let t = 0; t <= 5; t += 0.5) {
      setPlayer({
        playing: true,
        seconds: t,
        artifact: ART_2,
        label: 'Pausar el reproductor de audio',
      });
      t2.poll();
    }
    expect(onPlayed2).toHaveBeenCalledTimes(1);
    expect(onPlayed2).toHaveBeenCalledWith(ART_2);
    t2.disconnect();
  });

  it('no notifica si no llega al umbral', () => {
    listen(tracker, { to: 2 });
    setPlayer({ playing: false });
    tracker.poll();
    expect(onPlayed).not.toHaveBeenCalled();
  });

  it('los seeks no acumulan (salto en la barra)', () => {
    listen(tracker, { to: 1 });
    setPlayer({ playing: true, seconds: 240, artifact: ART_1 }); // seek a 4:00
    tracker.poll();
    setPlayer({ playing: true, seconds: 240.5, artifact: ART_1 });
    tracker.poll();
    expect(onPlayed).not.toHaveBeenCalled();
  });

  it('pausar cierra la sesión; reanudar exige otros 5 s', () => {
    listen(tracker, { to: 6 });
    expect(onPlayed).toHaveBeenCalledTimes(1); // primera sesión
    setPlayer({ playing: false });
    tracker.poll();
    // reanuda en el minuto 3: sesión nueva, otros 5 s efectivos (183..187)
    listen(tracker, { from: 180, to: 182, artifact: ART_1 });
    expect(onPlayed).toHaveBeenCalledTimes(1); // aún sin segunda notificación
    listen(tracker, { from: 182, to: 187, artifact: ART_1 });
    expect(onPlayed).toHaveBeenCalledTimes(2); // segunda sesión completa
    expect(onPlayed).toHaveBeenLastCalledWith(ART_1);
  });

  it('cambiar de artefacto (cola) inicia sesión nueva y notifica al nuevo', () => {
    listen(tracker, { to: 5, artifact: ART_1 });
    expect(onPlayed).toHaveBeenCalledWith(ART_1);
    listen(tracker, { from: 0, to: 5, artifact: ART_2 });
    expect(onPlayed).toHaveBeenLastCalledWith(ART_2);
    expect(onPlayed).toHaveBeenCalledTimes(2);
  });

  it('sin reproductor en el DOM no hace nada', () => {
    setPlayer({ playing: false });
    expect(tracker.poll()).toBeNull();
    expect(onPlayed).not.toHaveBeenCalled();
  });

  it('avisa en consola si el reproductor está abierto pero no detecta nada', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setPlayerOpenNotPlaying(10);
    tracker.poll();
    tracker.poll();
    expect(warn).not.toHaveBeenCalled(); // aún bajo el umbral (3)
    tracker.poll();
    expect(warn).toHaveBeenCalledTimes(1); // avisa una sola vez
    tracker.poll();
    tracker.poll();
    expect(warn).toHaveBeenCalledTimes(1); // no repite el aviso
    warn.mockRestore();
  });
});
