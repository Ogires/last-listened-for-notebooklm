import { describe, it, expect } from 'vitest';
import '../src/health.js';

const { health } = globalThis.NLM;

function monitor(persistMs) {
  let t = 0;
  const reports = [];
  const m = health.createHealthMonitor({
    report: (list) => reports.push(list),
    now: () => t,
    persistMs,
  });
  return { m, reports, advance: (ms) => (t += ms) };
}

describe('symptomsFromStats', () => {
  it('sin tarjetas no hay síntomas (cuaderno vacío o panel cerrado)', () => {
    expect(health.symptomsFromStats({ cards: 0, listenable: 0, keyed: 0, unknown: 0 })).toEqual({
      cards: false,
      keys: false,
    });
  });

  it('cards: ninguna tarjeta tiene icono reconocible', () => {
    expect(health.symptomsFromStats({ cards: 3, listenable: 0, keyed: 0, unknown: 3 }).cards).toBe(true);
    expect(health.symptomsFromStats({ cards: 3, listenable: 1, keyed: 1, unknown: 2 }).cards).toBe(false);
  });

  it('keys: hay audios pero ninguno da su identificador', () => {
    expect(health.symptomsFromStats({ cards: 2, listenable: 2, keyed: 0, unknown: 0 }).keys).toBe(true);
    expect(health.symptomsFromStats({ cards: 2, listenable: 2, keyed: 1, unknown: 0 }).keys).toBe(false);
  });

  it('solo cuestionarios y tarjetas didácticas no es un problema', () => {
    expect(health.symptomsFromStats({ cards: 4, listenable: 0, keyed: 0, unknown: 0 })).toEqual({
      cards: false,
      keys: false,
    });
  });
});

describe('createHealthMonitor', () => {
  it('informa de la lista vacía la primera vez (limpia el icono)', () => {
    const { m, reports } = monitor();
    m.update({ cards: false, keys: false });
    expect(reports).toEqual([[]]);
  });

  it('un síntoma pasajero no se notifica', () => {
    const { m, reports, advance } = monitor();
    m.update({ keys: true });
    advance(4000);
    m.update({ keys: false });
    advance(10000);
    m.check();
    expect(reports).toEqual([[]]);
  });

  it('un síntoma que persiste se notifica una sola vez y se retira al resolverse', () => {
    const { m, reports, advance } = monitor();
    m.update({ keys: true });
    advance(5000);
    m.check();
    m.update({ keys: true }); // sigue igual: no repite
    expect(reports).toEqual([[], ['keys']]);
    m.update({ keys: false });
    expect(reports).toEqual([[], ['keys'], []]);
  });

  it('el reproductor tiene más margen (carga del audio)', () => {
    const { m, reports, advance } = monitor();
    m.update({ player: true });
    advance(10000);
    m.check();
    expect(reports).toEqual([[]]);
    advance(20000);
    m.check();
    expect(reports).toEqual([[], ['player']]);
  });

  it('varios problemas a la vez, en orden estable', () => {
    const { m, reports, advance } = monitor({ player: 0 });
    m.update({ player: true, cards: true });
    advance(5000);
    m.check();
    expect(reports.at(-1)).toEqual(['cards', 'player']);
  });
});
