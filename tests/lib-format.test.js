import { describe, it, expect } from 'vitest';
import '../src/lib.js';

const { lib } = globalThis.NLM;

describe('formatRelative', () => {
  const base = new Date(2026, 9, 15, 14, 0, 0); // 15/10/2026 14:00:00 local

  function rel(secAgo) {
    return lib.formatRelative(new Date(base.getTime() - secAgo * 1000), base);
  }

  it('segundos', () => expect(rel(30)).toBe('hace 30 s'));
  it('minutos', () => expect(rel(5 * 60)).toBe('hace 5 min'));
  it('horas', () => expect(rel(3 * 3600)).toBe('hace 3 h'));
  it('un día', () => expect(rel(24 * 3600)).toBe('hace 1 día'));
  it('varios días', () => expect(rel(3 * 24 * 3600)).toBe('hace 3 días'));
  it('semanas', () => expect(rel(14 * 24 * 3600)).toBe('hace 2 semanas'));
});

describe('formatLastPlayed', () => {
  it('formatea fecha, hora y relativo', () => {
    const now = new Date(2026, 9, 15, 14, 0);
    const iso = new Date(2026, 9, 15, 12, 44).toISOString();
    expect(lib.formatLastPlayed(iso, now)).toBe(
      'Última escucha: 15/10/2026 12:44 (hace 1 h)'
    );
  });
});
