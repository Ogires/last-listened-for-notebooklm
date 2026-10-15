import { describe, it, expect, vi } from 'vitest';
import '../src/lib.js';
import '../src/player-tracker.js';

const { playerTracker } = globalThis.NLM;

function fire(el, type) {
  el.dispatchEvent(new window.Event(type));
}

// Simula 5 s de reproducción efectiva con deltas de 0.5 s.
function playFiveSeconds(el) {
  fire(el, 'play');
  for (let t = 0; t <= 5; t += 0.5) {
    el.currentTime = t;
    fire(el, 'timeupdate');
  }
}

describe('attachAudioTracker', () => {
  it('engancha un <audio> ya presente en el documento', () => {
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    playFiveSeconds(audio);
    expect(onPlayed).toHaveBeenCalledTimes(1);
    expect(onPlayed).toHaveBeenCalledWith(audio);
  });

  it('engancha los <audio> que aparecen después (MutationObserver)', async () => {
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    await new Promise((r) => setTimeout(r, 0)); // deja correr el observer
    playFiveSeconds(audio);
    expect(onPlayed).toHaveBeenCalledTimes(1);
  });

  it('no llama onPlayed si la escucha no llega al umbral', () => {
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    fire(audio, 'play');
    for (let t = 0; t <= 2; t += 0.5) {
      audio.currentTime = t;
      fire(audio, 'timeupdate');
    }
    fire(audio, 'pause');
    expect(onPlayed).not.toHaveBeenCalled();
  });

  it('una sesión nueva vuelve a notificar (reanudación otro día)', () => {
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    playFiveSeconds(audio);
    fire(audio, 'pause');
    playFiveSeconds(audio);
    expect(onPlayed).toHaveBeenCalledTimes(2);
  });

  it('los seeks no disparan la notificación', () => {
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    fire(audio, 'play');
    audio.currentTime = 0;
    fire(audio, 'timeupdate');
    audio.currentTime = 240; // seek al final
    fire(audio, 'timeupdate');
    expect(onPlayed).not.toHaveBeenCalled();
  });

  it('no engancha dos veces el mismo elemento dentro de un tracker', () => {
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    const onPlayed = vi.fn();
    playerTracker.attachAudioTracker(document, onPlayed);
    // El elemento se mueve por el DOM (SPA): el observer lo vuelve a ver.
    document.body.appendChild(audio);
    playFiveSeconds(audio);
    expect(onPlayed).toHaveBeenCalledTimes(1);
  });
});
