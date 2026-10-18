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

// Reproductor abierto con el tiempo ilegible (para el aviso de DOM roto).
function setPlayerUnreadableTime() {
  document.body.innerHTML = `<div class="player">
      <button class="playback-control-button" aria-label="Play audio player"></button>
      <div class="playback-time-container">--:-- / --:--</div>
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

  it('avisa en consola si el reproductor tiene el tiempo ilegible', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setPlayerUnreadableTime();
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

  it('un reproductor en pausa con tiempo legible no avisa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 5; i++) {
      setPlayer({ playing: true, seconds: 10, artifact: ART_1, label: 'Play audio player' });
      tracker.poll();
    }
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

// UI en un idioma sin "paus" en la etiqueta (japonés): solo queda la señal del
// tiempo. Reloj falso: cada poll avanza 500 ms y el texto, como en la UI real,
// tiene resolución de 1 s.
describe('attachPlayerTracker sin etiqueta de pausa reconocible', () => {
  const JA_PAUSE = '一時停止';
  let tracker;
  let onPlayed;
  let clock;

  beforeEach(() => {
    onPlayed = vi.fn();
    clock = 0;
    tracker = playerTracker.attachPlayerTracker(document, onPlayed, {
      pollMs: 60000,
      now: () => clock,
    });
  });

  function step(seconds, artifact = ART_1) {
    clock += 500;
    setPlayer({ playing: true, seconds, artifact, label: JA_PAUSE });
    tracker.poll();
  }

  function play(from, to, artifact) {
    for (let t = from; t <= to; t += 0.5) step(t, artifact);
  }

  it('detecta la reproducción por el avance del tiempo', () => {
    play(0, 5.5);
    expect(onPlayed).not.toHaveBeenCalled(); // 1 s perdido en detectar el avance
    play(6, 6);
    expect(onPlayed).toHaveBeenCalledTimes(1);
    expect(onPlayed).toHaveBeenCalledWith(ART_1);
  });

  it('un seek con el reproductor en pausa no cuenta como reproducción', () => {
    step(0);
    step(240); // salto en la barra
    for (let i = 0; i < 20; i++) step(240); // tiempo parado 10 s
    expect(onPlayed).not.toHaveBeenCalled();
  });

  it('el tiempo parado más de stallMs cierra la sesión; reanudar exige otros 5 s', () => {
    play(0, 3);
    for (let i = 0; i < 10; i++) step(3); // pausa de 5 s (> 2,5 s)
    play(3.5, 7.5); // 4 s más: no suma con los 2 s previos
    expect(onPlayed).not.toHaveBeenCalled();
    play(8, 9.5);
    expect(onPlayed).toHaveBeenCalledTimes(1);
  });
});

// Autodiagnóstico: el tracker informa en cada poll si ve el reproductor con
// el tiempo ilegible; health.js decide si persiste lo bastante para avisar.
describe('attachPlayerTracker: síntoma para el autodiagnóstico', () => {
  it('onSymptom es true solo con reproductor abierto y tiempo ilegible', () => {
    const symptoms = [];
    const t = playerTracker.attachPlayerTracker(document, vi.fn(), {
      pollMs: 60000,
      onSymptom: (bad) => symptoms.push(bad),
    });
    symptoms.length = 0; // descarta el poll inicial
    document.body.innerHTML = '';
    t.poll(); // sin reproductor
    setPlayer({ playing: true, seconds: 3, artifact: ART_1 });
    t.poll(); // tiempo legible
    setPlayerUnreadableTime();
    t.poll(); // tiempo ilegible
    expect(symptoms).toEqual([false, false, true]);
    t.disconnect();
  });
});
