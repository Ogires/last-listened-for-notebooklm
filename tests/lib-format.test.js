import { describe, it, expect } from 'vitest';
import '../src/lib.js';

const { lib } = globalThis.NLM;

describe('formatRelative (es, por defecto)', () => {
  const base = new Date(2026, 9, 15, 14, 0, 0); // 15/10/2026 14:00:00 local

  function rel(secAgo, lang) {
    return lib.formatRelative(new Date(base.getTime() - secAgo * 1000), base, lang);
  }

  it('segundos', () => expect(rel(30)).toBe('hace 30 s'));
  it('minutos', () => expect(rel(5 * 60)).toBe('hace 5 min'));
  it('horas', () => expect(rel(3 * 3600)).toBe('hace 3 h'));
  it('un día', () => expect(rel(24 * 3600)).toBe('hace 1 día'));
  it('varios días', () => expect(rel(3 * 24 * 3600)).toBe('hace 3 días'));
  it('semanas', () => expect(rel(14 * 24 * 3600)).toBe('hace 2 semanas'));
});

describe('formatRelative (en)', () => {
  const base = new Date(2026, 9, 15, 14, 0, 0);

  function rel(secAgo, lang) {
    return lib.formatRelative(new Date(base.getTime() - secAgo * 1000), base, lang);
  }

  it('seconds', () => expect(rel(30, 'en')).toBe('30s ago'));
  it('minutes', () => expect(rel(5 * 60, 'en')).toBe('5 min ago'));
  it('hours', () => expect(rel(3 * 3600, 'en')).toBe('3h ago'));
  it('one day', () => expect(rel(24 * 3600, 'en')).toBe('1 day ago'));
  it('days', () => expect(rel(3 * 24 * 3600, 'en')).toBe('3 days ago'));
  it('weeks', () => expect(rel(14 * 24 * 3600, 'en')).toBe('2 weeks ago'));
});

describe('detección de idioma (pickLocale vía formatters)', () => {
  const now = new Date(2026, 9, 15, 14, 0);
  const iso = new Date(2026, 9, 15, 12, 44).toISOString();

  it("'es-ES' se resuelve como es", () => {
    expect(lib.formatLastPlayed(iso, now, 'es-ES')).toBe(
      'Última escucha: 15/10/2026 12:44 (hace 1 h)'
    );
  });
  it("'en-US' se resuelve como en (fecha MM/DD)", () => {
    expect(lib.formatLastPlayed(iso, now, 'en-US')).toBe(
      'Last listened: 10/15/2026 12:44 (1h ago)'
    );
  });
  it('idioma sin tabla (fr) cae a español', () => {
    expect(lib.formatLastPlayed(iso, now, 'fr')).toBe(
      'Última escucha: 15/10/2026 12:44 (hace 1 h)'
    );
  });
  it('sin idioma explícito usa español (compatibilidad)', () => {
    expect(lib.formatLastPlayed(iso, now)).toBe(
      'Última escucha: 15/10/2026 12:44 (hace 1 h)'
    );
  });
});
