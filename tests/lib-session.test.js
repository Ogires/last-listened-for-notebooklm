import { describe, it, expect } from 'vitest';
import '../src/lib.js';

const { lib } = globalThis.NLM;

describe('createPlaybackSession', () => {
  it('registra al acumular 5 s en deltas válidos', () => {
    const s = lib.createPlaybackSession();
    s.play();
    let fired = false;
    for (let t = 0; t <= 5; t += 0.5) if (s.tick(t)) fired = true;
    expect(fired).toBe(true);
  });

  it('no registra si la sesión no supera el umbral', () => {
    const s = lib.createPlaybackSession();
    s.play();
    let fired = false;
    for (let t = 0; t <= 2; t += 0.5) if (s.tick(t)) fired = true;
    s.pause();
    expect(fired).toBe(false);
  });

  it('los seeks (delta grande) no acumulan', () => {
    const s = lib.createPlaybackSession();
    s.play();
    s.tick(0);
    expect(s.tick(120)).toBe(false); // salto a 2:00
    expect(s.tick(121)).toBe(false);
    expect(s.tick(122)).toBe(false);
  });

  it('rebobinar (delta negativo) no acumula', () => {
    const s = lib.createPlaybackSession();
    s.play();
    s.tick(10);
    expect(s.tick(2)).toBe(false);
  });

  it('dispara una sola vez por sesión', () => {
    const s = lib.createPlaybackSession();
    s.play();
    let count = 0;
    for (let t = 0; t <= 10; t += 0.5) if (s.tick(t)) count++;
    expect(count).toBe(1);
  });

  it('una sesión nueva tras pausa vuelve a poder registrar', () => {
    const s = lib.createPlaybackSession();
    s.play();
    for (let t = 0; t <= 6; t += 0.5) s.tick(t);
    s.pause();
    s.play();
    let fired = false;
    for (let t = 0; t <= 6; t += 0.5) if (s.tick(t)) fired = true;
    expect(fired).toBe(true);
  });

  it('tick fuera de sesión activa no acumula', () => {
    const s = lib.createPlaybackSession();
    expect(s.tick(3)).toBe(false);
    s.play();
    s.pause();
    expect(s.tick(4)).toBe(false);
  });
});
