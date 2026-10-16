import { describe, it, expect } from 'vitest';
import '../src/lib.js';

const { lib } = globalThis.NLM;

// ICU puede separar "12:44 PM" con U+202F; se normaliza para comparar.
const norm = (s) => s.replace(/\s+/g, ' ');

describe('formatRelative (Intl.RelativeTimeFormat, estilo corto)', () => {
  const base = new Date(2026, 9, 15, 14, 0, 0);
  const rel = (secAgo, lang) =>
    norm(lib.formatRelative(new Date(base.getTime() - secAgo * 1000), base, lang));

  it.each([
    [0, 'ahora', 'now'],
    [30, 'hace 30 s', '30 sec. ago'],
    [5 * 60, 'hace 5 min', '5 min. ago'],
    [3 * 3600, 'hace 3 h', '3 hr. ago'],
    [24 * 3600, 'ayer', 'yesterday'],
    [3 * 24 * 3600, 'hace 3 d', '3 days ago'],
    [14 * 24 * 3600, 'hace 2 sem.', '2 wk. ago'],
    [60 * 24 * 3600, 'hace 2 m', '2 mo. ago'],
    [800 * 24 * 3600, 'hace 2 a', '2 yr. ago'],
  ])('%i s atrás → es "%s" / en "%s"', (sec, es, en) => {
    expect(rel(sec, 'es')).toBe(es);
    expect(rel(sec, 'en')).toBe(en);
  });

  it('un instante futuro (reloj desajustado) es "ahora", nunca negativo', () => {
    expect(rel(-5, 'es')).toBe('ahora');
  });
});

describe('formatLastPlayed', () => {
  const now = new Date(2026, 9, 15, 14, 0);
  const iso = new Date(2026, 9, 15, 12, 44).toISOString();
  const fmt = (lang) => norm(lib.formatLastPlayed(iso, now, lang));

  it('es-ES: DD/MM/AAAA 24 h', () =>
    expect(fmt('es-ES')).toBe('Última escucha: 15/10/2026, 12:44 (hace 1 h)'));
  it('en-US: MM/DD/AAAA 12 h', () =>
    expect(fmt('en-US')).toBe('Last listened: 10/15/2026, 12:44 PM (1 hr. ago)'));
  it('en-GB conserva la región: DD/MM/AAAA 24 h', () =>
    expect(fmt('en-GB')).toBe('Last listened: 15/10/2026, 12:44 (1 hr ago)'));
  it('de: formato alemán', () =>
    expect(fmt('de')).toBe('Zuletzt gehört: 15.10.2026, 12:44 (vor 1 Std.)'));
  it('idioma sin texto propio (ja) cae entero a inglés, sin mezclar', () =>
    expect(fmt('ja')).toBe(fmt('en')));
  it('etiqueta mal formada o ausente cae a inglés', () => {
    expect(fmt('es_ES')).toBe(fmt('en'));
    expect(fmt(undefined)).toBe(fmt('en'));
  });
});

describe('detectLang', () => {
  const docWith = (lang) => ({ documentElement: { lang } });

  it('prioriza el idioma de la página sobre el del navegador', () =>
    expect(lib.detectLang(docWith('en'), { language: 'es-ES' })).toBe('en'));
  it('si la página no declara idioma, usa el del navegador', () =>
    expect(lib.detectLang(docWith(''), { language: 'es-ES' })).toBe('es-ES'));
  it('si la página está en un idioma sin texto propio, prueba el navegador', () =>
    expect(lib.detectLang(docWith('ja'), { language: 'de-DE' })).toBe('de-DE'));
  it('sin ningún idioma soportado, inglés', () =>
    expect(lib.detectLang(docWith('ja'), { language: 'ko' })).toBe('en'));
});
